# ADDS CRM — Cursor AI Rules

## Projeto
CRM personalizado para gestão de pedidos de escovas personalizadas (ADDS Brasil).
Pipeline Kanban de 12 colunas com realtime, gestão de contatos, aprovação de arte e dashboard.

## Stack
- **Framework:** Next.js 15 (App Router) + TypeScript strict
- **UI:** Tailwind CSS + shadcn/ui + Radix UI
- **Database:** Supabase (PostgreSQL + Auth + Storage + Realtime)
- **State:** Zustand (UI) + TanStack Query v5 (server state)
- **Forms:** React Hook Form + Zod
- **DnD:** @dnd-kit/core + @dnd-kit/sortable
- **Charts:** Recharts
- **Email:** Resend
- **Deploy:** Vercel

## Convenções de Código

### Nomes de Arquivos
- Componentes: `kebab-case.tsx` (e.g., `kanban-board.tsx`)
- Hooks: `use-*.ts`
- Services: `*.service.ts`
- Stores: `*.store.ts`
- Types: `*.types.ts`
- Constants: Caps para enums, camelCase para objetos

### Imports
- Use absolute imports: `@/lib/...`, `@/components/...`, `@/hooks/...`
- Imports de tipo com `type`: `import type { X } from "..."`

### Componentes
- Server Components por padrão
- `"use client"` apenas quando necessário (interação, hooks, browser APIs)
- Colocar componentes específicos de página em `_components/` dentro da rota
- Componentes compartilhados em `src/components/`

### Data Flow
```
UI Component → Service (src/services/) → Supabase Client → PostgreSQL
                                                ↕
                                    TanStack Query (cache)
```

### Mutations
1. Chamar service function
2. Invalidar cache do TanStack Query
3. Registrar no audit_logs (ações sensíveis)
4. Registrar no order_history (mudanças de pedido)
5. Toast de feedback (Sonner)

### Segurança
- NUNCA expor `SUPABASE_SERVICE_ROLE_KEY` no client
- RLS é a camada primária de segurança
- Validar inputs com Zod antes de enviar ao DB
- Middleware verifica auth em todas as rotas protegidas

## Paleta de Cores (CSS Variables)
- **Azul ADDS:** `hsl(var(--adds-blue))` = #21add6
- **Laranja ADDS:** `hsl(var(--adds-orange))` = #f07d00
- **Navy ADDS:** `hsl(var(--adds-navy))` = #0b4269
- **Primary:** `hsl(var(--primary))` (azul ADDS)
- **Accent:** `hsl(var(--accent))` (laranja ADDS)

## Perfis de Usuário
- **MASTER:** Acesso total
- **GESTOR:** Tudo exceto: gerenciar MASTER, segurança, auditoria
- **PRESTADOR:** Só vê pedidos atribuídos, pode editar e mudar status

## Pipeline Kanban (12 Status)
FAZER → AJUSTE → APROVACAO → AGUARDANDO_APROVACAO → APROVADO →
ARTE_APROVADA → PRODUCAO → EXPEDICAO → FINALIZADO → ENTREGUE →
FATURADO → ARQUIVADO

## 7 Etiquetas
BOLETO | AGUARDANDO_PAGAMENTO | PEDIDO_CANCELADO |
APROV_AGUARDANDO_PAGAMENTO | AMOSTRAS | PAGO | ORCAMENTO_PUBLICO

## Idioma
- Todo o UI em português brasileiro (pt-BR)
- Datas em formato DD/MM/YYYY
- Moeda em R$ (BRL)

## Padrões de UX
- Mobile-first responsive
- Dark mode suportado (class strategy)
- Skeleton loaders para loading states
- Toast (Sonner) para feedback de ações
- Empty states com mensagens amigáveis
- Animações suaves (fade-in, scale-in)
- Kanban com scroll horizontal suave
