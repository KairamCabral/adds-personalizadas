# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Source-of-truth docs

`AGENTS.md` (repo root) holds the full project rules — read it before any non-trivial change. This file is the short version. Other authoritative docs:

- `docs/architecture.md` — Tiny ↔ CRM event-driven integration (queues, webhooks, polling, RLS for the `tiny_*` tables)
- `docs/project-brief.md` — product context
- `docs/USERS_AND_PERMISSIONS.md` — RBAC details
- `.cursor/rules.md` — overlapping conventions (kept in sync with `AGENTS.md`)

## Commands

```
pnpm dev        # next dev --turbopack
pnpm build      # production build (must pass before PR)
pnpm test       # vitest run (also required before PR)
pnpm test:watch # vitest watch
pnpm lint       # next lint
pnpm db:types   # regenerate src/types/database.types.ts (needs $SUPABASE_PROJECT_ID)
pnpm db:migrate # supabase db push
pnpm db:reset   # supabase db reset
```

Run a single test file: `pnpm vitest run src/lib/tiny/tiny-webhook-parsing.test.ts`. Vitest is configured with `environment: "node"` and only picks up `src/**/*.test.ts` (see `vitest.config.ts`).

**Package manager is `pnpm@10.6.0` — never `npm` or `yarn`.**

## High-level architecture

Next.js 15 App Router monolith on Vercel, Supabase (Postgres + Auth + Storage + Realtime) as backend. Strict TypeScript, RSC-first.

```
src/
├── app/
│   ├── (auth)/        # login, password reset
│   ├── (dashboard)/   # logged-in area: pipeline, contacts, dashboard, quotes,
│   │                  # representantes, settings, tiny — wrapped by sidebar layout
│   ├── (public)/      # public quote, art-approval, supplier portals
│   └── api/           # ~55 REST routes (admin, art, auth, bling, clients, cron,
│                      # email, integrations, orders, products, push, quote, quotes,
│                      # supplier, tiny, users, webhooks)
├── components/        # shadcn/ui in components/ui/, feature folders elsewhere
├── lib/               # supabase/ (browser/server/middleware/admin), tiny/, bling/,
│                      # pricing/, email-templates/, rate-limit, permissions, utils
├── services/          # business logic called from server (orders, clients, tiny,
│                      # audit, dashboard, …)
├── hooks/, contexts/, providers/, stores/  # client-side state — Zustand for UI,
│                                            # TanStack Query v5 for server cache
└── types/database.types.ts  # GENERATED via `pnpm db:types` — never hand-edit
supabase/migrations/   # schema, RLS policies, RPCs (50+ files, applied in order)
middleware.ts          # delegates to lib/supabase/middleware.ts; excludes
                       # api/tiny/webhook, api/webhooks, api/cron from session check
```

Data flow for any mutation: **UI component → service in `src/services/` → Supabase client → Postgres → invalidate TanStack Query → audit log + order_history when relevant → Sonner toast**.

### Supabase clients (critical)

Only `@supabase/ssr` is used. There are four entry points in `src/lib/supabase/`:
- `client.ts` (browser) · `server.ts` (RSC/route handlers) · `middleware.ts` (session refresh) · `admin.ts` (service role, server-only)

Cookie adapters MUST use only `getAll()` / `setAll()`. Never reintroduce `@supabase/auth-helpers-nextjs`, `createClientComponentClient`, or per-key `cookies().get/set/remove` — they break the app.

RLS is always assumed active. New tables ship with RLS + policies in the same migration. Service-role key is server-only (API routes / `lib/supabase/admin.ts`).

### Tiny ERP integration

Two ingest paths exist (legacy + current):
- `POST /api/tiny/webhook/[secret]` — secret in URL path, the canonical entry point
- `POST /api/webhooks/tiny` — accepts `?token=` or `Bearer` token (legacy)

Central processor: `src/lib/tiny/process-webhook-notification.ts`. The parser tolerates Tiny's real-world quirks (JSON sent as `Content-Type: text/plain`, plus form-encoded `tipo=&dados=`) — covered by `src/lib/tiny/tiny-webhook-parsing.test.ts`. Always run `pnpm test` after touching parse logic.

Raw events are persisted to `tiny_webhook_events` (RLS: MASTER reads, service role writes). Heavy work runs via Next's `after()`. Vercel cron (`vercel.json`) drives `/api/cron/tiny-sync-incremental` (Mon–Fri 09:00 UTC), `/api/cron/tiny-refresh-token` (daily 06:00), and `/api/push/send` (daily 09:00) — all guarded by `CRON_SECRET`.

Required env: `TINY_WEBHOOK_SECRET`, `TINY_CLIENT_ID`, `TINY_CLIENT_SECRET`, `TINY_API_URL=https://api.tiny.com.br/public-api/v3` (the `public-api/v3` path is mandatory — `api3` is wrong). `NI_WEBHOOK_URL` is optional fan-out.

The full event-driven design (queue tables, idempotency rules, polling fallback, manual link/preview endpoints, dashboard) is in `docs/architecture.md` — consult it before extending the integration.

### Order pipeline (enum)

`AUTOMATICO → FAZER → AJUSTE → APROVACAO → AGUARDANDO_APROVACAO → CONFIRMACAO → APROVADO → PRODUCAO → EXPEDICAO → FINALIZADO → ENTREGUE → FATURADO → ARQUIVADO`

Roles: **MASTER** (full CRUD) · **GESTOR** (no client/order delete) · **PRESTADOR** (read clients/orders, work on assigned only) · **REPRESENTANTE** (mobile app `adds-rep-app` only, restrictive RLS).

## Conventions worth knowing

- **Files** kebab-case (`prospect-card.tsx`, `use-prospects.ts`). **Components** PascalCase. **Hooks** `useFoo`. **Services** camelCase. **Stores** `useXStore`. **DB** snake_case, **DB enums** UPPER_CASE.
- Imports use `@/*` (mapped to `src/*` in `tsconfig.json`). Use `import type` for types.
- Page-specific components live in `_components/` next to the route; shared ones in `src/components/`.
- UI is pt-BR, dates DD/MM/YYYY, currency BRL. Brand colors: `--adds-blue` `#21add6`, `--adds-orange` `#f07d00`, `--adds-navy` `#0b4269`.
- `next.config.ts` already sets CORS for `/api/*` (mobile rep app consumes these) and security headers globally — don't loosen without reason.

## Convenções de banco (CRÍTICO)

- Coluna de preço: `price` (NUNCA `unit_price`).
- Coluna de ativo/inativo: `is_active` (NUNCA `active`).
- Status de habilitação unificado em `profiles.is_active` — não existe tabela separada de status de representante.
- Em qualquer dúvida sobre schema, **usar o MCP `addscrm`** para consultar o banco real (`mcp__addscrm__list_tables`, `mcp__addscrm__execute_sql`) antes de propor SQL ou inventar coluna. Quando MCP não estiver disponível, ler `src/types/database.types.ts` ou as migrations.
- Outros nomes que costumam ser inventados (sempre os corretos primeiro):
  - `products`: `available_colors` JSONB `[{key,label,hex,image_url}]` (não `colors`); não existe `sku`.
  - `clients`: campos separados `street`/`number`/`neighborhood`/`complement` (não `address`), `zip_code` (não `cep`), `document` sem formatação; não existe `segment` (está em `rep_prospects`).
  - `rep_visits.address_detected` / `rep_client_links.visit_deadline_at` / `rep_goals.month` DATE (filtrar com `'YYYY-MM-DD'` completo).
  - `rep_activity_log`: `action`, `entity_type`, `entity_id`, `metadata` — não tem `result` nem `client_id`.

## Multi-app compartilhado (REGRA DE OURO)

Este repo (`adds-crm` web) compartilha o **mesmo Supabase** com `adds-rep-app` (mobile React Native).

- Toda mudança de schema afeta os DOIS apps.
- Antes de propor migration, RLS ou alteração de coluna: avaliar impacto no rep-app e **declarar explicitamente** no plano (ex.: "isso afeta o rep-app porque a tela X consome a coluna Y").
- Em dúvida sobre o efeito cruzado, **parar e perguntar** antes de implementar — não assumir.
- RLS de tabelas tocadas pelo rep-app (prefixo `rep_*`, `clients`, `orders`, `profiles`) precisa de revisão multi-tenant antes de qualquer ajuste.

## Zustand — regra inegociável

- Selectors **nunca** usam `.filter() / .map() / .some() / .reduce()` inline, nem chamam função que retorne objeto/array novo.
- Selecionar o array cru e derivar com `useMemo` no componente. Inline = re-render infinito (`Maximum update depth exceeded`) — já tivemos esse bug, não repetir.

```ts
// ❌ const count = useStore((s) => s.items.filter(x => x.active).length)
const items = useStore((s) => s.items)
const count = useMemo(() => items.filter(x => x.active).length, [items])
```

## DO NOT CHANGE

- **Schema Supabase:** nunca alterar sem migration nova explícita em `supabase/migrations/` (ou equivalente local). Não rodar DDL ad-hoc.
- **Arquivos `.env.local`, `.env.production`:** não tocar. `.env*` nunca entram no git.
- **Dependências:** não rodar `pnpm install` / `npm install` / `yarn` sem confirmação prévia.
- **RLS:** não modificar policy sem entender o impacto multi-tenant (web + rep-app + portais públicos).
- **`src/types/database.types.ts`:** gerado automaticamente — editar manualmente está proibido.

## Workflow comigo

- **Plan Mode** para qualquer mudança que toque mais de 2 arquivos — apresentar plano e esperar OK antes de editar.
- Diffs cirúrgicos: não reformatar/refatorar código não relacionado à tarefa.
- Antes de editar, **ler arquivos vizinhos** para captar o padrão local (naming, estrutura, imports).
- Em dúvida arquitetural, **parar e perguntar** — não decidir sozinho.
- **Não inventar APIs, métodos ou imports.** Em incerteza, ler/grep o código antes; se for biblioteca externa, consultar a doc.
- Antes de declarar tarefa concluída: rodar `pnpm test` (quando aplicável), `pnpm lint` e `pnpm build` (ou tsc) e **reportar o resultado** — sucesso ou falhas explícitas. Se não der pra rodar, dizer "não consegui validar" em vez de assumir verde.

## Modelo a usar

- **Opus 4.7** (default) → planejamento, refactors grandes, debug complexo, decisões arquiteturais.
- **Sonnet 4.6** → execução de tarefas claras (criar componente, ajustar service, escrever teste).
- Trocar via `/model` conforme a tarefa exigir. Se eu estiver no modelo errado para o trabalho pedido, sinalizo antes de começar.

## Padrão de commits

Conventional Commits **com escopo**:

- `feat(crm): ...` / `fix(crm): ...` — features e correções da web app
- `feat(db): ...` — migrations / mudanças de schema
- `chore(repo): ...` — configs, CI, monorepo, tooling
- `feat(S15): ...` — quando a story BMAD for o escopo natural (referencia o ID)
- Demais tipos: `refactor:`, `docs:`, `test:`, `style:`

Antes de mergear: `pnpm test && pnpm build` precisam passar. Nunca push direto em `main`, nunca force-push em `main`, nunca commitar `.env*`. Se mexeu no schema, regerar `src/types/database.types.ts` com `pnpm db:types` e versionar a migration com RLS policies.

## Bug pendente conhecido

- **Popover state bug no pipeline Kanban.** Ao atacar isso, **alinhar comigo antes** — não tentar resolver de forma autônoma; o caminho da correção depende de decisão de UX/estado.
