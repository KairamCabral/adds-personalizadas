---
stepsCompleted: ['step-01-validate-prerequisites', 'step-02-design-epics', 'step-03-create-stories', 'step-04-final-validation']
inputDocuments:
  - _bmad-output/planning-artifacts/prd.md
  - conversa: estudo técnico de Fase 1 (schema real via MCP addscrm, RPCs, fila-molde nps_dispatches, rotas públicas, roles/RLS)
  - docs/architecture.md (referência de padrões do repo — não específico deste módulo)
module: 'congressos'
---

# Congressos: Pré-Cadastro + Controle de Brindes + Cashback - Epic Breakdown

## Overview

Este documento decompõe os requisitos do PRD (`prd.md`) em épicos e stories implementáveis para o módulo Congressos do ADDS CRM. Não há documento de arquitetura nem de UX dedicados a este módulo — as decisões técnicas/arquiteturais estão embutidas no PRD (Domain Requirements, Web App Requirements, Dependências & Decisões Técnicas) e no estudo de Fase 1. Estimativas relativas: **P** (pequeno), **M** (médio), **G** (grande). Itens **[Fase 2]** são fast-follow (fora do MVP).

## Requirements Inventory

### Functional Requirements

**Gestão de Eventos (Edições)**
- FR1: Um gestor pode criar e editar edições de congresso (nome, slug, local, datas, brinde, estoque do brinde).
- FR2: Um gestor pode ativar/desativar uma edição, controlando se o pré-cadastro público está aberto.
- FR3: Cada edição possui um link/QR público próprio para o estande.
- FR4: Um gestor pode configurar o cashback por edição (habilitar; tipo; valor; condições de resgate por valor/quantidade mínima; elegibilidade; validade).
- FR5: O sistema suporta múltiplas edições simultâneas e independentes (multi-evento).

**Captura Pública (Pré-cadastro)**
- FR6: Um participante acessa a página pública de uma edição via QR/link, sem autenticação.
- FR7: Um participante informa apenas CPF/CNPJ como primeiro passo.
- FR8: O sistema identifica se o participante já é cliente a partir do documento informado.
- FR9: Um participante já cadastrado confirma seus dados em uma única ação para liberar o brinde.
- FR10: Um participante novo completa um cadastro curto (nome, contato, tipo de contato) para liberar o brinde.
- FR11: Um participante registra consentimento LGPD antes de concluir o cadastro.
- FR12: O sistema preserva os dados digitados e reenvia automaticamente em falha de rede, sem duplicar o cadastro.
- FR13: Ao concluir, o participante recebe o comprovante do brinde (QR + código curto) na tela.

**Identidade & Deduplicação**
- FR14: O sistema deduplica participantes por documento normalizado (ignorando formatação).
- FR15: O sistema vincula o pré-cadastro a um cliente existente quando houver correspondência.
- FR16: O sistema classifica o participante por tipo de contato (Dentista / Distribuidora / Outro).

**Brinde & Resgate**
- FR17: Cada pré-cadastro gera um brinde único resgatável (token + código curto).
- FR18: Um operador localiza um participante por nome, documento ou código.
- FR19: Um operador marca o brinde como retirado.
- FR20: O sistema impede retirada em duplicidade e informa quando e por quem já foi retirado.
- FR21: O sistema registra quem entregou e o horário da retirada.
- FR22: O sistema exibe o estoque do brinde por edição de forma informativa (alerta ao zerar), sem bloquear a retirada no MVP; bloqueio rígido é opção configurável por edição na Fase 2.

**Sincronização com Tiny (ERP)**
- FR23: O sistema cria/atualiza o participante qualificado como contato no Tiny com o Tipo de Contato correto, de forma assíncrona.
- FR24: O sistema promove a cliente do CRM apenas participantes qualificados, marcando a origem "congresso".
- FR25: O sistema reprocessa automaticamente falhas transitórias de sincronização (retentativas com espaçamento crescente), sem intervenção manual.
- FR26: O fluxo do participante permanece funcional mesmo com o ERP indisponível.
- FR27: Um gestor visualiza o status/log de sincronização de cada cadastro.

**Confirmações**
- FR28: O sistema envia confirmação por e-mail ao participante após o cadastro.
- FR29: O sistema registra o status de envio de cada confirmação e permite retentativa/reenvio.
- FR30 [Fase 2]: O sistema envia confirmação por WhatsApp.

**Cashback / Crédito**
- FR31: O sistema gera um crédito de cashback no cadastro quando a edição tem cashback ativo e o participante é elegível, congelando (snapshot) as regras vigentes.
- FR32: O sistema garante no máximo um crédito por documento por edição.
- FR33: Um gestor visualiza o crédito e suas condições no perfil do cliente.
- FR34: Um gestor registra o resgate (baixa) manual de um crédito, validando as condições no momento do uso.
- FR35 [Fase 2]: O sistema aplica/resgata o crédito automaticamente em um pedido elegível.

**Controle Interno, Relatórios & Segurança**
- FR36: Um gestor acompanha um dashboard por evento (cadastros, retiradas, taxa de conversão, estoque, saúde da fila).
- FR37: Um gestor exporta a lista qualificada do evento (CSV) com filtros.
- FR38: O acesso às telas/ações internas é restrito por papel — congressos.operate (buscar/retirar) = MASTER/GESTOR/PRESTADOR; congressos.manage (CRUD edição, cashback, dashboard completo, export) = MASTER/GESTOR. Sem role nova.
- FR39: A página pública é protegida contra abuso (limitação de tentativas + verificação anti-bot).
- FR40: O sistema registra o consentimento com versão, data e IP protegido.
- FR41: A superfície pública nunca expõe dados pessoais de terceiros nem identificadores internos.

### NonFunctional Requirements

- NFR-P1: Landing pública com LCP < 2,5s em 3G; JS da ilha cliente < ~60KB gzip.
- NFR-P2: Lookup de CPF p95 < 1s; submit do pré-cadastro p95 < 1s (Tiny nunca no caminho síncrono).
- NFR-P3: Na tela interna, busca de participante < 2s; retirada confirma em < 1s.
- NFR-S1: Escrita pública apenas por rota server-side com service role; chave service-role nunca exposta ao cliente.
- NFR-S2: Captura protegida por Turnstile + rate limit por IP e por CPF; lookup com rate limit contra enumeração.
- NFR-S3: Tokens de brinde imprevisíveis (≥128 bits); leitura pública via RPC SECURITY DEFINER que revela PII só quando o token é acionável.
- NFR-S4: RLS ativa em todas as tabelas novas (get_user_role()); service_role com grant explícito; nenhuma policy aberta a anon.
- NFR-S5: Documento armazenado só em dígitos; IP apenas como HMAC.
- NFR-SC1: Suportar o pico do evento sem degradar submit acima de p95 < 1s (baseline ≥ 300 cadastros/min, a calibrar no teste de carga).
- NFR-SC2: Catch-up da fila respeita ~2 req/s do Tiny sem estourar a API, mesmo com backlog de milhares.
- NFR-SC3: Reprocessamento idempotente (sem duplicar contato/cliente/brinde).
- NFR-R1: Fluxo do participante com zero dependência de disponibilidade do Tiny.
- NFR-R2: Fila durável: nenhum job perdido; retry até 5× com backoff; jobs esgotados marcados como "mortos" e sinalizados.
- NFR-R3: Confirmação (e-mail) com registro de status e retentativa automática.
- NFR-A1: WCAG 2.1 AA no essencial na página pública (contraste, label por campo, foco visível, erros ligados ao campo, alvos ≥ 48px).
- NFR-I1: Integração Tiny via OAuth existente (sem alterar fluxo de token), com throttle, log em tiny_sync_logs e idempotência por documento/tiny_id.
- NFR-I2: E-mail via Resend com templates React Email; envio desacoplado (fila) do cadastro.
- NFR-C1: 100% dos cadastros com consentimento versionado + timestamp + IP (HMAC).
- NFR-C2: PII nunca exposta em superfície pública fora do token acionável; tiny_id nunca exposto.
- NFR-C3: Política de retenção e expurgo por prazo definido (valor = pendência de go-live) e opt-out em comunicações.

### Additional Requirements

Requisitos técnicos derivados do estudo de Fase 1 e das Dependências & Decisões Técnicas do PRD (impactam implementação):

- **AR1 (Migrations + RLS):** Toda tabela nova (`event_editions`, `event_registrations`, `event_gift_redemptions`, `event_credits`, `tiny_contact_sync_jobs`, `event_dispatches`) criada em `supabase/migrations/` **com RLS + policies na mesma migration** (padrão do repo). RLS via `get_user_role()` (MASTER/GESTOR) + `GRANT service_role`.
- **AR2 (Types gerados):** Após migrations, regenerar `src/types/database.types.ts` (`pnpm db:types`) e **re-anexar o rodapé de aliases** (Client/Order/Profile/…) que o projeto importa.
- **AR3 (Fila durável — construir):** Não existe fila/retry no repo; construir sobre o molde `nps_dispatches`, adicionando `attempts` + `next_attempt_at` + `last_error` (que o NPS não tem). Índice parcial por status/próxima tentativa.
- **AR4 (Throttle Tiny — construir):** Não há rate limit para o Tiny; construir throttle (~2 req/s, estilo `src/lib/bling/rate-limiter.ts`) para o catch-up.
- **AR5 (Service de contato Tiny):** Extrair `createOrFindTinyContact` (busca por cpfCnpj → cria com sales_channel) para service interno reusável; **não** chamar a rota pública `/api/tiny/create-contact`.
- **AR6 (RPCs SECURITY DEFINER):** Reusar `find_client_by_document`; criar `validate_gift_token` (molde `validate_nps_token`) e `redeem_gift` (retirada atômica com lock).
- **AR7 (Middleware):** Adicionar a rota pública à allowlist `isPublicRoute` de `src/lib/supabase/middleware.ts`.
- **AR8 (Cron):** Registrar cron de drain em `vercel.json` (1–2 min; viável no plano Pro/Enterprise), guardado por `CRON_SECRET`. `after()` como fast path.
- **AR9 (Dependências):** Adicionar `qrcode` (aprovada). Turnstile (site key + secret nas envs). Scanner de câmera e Upstash **[Fase 2]**.
- **AR10 (Idempotência):** idempotency-key no submit; 1 job por `registration_id`; upsert `clients` `onConflict: tiny_id`.
- **AR11 (Multi-app):** `clients` é lido pelo `adds-rep-app` — só promover qualificados, com marcador de origem "congresso"; validar impacto de RLS.
- **AR12 (Validação `tipos` V3):** validar a forma real do campo `tipos` do Tiny V3 contra resposta real; manter duplo-write (marcador `canal:` + `tipos`) + retry-sem-canal.

### UX Design Requirements

Derivados da seção Web App Requirements e das User Journeys do PRD (não há doc de UX separado):

- UX-DR1: **Landing do evento** (`/congressos/[slug]`) mobile-first no layout `(public)`: logo + nome do congresso + brinde + 1 botão grande "Retirar meu brinde"; alto contraste, alvos ≥ 48px, `noindex`.
- UX-DR2: **Tela 1 — CPF/CNPJ**: um único campo, `inputmode="numeric"`, máscara CPF/CNPJ, botão "Continuar" com estado de loading.
- UX-DR3: **Tela 2a — cliente existente**: saudação com primeiro nome + dados mascarados + confirmação em 1 toque; link discreto "corrigir".
- UX-DR4: **Tela 2b — novo cadastro**: formulário curto (Nome, WhatsApp, E-mail, Tipo via chips Dentista/Distribuidora/Outro) + checkbox de consentimento LGPD com link ao texto; validação inline (zod).
- UX-DR5: **Tela 3 — sucesso**: QR grande (gerado client-side com `qrcode`) + código de 6 dígitos em destaque + aviso "enviamos por e-mail"; cor de sucesso.
- UX-DR6: **Estados de erro/offline**: autosave em `localStorage`; mensagem clara "sem conexão — tentaremos de novo"; retry automático ao reconectar; nunca limpar o formulário.
- UX-DR7: **Página interna Controle de Brindes**: busca por nome/CPF/código (rápida), lista via `DataTable` compartilhado, espelhando o padrão de `contacts/page.tsx`.
- UX-DR8: **Feedback de retirada**: card verde "✅ ENTREGUE" no sucesso; card âmbar "⚠️ JÁ RETIRADO às HH:MM por {usuário}" quando já retirado.
- UX-DR9: **Dashboard do evento**: cards de cadastros, retiradas, taxa de conversão, estoque restante e saúde da fila (jobs pendentes/mortos), com skeletons.
- UX-DR10: **Export CSV** da lista qualificada com filtros (tipo, retirado, consentimento).
- UX-DR11: **Config de Cashback na edição**: toggle "habilitar" + campos condicionais (tipo, valor, condições de resgate, elegibilidade, validade).
- UX-DR12: **Exibição do crédito no perfil do cliente**: valor + condições + validade + status, de forma clara.

### FR Coverage Map

- FR1: Épico 1 — criar/editar edição
- FR2: Épico 1 — ativar/desativar edição
- FR3: Épico 1 — link/QR público por edição
- FR4: Épico 1 — configurar cashback por edição
- FR5: Épico 1 — multi-evento
- FR6: Épico 2 — acesso público via QR/link
- FR7: Épico 2 — passo CPF/CNPJ
- FR8: Épico 2 — identificar cliente existente
- FR9: Épico 2 — confirmação em 1 toque
- FR10: Épico 2 — cadastro curto (novo)
- FR11: Épico 2 — consentimento LGPD
- FR12: Épico 2 — autosave + retry offline sem duplicar
- FR13: Épico 2 — comprovante (QR + código) na tela
- FR14: Épico 2 — dedup por documento normalizado
- FR15: Épico 2 — vínculo a cliente existente
- FR16: Épico 2 — classificação por tipo de contato
- FR17: Épico 2 — geração do brinde único
- FR18: Épico 5 — localizar participante
- FR19: Épico 5 — marcar retirada
- FR20: Épico 5 — impedir duplicidade + informar
- FR21: Épico 5 — registrar quem/quando entregou
- FR22: Épico 5 — estoque informativo (alerta ao zerar, sem bloqueio no MVP)
- FR23: Épico 3 — criar/atualizar contato no Tiny (assíncrono)
- FR24: Épico 3 — promoção seletiva a cliente + marcador de origem
- FR25: Épico 3 — reprocessamento automático (retry)
- FR26: Épico 3 — resiliência à indisponibilidade do ERP
- FR27: Épico 3 — status/log de sincronização
- FR28: Épico 4 — confirmação por e-mail
- FR29: Épico 4 — status de envio + retentativa
- FR30: Épico 4 — confirmação por WhatsApp [Fase 2]
- FR31: Épico 6 — geração de crédito com snapshot
- FR32: Épico 6 — 1 crédito por documento por edição
- FR33: Épico 6 — exibição do crédito no perfil
- FR34: Épico 6 — resgate manual com validação de condições
- FR35: Épico 6 — resgate automatizado [Fase 2]
- FR36: Épico 5 — dashboard do evento
- FR37: Épico 5 — export CSV da lista qualificada
- FR38: Épico 5 — RBAC (operate=MASTER/GESTOR/PRESTADOR; manage=MASTER/GESTOR; base de RLS/permissões no Épico 1)
- FR39: Épico 2 — anti-abuso (rate limit + anti-bot)
- FR40: Épico 2 — registro de consentimento (versão/data/IP)
- FR41: Épico 2 — não expor PII/identificadores na superfície pública

## Epic List

### Epic 1: Fundações & Gestão de Edições (E0 + gestão) — MVP
Um gestor cria, edita, ativa/desativa e configura edições de congresso (incl. cashback), com link/QR próprio. Entrega a base de dados do módulo (migrations de `event_editions`, `event_registrations`, `event_gift_redemptions`, `event_credits`, `tiny_contact_sync_jobs`, `event_dispatches` + enums + RLS + RPCs + permissões `congressos.*` + regen de types) revisada de forma holística pelo impacto no rep-app.
**FRs covered:** FR1, FR2, FR3, FR4, FR5 · **ARs:** AR1, AR2, AR6, AR11

### Epic 2: Pré-Cadastro Público (Captura no Estande) (E1) — MVP
Um participante retira o brinde só com CPF (existente em 1 toque; novo com cadastro curto), com consentimento LGPD, recebe QR+código na tela e nunca perde dados em queda de rede.
**FRs covered:** FR6, FR7, FR8, FR9, FR10, FR11, FR12, FR13, FR14, FR15, FR16, FR17, FR39, FR40, FR41 · **UX-DR:** 1–6 · **ARs:** AR7, AR9, AR10

### Epic 3: Sincronização Assíncrona com Tiny (E2) — MVP
Um participante qualificado vira contato no Tiny com o Tipo correto e cliente no CRM (marcado como "congresso"), de forma resiliente (fila durável + retry + throttle), sem afetar o participante; o gestor vê o status.
**FRs covered:** FR23, FR24, FR25, FR26, FR27 · **ARs:** AR3, AR4, AR5, AR8, AR10, AR11, AR12

### Epic 4: Confirmação ao Participante (E3) — MVP (e-mail)
Um participante recebe confirmação do brinde por e-mail (WhatsApp na Fase 2).
**FRs covered:** FR28, FR29, FR30 [Fase 2] · **ARs:** AR3 (reuso da fila de dispatches)

### Epic 5: Controle de Brindes & Operação de Estande (E4) — MVP
A equipe localiza o participante e entrega o brinde sem duplicidade (com trilha), e o gestor acompanha o dashboard do evento e exporta a lista qualificada.
**FRs covered:** FR18, FR19, FR20, FR21, FR22, FR36, FR37, FR38 · **UX-DR:** 7–10 · **ARs:** AR6

### Epic 6: Cashback / Crédito (E5) — MVP (geração + resgate manual)
Um participante elegível ganha um crédito com snapshot das regras; o gestor vê e dá baixa manual (resgate automatizado na Fase 2).
**FRs covered:** FR31, FR32, FR33, FR34, FR35 [Fase 2] · **UX-DR:** 11–12

### Epic 7: Hardening & Prontidão de Go-Live (E6) — MVP (teste de carga = gate)
Operação confiável no pico: observabilidade da fila (jobs pendentes/mortos, dispatches falhos) e teste de carga antes do evento como gate de go-live.
**FRs covered:** — (cobre NFRs transversais: NFR-SC1/2/3, NFR-R1/2/3, NFR-P1/2) · **ARs:** AR4

---

## Epic 1: Fundações & Gestão de Edições

Um gestor cria, edita, ativa/desativa e configura edições de congresso (incl. cashback), com link/QR próprio prontos. Entrega a base de dados do módulo revisada de forma holística pelo impacto no rep-app (banco compartilhado). **Decisão:** todas as tabelas do módulo são criadas numa migration única e revisada (não espalhar DDL), pela necessidade de revisar RLS/multi-tenant de uma vez.

### Story 1.1: Schema e RLS do módulo (migration única revisada)

As a desenvolvedor,
I want criar todas as tabelas do módulo (`event_editions`, `event_registrations`, `event_gift_redemptions`, `event_credits`, `tiny_contact_sync_jobs`, `event_dispatches`) com enums e RLS na mesma migration,
So that a base de dados exista de forma consistente e o impacto de RLS no rep-app seja revisado de uma só vez.

**Estimativa:** G · **FRs:** base para FR1–FR41 · **ARs:** AR1, AR11

**Acceptance Criteria:**

**Given** o repositório com `supabase/migrations/`
**When** a migration do módulo é aplicada
**Then** existem as tabelas `event_editions`, `event_registrations`, `event_gift_redemptions`, `event_credits`, `tiny_contact_sync_jobs`, `event_dispatches` com enums do módulo (status de job/dispatch/redemption, tipo/elegibilidade de cashback)
**And** cada tabela tem RLS habilitada e policies `get_user_role() IN ('MASTER','GESTOR')` + `GRANT ... TO service_role`, sem nenhuma policy aberta a `anon`
**And** `event_registrations.document` é indexado (não único), com colunas de consentimento (`consent_version`, `consent_at`, `consent_ip_hmac`) e coluna de origem/qualificação

**Given** o banco é compartilhado com o `adds-rep-app`
**When** a migration é revisada antes do merge
**Then** está documentado no PR que nenhuma tabela `rep_*`/`clients`/`orders`/`profiles` teve RLS alterada e que as tabelas novas não são lidas pelo rep-app

**Given** `event_gift_redemptions`
**When** a tabela é criada
**Then** possui `token` (≥128 bits, default por `gen_random_bytes`), `short_code` (6 dígitos), `status` (PENDENTE/RETIRADO/CANCELADO), `redeemed_at`, `redeemed_by` e `registration_id` único

### Story 1.2: Permissões, types e helpers de RPC

As a desenvolvedor,
I want registrar as permissões `congressos.*`, regenerar os types e criar os RPCs base,
So that o restante do módulo tenha permissão, tipos e funções seguras disponíveis.

**Estimativa:** M · **FRs:** FR38 (base) · **ARs:** AR2, AR6

**Acceptance Criteria:**

**Given** a matriz de permissões em `src/lib/permissions.ts`
**When** as permissões do módulo são adicionadas
**Then** existem `congressos.manage` (MASTER/GESTOR) e `congressos.operate` (MASTER/GESTOR/PRESTADOR) e `hasPermission` as reconhece

**Given** as migrations aplicadas
**When** `pnpm db:types` é executado
**Then** `src/types/database.types.ts` reflete as novas tabelas **e** o rodapé de aliases (Client/Order/Profile/…) é re-anexado

**Given** os RPCs do módulo
**When** criados como `SECURITY DEFINER`
**Then** existe `validate_gift_token(token)` (revela dados do brinde só quando o token é acionável, no molde de `validate_nps_token`) e `redeem_gift(token, operator)` (baixa atômica), ambos com `search_path` fixo
**And** `find_client_by_document` é reusado (não recriado)

### Story 1.3: CRUD de edições de congresso

As a gestor,
I want criar, editar e ativar/desativar edições de congresso,
So that eu consiga preparar cada evento antes do estande abrir.

**Estimativa:** M · **FRs:** FR1, FR2, FR5 · **UX-DR:** —

**Acceptance Criteria:**

**Given** que sou MASTER/GESTOR na tela de Congressos
**When** crio uma edição com nome, slug, local, datas, brinde e estoque
**Then** a edição é persistida e aparece na lista de edições

**Given** uma edição existente
**When** eu a ativo ou desativo
**Then** o campo de ativação muda e passa a controlar se o pré-cadastro público está aberto

**Given** que sou PRESTADOR
**When** acesso a gestão de edições
**Then** o acesso é negado (sem permissão `congressos.manage`)

**Given** múltiplas edições
**When** listo os congressos
**Then** cada edição é independente (dados/estoque/QR próprios)

### Story 1.4: Configuração de cashback por edição

As a gestor,
I want configurar o cashback de cada edição com toggle e campos condicionais,
So that cada congresso tenha sua própria regra de bônus sem envolver desenvolvimento.

**Estimativa:** M · **FRs:** FR4 · **UX-DR:** 11

**Acceptance Criteria:**

**Given** o formulário de edição
**When** habilito o cashback
**Then** aparecem os campos: tipo (PERCENT/FIXED), valor, condição de resgate (valor mínimo e/ou quantidade mínima), elegibilidade (ALL/NEW_ONLY) e validade (dias)

**Given** o cashback desabilitado
**When** salvo a edição
**Then** os campos de cashback ficam ocultos/ignorados e nenhum crédito será gerado

**Given** valores inválidos (ex.: percentual > 100, valor negativo)
**When** tento salvar
**Then** a validação (zod) bloqueia e exibe erro claro

### Story 1.5: Link e QR público da edição

As a gestor,
I want obter o link e o QR público de cada edição,
So that eu possa imprimir/exibir o QR no estande.

**Estimativa:** P · **FRs:** FR3 · **ARs:** AR9 (qrcode)

**Acceptance Criteria:**

**Given** uma edição ativa
**When** abro seus detalhes
**Then** vejo o link público `/congressos/[slug]` e um QR gerado a partir dele, com opção de copiar/baixar

**Given** uma edição desativada
**When** o QR é acessado
**Then** a landing informa que o pré-cadastro não está disponível

---

## Epic 2: Pré-Cadastro Público (Captura no Estande)

Um participante retira o brinde só com CPF (existente em 1 toque; novo com cadastro curto), com consentimento LGPD, recebe QR+código na tela e nunca perde dados em queda de rede.

### Story 2.1: Landing pública da edição (mobile-first)

As a participante,
I want abrir uma página leve do evento ao escanear o QR,
So that eu comece a retirada do brinde rapidamente mesmo no 3G do pavilhão.

**Estimativa:** M · **FRs:** FR6 · **UX-DR:** 1 · **ARs:** AR7 · **NFR:** NFR-P1, NFR-A1

**Acceptance Criteria:**

**Given** uma edição ativa
**When** acesso `/congressos/[slug]`
**Then** vejo a landing no layout `(public)` com logo, nome do congresso, brinde e botão grande "Retirar meu brinde", com `noindex, nofollow`

**Given** a rota pública nova
**When** o middleware processa a requisição
**Then** a rota está na allowlist `isPublicRoute` e não redireciona para `/login`

**Given** conexão lenta
**When** a landing carrega
**Then** o JS da ilha cliente é < ~60KB gzip e o QR só é carregado sob demanda (code-split)

### Story 2.2: Passo CPF/CNPJ com lookup

As a participante,
I want informar apenas meu CPF/CNPJ,
So that o sistema saiba se já sou cliente antes de pedir qualquer outro dado.

**Estimativa:** M · **FRs:** FR7, FR8, FR14 · **UX-DR:** 2 · **NFR:** NFR-P2, NFR-S2

**Acceptance Criteria:**

**Given** a tela de CPF
**When** digito o documento
**Then** o campo usa `inputmode="numeric"` com máscara e valida CPF/CNPJ antes de enviar

**Given** um documento válido
**When** submeto o lookup
**Then** o endpoint chama o RPC `find_client_by_document` (por dígitos normalizados), responde em < 1s (p95) e informa se há cliente correspondente

**Given** muitas tentativas de um mesmo IP
**When** excedo o limite
**Then** recebo 429 (rate limit contra enumeração), sem vazar existência do documento além do necessário

### Story 2.3: Fluxo de cliente existente (confirmação em 1 toque)

As a participante já cliente,
I want confirmar meus dados em um toque,
So that eu retire o brinde em menos de 15 segundos.

**Estimativa:** M · **FRs:** FR9, FR15 · **UX-DR:** 3

**Acceptance Criteria:**

**Given** que o lookup encontrou meu cadastro
**When** a tela de confirmação abre
**Then** vejo saudação com meu primeiro nome e contatos mascarados

**Given** a confirmação exibida
**When** toco "Sim, é isso"
**Then** o pré-cadastro é criado vinculado ao cliente existente e o brinde é liberado

**Given** dados incorretos
**When** toco "corrigir"
**Then** posso ajustar contato antes de concluir

### Story 2.4: Fluxo de novo cadastro (formulário curto)

As a participante novo,
I want preencher um cadastro curto,
So that eu retire o brinde em menos de 60 segundos.

**Estimativa:** M · **FRs:** FR10, FR16 · **UX-DR:** 4

**Acceptance Criteria:**

**Given** que o lookup não encontrou cadastro
**When** o formulário abre
**Then** vejo Nome, WhatsApp, E-mail e Tipo (chips Dentista/Distribuidora/Outro), com validação inline (zod, schema em `src/lib/validations.ts`)

**Given** o tipo escolhido
**When** concluo
**Then** o tipo é mapeado para `sales_channel` (Dentista→DENTISTA, Distribuidora→DISTRIBUIDORA, Outro→CONSUMIDOR)

**Given** campos obrigatórios vazios/ inválidos
**When** tento concluir
**Then** os erros são exibidos ligados ao campo e a conclusão é bloqueada

### Story 2.5: Consentimento LGPD

As a participante,
I want consentir explicitamente com o tratamento dos meus dados,
So that a coleta seja conforme a LGPD.

**Estimativa:** P · **FRs:** FR11, FR40 · **NFR:** NFR-C1, NFR-S5

**Acceptance Criteria:**

**Given** o formulário de conclusão
**When** vou concluir
**Then** há um checkbox obrigatório de consentimento com link ao texto vigente

**Given** o consentimento aceito
**When** o cadastro é gravado
**Then** são persistidos `consent_version`, `consent_at` e `consent_ip_hmac` (IP apenas como HMAC)

**Given** o checkbox não marcado
**When** tento concluir
**Then** a conclusão é bloqueada

### Story 2.6: Submissão e gravação idempotente

As a participante,
I want que meu cadastro seja gravado de forma rápida e sem duplicar,
So that eu tenha resposta imediata mesmo com toques repetidos.

**Estimativa:** M · **FRs:** FR12 (parcial), FR17, FR41 · **ARs:** AR10 · **NFR:** NFR-P2, NFR-S1

**Acceptance Criteria:**

**Given** o submit do pré-cadastro
**When** a rota server-side (admin client) processa
**Then** cria `event_registrations` e um `event_gift_redemptions` (token + código) e responde em < 1s, sem expor `tiny_id` nem PII de terceiros

**Given** o mesmo `idempotency-key` reenviado (double-tap/retry)
**When** o submit chega de novo
**Then** nenhum cadastro/brinde duplicado é criado e a mesma resposta é retornada

**Given** o cadastro criado
**When** a resposta retorna
**Then** o trabalho de sync com o Tiny e a confirmação são apenas **enfileirados** (não bloqueiam a resposta)

### Story 2.7: Autosave e recuperação offline

As a participante,
I want não perder o que digitei se a rede cair,
So that eu conclua o cadastro sem recomeçar.

**Estimativa:** M · **FRs:** FR12 · **UX-DR:** 6 · **NFR:** NFR-R1

**Acceptance Criteria:**

**Given** que estou preenchendo o formulário
**When** a rede oscila ou o submit falha
**Then** os dados ficam salvos em `localStorage` e vejo "Sem conexão — tentaremos de novo. Seus dados estão salvos"

**Given** a conexão volta
**When** o app detecta reconexão
**Then** o submit é reenviado automaticamente com o mesmo `idempotency-key`, sem duplicar

### Story 2.8: Tela de sucesso com QR e código

As a participante,
I want ver o comprovante do brinde na tela,
So that eu retire o brinde mesmo se a leitura do QR falhar.

**Estimativa:** M · **FRs:** FR13 · **UX-DR:** 5 · **ARs:** AR9

**Acceptance Criteria:**

**Given** o cadastro concluído
**When** a tela de sucesso abre
**Then** vejo um QR grande (gerado client-side com `qrcode`) e um código de 6 dígitos em destaque, com aviso de confirmação por e-mail

**Given** o QR exibido
**When** ele codifica o brinde
**Then** contém o token do resgate (não o documento nem dados pessoais)

### Story 2.9: Proteção anti-abuso da captura

As a operação,
I want proteger a página pública contra bots e abuso,
So that o pico do evento e os dados fiquem seguros.

**Estimativa:** M · **FRs:** FR39, FR41 · **ARs:** AR9 (Turnstile) · **NFR:** NFR-S2, NFR-S3, NFR-C2

**Acceptance Criteria:**

**Given** o submit público
**When** é enviado
**Then** um token do Turnstile é exigido e validado no servidor; sem token válido, o cadastro é rejeitado

**Given** muitas submissões do mesmo IP ou do mesmo CPF
**When** o limite é excedido
**Then** o sistema responde 429

**Given** qualquer resposta pública
**When** ela é montada
**Then** nunca inclui lista de documentos, `tiny_id` ou tokens de terceiros

---

## Epic 3: Sincronização Assíncrona com Tiny

Um participante qualificado vira contato no Tiny com o Tipo correto e cliente no CRM (marcado como "congresso"), de forma resiliente (fila durável + retry + throttle), sem afetar o participante; o gestor vê o status.

### Story 3.1: Service de criar/achar contato no Tiny

As a desenvolvedor,
I want um service interno reusável que cria ou acha o contato no Tiny com o Tipo correto,
So that a sincronização use lógica segura sem depender da rota pública sem auth.

**Estimativa:** M · **FRs:** FR23 (base) · **ARs:** AR5, AR12

**Acceptance Criteria:**

**Given** um documento e um tipo de contato
**When** o service `createOrFindTinyContact` é chamado
**Then** busca no Tiny por `cpfCnpj` antes de criar (evita duplicar) e aplica o `sales_channel` no contato (`applySalesChannelToTinyContact`)

**Given** a criação com canal falha por forma do campo `tipos`
**When** ocorre o erro
**Then** há retry sem canal (contato é criado mesmo assim) e o caso é logado para validação

**Given** a rota pública `/api/tiny/create-contact`
**When** implemento a sincronização
**Then** ela não é chamada (uso o service interno)

### Story 3.2: Enfileiramento do job de sync no cadastro

As a sistema,
I want enfileirar um job de sincronização a cada cadastro,
So that o Tiny seja atualizado fora do caminho do participante.

**Estimativa:** M · **FRs:** FR26 · **ARs:** AR3, AR10 · **NFR:** NFR-R1

**Acceptance Criteria:**

**Given** um pré-cadastro criado
**When** a gravação conclui
**Then** um registro em `tiny_contact_sync_jobs` (status PENDING, 1 por `registration_id`) é criado

**Given** o job criado
**When** a resposta ao participante já foi enviada
**Then** uma tentativa best-effort imediata roda via `after()` sem bloquear a resposta

**Given** o Tiny indisponível
**When** a tentativa imediata falha
**Then** o participante não é afetado e o job permanece PENDING para o cron

### Story 3.3: Worker/cron de drenagem com backoff e throttle

As a sistema,
I want um cron que drena a fila de sync com retry e throttle,
So that todos os cadastros cheguem ao Tiny sem estourar a API e sem perder jobs.

**Estimativa:** G · **FRs:** FR25 · **ARs:** AR3, AR4, AR8 · **NFR:** NFR-SC2, NFR-R2, NFR-I1

**Acceptance Criteria:**

**Given** jobs PENDING/FAILED com `next_attempt_at <= now()`
**When** o cron (guardado por `CRON_SECRET`) executa
**Then** processa os jobs respeitando ~2 req/s do Tiny (throttle)

**Given** uma falha transitória
**When** o job falha
**Then** `attempts` incrementa e `next_attempt_at` segue backoff (1,2,4,8,16 min), até 5 tentativas; depois é marcado como DEAD

**Given** um contato sincronizado
**When** o job conclui
**Then** grava `tiny_id`/`tiny_synced_at` e registra sucesso/erro em `tiny_sync_logs`

**Given** reprocessamento
**When** um job roda novamente
**Then** a operação é idempotente (upsert `clients` `onConflict: tiny_id`, sem duplicar)

### Story 3.4: Promoção seletiva a cliente com marcador de origem

As a gestor,
I want que só participantes qualificados virem clientes,
So that o rep-app não seja poluído por leads não qualificados.

**Estimativa:** M · **FRs:** FR24 · **ARs:** AR11 · **NFR:** (isolamento rep-app)

**Acceptance Criteria:**

**Given** um participante Dentista/Distribuidora (qualificado)
**When** o job de sync roda
**Then** ele é criado/atualizado como `client` com marcador de origem "congresso"

**Given** um participante "Outro" (não qualificado)
**When** o job roda
**Then** ele permanece apenas em `event_registrations` (não vira `client`), mas pode ser sincronizado como contato no Tiny conforme a regra do evento

**Given** as telas do rep-app
**When** listam clientes
**Then** leads não qualificados do congresso não aparecem

### Story 3.5: Validação do campo `tipos` do Tiny V3

As a desenvolvedor,
I want validar a forma real do campo `tipos` na API V3,
So that o Tipo de Contato seja gravado de forma confiável.

**Estimativa:** P · **FRs:** FR23 · **ARs:** AR12

**Acceptance Criteria:**

**Given** um contato de teste criado no Tiny
**When** consulto a resposta real da API
**Then** a estrutura do campo `tipos` é confirmada/documentada e o mapeamento ajustado se necessário

**Given** o mapeamento confirmado
**When** um contato é criado
**Then** o Tipo de Contato aparece correto no Tiny (validado manualmente ao menos 1 vez por tipo)

### Story 3.6: Status de sincronização por cadastro (gestor)

As a gestor,
I want ver o status de sincronização de cada cadastro,
So that eu saiba o que já foi para o Tiny e o que falhou.

**Estimativa:** M · **FRs:** FR27 · **UX-DR:** 9 (parcial)

**Acceptance Criteria:**

**Given** a lista/detalhe de cadastros de um evento
**When** abro um cadastro
**Then** vejo o status do job (PENDING/PROCESSING/DONE/FAILED/DEAD), tentativas e último erro

**Given** um job DEAD
**When** visualizo
**Then** ele é destacado para ação manual

---

## Epic 4: Confirmação ao Participante

Um participante recebe confirmação do brinde por e-mail (WhatsApp na Fase 2).

### Story 4.1: Enfileiramento da confirmação no cadastro

As a sistema,
I want enfileirar uma confirmação a cada cadastro,
So that o envio seja desacoplado e resiliente.

**Estimativa:** P · **FRs:** FR28 (base) · **ARs:** AR3 · **NFR:** NFR-I2

**Acceptance Criteria:**

**Given** um pré-cadastro com e-mail
**When** a gravação conclui
**Then** um `event_dispatches` (canal EMAIL, status PENDENTE) é criado

**Given** cadastro sem e-mail
**When** concluo
**Then** nenhum dispatch de e-mail é criado e isso é registrado

### Story 4.2: Template e canal de e-mail (Resend)

As a participante,
I want receber um e-mail de confirmação do brinde,
So that eu tenha o comprovante fora da tela.

**Estimativa:** M · **FRs:** FR28 · **ARs:** — · **NFR:** NFR-I2

**Acceptance Criteria:**

**Given** um dispatch de e-mail pendente
**When** o canal de e-mail (Resend, no molde do canal NPS) o processa
**Then** um e-mail com nome do evento, brinde, QR/código é enviado a partir de `RESEND_FROM_EMAIL`

**Given** o template React Email
**When** renderizado
**Then** é responsivo e não expõe dados sensíveis além do necessário

### Story 4.3: Cron de drenagem de confirmações

As a sistema,
I want drenar os dispatches com status e retentativa,
So that as confirmações sejam entregues de forma confiável.

**Estimativa:** M · **FRs:** FR29 · **NFR:** NFR-R3

**Acceptance Criteria:**

**Given** dispatches pendentes
**When** o cron (guardado por `CRON_SECRET`) executa
**Then** envia e marca status (ENVIADO/FALHOU) com `sent_at`/`send_error`

**Given** um envio que falha
**When** o cron roda de novo
**Then** há retentativa; um gestor pode reenviar manualmente

### Story 4.4 [Fase 2]: Canal de confirmação por WhatsApp

As a participante,
I want receber a confirmação também por WhatsApp,
So that eu tenha o comprovante no canal que mais uso.

**Estimativa:** G · **FRs:** FR30 [Fase 2]

**Acceptance Criteria:**

**Given** um provedor de WhatsApp configurado (Meta Cloud API)
**When** um dispatch de canal WHATSAPP é processado
**Then** a mensagem (template aprovado) é enviada e o status é registrado

**Given** o provedor não configurado
**When** o dispatch WHATSAPP é processado
**Then** ele falha de forma controlada (sem quebrar o fluxo), no molde do driver plugável existente

---

## Epic 5: Controle de Brindes & Operação de Estande

A equipe localiza o participante e entrega o brinde sem duplicidade (com trilha), e o gestor acompanha o dashboard do evento e exporta a lista qualificada.

### Story 5.1: Página interna de controle e busca

As a operador de estande,
I want localizar rapidamente um participante,
So that eu entregue o brinde sem atrasar a fila.

**Estimativa:** M · **FRs:** FR18 · **UX-DR:** 7 · **NFR:** NFR-P3

**Acceptance Criteria:**

**Given** que sou MASTER, GESTOR ou PRESTADOR (permissão `congressos.operate`) na página Controle de Brindes de um evento
**When** busco por nome, documento ou código de 6 dígitos
**Then** o resultado aparece em < 2s, usando o `DataTable` compartilhado

**Given** que não tenho permissão `congressos.operate` (ex.: REPRESENTANTE)
**When** acesso a página
**Then** o acesso é negado

### Story 5.2: Retirada atômica anti-duplicidade

As a operador de estande,
I want marcar o brinde como retirado com garantia de unicidade,
So that ninguém retire o mesmo brinde duas vezes.

**Estimativa:** M · **FRs:** FR19, FR20, FR21 · **ARs:** AR6 · **UX-DR:** 8

**Acceptance Criteria:**

**Given** um brinde PENDENTE
**When** toco "Retirar"
**Then** o RPC `redeem_gift` faz a baixa atômica e vejo card verde "✅ ENTREGUE", registrando `redeemed_by` e `redeemed_at`

**Given** um brinde já RETIRADO
**When** tento retirar de novo
**Then** vejo "⚠️ JÁ RETIRADO às HH:MM por {usuário}" e nenhuma segunda baixa ocorre

**Given** duas tentativas concorrentes
**When** ambas chegam
**Then** apenas uma efetua a retirada (garantia transacional)

### Story 5.3: Controle de estoque do brinde

As a gestor,
I want acompanhar o estoque do brinde por edição de forma informativa,
So that eu saiba quando está acabando sem travar a operação do estande.

**Estimativa:** P · **FRs:** FR22

**Acceptance Criteria:**

**Given** uma edição com estoque definido
**When** brindes são retirados
**Then** o disponível = estoque − retiradas é atualizado e exibido no dashboard e na tela de retirada

**Given** estoque esgotado (disponível = 0 ou negativo)
**When** o operador vai retirar um brinde
**Then** há um **alerta visual** de estoque zerado, mas a retirada **não é bloqueada** (controle informativo no MVP)

**Given** o requisito de bloqueio rígido
**When** for priorizado
**Then** ele entra como opção **configurável por edição na Fase 2** (fora do escopo desta story)

### Story 5.4: Dashboard do evento

As a gestor,
I want um dashboard por evento,
So that eu acompanhe o desempenho e a saúde da integração em tempo quase real.

**Estimativa:** M · **FRs:** FR36 · **UX-DR:** 9

**Acceptance Criteria:**

**Given** um evento
**When** abro o dashboard
**Then** vejo cards de cadastros, retiradas, taxa de conversão (retiradas/cadastros), estoque restante e saúde da fila (jobs pendentes/mortos, dispatches falhos), com skeletons no carregamento

### Story 5.5: Exportação da lista qualificada (CSV)

As a gestor,
I want exportar a lista qualificada do evento,
So that o comercial faça follow-up sem digitação manual.

**Estimativa:** P · **FRs:** FR37 · **UX-DR:** 10

**Acceptance Criteria:**

**Given** um evento
**When** exporto com filtros (tipo, retirado, consentimento)
**Then** um CSV é gerado com os campos qualificados, respeitando o filtro

### Story 5.6: RBAC das telas e ações internas

As a gestor,
I want que o acesso às telas e ações seja restrito por papel,
So that apenas quem deve consiga operar e gerenciar.

**Estimativa:** P · **FRs:** FR38 · **NFR:** NFR-S4

**Acceptance Criteria:**

**Given** as telas internas do módulo
**When** um usuário sem `congressos.operate` acessa
**Then** o acesso é bloqueado (client-gate + RLS como backstop)

**Given** um PRESTADOR (tem `congressos.operate`, não tem `congressos.manage`)
**When** ele acessa o Controle de Brindes e marca retiradas
**Then** consegue operar; mas ao tentar uma ação de gestão (editar edição, config de cashback, export CSV)
**Then** a ação é negada

**Given** MASTER/GESTOR (têm `congressos.manage`)
**When** acessam gestão de edições, cashback, dashboard completo e export
**Then** conseguem executar todas as ações

### Story 5.7 [Fase 2]: Leitura de QR por câmera

As a operador de estande,
I want ler o QR do participante pela câmera,
So that a retirada seja ainda mais rápida.

**Estimativa:** M · **FRs:** FR18 (extensão) · **ARs:** AR9 (scanner) [Fase 2]

**Acceptance Criteria:**

**Given** o scanner habilitado
**When** aponto a câmera para o QR
**Then** o brinde correspondente é localizado para retirada

---

## Epic 6: Cashback / Crédito

Um participante elegível ganha um crédito com snapshot das regras; o gestor vê e dá baixa manual (resgate automatizado na Fase 2).

### Story 6.1: Geração de crédito com snapshot

As a sistema,
I want gerar o crédito no cadastro conforme a regra vigente da edição,
So that o participante elegível receba o bônus de forma auditável.

**Estimativa:** M · **FRs:** FR31, FR32

**Acceptance Criteria:**

**Given** uma edição com cashback ativo e um participante elegível (regra ALL/NEW_ONLY)
**When** o cadastro é concluído
**Then** um `event_credits` é criado com **snapshot** das regras (tipo, valor, condições, `valid_until` calculado)

**Given** que a config da edição muda depois
**When** consulto um crédito já emitido
**Then** ele mantém as regras do momento da emissão (snapshot inalterado)

**Given** o mesmo documento na mesma edição
**When** um segundo cadastro tenta gerar crédito
**Then** apenas um crédito por documento por edição existe (constraint)

### Story 6.2: Exibição do crédito no perfil do cliente

As a gestor,
I want ver o crédito e suas condições no perfil do cliente,
So that eu informe o participante e prepare o resgate.

**Estimativa:** P · **FRs:** FR33 · **UX-DR:** 12

**Acceptance Criteria:**

**Given** um cliente com crédito
**When** abro seu perfil
**Then** vejo valor, condições de resgate, validade e status (ATIVO/USADO/EXPIRADO/CANCELADO)

### Story 6.3: Resgate manual com validação de condições

As a gestor,
I want dar baixa manual em um crédito validando as condições,
So that o bônus seja aplicado corretamente na compra.

**Estimativa:** M · **FRs:** FR34

**Acceptance Criteria:**

**Given** um crédito ATIVO dentro da validade
**When** registro o resgate informando o pedido/uso
**Then** as condições (valor/quantidade mínima) são validadas e o crédito passa a USADO, com vínculo ao pedido

**Given** um crédito expirado ou fora das condições
**When** tento resgatar
**Then** o resgate é bloqueado com mensagem clara

### Story 6.4 [Fase 2]: Resgate automatizado no pedido

As a sistema,
I want aplicar o crédito automaticamente em um pedido elegível,
So that o resgate não dependa de ação manual.

**Estimativa:** G · **FRs:** FR35 [Fase 2]

**Acceptance Criteria:**

**Given** um pedido elegível de um cliente com crédito ativo
**When** o pedido é criado/fechado
**Then** o crédito é aplicado automaticamente conforme as condições (integra pricing/orders)

---

## Epic 7: Hardening & Prontidão de Go-Live

Operação confiável no pico: observabilidade da fila e teste de carga antes do evento como gate.

### Story 7.1: Observabilidade da fila e alertas

As a gestor,
I want visibilidade de jobs e dispatches problemáticos,
So that eu aja antes que afetem o evento.

**Estimativa:** M · **FRs:** — (NFR-R2) · **ARs:** AR4

**Acceptance Criteria:**

**Given** jobs DEAD ou dispatches FALHOU
**When** acesso a visão de saúde da integração
**Then** vejo contagens e listas com o último erro, e há um alerta quando ultrapassam um limiar

### Story 7.2: Teste de carga do pico (gate de go-live)

As a operação,
I want validar o sistema sob o pico esperado antes do evento,
So that o go-live seja seguro.

**Estimativa:** M · **FRs:** — (NFR-SC1, NFR-P2) · **ARs:** AR4

**Acceptance Criteria:**

**Given** um cenário de carga (baseline ≥ 300 cadastros/min)
**When** o teste roda
**Then** o submit mantém p95 < 1s e a fila drena respeitando o throttle do Tiny, sem perda de jobs

**Given** o resultado do teste
**When** avalio o go-live
**Then** a decisão de habilitar Upstash e a frequência final do cron são registradas com base nos números observados
