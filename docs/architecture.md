# Architecture — Integração Bidirecional Tiny ↔ CRM

**Agente:** Architect Agent
**Data:** Abril 2026
**Baseado em:** Project Brief aprovado
**Status:** ⏳ Aguardando aprovação

---

## 1. Visão Técnica

Sistema de integração **event-driven assíncrono** entre Tiny V3 e o CRM ADDS (Next.js 15 + Supabase). Webhook como gatilho primário, polling de segurança como fallback, fila de processamento em background, feedback visual no UI.

**Princípios invioláveis:**
1. **Idempotência** — processar o mesmo evento N vezes produz o mesmo resultado
2. **Resiliência** — falha temporária não perde dado (retry com backoff)
3. **Observabilidade** — todo evento é logado com status final
4. **Tiny como fonte da verdade** — conflitos resolvem a favor do Tiny (exceto campos explicitamente protegidos)

---

## 2. Arquitetura em Camadas

```
┌────────────────────────────────────────────────────────────────┐
│                         TINY ERP (V3)                           │
│  Evento: pedido criado/alterado/enviado/NF autorizada           │
└───────────────────┬────────────────────────────────────────────┘
                    │ POST (webhook)
                    ▼
┌────────────────────────────────────────────────────────────────┐
│  NEXT.JS — POST /api/tiny/webhook                               │
│  1. Valida origem (IP whitelist OU token secreto)               │
│  2. Loga payload BRUTO em tiny_webhook_events                   │
│  3. Extrai pedidoId                                             │
│  4. Enfileira job em tiny_sync_queue                            │
│  5. Responde 200 em < 500ms                                     │
└───────────────────┬────────────────────────────────────────────┘
                    │
                    ▼
┌────────────────────────────────────────────────────────────────┐
│  WORKER (Vercel Cron a cada 1min + on-demand)                   │
│  Processa tiny_sync_queue FIFO:                                 │
│  1. GET /pedidos/{id}                                           │
│  2. GET /pedidos/{id}/marcadores                                │
│  3. Avalia critérios de personalizado                           │
│  4. Se NÃO personalizado → marca "ignorado" e remove da fila    │
│  5. Se SIM → upsert em orders (+ order_items)                   │
│  6. Gera notification + atualiza tiny_sync_log                  │
└───────────────────┬────────────────────────────────────────────┘
                    │
                    ▼
┌────────────────────────────────────────────────────────────────┐
│  SUPABASE (Postgres + Realtime)                                 │
│  orders (+ tiny_order_id, tiny_last_sync_at, tiny_sync_status)  │
└───────────────────┬────────────────────────────────────────────┘
                    │ Realtime (opcional) OU refetch via TanStack
                    ▼
┌────────────────────────────────────────────────────────────────┐
│  CRM UI (Kanban)                                                │
│  - Card em AUTOMATICO com badge "📱 Tiny"                        │
│  - Badge "💰 PAGO" quando situação = Aprovada                    │
│  - Ícone 📦 rastreio no card + seção dedicada no detalhe         │
│  - Ícone status de sync (✅ 🟡 ❌) com tooltip                   │
└────────────────────────────────────────────────────────────────┘

                POLLING DE SEGURANÇA (paralelo)
┌────────────────────────────────────────────────────────────────┐
│  Vercel Cron a cada 30min                                       │
│  GET /pedidos?dataAtualizacao={last_poll}&limit=100             │
│  Para cada ID: enfileira em tiny_sync_queue (idempotente)       │
└────────────────────────────────────────────────────────────────┘
```

---

## 3. Modelo de Dados

### 3.1 Novas tabelas

#### `tiny_webhook_events` — Log bruto
Captura TUDO que chega do Tiny. Usado para auditoria, debug e resolução do payload (Fase 0).

| Campo | Tipo | Null | Descrição |
|---|---|---|---|
| id | UUID | NOT NULL | PK — gen_random_uuid() |
| received_at | TIMESTAMPTZ | NOT NULL | Hora de chegada |
| source_ip | TEXT | NULL | IP da request (validação) |
| headers | JSONB | NULL | Headers da request |
| payload | JSONB | NOT NULL | Body bruto recebido |
| event_type | TEXT | NULL | Extraído do payload (venda/pedido_enviado/nf) |
| tiny_order_id | BIGINT | NULL | Extraído do payload |
| processed | BOOLEAN | NOT NULL DEFAULT false | Se gerou job na queue |
| processed_at | TIMESTAMPTZ | NULL | Quando processou |

**Índices:** received_at DESC; tiny_order_id; (processed, received_at)

---

#### `tiny_sync_queue` — Fila de processamento
Cada item representa "preciso buscar esse pedido no Tiny e sincronizar".

| Campo | Tipo | Null | Descrição |
|---|---|---|---|
| id | UUID | NOT NULL | PK |
| tiny_order_id | BIGINT | NOT NULL | ID no Tiny |
| trigger | TEXT | NOT NULL | webhook/polling/manual |
| webhook_event_id | UUID | NULL | FK → tiny_webhook_events.id |
| status | TEXT | NOT NULL DEFAULT 'pending' | pending/processing/done/error/ignored |
| attempts | INTEGER | NOT NULL DEFAULT 0 | Tentativas |
| last_error | TEXT | NULL | Último erro |
| created_at | TIMESTAMPTZ | NOT NULL DEFAULT now() | - |
| processed_at | TIMESTAMPTZ | NULL | Quando terminou |

**Constraint:** UNIQUE (tiny_order_id, status) WHERE status IN ('pending', 'processing') — garante idempotência (um mesmo pedido nunca tem 2 jobs ativos)

**Índices:** (status, created_at); tiny_order_id

---

#### `tiny_sync_log` — Log de resultado por pedido
Um registro por sincronização bem-sucedida. Aparece no dashboard de integração.

| Campo | Tipo | Null | Descrição |
|---|---|---|---|
| id | UUID | NOT NULL | PK |
| tiny_order_id | BIGINT | NOT NULL | - |
| order_id | UUID | NULL | FK → orders.id (null se ignorado) |
| sync_type | TEXT | NOT NULL | created/updated/paid/shipped/tracking |
| action | TEXT | NOT NULL | imported/updated/ignored/error |
| changes | JSONB | NULL | Diff do que mudou |
| synced_at | TIMESTAMPTZ | NOT NULL DEFAULT now() | - |

**Índices:** synced_at DESC; tiny_order_id; order_id

---

### 3.2 Alterações em `orders` (tabela existente)

Colunas a adicionar:

| Campo | Tipo | Null | Descrição |
|---|---|---|---|
| tiny_order_id | BIGINT | NULL | UNIQUE — ID do pedido no Tiny |
| tiny_last_sync_at | TIMESTAMPTZ | NULL | Última sync bem-sucedida |
| tiny_sync_status | TEXT | NULL | synced/pending/error/unlinked |
| tiny_situacao | INTEGER | NULL | Enum Tiny (Aberta/Aprovada/...) |
| tiny_deposito | TEXT | NULL | Nome do depósito |
| paid_at | TIMESTAMPTZ | NULL | Data do pagamento (situação=Aprovada) |
| tracking_code | TEXT | NULL | Código de rastreio |
| tracking_url | TEXT | NULL | URL de rastreio |
| tracking_carrier | TEXT | NULL | Transportadora |
| shipped_at | TIMESTAMPTZ | NULL | Data de envio (situação=Enviada) |

**Constraint:** UNIQUE (tiny_order_id) WHERE tiny_order_id IS NOT NULL

**Índice:** tiny_order_id; (tiny_sync_status, tiny_last_sync_at)

**Coluna existente reutilizada:** `origin` (já existe, usar valor `'TINY_WEBHOOK'`)

---

### 3.3 Campos PROTEGIDOS (nunca sobrescritos pelo Tiny)

Durante sync/update, Tiny NUNCA sobrescreve:
- `notes` (observações internas)
- `personalization_data` (dados de personalização editáveis pela equipe)
- `is_personalized` (marcação manual)
- `discount_pending_approval`, `discount_approved_by`, `discount_approved_at`
- `status` (etapa do Kanban — humano decide, exceto no `upsert inicial` onde cria como AUTOMATICO)
- `rep_id` (representante vinculado)

**Regra:** sync inicial popula TUDO. Syncs subsequentes só atualizam campos Tiny-nativos (valores, situação, rastreio, pagamento, itens).

---

## 4. Fluxos Detalhados

### 4.1 Fluxo A — Webhook de pedido criado/alterado

```
1. Tiny → POST /api/tiny/webhook
   Body: { evento, idPedido, ... } (FORMATO A DESCOBRIR NA FASE 0)

2. Handler:
   a. Valida IP de origem OU token no header (403 se inválido)
   b. INSERT em tiny_webhook_events (payload bruto)
   c. Extrai tiny_order_id do payload
   d. INSERT em tiny_sync_queue (status=pending)
      - Se já existe pending pra esse order: ignora (idempotência)
   e. Responde 200 OK em < 500ms
   f. Dispara worker via fetch interno (ou deixa cron pegar)

3. Worker (processQueueItem):
   a. SELECT item pending mais antigo FOR UPDATE SKIP LOCKED
   b. UPDATE status=processing, attempts+=1
   c. tinyApiGet(`/pedidos/${tiny_order_id}`) → dados completos
   d. tinyApiGet(`/pedidos/${tiny_order_id}/marcadores`) → tags
   e. Para cada item do pedido: checar categoria do produto (cache em memória por 5min)
   f. Avalia isPersonalizado(pedido, marcadores, produtos):
      - deposito.nome contém "Personaliz" OU
      - marcadores contém "personalizadas" OU
      - algum produto tem categoria "Venda Dentistas Personalizadas"
   g. Se NÃO personalizado:
      - UPDATE status=ignored, INSERT em tiny_sync_log (action=ignored)
      - RETURN
   h. Se SIM personalizado:
      - Busca existing order WHERE tiny_order_id = X
      - Se existe: UPDATE (respeitando campos protegidos)
      - Se não existe: checkDuplicateByCNPJ(pedido) 
        - Se match: gera notification "possível duplicata, confirmar vínculo"
        - Se não match: INSERT novo order em status=AUTOMATICO
      - UPSERT order_items
      - Popula: tracking_code, paid_at (se situação=Aprovada), etc
      - UPDATE tiny_sync_queue status=done
      - INSERT tiny_sync_log (action=imported ou updated)

4. Error handling:
   - Falha transitória (rate limit, 5xx Tiny): UPDATE status=pending (retry em 1min, depois 2, 4, 8, 16min — máx 5 tentativas)
   - Falha permanente (pedido não existe, 404): UPDATE status=error, log razão
   - Timeout: worker tem 25s max (Vercel edge), se não terminou, deixa pending pro próximo tick
```

### 4.2 Fluxo B — Polling de segurança

```
Vercel Cron: 0 */30 * * * *  (a cada 30min)

1. SELECT MAX(tiny_last_sync_at) FROM orders WHERE tiny_order_id IS NOT NULL
   (ou last_poll_at de tabela de config)
2. tinyApiGet(`/pedidos?dataAtualizacao=${last_poll}&limit=100`)
3. Para cada pedido retornado:
   - INSERT em tiny_sync_queue (trigger=polling)
   - Dedup: ignora se já tem job pending/processing pra esse ID
4. UPDATE config last_poll_at = now()
5. Worker processa normalmente
```

### 4.3 Fluxo C — Vínculo manual

#### C.1 Na criação de pedido manual (formulário existente)
```
Form de criar pedido → campo opcional "Nº do pedido no Tiny"
- Se preenchido: ao salvar, dispara INSERT em tiny_sync_queue (trigger=manual)
- Worker processa → busca no Tiny → enriquece o pedido criado
- Se pedido não existe no Tiny: volta erro amigável "Pedido {X} não encontrado no Tiny"
```

#### C.2 No card existente (botão "Vincular ao Tiny")
```
Card sem tiny_order_id → menu "..." → "Vincular ao Tiny"
Modal:
- Input: "Número do pedido no Tiny"
- Botão "Buscar"
- Preview com dados do pedido encontrado (cliente, valor, itens)
- Aviso se CNPJ não bate: "⚠️ CNPJ do pedido no Tiny ({X}) diferente do CNPJ deste card ({Y}). Confirmar?"
- Botão "Vincular" → UPDATE orders SET tiny_order_id=X, dispara sync
```

### 4.4 Fluxo D — Detecção de duplicata

```
Webhook importa pedido Y do Tiny:
1. SELECT orders WHERE tiny_order_id = Y → se existe, é update (caso já processado)
2. Extrai CNPJ do cliente do pedido Tiny
3. SELECT orders WHERE tiny_order_id IS NULL 
   AND client.document = CNPJ 
   AND created_at > NOW() - INTERVAL '7 days'
4. Se encontra candidato:
   - NÃO cria novo card automaticamente
   - INSERT em notifications (tipo=duplicate_match) 
     - "Pedido #X do Tiny pode ser o card '{nome cliente}' já existente. Vincular?"
   - Exibe no UI: Badge vermelho no dashboard de integração
   - Card fica pendente em tabela tiny_pending_matches
5. Humano abre notificação → Modal com 2 opções: "Vincular" ou "Criar novo card"
```

---

## 5. Endpoints da Aplicação

### 5.1 Webhook receiver
`POST /api/tiny/webhook` — público, valida origem

### 5.2 Worker
`POST /api/tiny/worker/process-queue` — processa próximo item da fila
- Protegido por `X-Worker-Secret` header
- Chamado por Vercel Cron + fetch interno pós-webhook

### 5.3 Polling
`POST /api/tiny/worker/poll-orders` — polling de segurança
- Protegido por `X-Worker-Secret`
- Vercel Cron: a cada 30min

### 5.4 Vínculo manual
`POST /api/tiny/link-order` — body: `{ order_id, tiny_order_id }`
- Verifica se CNPJ bate, retorna warning se não
- Se confirmado: UPDATE + enfileira sync

`GET /api/tiny/order-preview?id={tiny_id}` — preview antes de vincular
- Retorna dados resumidos pra confirmação

### 5.5 Dashboard de integração
`GET /api/tiny/sync-status` — KPIs (eventos recebidos, processados, erros)
`GET /api/tiny/webhook-events?limit=50` — lista paginada dos últimos eventos

---

## 6. Segurança

### 6.1 Autenticação do webhook
Tiny não suporta HMAC nativo documentado. Duas camadas:

**Camada 1 — IP whitelist:**
- Descobrir IPs que o Tiny usa (capturar na Fase 0)
- Variável ENV: `TINY_WEBHOOK_ALLOWED_IPS=1.2.3.4,5.6.7.8`
- Handler valida `x-forwarded-for` contra lista

**Camada 2 — URL secreta:**
- Configurar webhook no Tiny como `https://crm.../api/tiny/webhook/{secret-token}`
- Handler valida token da URL contra ENV `TINY_WEBHOOK_SECRET`
- Se alguém descobrir IPs válidos mas não o token, request é rejeitada

### 6.2 Autenticação dos workers
- Header `X-Worker-Secret: ${WORKER_SECRET_TOKEN}` (ENV)
- Handler rejeita qualquer request sem ele

### 6.3 RLS das novas tabelas
- `tiny_webhook_events`: só MASTER lê (sensível)
- `tiny_sync_queue`: só MASTER lê
- `tiny_sync_log`: MASTER + GESTOR leem
- Todas bloqueadas para INSERT/UPDATE/DELETE via client — só backend (service role) escreve

### 6.4 Vínculo manual
- Só MASTER e GESTOR podem chamar `/api/tiny/link-order`
- PRESTADOR não vê o botão "Vincular" no UI

---

## 7. Fase 0 — Descoberta do Payload (Obrigatória)

**Duração:** 1-3 dias (depende do volume de pedidos)

1. Criar migration mínima: `tiny_webhook_events` apenas
2. Criar endpoint `POST /api/tiny/webhook/[secret]` minimalista:
   ```typescript
   export async function POST(req, { params }) {
     if (params.secret !== process.env.TINY_WEBHOOK_SECRET) {
       return new Response('forbidden', { status: 403 })
     }
     const body = await req.text()
     const headers = Object.fromEntries(req.headers)
     const ip = req.headers.get('x-forwarded-for')
     await supabase.from('tiny_webhook_events').insert({
       payload: JSON.parse(body),
       headers,
       source_ip: ip
     })
     return new Response('ok', { status: 200 })
   }
   ```
3. Configurar no painel do Tiny: URLs de webhook apontando pro endpoint
4. Aguardar eventos reais (vendas, envios, NFs)
5. Analisar registros em `tiny_webhook_events`:
   - Quais campos vêm?
   - Qual o identificador do pedido? (`idPedido`? `id`? `numero`?)
   - Qual discriminador do tipo de evento?
6. Documentar o payload real em `docs/tiny-webhook-payload.md`
7. SÓ DEPOIS implementar as stories do worker

---

## 8. Decisões Técnicas

### D1: Por que fila em banco e não Redis/BullMQ?
- Vercel não tem Redis nativo, precisaria Upstash (custo extra)
- Volume esperado: ~100-500 webhooks/dia — Postgres aguenta tranquilo
- Vantagem: query de observabilidade ("o que está pending?") é SQL direto
- FOR UPDATE SKIP LOCKED garante atomicidade em concorrência

### D2: Por que não usar Supabase Edge Functions?
- Stack atual é Next.js API Routes — manter consistência
- Edge Functions têm cold start + limite de 10s (worker pode precisar de 20s+)
- API Route do Next.js em Vercel Serverless: 60s de timeout no plano Pro

### D3: Vercel Cron vs Supabase pg_cron
- **Worker processor** → Vercel Cron (chama endpoint HTTP, fácil de debugar/logar)
- **Polling de segurança** → Vercel Cron também (mesma razão)
- pg_cron só se virar gargalo de custo

### D4: Por que cache in-memory de produtos (não Redis)?
- Categoria de produto muda raramente
- Cache simples Map<produto_id, categoria> com TTL de 5min
- Se serverless instância morrer, reconstrói — baixo custo

### D5: Idempotência via UNIQUE constraint, não via lock distribuído
- `UNIQUE (tiny_order_id) WHERE tiny_order_id NOT NULL` em orders
- `UNIQUE (tiny_order_id, status) WHERE status IN ('pending','processing')` em queue
- Simples, barato, confiável

---

## 9. Trade-offs Documentados

| Trade-off | Escolha | O que perdemos | O que ganhamos |
|---|---|---|---|
| Fila em banco vs Redis | Banco | Latência levemente maior | Simplicidade, zero infra extra |
| Webhook-first vs polling-only | Webhook + polling | Complexidade de dois caminhos | Latência de segundos (vs 30min) |
| Tiny = fonte da verdade | Sempre sobrescreve | Edição manual do CRM pode ser perdida | Consistência garantida |
| Status inicial AUTOMATICO sempre | Uniforme | Não aproveita status Tiny | Humano triagem, zero surpresa |
| Duplicata por CNPJ (não auto-merge) | Humano decide | Requer ação manual | Zero merge errado silencioso |

---

## 10. Riscos Técnicos

| Risco | Probabilidade | Impacto | Mitigação |
|---|---|---|---|
| Payload webhook diferente do esperado | ALTA | CRÍTICO | Fase 0 obrigatória |
| Volume de webhooks estourar cron | BAIXA | MÉDIO | Worker escalonável + polling compensa |
| Rate limit Tiny bater no polling | MÉDIA | BAIXO | Respeitar X-RateLimit-Remaining, backoff |
| Tiny ficar offline (API down) | BAIXA | ALTO | Fila acumula, processa quando voltar (TTL 24h) |
| Webhook do Tiny não chegar (perda) | MÉDIA | MÉDIO | Polling a cada 30min captura o que faltou |
| Token OAuth do Tiny expirar | BAIXA | ALTO | Código já tem refresh automático (tinyApiGet) |

---

## 11. Estrutura de Arquivos

```
src/
├── app/
│   └── api/
│       └── tiny/
│           ├── webhook/
│           │   └── [secret]/
│           │       └── route.ts           # Handler do webhook
│           ├── worker/
│           │   ├── process-queue/
│           │   │   └── route.ts           # Worker principal
│           │   └── poll-orders/
│           │       └── route.ts           # Polling de segurança
│           ├── link-order/
│           │   └── route.ts               # Vínculo manual
│           ├── order-preview/
│           │   └── route.ts               # Preview antes de vincular
│           └── sync-status/
│               └── route.ts               # Dashboard KPIs
│
├── lib/
│   └── tiny/
│       ├── webhook-validator.ts           # Valida origem
│       ├── order-matcher.ts               # isPersonalizado() + detecta duplicata
│       ├── order-importer.ts              # Upsert order + items
│       ├── products-cache.ts              # Cache in-memory categorias
│       └── constants.ts                   # Enum situações, etc
│
├── services/
│   └── tiny-integration.service.ts        # Funções de UI (preview, link)
│
├── components/
│   ├── pipeline/
│   │   ├── kanban-card-tiny-badges.tsx    # Badges PAGO, Tiny, rastreio
│   │   └── link-to-tiny-dialog.tsx        # Modal de vínculo manual
│   ├── orders/
│   │   └── tracking-section.tsx           # Seção rastreio no detalhe
│   └── settings/
│       └── tiny-integration-dashboard.tsx # Logs + KPIs
│
└── app/(dashboard)/settings/
    └── integracoes/
        └── tiny/
            └── page.tsx                   # Dashboard da integração
```

---

## Aprovação

Este documento de Arquitetura precisa de aprovação antes de seguir para Stories.

**Status:** ⏳ Aguardando aprovação do Kairam
