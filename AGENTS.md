# AGENTS.md — adds-crm

Universal project rules. Read before any code change. Nearest file wins (override via subdir `AGENTS.md`).

## Quick Facts

- **Project:** adds-crm (ADDS Brasil) — CRM B2B de pedidos personalizados de higiene bucal
- **Stack:** Next.js 15 (App Router, Turbopack) · React 19 · TypeScript · Supabase · Tailwind · shadcn/ui · TanStack Query · Zustand · React Hook Form + Zod · Vitest
- **Package manager:** pnpm@10.6.0 (NUNCA npm/yarn)
- **Hosting:** Vercel · **URL prod:** https://personalizadas.adds.com.br

## Commands

```
pnpm dev            # dev server (next dev --turbopack)
pnpm build          # production build
pnpm test           # vitest
pnpm db:types       # gera src/types/database.types.ts
```

Antes de PR: `pnpm test && pnpm build` devem passar.

## Architecture

```
src/
├── app/              # App Router
│   ├── (dashboard)/  # área logada (sidebar + guard client-side)
│   ├── (public)/     # quote, approval, fornecedor
│   ├── (auth)/       # login, reset
│   └── api/          # ~55 rotas REST
├── components/       # Radix + shadcn em ui/, layouts
├── lib/              # supabase client, tiny, bling, email, utils
├── services/         # regras de negócio (clients, orders, tiny, audit)
├── hooks/            # sessão, UI, realtime
├── stores/           # Zustand
└── types/database.types.ts  # GERADO — nunca editar manualmente
supabase/migrations/  # schema, RLS, RPCs
```

## Roles & Access

- **MASTER** — CRUD total
- **GESTOR** — quase tudo, sem deletar clientes/pedidos
- **PRESTADOR** — lê clientes/pedidos, trabalha em atribuídos
- **REPRESENTANTE** — só acessa via app mobile (`adds-rep-app`), RLS restritiva

## Pipeline de status de pedidos (enum)

`AUTOMATICO → FAZER → AJUSTE → APROVACAO → AGUARDANDO_APROVACAO → CONFIRMACAO → APROVADO → PRODUCAO → EXPEDICAO → FINALIZADO → ENTREGUE → FATURADO → ARQUIVADO`

## Database — Nomes REAIS (consultar antes de queryear)

Muitas features antigas inventaram nomes. Os corretos são:

### `products`
- `price` (NÃO `unit_price`)
- `is_active` (NÃO `active`)
- `available_colors` JSONB: `[{"key","label","hex","image_url"}]` (NÃO `colors`)
- `tiny_color_map` JSONB — cor→Tiny ID
- `cost_price`, `supplier_*`
- ❌ `sku` não existe em products

### `clients`
- `street`, `number`, `neighborhood`, `complement` (NÃO campo único `address`)
- `zip_code` (NÃO `cep`)
- `person_type` enum (`fisica`|`juridica`)
- `document` — CPF/CNPJ SEM formatação
- `created_by` UUID
- ❌ `segment` não existe em clients (existe em `rep_prospects`)

### `orders`
- `status` — enum acima
- `rep_id` UUID, `origin` TEXT (`'APP_REPRESENTANTE'`|null)
- `is_personalized`, `discount_percentage`, `discount_pending_approval`
- `personalization_data` JSONB, `notes` TEXT

### `order_items`
- `product_id`, `product_name`, `quantity`, `unit_price`, `total_price`
- `color`, `color_name`

### `rep_*` tables
- `rep_visits.address_detected` (NÃO `address`)
- `rep_client_links.visit_deadline_at` (NÃO `visit_deadline`)
- `rep_goals.month` DATE — filtrar SEMPRE com `'YYYY-MM-DD'` completo
- `rep_activity_log`: `action`, `entity_type`, `entity_id`, `metadata` JSONB. ❌ Não tem `result` nem `client_id`

### `tiny_webhook_events`
- Auditoria de webhooks. RLS: MASTER lê, service_role escreve.

## Supabase Client (CRÍTICO — não errar)

✅ **USAR:**
- `@supabase/ssr` como único pacote
- Cookies: APENAS `getAll()` e `setAll()` nos adapters
- Padrão em `src/lib/supabase/` (browser, server, middleware separados)

❌ **NUNCA:**
- `@supabase/auth-helpers-nextjs` — DEPRECATED, QUEBRA a app
- `createClientComponentClient`, `createMiddlewareClient` (legacy)
- `cookies().get()`, `cookies().set()`, `cookies().remove()` nos adapters Supabase

### RLS — sempre ATIVA

Presumir que toda tabela tem RLS habilitada. Ao criar migration nova, habilitar RLS + policies ANTES de produção. Nunca desabilitar RLS.

## Patterns Next.js 15

- **RSC first.** `'use client'` só em components com state local, forms, Web APIs, event handlers
- Client components sempre envelopados em `<Suspense>` com fallback
- Data fetching: server components OU `src/services/` chamado do server
- API routes em `src/app/api/*/route.ts`
- **Service role key APENAS em server-side** (API routes, lib server). NUNCA no client.
- CORS e headers de segurança já configurados em `next.config.ts` — não alterar sem motivo

## Zustand — REGRA DE OURO (infinite loop killer)

❌ **NUNCA** (causa `Maximum update depth exceeded`):
```typescript
const count = useStore((s) => s.items.filter(x => x.active).length)
const total = useStore((s) => s.items.reduce((sum, i) => sum + i.qty, 0))
const value = useStore((s) => s.computeValue()) // função retornando valor novo
```

✅ **SEMPRE:**
```typescript
const items = useStore((s) => s.items)
const count = useMemo(() => items.filter(x => x.active).length, [items])
```

Nunca usar `.filter()`/`.map()`/`.some()`/`.reduce()` dentro de seletores Zustand em components React. Selecionar array inteiro + derivar com `useMemo`.

## Naming Conventions

- **Arquivos:** kebab-case (`prospect-card.tsx`, `use-prospects.ts`)
- **Componentes:** PascalCase (`ProspectCard`)
- **Hooks:** camelCase com `use` (`useProspects`)
- **Services:** camelCase (`createVisit`)
- **Stores:** `useXStore` (`useCartStore`)
- **DB:** snake_case (tables, columns)
- **Enums DB:** UPPER_CASE

## Tiny ERP (atenção, código em evolução)

- Duas entradas de webhook:
  - `/api/webhooks/tiny` — auth via `?token=` ou `Bearer`
  - `/api/tiny/webhook/[secret]` — secret no path
- Processamento central: `src/lib/tiny/process-webhook-notification.ts`
- Parser aceita JSON com `Content-Type: text/plain` (Tiny real) e form `tipo=&dados=`
- Eventos persistidos em `tiny_webhook_events` (payload bruto + headers)
- Trabalho async via `after()` do Next
- Env: `TINY_WEBHOOK_SECRET` (obrigatório), `TINY_RELAY_URL` (opcional, lista vírgula-separada)
- Testes em `src/lib/tiny/tiny-webhook-parsing.test.ts` — rodar `pnpm test` após mudanças de parse

## UI / Styling

- shadcn/ui + Tailwind + Radix UI
- Mobile-first responsive
- Next.js `<Image>` com size data + lazy loading
- Otimizar Web Vitals (LCP, CLS, FID)
- `nuqs` para URL search params state (se precisar)

## Environment Variables

- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` — client OK
- `SUPABASE_SERVICE_ROLE_KEY` — **SÓ SERVER**
- `NEXT_PUBLIC_APP_URL` — para links absolutos
- `TINY_WEBHOOK_SECRET` — server
- `RESEND_API_KEY` — server (emails)

Nunca commitar `.env*`. Nunca retornar service role key em API responses.

## Testing

- Vitest unit tests
- Coverage obrigatório para: webhook parsing, pricing, RLS-sensitive services
- Sempre rodar `pnpm test && pnpm build` antes de merge

## Git / Commits

- Conventional Commits: `feat:`, `fix:`, `chore:`, `refactor:`, `docs:`, `test:`
- Branch `main` protegida, sempre via PR
- Commit snapshot antes de refatoração grande
- Nunca force-push em `main`

## Never Do

- ❌ `@supabase/auth-helpers-nextjs` (deprecated, quebra app)
- ❌ `.filter/.map/.reduce/.some` em seletores Zustand
- ❌ Inventar nome de coluna — consultar `database.types.ts` ou migrations
- ❌ Service role key em código client
- ❌ Deletar linhas em produção via query manual sem policy review
- ❌ Usar `npm` ou `yarn` (sempre `pnpm`)
- ❌ Commitar `.env*` ou credenciais
- ❌ Desabilitar RLS em tabela com dados reais
- ❌ Push direto em `main`
- ❌ Editar `src/types/database.types.ts` manualmente (é gerado)

## When In Doubt

1. Ler o código existente em `src/services/` ou `src/lib/` para padrão atual
2. Consultar `supabase/migrations/` para schema real
3. Perguntar ao usuário antes de inventar novo pattern
