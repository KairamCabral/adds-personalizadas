# Project Brief — Integração Bidirecional Tiny ↔ CRM (Pedidos Personalizados)

**Agente:** Analyst Agent
**Data:** Abril 2026
**Stakeholder:** Kairam Cabral (ADDS Brasil)
**Status:** ⏳ Aguardando aprovação

---

## 1. O Problema

A ADDS Brasil recebe pedidos de escovas personalizadas via múltiplos canais (site, marketplace, vendas diretas), todos desaguando no Tiny ERP. Hoje, esses pedidos precisam ser **transcritos manualmente** no CRM para entrar no pipeline de produção (Kanban). Isso gera:

**Consequências atuais:**
- Pedidos personalizados do Tiny ficam "invisíveis" pro time de produção até alguém lembrar de criar o card
- Transcrição manual = atraso + erros de digitação (quantidade, cor, personalização)
- Impossível saber se um pedido já tem card ou não (risco de duplicata)
- Quando cliente paga ou envia, a equipe não tem visibilidade automática — precisa entrar no Tiny pra conferir
- Código de rastreio fica perdido no Tiny, equipe não consegue comunicar facilmente ao cliente
- Pedidos do app dos representantes já têm integração, mas pedidos externos (site, marketplace) não

**O problema real:** O CRM é o cérebro da operação de produção, mas não tem conexão automática com o Tiny, que é o cérebro da operação comercial. Os dois vivem em silos.

---

## 2. Usuários

### Usuário Primário: Equipe de Produção (PRESTADOR + GESTOR)
- Trabalha no Kanban diariamente, movendo cards entre etapas
- Precisa saber: o que chegou de novo, o que foi pago, o que foi enviado
- Hoje: fica entrando no Tiny pra conferir se pedido foi pago
- Dor principal: "perdi dois dias produzindo um pedido que o cliente nem pagou"

### Usuário Secundário: Gestor Comercial (MASTER)
- Precisa ver o "big picture" — quantos pedidos automáticos vieram hoje, status geral
- Precisa poder vincular manualmente quando houver dúvida (evitar duplicata)
- Hoje: não tem visibilidade sobre a integração, se está funcionando ou não

### Usuário Fora do Escopo: Fornecedor (PRESTADOR externo)
- NÃO pode vincular pedidos manualmente (risco de erro/conflito)
- Só vê cards depois que entram no pipeline

---

## 3. Decisões Tomadas (Validadas pelo Stakeholder)

| Decisão | Escolha | Justificativa |
|---|---|---|
| **Detecção de personalizado** | OU lógico entre depósito "SP - WS Serviços - Personaliz.", tag "personalizadas", categoria "Venda Dentistas Personalizadas" | Redundância garante zero pedido personalizado esquecido. Se UM critério bater, entra. |
| **Frequência de sync** | Webhook em tempo real (Tiny suporta) + polling de segurança a cada 30min | Webhook = imediato. Polling = rede de segurança se webhook falhar. |
| **Status inicial no CRM** | Sempre `AUTOMATICO` (independente do status Tiny) | Humano triagem antes de mover pro fluxo. Evita cards direto em "Aprovado" sem revisão. |
| **Vínculo manual** | Botão no card (depois) + campo na criação (antes) | Flexibilidade total — vincula como/quando preferir. |
| **Pedido PAGO** | Badge "PAGO" no card + log da data | Não mexer no Kanban (humano decide quando avançar). Badge dá visibilidade sem bagunçar fluxo. |
| **Rastreio** | Ícone no card (visual rápido) + seção no detalhe (botão copiar + link) | Visibilidade imediata no Kanban + ação no detalhe. |
| **Detecção de duplicata** | Match por CNPJ/CPF → pergunta antes de vincular | Evita vínculo errado silencioso. Humano confirma. |
| **Feedback de sync** | Ícone status no card + log completo em /settings | Rastreabilidade total. Debug rápido se algo falhar. |
| **Conflito de edição** | Tiny = fonte da verdade, sobrescreve | Tiny é sistema transacional (NF, pagamento, estoque). CRM é operacional. |
| **Definição de PAGO no Tiny** | Situação = "Aprovada" | Validado pelo stakeholder para o fluxo ADDS. |
| **Escopo de importação** | Apenas pedidos personalizados | Pedidos "normais" do Tiny não vão pro Kanban (tem outro fluxo). |

---

## 4. Restrições Críticas

### 4.1 Webhook do Tiny: payload não documentado
A API V3 confirma que webhooks existem ("vendas criadas/alteradas", "pedido enviado", "NF autorizada"), mas **o formato do JSON recebido não está na documentação pública**. Isso significa:

- **Fase 0 obrigatória:** capturar o payload real antes de qualquer implementação
- Estratégia: criar endpoint "sniffer" que loga o body bruto em tabela dedicada por 24-48h, configurar webhook no painel Tiny apontando pra esse endpoint, analisar os registros capturados
- Sem isso, qualquer mapeamento é chute e vai quebrar em produção

### 4.2 Webhooks são globais, não por aplicativo
A doc confirma: "não é possível criar webhooks específicos por aplicativo". Isso significa:
- Endpoint de webhook precisa ser **idempotente** (receber o mesmo evento 2x não duplica)
- Precisa filtrar no backend (não no Tiny): nem todo pedido que chegar é personalizado

### 4.3 Dados fragmentados em múltiplos endpoints
Para saber tudo sobre um pedido personalizado, precisa chamar:
- `GET /pedidos/{id}` → situação, depósito, transportador, parcelas
- `GET /pedidos/{id}/marcadores` → tags/marcadores
- `GET /produtos/{id}` (para cada item) → categoria do produto

Se fizer tudo síncrono no webhook, vai estourar timeout. Solução: **fila assíncrona** (enfileirar o ID, processar em background).

### 4.4 Rate limit da API
Headers padrão (`X-RateLimit-Remaining`). Precisamos respeitar — especialmente no polling de segurança. Backoff exponencial + respeitar header.

### 4.5 Tiny é fonte da verdade, mas CRM tem dados próprios
Campos do CRM que NÃO devem ser sobrescritos pelo Tiny:
- `notes` (observações internas da equipe)
- `personalization_data` (pode ser editado pela equipe)
- `is_personalized` (marcação interna)
- Descontos aprovados/rejeitados manualmente

Tiny sobrescreve: status de pagamento, rastreio, valores, itens (se mudarem).

---

## 5. Oportunidades

### 5.1 Eliminar trabalho manual repetitivo
Hoje alguém transcreve pedidos. Isso deixa de existir. Tempo economizado pode ir pra produção real.

### 5.2 Visibilidade em tempo real
Pedido entra no CRM no mesmo segundo que entra no Tiny. Equipe de produção vê o fluxo real sem ficar caçando no Tiny.

### 5.3 Proteção contra "produzir sem pagamento"
Badge PAGO dá sinal visual óbvio. Elimina o risco de produzir pedido em aberto.

### 5.4 Rastreio integrado
Equipe de atendimento passa a ter o código de rastreio direto no CRM, sem precisar acessar o Tiny.

### 5.5 Base para automações futuras
Com dados sincronizados, dá pra construir:
- Notificação automática ao cliente quando paga ("seu pedido entrou em produção!")
- Dashboard de conversão (pedidos criados vs pedidos pagos)
- SLA de produção por tipo de pedido

---

## 6. Riscos Identificados

| Risco | Probabilidade | Impacto | Mitigação |
|---|---|---|---|
| Payload do webhook ter formato inesperado | ALTA | ALTO | Fase 0 obrigatória — capturar antes de implementar |
| Webhook cair em pico de pedidos | MÉDIA | ALTO | Fila assíncrona + polling de segurança a cada 30min |
| Duplicar pedidos (mesmo pedido virando 2 cards) | MÉDIA | ALTO | UNIQUE constraint em `tiny_order_id` + match por CNPJ |
| Rate limit do Tiny estourar | BAIXA | MÉDIO | Respeitar headers + backoff + job em fila com throttling |
| Tiny sobrescrever dado importante do CRM | MÉDIA | ALTO | Lista explícita de campos "protegidos" (nunca sobrescrever) |
| Webhook assinado mas não autenticado | ALTA | CRÍTICO | Validar origem (IP whitelist ou token secreto no header) |
| Equipe vincular pedido errado manualmente | BAIXA | MÉDIO | Confirmação com preview dos dados antes de vincular |

---

## 7. Métricas de Sucesso

### Lançamento (30 dias pós-deploy)
- **0** pedidos personalizados do Tiny ficaram sem card no CRM
- **< 2 minutos** entre pedido criado no Tiny e card visível no Kanban
- **0** duplicatas (mesmo pedido virando 2 cards)
- **100%** dos pedidos pagos mostram badge PAGO em < 5 minutos
- **100%** dos pedidos com rastreio mostram o código no CRM

### Maturidade (90 dias)
- Equipe de produção **não abre mais o Tiny** pra conferir status
- Tempo médio entre "pedido criado" e "produção iniciada" cai em X% (medir baseline antes)
- Zero reclamação de "produzi sem pagamento" ou "perdi o rastreio"

---

## 8. Fora do Escopo

- Criação de pedidos no Tiny A PARTIR do CRM (fluxo já existe para app representante, não será alterado)
- Sincronização de clientes (já existe fluxo, não mexer)
- Sincronização de produtos/estoque (já existe, não mexer)
- Importação de pedidos históricos (só novos a partir do deploy)
- Pedidos NÃO personalizados do Tiny (ficam ignorados)
- Gestão de NF-e no CRM (continua no Tiny)
- Relatórios financeiros de pagamento (continua no Tiny)

---

## 9. Premissa Arquitetural

> **"Webhook dispara, fila processa, banco persiste, UI reage."**

Nunca fazer trabalho pesado no handler do webhook. Sempre:
1. Receber payload → validar origem → enfileirar → responder HTTP 200 em < 500ms
2. Worker processa em background (enriquece dados, faz matching, persiste)
3. UI consome o banco (sem chamadas diretas ao Tiny no frontend)

Isso garante: idempotência, resiliência, escalabilidade e debug fácil.

---

## Aprovação

Este Project Brief precisa de aprovação antes de seguir para o documento de Arquitetura.

**Status:** ⏳ Aguardando aprovação do Kairam
