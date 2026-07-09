---
stepsCompleted: ['step-01-init', 'step-02-discovery', 'step-02b-vision', 'step-02c-executive-summary', 'step-03-success', 'step-04-journeys', 'step-05-domain', 'step-06-innovation-skipped', 'step-07-project-type', 'step-08-scoping', 'step-09-functional', 'step-10-nonfunctional', 'step-11-polish', 'step-12-complete']
classification:
  projectType: web_app
  domain: general (CRM / captação de leads em evento — odontológico)
  complexity: medium
  projectContext: brownfield
  keyCompliance: LGPD
inputDocuments:
  - conversa: plano completo + decisões fechadas (Congressos)
  - _bmad-output/planning-artifacts/project-context.md
  - docs/project-brief.md
  - docs/architecture.md
  - docs/USERS_AND_PERMISSIONS.md
workflowType: 'prd'
documentCounts:
  briefs: 1
  research: 0
  brainstorming: 0
  projectDocs: 3
module: 'congressos'
---

# Product Requirements Document - Congressos: Pré-Cadastro + Controle de Brindes + Cashback

**Author:** Cabra
**Date:** 2026-07-08
**Projeto:** adds-crm (brownfield — Fase 2 em produção)

## Executive Summary

A ADDS Brasil participará de congressos odontológicos com milhares de participantes, oferecendo um brinde no estande. Hoje a retirada depende de formulário/planilha, que gera fila, erro e **leads mortos** — o custo do brinde não se converte em pipeline. Este módulo transforma a retirada do brinde em **aquisição qualificada**: o participante escaneia um QR no estande, informa **apenas o CPF/CNPJ** e retira o brinde; em segundos o cadastro vira **contato ativo no Tiny ERP com o "Tipo de Contato" correto** (Dentista, Distribuidora/Dental ou Outro), pronto para o comercial fazer follow-up.

O produto tem três públicos: (1) o **participante** (mobile, internet de pavilhão ruim, pressa) — cliente existente retira em <15s/1 toque, novo em <60s; (2) a **equipe de estande** (autenticada no CRM) — busca por nome/CPF/código, marca a retirada com trilha anti-duplicidade e acompanha um dashboard do evento; (3) o **gestor comercial** — recebe a lista qualificada e as métricas de conversão do congresso. A entidade é **multi-evento desde a v1**: cada congresso tem nome, datas, brinde, estoque e link/QR próprios. Um **cashback configurável por evento** (v1: crédito gerado no cadastro, resgate manual) cria o gancho de recompra.

O escopo do MVP para o primeiro congresso: **pré-cadastro público CPF-first + confirmação por e-mail e QR/código na tela + sync assíncrono resiliente com o Tiny + controle de brindes interno + geração/exibição de crédito**. WhatsApp, resgate automatizado de crédito e leitura de QR por câmera são *fast-follow* explícitos.

### What Makes This Special

O diferencial não é o formulário — é a **arquitetura que tira o ERP da frente do participante**. Grava-se **primeiro no Supabase** (resposta <1s) e o Tiny é empurrado para uma **fila durável assíncrona** com retry/backoff e throttle: o ERP nunca é gargalo nem ponto de falha no estande, mesmo se cair por horas. Sobre isso, o módulo **reusa infra já existente e comprovada** do CRM, o que torna o MVP viável no prazo do evento:

- **CPF-first sem atrito:** reuso do RPC `find_client_by_document` (que já normaliza dígitos — essencial porque `clients.document` tem formatos mistos e não é único). Cliente existente confirma em 1 toque.
- **Contato Tiny com Tipo correto pronto:** reuso da lógica de criar/achar contato + mapa `sales_channel`→"Tipo de Contato" (`src/lib/sales-channel.ts`).
- **Confirmação e privacidade prontas:** e-mail via Resend (canal já ligado no NPS) e o padrão de token público + RPC `SECURITY DEFINER` que só devolve PII quando o token é acionável (molde `validate_nps_token`, defesa LGPD).
- **Anti-fraude transacional:** retirada por `UPDATE ... WHERE status='PENDENTE'` — segunda tentativa mostra "JÁ RETIRADO às HH:MM por {usuário}".

Frase-âncora do valor: **"Retire seu brinde só com o CPF — e vire cliente da ADDS sem preencher nada."**

## Project Classification

- **Tipo de projeto:** `web_app` — página pública mobile-first (captura no estande) + dashboard interno de controle, dentro do CRM `saas_b2b` existente.
- **Domínio:** CRM / captação de leads em evento (nicho odontológico).
- **Complexidade:** **Medium**, com bolsões de alta — fila assíncrona durável, anti-duplicidade transacional e conformidade **LGPD**.
- **Contexto:** **Brownfield** — módulo novo (`event_*`) sobre sistema em produção (`personalizadas.adds.com.br`, Vercel), **compartilhando o mesmo Supabase com o `adds-rep-app`** (impacto cruzado tratado explicitamente neste PRD).

## Success Criteria

### User Success (participante + equipe)
- **Cliente existente retira em ≤15s** com no máximo **1 toque** de confirmação após digitar o CPF.
- **Novo cadastro concluído em ≤60s** (do CPF ao QR na tela).
- **Taxa de conclusão do fluxo** (iniciou → brinde liberado) **≥ 90%** entre quem abre a landing.
- **Zero perda de dados digitados** em queda/instabilidade de rede (autosave + retry).
- **Equipe:** localizar um participante e marcar retirada em **≤10s**; feedback visual inequívoco de "ENTREGUE" vs "JÁ RETIRADO".

### Business Success
- **≥ 70% dos participantes elegíveis** que retiram brinde viram registro qualificado (meta calibrável por evento).
- **≥ 95% dos leads qualificados** (Dentista/Distribuidora) chegam ao **Tiny como contato com Tipo correto** em até 30 min.
- **Conversão pós-evento:** % de leads do congresso que geram orçamento/pedido em **30 e 90 dias** (baseline medido no 1º evento).
- **Lista qualificada exportável no fim do congresso, sem digitação manual** (elimina o retrabalho atual).

### Technical Success
- **Submit do pré-cadastro responde em <1s (p95)** — Tiny fora do hot path.
- **0 brindes retirados em duplicidade** (garantia transacional).
- **Sync Tiny com sucesso ≥ 99%**; falhas transitórias reprocessadas pela fila (retry/backoff) **sem intervenção manual**; nenhuma perda de job mesmo com **Tiny indisponível por horas**.
- **Throttle respeita o Tiny** no catch-up (sem estourar a API).
- **LGPD:** **100% dos cadastros** com consentimento **versionado + timestamp + IP (HMAC)**; PII nunca exposta na superfície pública fora do token acionável.
- **Isolamento do rep-app:** leads não qualificados **não** poluem as telas do `adds-rep-app` (só qualificados promovidos a `clients`, com marcador de origem).

### Measurable Outcomes (metas do 1º congresso)
| Métrica | Alvo |
|---|---|
| Latência submit (p95) | < 1s |
| Cliente existente: tempo até brinde | < 15s |
| Novo: tempo até QR | < 60s |
| Duplicidade de brinde | 0 |
| Sync Tiny bem-sucedido | ≥ 99% em ≤ 30 min |
| Cadastros com consentimento válido | 100% |
| Retrabalho de digitação pós-evento | 0 |

## Product Scope

Resumo das fases (detalhamento de MVP, esforço e riscos em **Project Scoping & Phased Development**):

- **MVP (Fase 1):** E0 fundações · E1 página pública CPF-first (QR+código, autosave/retry, Turnstile) · E2 sync assíncrono resiliente (promoção seletiva a `clients`) · E3.1 confirmação por e-mail · E4 controle de brindes interno (retirada atômica, dashboard, export) · E5.1 cashback com snapshot + resgate manual.
- **Growth (Post-MVP / fast-follow):** WhatsApp de confirmação; resgate automatizado de crédito; scan de QR por câmera; rate limit distribuído (Upstash, pós-carga); multi-brinde por evento.
- **Vision (Future):** follow-up comercial automatizado; NPS pós-evento integrado; atribuição de conversão fim-a-fim (→ Meta CAPI); self-service de eventos.

## User Journeys

### Jornada 1 — Participante cliente existente (happy path): **Dra. Marina**
**Cena de abertura:** Dra. Marina, dentista, já comprou da ADDS uma vez. No congresso, vê a placa "Retire seu brinde" e um QR. Está com sacola numa mão, celular na outra, pressa para voltar à palestra.
**Ação:** Escaneia o QR → landing do evento carrega leve (logo + "Retirar meu brinde"). Toca no botão. Uma tela, um campo: **CPF**. Digita (teclado numérico, máscara). Em <1s: *"Olá, Marina! Confirma seus dados? marina@…, (11) 9••••"*.
**Clímax:** Um toque em **"Sim, é isso"** → tela verde de sucesso com **QR grande + código de 6 dígitos**. Total: ~12s.
**Resolução:** Pega o brinde no balcão (operador confere), recebe **e-mail de confirmação**. Não digitou nada além do CPF. Nos bastidores, ela já era `client`; o worker só atualiza `tiny_synced_at` se necessário.
**Emoção:** surpresa positiva ("foi instantâneo").
**Revela requisitos:** landing ultra-leve; lookup CPF <1s (`find_client_by_document`); confirmação em 1 toque; geração de QR/código; e-mail de confirmação.

### Jornada 2 — Participante novo, internet ruim (edge case): **Rafael**
**Cena de abertura:** Rafael, comprador de uma distribuidora dental, nunca comprou da ADDS. Wi-Fi do pavilhão oscilando.
**Ação:** Escaneia, digita CPF → *"Não encontramos seu cadastro, vamos criar"* → formulário curto: Nome, WhatsApp, E-mail, **Tipo** (chips: Dentista / Distribuidora / Outro → escolhe **Distribuidora**), checkbox **LGPD**. No meio do preenchimento, a rede cai.
**Clímax (recuperação):** Ao tocar "Concluir", falha de rede. Mensagem clara: *"Sem conexão — vamos tentar de novo automaticamente. Seus dados estão salvos."* O payload fica em `localStorage` com **idempotency-key**; ao reconectar, reenvia sozinho. **Nada é perdido nem duplicado.**
**Resolução:** Tela de sucesso com QR + código. Recebe e-mail. Nos bastidores: `event_registrations` gravado; como é **Distribuidora (qualificado)**, entra na fila para virar `client` + contato no Tiny com Tipo "distribuidora / dental", com marcador de origem "congresso". Se o Tiny estiver fora, o job aguarda e drena depois — Rafael nunca percebe.
**Emoção:** alívio (não perdeu o cadastro).
**Revela requisitos:** formulário curto validado (zod); autosave + retry offline; idempotência; consentimento LGPD versionado; enfileiramento resiliente; regra de qualificação/promoção.

### Jornada 3 — Operador de estande (retirada + duplicata): **Júlia** (operador: MASTER/GESTOR/PRESTADOR)
**Cena de abertura:** Júlia opera o balcão de brindes, logada no CRM pelo tablet. Fila se formando.
**Ação:** Participante mostra o **código de 6 dígitos** (ou nome/CPF). Júlia busca na página **Controle de Brindes** → acha o registro em ≤10s → toca **"Retirar"**.
**Clímax:** Card verde grande **"✅ ENTREGUE"**. Minutos depois, alguém tenta usar o **mesmo código de novo** → card âmbar **"⚠️ JÁ RETIRADO às 14:32 por Júlia"**. Fraude/erro barrado na hora (garantia transacional `UPDATE ... WHERE status='PENDENTE'`).
**Resolução:** Fila anda rápido, zero brinde duplicado, trilha de quem entregou.
**Emoção:** confiança (o sistema não deixa errar).
**Revela requisitos:** página interna com busca rápida; retirada atômica; feedback visual forte; RLS por role; registro de `redeemed_by`/`redeemed_at`.

### Jornada 4 — Gestor comercial (visão + follow-up): **Kairam** (MASTER)
**Cena de abertura:** Fim do 1º dia de congresso. Kairam quer saber se está funcionando e preparar o follow-up.
**Ação:** Abre o **dashboard do evento**: cadastros, retiradas, **taxa de conversão** (retiradas/cadastros), **estoque restante** do brinde, quantos já viraram contato no Tiny. Vê a saúde da fila (jobs pendentes/falhos).
**Clímax:** Exporta a **lista qualificada** (CSV) filtrada por Dentista/Distribuidora — **sem digitar nada**. A lista já está pronta para o comercial atacar.
**Resolução:** No dia seguinte o time liga para leads quentes; nada foi transcrito à mão. Ao fim do congresso, os créditos de cashback estão registrados nos cadastros, prontos para resgate manual.
**Emoção:** controle e previsibilidade (congresso virou pipeline mensurável).
**Revela requisitos:** dashboard por evento; métricas de conversão; observabilidade da fila; export CSV; visibilidade dos créditos.

### Journey Requirements Summary
As jornadas revelam os seguintes conjuntos de capacidades:
- **Captura pública (E1):** landing leve, lookup CPF, confirmação 1-toque, formulário curto, autosave/retry offline, consentimento LGPD, geração de QR+código, idempotência, Turnstile.
- **Sync resiliente (E2):** fila durável, backoff, throttle Tiny, idempotência, regra de qualificação/promoção a `client` com marcador de origem, mapa de Tipo de Contato.
- **Confirmação (E3.1):** e-mail transacional (Resend + template).
- **Operação de estande (E4):** busca rápida, retirada atômica anti-duplicidade, feedback visual, RLS por role, trilha de auditoria.
- **Gestão (E4):** dashboard do evento, métricas de conversão, observabilidade da fila, export CSV.
- **Cashback (E5.1):** geração com snapshot de regras, exibição do crédito no perfil do cliente.

## Domain-Specific Requirements

### Compliance & Regulatory (LGPD)
- **Base legal:** consentimento explícito e granular no cadastro (checkbox obrigatório) para tratamento de dado pessoal + contato comercial (follow-up).
- **Registro de consentimento:** guardar `consent_version` (texto vigente), `consent_at` (timestamp) e `consent_ip_hmac` (IP com HMAC — reusar o util já usado em `/api/nps/respond`). Nunca guardar IP em claro.
- **Minimização/finalidade:** coletar só o necessário (documento, nome, contato, tipo). Documento armazenado **apenas em dígitos**.
- **Retenção & revogação:** política de expurgo por prazo (a definir — pendência de go-live) e opt-out em toda comunicação.
- **PII na superfície pública:** leitura pública só via **RPC `SECURITY DEFINER`** que devolve PII **apenas quando o token é acionável** (molde `validate_nps_token`). A landing nunca expõe lista de CPFs, `tiny_id` ou tokens de terceiros.

### Technical Constraints
- **Segurança da escrita pública:** captura via rota com **admin client** (service role, server-only), protegida por **Turnstile + rate limit por IP e por CPF**; adicionar a rota à allowlist `isPublicRoute` do middleware.
- **Rate limit atual é em memória (por instância)** — mitigação primária para o pico é **Turnstile + limites por CPF**; **Upstash** fica como decisão pós-teste de carga (não no MVP).
- **Performance:** submit **<1s p95** — Tiny **fora do hot path**; toda chamada ao ERP é assíncrona.
- **Disponibilidade/resiliência:** o fluxo do participante **não pode depender do Tiny**. Fila durável com estados e retry garante que indisponibilidade do ERP por horas não afete a captura.
- **Idempotência ponta-a-ponta:** idempotency-key no submit (double-tap/retry) + 1 job por `registration_id` + upsert `clients` `onConflict: tiny_id`.

### Integration Requirements (Tiny ERP V3)
- **Auth reusada:** OAuth em `app_settings.tiny_oauth_tokens` + `getValidAccessToken()` (refresh automático). Nenhuma mudança no fluxo de token.
- **Criar/achar contato:** extrair a lógica existente (`create-or-find` + `applySalesChannelToTinyContact`) para um **service interno** — **não** chamar `/api/tiny/create-contact` (rota pública sem auth, CORS `*`).
- **Mapa de Tipo de Contato:** `DENTISTA→"dentista"`, `DISTRIBUIDORA→"distribuidora / dental"`, `Outro→CONSUMIDOR→"cliente"`. ⚠️ **A forma do campo `tipos` na V3 não foi validada** — manter o duplo-write (marcador `canal:` + `tipos`) e o **retry sem canal** já existentes; incluir uma tarefa de validar contra resposta real.
- **Sem rate limit nativo para o Tiny:** **construir throttle** (fila 2 req/s, estilo `src/lib/bling/rate-limiter.ts`) para o catch-up da fila.
- **Log:** reusar `tiny_sync_logs` (`entity_type`, `direction`, `status`, `error_message`).
- **Confirmação:** e-mail via **Resend** (canal já ligado no NPS); adicionar template React Email dedicado.

### Multi-app / Multi-tenant (Supabase compartilhado com `adds-rep-app`)
- **Regra de ouro:** `clients` é lido pelo rep-app. **Só promover a `clients`** os qualificados/Dentistas, com **marcador de origem "congresso"**; não qualificados ficam em `event_registrations`. Evita flood nas telas do rep-app.
- Tabelas novas `event_*`/`tiny_contact_sync_jobs` **não** são lidas pelo rep-app hoje → risco cruzado concentrado em `clients`.
- RLS de tudo via `get_user_role()` (MASTER/GESTOR) + `GRANT service_role`; escrita pública só por rota admin/RPC.

### Risk Mitigations (domínio)
- **Fraude de brinde:** retirada atômica + 1 redemption por registration + trilha `redeemed_by/at`.
- **Duplicidade de CPF** (document não-único, formatos mistos): dedup por **dígitos normalizados** (RPC já faz) + `create-or-find` busca antes de criar no Tiny + conciliação manual pós-evento.
- **Vazamento de PII:** RPC condicional + admin só server-side.
- **Enumeração de CPF:** rate limit no lookup (já existe padrão em `find-by-document`).

## Web App - Requisitos Específicos

### Project-Type Overview
Duas superfícies web distintas no mesmo módulo, com perfis opostos de otimização:
- **Superfície pública** (`/congressos/[slug]`): server-rendered (RSC) com um **wizard cliente mínimo**; prioridade absoluta a peso/latência (3G de pavilhão). Sem SEO, sem chrome de dashboard (layout `(public)`).
- **Superfície interna** (`(dashboard)/congressos`): client-heavy com TanStack Query + `DataTable`; prioridade a produtividade (busca rápida, feedback forte). Herda sidebar/header e auth do dashboard.

### Technical Architecture Considerations
- **SPA ou MPA:** **MPA/RSC** (Next.js App Router). Público = RSC + ilha cliente pequena para o wizard/lookup; interno = páginas client com Query. **Sem Server Actions** (padrão do repo: service client + Query, ou API route + fetch).
- **Real-time:** **não necessário** no público. Interno usa **refetch/invalidations** do TanStack Query após mutações; feedback de retirada é imediato pela própria mutation. Supabase Realtime é **opcional fora do MVP** (ex.: dashboard ao vivo).
- **Estado/dados:** TanStack Query v5 (cache/servidor), Zustand só para UI se necessário (respeitando a regra de seletores). Formulários com react-hook-form + zod (schemas em `src/lib/validations.ts`).

### Browser Matrix
- **Público (crítico):** iOS Safari (últimas 2 versões), Android Chrome (últimas 2), Samsung Internet. Foco em smartphones; degradar graciosamente em conexões lentas.
- **Interno:** Chrome/Edge desktop + tablets (operação no balcão). Sem exigência de browsers legados.

### Responsive Design
- **Mobile-first real**: layout de uma coluna, **alvos de toque ≥ 48px**, uso de uma mão, tipografia grande e **alto contraste** (luz de pavilhão), `inputmode="numeric"` no CPF, sem hover-dependência.
- Reuso do layout `(public)` (glass header, mobile-first já existente) e das cores de marca (`--adds-navy/orange/blue`).
- Interno responsivo para tablet (busca + botão de retirada grandes).

### Performance Targets
- **Landing pública:** JS inicial enxuto (meta de bundle da ilha cliente **< ~60KB gzip**), **LCP < 2,5s em 3G**; QR gerado client-side com `qrcode` (leve) só na tela de sucesso (code-split).
- **Submit < 1s p95** (Tiny fora do hot path).
- **Lookup CPF < 1s** (RPC indexado + rate limit).
- Sem imagens pesadas na landing; assets estáticos com cache.

### SEO Strategy
- **Nenhum SEO** — a landing é página de captura privada por evento (slug/token) com fluxo de PII. **`noindex, nofollow`** (meta robots) e fora de sitemap. Interno é autenticado (naturalmente não indexável).

### Accessibility Level
- Meta **WCAG 2.1 AA no essencial**: contraste adequado, `<label>` associado a cada campo, foco visível e ordem lógica, mensagens de erro programaticamente ligadas ao campo, estados de loading anunciados. Chips de "Tipo" acessíveis por teclado/leitor de tela.

### Implementation Considerations
- Adicionar a rota pública à allowlist `isPublicRoute` do middleware.
- Dependência nova aprovada: **`qrcode`** (geração). Scanner de câmera **fora do MVP**.
- Reusar `DataTable` compartilhado e o padrão de página de `contacts` para a tela interna.
- Turnstile carregado de forma assíncrona para não pesar o first paint.

## Project Scoping & Phased Development

### MVP Strategy & Philosophy
- **Abordagem de MVP:** *problem-solving MVP* — resolver o problema real do estande **ponta a ponta** para o **primeiro congresso**: participante retira brinde só com CPF → vira lead qualificado no CRM/Tiny → equipe controla retirada → gestor exporta lista. Fatia vertical fina, mas completa e confiável.
- **Filosofia:** maximizar **reuso de infra existente** (RPC de CPF, contato Tiny, Resend, RPCs de token, layout público, DataTable) para reduzir superfície nova ao essencial: **página pública + fila durável + tela interna + crédito**.
- **Resource Requirements:** 1 dev full-stack com contexto do repo; esforço concentrado em E0–E2 (fundações + fila). Dependência nova mínima (`qrcode`). Turnstile (chave de site). Sem novas contas de terceiros no MVP (WhatsApp/Upstash adiados).

### MVP Feature Set (Phase 1)
**Jornadas suportadas:** J1 (cliente existente), J2 (novo + recuperação offline), J3 (operador/retirada), J4 (gestor/dashboard+export).

**Must-Have Capabilities:**
- **E0** Fundações de dados + RLS + RPCs + permissões + regen de types.
- **E1** Página pública CPF-first (lookup, confirma/preenche, QR+código, autosave/retry offline, Turnstile, idempotency-key, `noindex`).
- **E2** Sync assíncrono resiliente (fila durável + backoff + throttle; promoção seletiva a `clients` com marcador de origem; log).
- **E3.1** E-mail de confirmação (Resend + template).
- **E4** Controle de brindes interno (busca, **retirada atômica**, dashboard do evento, export CSV; sem câmera).
- **E5.1** Cashback: geração com snapshot + exibição no perfil; resgate manual.
- **E6.2** Teste de carga do pico **antes do evento** (gate de go-live).

### Post-MVP Features
**Phase 2 (Growth / fast-follow):**
- WhatsApp de confirmação (Meta Cloud API, canal plugável).
- Resgate automatizado de cashback (cupom/pricing/orders).
- Scan de QR por câmera (`html5-qrcode`).
- Rate limit distribuído (Upstash) — pós teste de carga.
- Multi-brinde por evento + regras de estoque rígidas.

**Phase 3 (Expansion):**
- Follow-up comercial automatizado pós-congresso; NPS pós-evento integrado; atribuição de conversão fim-a-fim (→ Meta CAPI); self-service de eventos.

### Risk Mitigation Strategy
- **Technical Risks:** maior risco é **pico + resiliência da fila** → fila durável com retry/backoff + throttle Tiny + **teste de carga obrigatório antes do evento**; risco secundário é a **forma do campo `tipos` na V3** → manter duplo-write + retry-sem-canal e validar contra resposta real numa tarefa de E2.
- **Market Risks:** ausência de WhatsApp pode frustrar quem espera confirmação por Zap → mitigado por **e-mail + QR/código na tela** (confirmação imediata sem depender de terceiros) e WhatsApp como fast-follow rápido.
- **Resource Risks:** se o prazo apertar, **ordem de corte:** E5.1 (cashback) → S4.3 (já fora) → Turnstile (fica só rate-limit) → (WhatsApp já é fast-follow). **Nunca cortar:** fila durável (E2) e retirada atômica (E4) — são o núcleo anti-falha/anti-fraude.

## Functional Requirements

### Gestão de Eventos (Edições)
- **FR1:** Um gestor pode criar e editar edições de congresso (nome, slug, local, datas, brinde, estoque do brinde).
- **FR2:** Um gestor pode ativar/desativar uma edição, controlando se o pré-cadastro público está aberto.
- **FR3:** Cada edição possui um link/QR público próprio para o estande.
- **FR4:** Um gestor pode configurar o cashback por edição (habilitar; tipo; valor; condições de resgate por valor/quantidade mínima; elegibilidade; validade).
- **FR5:** O sistema suporta múltiplas edições simultâneas e independentes (multi-evento).

### Captura Pública (Pré-cadastro)
- **FR6:** Um participante acessa a página pública de uma edição via QR/link, sem autenticação.
- **FR7:** Um participante informa apenas CPF/CNPJ como primeiro passo.
- **FR8:** O sistema identifica se o participante já é cliente a partir do documento informado.
- **FR9:** Um participante já cadastrado confirma seus dados em uma única ação para liberar o brinde.
- **FR10:** Um participante novo completa um cadastro curto (nome, contato, tipo de contato) para liberar o brinde.
- **FR11:** Um participante registra consentimento LGPD antes de concluir o cadastro.
- **FR12:** O sistema preserva os dados digitados e reenvia automaticamente em falha de rede, sem duplicar o cadastro.
- **FR13:** Ao concluir, o participante recebe o comprovante do brinde (QR + código curto) na tela.

### Identidade & Deduplicação
- **FR14:** O sistema deduplica participantes por documento normalizado (ignorando formatação).
- **FR15:** O sistema vincula o pré-cadastro a um cliente existente quando houver correspondência.
- **FR16:** O sistema classifica o participante por tipo de contato (Dentista / Distribuidora / Outro).

### Brinde & Resgate
- **FR17:** Cada pré-cadastro gera um brinde único resgatável (token + código curto).
- **FR18:** Um operador localiza um participante por nome, documento ou código.
- **FR19:** Um operador marca o brinde como retirado.
- **FR20:** O sistema impede retirada em duplicidade e informa quando e por quem já foi retirado.
- **FR21:** O sistema registra quem entregou e o horário da retirada.
- **FR22:** O sistema exibe o estoque do brinde por edição (retiradas vs disponível) de forma **informativa**: alerta visualmente quando zera, mas **não bloqueia** a retirada no MVP. Bloqueio rígido é opção **configurável por edição na Fase 2**.

### Sincronização com Tiny (ERP)
- **FR23:** O sistema cria/atualiza o participante qualificado como contato no Tiny com o Tipo de Contato correto, de forma assíncrona.
- **FR24:** O sistema promove a cliente do CRM apenas participantes qualificados, marcando a origem "congresso".
- **FR25:** O sistema reprocessa automaticamente falhas transitórias de sincronização (retentativas com espaçamento crescente), sem intervenção manual.
- **FR26:** O fluxo do participante permanece funcional mesmo com o ERP indisponível.
- **FR27:** Um gestor visualiza o status/log de sincronização de cada cadastro.

### Confirmações
- **FR28:** O sistema envia confirmação por e-mail ao participante após o cadastro.
- **FR29:** O sistema registra o status de envio de cada confirmação e permite retentativa/reenvio.
- **FR30 (Fase 2):** O sistema envia confirmação por WhatsApp.

### Cashback / Crédito
- **FR31:** O sistema gera um crédito de cashback no cadastro quando a edição tem cashback ativo e o participante é elegível, congelando (snapshot) as regras vigentes.
- **FR32:** O sistema garante no máximo um crédito por documento por edição.
- **FR33:** Um gestor visualiza o crédito e suas condições no perfil do cliente.
- **FR34:** Um gestor registra o resgate (baixa) manual de um crédito, validando as condições no momento do uso.
- **FR35 (Fase 2):** O sistema aplica/resgata o crédito automaticamente em um pedido elegível.

### Controle Interno, Relatórios & Segurança
- **FR36:** Um gestor acompanha um dashboard por evento (cadastros, retiradas, taxa de conversão, estoque, saúde da fila).
- **FR37:** Um gestor exporta a lista qualificada do evento (CSV) com filtros.
- **FR38:** O acesso às telas e ações internas é restrito por papel: **`congressos.operate`** (buscar participante, marcar retirada) = MASTER, GESTOR, PRESTADOR; **`congressos.manage`** (CRUD de edições, config de cashback, dashboard completo, export CSV) = MASTER, GESTOR. **Nenhuma role nova** é criada.
- **FR39:** A página pública é protegida contra abuso (limitação de tentativas + verificação anti-bot).
- **FR40:** O sistema registra o consentimento com versão, data e IP protegido.
- **FR41:** A superfície pública nunca expõe dados pessoais de terceiros nem identificadores internos.

## Non-Functional Requirements

### Performance
- **NFR-P1:** Landing pública com **LCP < 2,5s em 3G**; JS da ilha cliente **< ~60KB gzip**.
- **NFR-P2:** Lookup de CPF **p95 < 1s**; submit do pré-cadastro **p95 < 1s** (Tiny nunca no caminho síncrono).
- **NFR-P3:** Na tela interna, busca de participante retorna em **< 2s**; retirada confirma em **< 1s**.

### Security
- **NFR-S1:** Escrita pública apenas por rota server-side com service role; **a chave service-role nunca é exposta ao cliente**.
- **NFR-S2:** Captura protegida por **Turnstile + rate limit por IP e por CPF**; lookup com rate limit contra enumeração de documento.
- **NFR-S3:** Tokens de brinde **imprevisíveis (≥128 bits de entropia)**; leitura pública apenas via RPC `SECURITY DEFINER` que revela PII só quando o token é acionável.
- **NFR-S4:** RLS ativa em **todas** as tabelas novas (`get_user_role()`); `service_role` com grant explícito; nenhuma policy aberta a `anon`.
- **NFR-S5:** Documento armazenado só em dígitos; IP apenas como HMAC.

### Scalability
- **NFR-SC1:** Suportar o **pico do evento** sem degradar o submit acima de p95 < 1s — alvo a calibrar no teste de carga (baseline sugerido: **≥ 300 cadastros/min**).
- **NFR-SC2:** O catch-up da fila respeita o limite do Tiny (**~2 req/s**) sem estourar a API, mesmo com backlog de milhares de jobs.
- **NFR-SC3:** Reprocessamento é **idempotente** (reentrância segura sem duplicar contato/cliente/brinde).

### Reliability / Availability
- **NFR-R1:** O fluxo do participante tem **zero dependência** de disponibilidade do Tiny.
- **NFR-R2:** Fila **durável**: nenhum job perdido; **retry até 5× com backoff crescente**; jobs esgotados marcados como "mortos" e sinalizados ao gestor.
- **NFR-R3:** Confirmação (e-mail) com registro de status e **retentativa** automática.

### Accessibility
- **NFR-A1:** **WCAG 2.1 AA no essencial** na página pública: contraste adequado, `<label>` por campo, foco visível, erros ligados ao campo, alvos de toque ≥ 48px.

### Integration
- **NFR-I1:** Integração Tiny via OAuth existente (sem alterar o fluxo de token), com **throttle**, **log em `tiny_sync_logs`** e idempotência por documento/`tiny_id`.
- **NFR-I2:** E-mail via Resend com templates React Email; envio desacoplado (fila) do cadastro.

### Compliance (LGPD)
- **NFR-C1:** **100% dos cadastros** com consentimento **versionado + timestamp + IP (HMAC)**.
- **NFR-C2:** PII nunca exposta em superfície pública fora do token acionável; identificadores internos (`tiny_id`) nunca expostos.
- **NFR-C3:** Política de **retenção e expurgo** por prazo definido (valor exato = pendência de go-live) e opt-out em comunicações.

## Dependências & Decisões Técnicas

- **`qrcode` (geração de QR): APROVADA** para o MVP.
- **Scanner de câmera (`html5-qrcode`): FORA do MVP** — a operação interna usa busca por nome/CPF + código de 6 dígitos. Entra na Fase 2.
- **Cloudflare Turnstile: APROVADO** para o MVP (anti-bot na captura pública).
- **Upstash Redis (rate limit distribuído): ADIADO** — manter rate limit em memória + Turnstile; reavaliar após o teste de carga (E6.2). O rate limit atual (`src/lib/rate-limit.ts`) é por instância; Turnstile é a defesa primária no pico.
- **Frequência do cron de drain:** 1–2 min é **viável** (o `vercel.json` já tem 5 crons → plano **Pro/Enterprise**, que libera crons de até 1/min). `after()` atua como fast path; o cron é a rede de segurança/retry. Confirmar o plano no painel Vercel antes do deploy.
- **Reuso obrigatório (não reinventar):** RPC `find_client_by_document`; lógica de contato Tiny (`create-or-find` + `applySalesChannelToTinyContact`) extraída para service interno; padrão de token público via RPC `SECURITY DEFINER` (molde `validate_nps_token`); e-mail via Resend (molde canal NPS); layout `(public)`; `DataTable` compartilhado.

## Pendências de Go-Live (não bloqueiam desenvolvimento)

Itens que **não travam a implementação** (viram configuração/conteúdo), mas são obrigatórios antes de abrir ao público:

- **Texto de consentimento LGPD** (base legal, finalidade, prazo de retenção, opt-out) — versionado no cadastro.
- **Conteúdo e remetente do e-mail de confirmação** — validar **SPF/DKIM de `addsbrasil.com.br`** no Resend (`RESEND_FROM_EMAIL`).
- **Valores reais de cashback do 1º evento** — inseridos como **configuração da edição** (tipo, valor, condições, elegibilidade, validade), não como código.
- **Confirmar plano Vercel** no painel (habilita a frequência do cron de drain).
- **Chaves do Turnstile** (site key + secret) provisionadas nas envs.
