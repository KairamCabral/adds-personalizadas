---
project_name: "adds-crm"
user_name: "Cabra"
date: "2026-04-17"
sections_completed:
  - technology_stack
  - language_rules
  - framework_rules
  - testing_rules
  - quality_rules
  - workflow_rules
  - anti_patterns
  - product_context
status: "complete"
rule_count: 28
optimized_for_llm: true
canonical_rules_source: "AGENTS.md"
---

# Project Context for AI Agents

_Este ficheiro orienta agentes de IA sobre o **adds-crm**. Regras normativas detalhadas (Supabase, Zustand, naming, Never Do, etc.) estão em **`AGENTS.md` na raiz** — aqui: resumo enxuto, âncoras e contexto que o `AGENTS.md` não substitui (integrações, fase do produto, cron)._

**Regra de ouro:** antes de implementar, ler **`AGENTS.md`** por completo; usar este ficheiro para localizar integrações e estado do projeto.

---

## Estado do produto (abril/2026)

- **Fase 2 entregue:** MVP histórico + 7 batches + Product Hub + Push notifications + webhooks Tiny em evolução contínua.
- **Modo atual:** manutenção e evolução — **não** tratar o sistema como MVP em construção; mudanças devem respeitar dados e fluxos em produção (**https://personalizadas.adds.com.br**, Vercel).

---

## Papéis e superfícies

| Papel | Onde |
|--------|------|
| **MASTER** | Web — CRUD total |
| **GESTOR** | Web — quase tudo; sem apagar clientes/pedidos |
| **PRESTADOR** | Web — lê; trabalha em itens atribuídos |
| **REPRESENTANTE** | App mobile **`adds-rep-app`** (Expo), **projeto separado**; partilha o **mesmo Supabase** com RLS específica |

Detalhes de permissão: ver **`AGENTS.md`** — secção **Roles & Access**.

---

## Technology Stack & Versions

_Valores indicativos; confirmar em `package.json` ao atualizar este ficheiro._

| Área | Stack |
|------|--------|
| App | Next.js 15 (App Router, Turbopack em dev), React 19, TypeScript 5.x |
| Dados | Supabase (Postgres, RLS, Realtime), tipos em `src/types/database.types.ts` (**gerado** — `pnpm db:types`) |
| UI | Tailwind, Radix, padrão shadcn em `components/ui`, `nuqs` para estado na URL |
| Estado / API cliente | TanStack Query, Zustand, React Hook Form + Zod |
| Testes | Vitest |
| Pacotes | **pnpm@10.6.0** apenas |

---

## Integrações ERP

### Tiny ERP (ativo, em evolução)

- **Duas entradas de webhook:**
  - `/api/webhooks/tiny` — autenticação via `?token=` **ou** header **Bearer** (`TINY_WEBHOOK_SECRET`).
  - `/api/tiny/webhook/[secret]` — secret no path (validação GET para o Tiny; POST processa).
- **Processamento central:** `src/lib/tiny/process-webhook-notification.ts` (parse + handlers por `tipo`).
- **Auditoria:** `tiny_webhook_events`; trabalho assíncrono com `after()` onde aplicável.
- Regras e variáveis de ambiente: **`AGENTS.md`** — secção **Tiny ERP**.

### Bling ERP (legado)

- Integração **OAuth** e APIs em **`src/app/api/bling/`** (ex.: `oauth/start`, `oauth/callback`, `sync`, `products`, `data`, `test`).
- Tratar como **legado**: alterações mínimas e alinhadas ao código existente em `src/services/bling.service.ts` e rotas atuais; não assumir paridade de features com Tiny.

---

## Vercel Cron

Configuração em **`vercel.json`** (`crons`):

| Path | Schedule (UTC) | Função típica |
|------|----------------|-----------------|
| `/api/cron/tiny-sync-incremental` | `0 9 * * 1-5` | Sync incremental Tiny → CRM (dias úteis) |
| `/api/cron/tiny-refresh-token` | `0 6 * * *` | Refresh de token Tiny |
| `/api/push/send` | `0 9 * * *` | Envio agendado (push / alertas diários) |

Outros jobs podem existir sob `src/app/api/cron/` (ex. `cleanup`). Autenticação dos crons: em geral **`Authorization: Bearer CRON_SECRET`** quando `CRON_SECRET` está definido — ver comentários em cada `route.ts`.

---

## Critical Implementation Rules

### Regras canónicas (não duplicar aqui)

Para implementação correta, **obrigatório** seguir o repositório:

| Tema | Fonte canónica |
|------|----------------|
| Cliente Supabase, cookies, RLS | **`AGENTS.md`** — **Supabase Client (CRÍTICO — não errar)** e **RLS — sempre ATIVA** |
| Seletores Zustand | **`AGENTS.md`** — **Zustand — REGRA DE OURO (infinite loop killer)** |
| Nomes de ficheiros, componentes, hooks, DB | **`AGENTS.md`** — **Naming Conventions** |
| Lista de proibições | **`AGENTS.md`** — **Never Do** |
| Colunas reais (`products`, `clients`, `orders`, `rep_*`, etc.) | **`AGENTS.md`** — **Database — Nomes REAIS** |
| Next.js 15, service role, CORS | **`AGENTS.md`** — **Patterns Next.js 15** |
| Variáveis de ambiente | **`AGENTS.md`** — **Environment Variables** |
| UI, testes, Git | **`AGENTS.md`** — **UI / Styling**, **Testing**, **Git / Commits** |

### Específico deste contexto (além do AGENTS.md)

- **Bling:** mudanças só com leitura prévia de `src/app/api/bling/**` e serviços associados; OAuth e tokens já modelados nas migrations — não reinventar fluxo.
- **Cron / push:** alterar `vercel.json` ou horários com consciência de **UTC** e de utilizadores em produção; testar rotas com o mesmo padrão de auth que os ficheiros existentes.
- **Representantes:** dados com `origin`/ `rep_id` e tabelas `rep_*` — respeitar RLS; app **`adds-rep-app`** não está neste repo.
- **Drift de documentação:** se regra mudar, **atualizar `AGENTS.md` primeiro**; este `project-context.md` deve apenas apontar ou resumir o que for exclusivo (integrações, fase, cron).

---

## Testing Rules

- Comandos e cobertura esperada: **`AGENTS.md`** — **Testing**.
- Após alterações em **parse de webhook Tiny:** correr `pnpm test` (ficheiros em `src/lib/tiny/*.test.ts`).

---

## Development Workflow Rules

- **`AGENTS.md`** — **Git / Commits**, **Commands** (incl. `pnpm test && pnpm build` antes de PR).

---

## Usage Guidelines

**Para agentes de IA**

1. Ler **`AGENTS.md`** na raiz antes de qualquer alteração de código.
2. Usar este **`project-context.md`** para integrações (Tiny, Bling, Cron), fase do produto e papéis/rep app.
3. Em dúvida sobre coluna ou policy: `database.types.ts` e `supabase/migrations/`, como em **`AGENTS.md`** — **When In Doubt**.

**Para humanos**

- Manter **`AGENTS.md`** como única fonte normativa detalhada; atualizar este ficheiro quando mudarem integrações, cron ou fase do produto.
- Rever trimestralmente se âncoras para `AGENTS.md` ainda batem com as secções (títulos podem mudar).

_Last updated: 17/04/2026_
