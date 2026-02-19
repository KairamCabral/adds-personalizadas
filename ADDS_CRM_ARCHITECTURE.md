# ADDS CRM — Arquitetura Completa do Projeto

## 1. VISÃO GERAL

**Objetivo:** Sistema CRM personalizado para gestão de pedidos de escovas personalizadas, substituindo o Trello por uma solução sob medida com Kanban real-time, gestão de contatos, fluxo de aprovação de arte e dashboard gerencial.

**Usuários:** 5-15 simultâneos | 3 perfis (MASTER, GESTOR, PRESTADOR)

---

## 2. STACK TECNOLÓGICO DEFINITIVO

### Frontend
| Tecnologia | Versão | Função |
|---|---|---|
| **Next.js** | 15+ (App Router) | Framework principal, SSR/SSG, API Routes, Middleware |
| **React** | 19+ | UI Library |
| **TypeScript** | 5.x | Tipagem estática em todo o projeto |
| **Tailwind CSS** | 4.x | Estilização utility-first |
| **shadcn/ui** | latest | Componentes base (Dialog, Sheet, Dropdown, etc.) |
| **Radix UI** | latest | Primitivos acessíveis (base do shadcn) |
| **@dnd-kit/core** | 6.x | Drag & Drop do Kanban |
| **@dnd-kit/sortable** | 8.x | Sortable dentro das colunas |
| **Recharts** | 2.x | Gráficos do Dashboard |
| **React Hook Form** | 7.x | Formulários performáticos |
| **Zod** | 3.x | Validação de schemas |
| **Zustand** | 5.x | Estado global (UI, filtros, sidebar) |
| **TanStack Query** | 5.x | Cache de server state, mutations, invalidação |
| **date-fns** | 3.x | Manipulação de datas (pt-BR) |
| **Lucide React** | latest | Ícones consistentes |
| **Sonner** | latest | Toast notifications |
| **nuqs** | latest | State na URL (filtros, busca) |

### Backend / Infraestrutura
| Tecnologia | Função |
|---|---|
| **Supabase** | Auth, PostgreSQL, Storage, Realtime, Edge Functions, RLS |
| **Vercel** | Deploy, Edge Network, Preview Deployments |
| **Supabase Realtime** | WebSocket para Kanban live updates |
| **Supabase Storage** | Artes, anexos, logos de clientes |
| **Supabase Auth** | Login email/senha, sessões, refresh tokens |
| **Resend** | E-mails transacionais (notificações, aprovação de arte) |

### Ferramentas de Dev
| Ferramenta | Função |
|---|---|
| **Cursor AI** | IDE principal de desenvolvimento |
| **pnpm** | Package manager (mais rápido, workspace support) |
| **ESLint** | Linting com flat config |
| **Prettier** | Formatação consistente |
| **Husky + lint-staged** | Pre-commit hooks |

---

## 3. ESTRUTURA DE PASTAS

```
adds-crm/
├── .cursor/                          # Regras do Cursor AI
│   └── rules.md                      # Prompt de contexto do projeto
├── .env.local                        # Variáveis de ambiente (local)
├── .env.example                      # Template de variáveis
├── .eslintrc.js
├── .prettierrc
├── next.config.ts
├── tailwind.config.ts
├── tsconfig.json
├── package.json
├── middleware.ts                      # Auth middleware (proteção de rotas)
│
├── supabase/
│   ├── config.toml                   # Config local do Supabase CLI
│   ├── seed.sql                      # Dados iniciais (usuário master, status, etc.)
│   └── migrations/
│       ├── 00001_create_enums.sql
│       ├── 00002_create_profiles.sql
│       ├── 00003_create_clients.sql
│       ├── 00004_create_products.sql
│       ├── 00005_create_orders.sql
│       ├── 00006_create_order_items.sql
│       ├── 00007_create_artworks.sql
│       ├── 00008_create_comments.sql
│       ├── 00009_create_checklists.sql
│       ├── 00010_create_attachments.sql
│       ├── 00011_create_labels.sql
│       ├── 00012_create_order_labels.sql
│       ├── 00013_create_notifications.sql
│       ├── 00014_create_audit_logs.sql
│       ├── 00015_create_public_quotes.sql
│       ├── 00016_create_approval_tokens.sql
│       ├── 00017_create_order_watchers.sql
│       ├── 00018_enable_rls.sql
│       ├── 00019_create_functions.sql
│       └── 00020_create_triggers.sql
│
├── public/
│   ├── logo-adds.svg
│   ├── favicon.ico
│   └── og-image.png
│
├── src/
│   ├── app/                          # Next.js App Router
│   │   ├── layout.tsx                # Root layout (providers, sidebar)
│   │   ├── page.tsx                  # Redirect → /pipeline
│   │   ├── loading.tsx               # Global loading
│   │   ├── error.tsx                 # Global error boundary
│   │   ├── not-found.tsx
│   │   ├── globals.css               # Tailwind + CSS variables (cores ADDS)
│   │   │
│   │   ├── (auth)/                   # Grupo: rotas de autenticação
│   │   │   ├── layout.tsx            # Layout auth (centralizado, sem sidebar)
│   │   │   ├── login/
│   │   │   │   └── page.tsx
│   │   │   └── forgot-password/
│   │   │       └── page.tsx
│   │   │
│   │   ├── (dashboard)/              # Grupo: rotas autenticadas (com sidebar)
│   │   │   ├── layout.tsx            # Layout com Sidebar + Header + Notifications
│   │   │   ├── pipeline/
│   │   │   │   ├── page.tsx          # Kanban Board principal
│   │   │   │   └── _components/
│   │   │   │       ├── kanban-board.tsx
│   │   │   │       ├── kanban-column.tsx
│   │   │   │       ├── kanban-card.tsx
│   │   │   │       ├── kanban-card-skeleton.tsx
│   │   │   │       ├── order-detail-sheet.tsx
│   │   │   │       ├── order-form.tsx
│   │   │   │       ├── order-filters.tsx
│   │   │   │       ├── order-comments.tsx
│   │   │   │       ├── order-checklist.tsx
│   │   │   │       ├── order-attachments.tsx
│   │   │   │       ├── order-artwork.tsx
│   │   │   │       ├── order-history.tsx
│   │   │   │       └── order-labels.tsx
│   │   │   │
│   │   │   ├── contacts/
│   │   │   │   ├── page.tsx          # Lista de contatos
│   │   │   │   ├── [id]/
│   │   │   │   │   └── page.tsx      # Detalhe do contato
│   │   │   │   └── _components/
│   │   │   │       ├── contacts-table.tsx
│   │   │   │       ├── contact-form.tsx
│   │   │   │       ├── contact-detail.tsx
│   │   │   │       ├── import-dialog.tsx
│   │   │   │       └── sync-tiny-dialog.tsx
│   │   │   │
│   │   │   ├── dashboard/
│   │   │   │   ├── page.tsx          # Dashboard gerencial
│   │   │   │   └── _components/
│   │   │   │       ├── dashboard-tabs.tsx
│   │   │   │       ├── tab-vendas.tsx
│   │   │   │       ├── tab-estoque.tsx
│   │   │   │       ├── tab-clientes.tsx
│   │   │   │       ├── tab-operacoes.tsx
│   │   │   │       ├── tab-marketing.tsx
│   │   │   │       ├── tab-financeiro.tsx
│   │   │   │       ├── metric-card.tsx
│   │   │   │       ├── chart-vendas.tsx
│   │   │   │       └── period-selector.tsx
│   │   │   │
│   │   │   ├── quotes/
│   │   │   │   ├── page.tsx          # Gerenciador de orçamentos públicos
│   │   │   │   └── _components/
│   │   │   │       ├── quotes-table.tsx
│   │   │   │       └── quote-detail-sheet.tsx
│   │   │   │
│   │   │   ├── settings/
│   │   │   │   ├── page.tsx          # Redirect → /settings/products
│   │   │   │   ├── layout.tsx        # Layout com sidebar de settings
│   │   │   │   ├── products/page.tsx
│   │   │   │   ├── kanban/page.tsx
│   │   │   │   ├── users/page.tsx
│   │   │   │   ├── labels/page.tsx
│   │   │   │   ├── notifications/page.tsx
│   │   │   │   ├── system/page.tsx
│   │   │   │   ├── security/page.tsx
│   │   │   │   ├── integrations/page.tsx
│   │   │   │   └── backup/page.tsx
│   │   │   │
│   │   │   └── tiny/
│   │   │       ├── page.tsx          # Dashboard Tiny ERP
│   │   │       └── _components/
│   │   │           ├── tiny-dashboard.tsx
│   │   │           ├── tiny-clients.tsx
│   │   │           ├── tiny-orders.tsx
│   │   │           └── tiny-sync-log.tsx
│   │   │
│   │   ├── (public)/                 # Grupo: rotas públicas (sem auth)
│   │   │   ├── layout.tsx            # Layout público (branding ADDS)
│   │   │   ├── quote/
│   │   │   │   ├── page.tsx          # Formulário de orçamento público
│   │   │   │   ├── success/page.tsx
│   │   │   │   └── _components/
│   │   │   │       ├── quote-wizard.tsx
│   │   │   │       ├── step-welcome.tsx
│   │   │   │       ├── step-login.tsx
│   │   │   │       ├── step-register.tsx
│   │   │   │       ├── step-products.tsx
│   │   │   │       ├── step-personalization.tsx
│   │   │   │       ├── step-confirmation.tsx
│   │   │   │       └── cep-lookup.tsx
│   │   │   │
│   │   │   └── art/
│   │   │       └── approve/
│   │   │           └── [token]/
│   │   │               ├── page.tsx  # Página de aprovação de arte
│   │   │               └── _components/
│   │   │                   ├── art-viewer.tsx
│   │   │                   └── approval-form.tsx
│   │   │
│   │   └── api/                      # API Routes (Next.js)
│   │       ├── auth/
│   │       │   └── callback/route.ts # Supabase Auth callback
│   │       ├── webhooks/
│   │       │   └── tiny/route.ts     # Webhook do Tiny ERP
│   │       ├── cron/
│   │       │   └── cleanup/route.ts  # Limpeza de tokens expirados
│   │       └── email/
│   │           └── send/route.ts     # Envio de e-mails via Resend
│   │
│   ├── components/                   # Componentes compartilhados
│   │   ├── ui/                       # shadcn/ui components
│   │   │   ├── button.tsx
│   │   │   ├── dialog.tsx
│   │   │   ├── sheet.tsx
│   │   │   ├── dropdown-menu.tsx
│   │   │   ├── input.tsx
│   │   │   ├── select.tsx
│   │   │   ├── textarea.tsx
│   │   │   ├── badge.tsx
│   │   │   ├── avatar.tsx
│   │   │   ├── tabs.tsx
│   │   │   ├── table.tsx
│   │   │   ├── card.tsx
│   │   │   ├── tooltip.tsx
│   │   │   ├── popover.tsx
│   │   │   ├── command.tsx           # Command palette (busca global)
│   │   │   ├── calendar.tsx
│   │   │   ├── skeleton.tsx
│   │   │   └── scroll-area.tsx
│   │   │
│   │   ├── layout/
│   │   │   ├── sidebar.tsx           # Sidebar principal
│   │   │   ├── sidebar-item.tsx
│   │   │   ├── header.tsx            # Top header (busca, notificações, perfil)
│   │   │   ├── notification-popover.tsx
│   │   │   ├── user-menu.tsx
│   │   │   └── breadcrumbs.tsx
│   │   │
│   │   └── shared/
│   │       ├── data-table.tsx        # Tabela reutilizável (TanStack Table)
│   │       ├── file-upload.tsx       # Upload drag & drop
│   │       ├── confirm-dialog.tsx    # Diálogo de confirmação
│   │       ├── empty-state.tsx       # Estado vazio
│   │       ├── loading-spinner.tsx
│   │       ├── status-badge.tsx      # Badge de status do Kanban
│   │       ├── priority-indicator.tsx
│   │       ├── label-badge.tsx       # Badge de etiqueta
│   │       ├── avatar-group.tsx      # Grupo de avatares
│   │       ├── search-input.tsx
│   │       └── page-header.tsx
│   │
│   ├── lib/                          # Utilitários e configurações
│   │   ├── supabase/
│   │   │   ├── client.ts             # createBrowserClient
│   │   │   ├── server.ts             # createServerClient (Server Components)
│   │   │   ├── middleware.ts          # createServerClient (Middleware)
│   │   │   ├── admin.ts              # Service role client (API routes)
│   │   │   └── realtime.ts           # Configuração de canais realtime
│   │   │
│   │   ├── utils.ts                  # cn(), formatCurrency(), formatDate()
│   │   ├── constants.ts              # Status, labels, tipos, cores
│   │   ├── validations.ts            # Schemas Zod compartilhados
│   │   └── permissions.ts            # Mapa de permissões por perfil
│   │
│   ├── hooks/                        # Custom Hooks
│   │   ├── use-user.ts               # Hook de autenticação
│   │   ├── use-permissions.ts        # Hook de permissões
│   │   ├── use-realtime.ts           # Hook genérico de realtime
│   │   ├── use-kanban-realtime.ts    # Realtime específico do Kanban
│   │   ├── use-notifications.ts      # Notificações em tempo real
│   │   ├── use-debounce.ts
│   │   └── use-media-query.ts
│   │
│   ├── services/                     # Camada de acesso a dados
│   │   ├── orders.service.ts         # CRUD de pedidos + movimentação
│   │   ├── clients.service.ts        # CRUD de clientes
│   │   ├── products.service.ts       # CRUD de produtos
│   │   ├── artworks.service.ts       # Upload/aprovação de artes
│   │   ├── comments.service.ts       # Comentários de pedidos
│   │   ├── notifications.service.ts  # CRUD de notificações
│   │   ├── audit.service.ts          # Logs de auditoria
│   │   ├── quotes.service.ts         # Orçamentos públicos
│   │   ├── labels.service.ts         # Etiquetas
│   │   ├── tiny.service.ts           # Integração Tiny ERP
│   │   └── email.service.ts          # Envio de e-mails
│   │
│   ├── stores/                       # Zustand stores
│   │   ├── ui.store.ts               # Sidebar state, modals, theme
│   │   ├── kanban.store.ts           # Filtros do Kanban, view mode
│   │   └── notifications.store.ts    # Contagem de não lidas
│   │
│   ├── types/                        # TypeScript types
│   │   ├── database.types.ts         # Gerado pelo Supabase CLI
│   │   ├── order.types.ts            # Tipos derivados de pedidos
│   │   ├── client.types.ts
│   │   ├── product.types.ts
│   │   ├── notification.types.ts
│   │   └── enums.ts                  # Enums do sistema
│   │
│   └── providers/                    # React Context Providers
│       ├── query-provider.tsx        # TanStack Query
│       ├── theme-provider.tsx        # Dark/Light mode
│       └── realtime-provider.tsx     # Supabase Realtime channels
│
└── scripts/
    ├── generate-types.sh             # supabase gen types typescript
    └── seed-data.ts                  # Script de seed inicial
```

---

## 4. SCHEMA DO BANCO DE DADOS (Supabase / PostgreSQL)

### 4.1 Enums

```sql
-- Perfis de usuário
CREATE TYPE user_role AS ENUM ('MASTER', 'GESTOR', 'PRESTADOR');

-- Status do Kanban (12 colunas)
CREATE TYPE order_status AS ENUM (
  'FAZER',
  'AJUSTE',
  'APROVACAO',
  'AGUARDANDO_APROVACAO',
  'APROVADO',
  'ARTE_APROVADA',
  'PRODUCAO',
  'EXPEDICAO',
  'FINALIZADO',
  'ENTREGUE',
  'FATURADO',
  'ARQUIVADO'
);

-- Prioridade
CREATE TYPE order_priority AS ENUM ('NORMAL', 'ALTA');

-- Tipo de pedido
CREATE TYPE order_type AS ENUM (
  'USUARIO',
  'PERSONALIZADO',
  'RUSH',
  'PROMOCIONAL',
  'ORCAMENTO_PUBLICO'
);

-- Etiquetas
CREATE TYPE label_type AS ENUM (
  'BOLETO',
  'AGUARDANDO_PAGAMENTO',
  'PEDIDO_CANCELADO',
  'APROV_AGUARDANDO_PAGAMENTO',
  'AMOSTRAS',
  'PAGO',
  'ORCAMENTO_PUBLICO'
);

-- Status de arte
CREATE TYPE artwork_status AS ENUM ('PENDENTE', 'APROVADA', 'AJUSTE_SOLICITADO');

-- Status de orçamento público
CREATE TYPE quote_status AS ENUM (
  'PENDENTE',
  'CONTACTADO',
  'CONCLUIDO',
  'APROVADO',
  'REJEITADO'
);

-- Tipo de pessoa (cliente)
CREATE TYPE person_type AS ENUM ('FISICA', 'JURIDICA');

-- Tipo de ação de auditoria
CREATE TYPE audit_action AS ENUM (
  'LOGIN', 'LOGOUT',
  'CREATE', 'UPDATE', 'DELETE',
  'STATUS_CHANGE', 'LABEL_CHANGE',
  'ARTWORK_UPLOAD', 'ARTWORK_APPROVE', 'ARTWORK_REJECT',
  'SYNC_TINY', 'EXPORT'
);
```

### 4.2 Tabelas

```sql
-- ============================================
-- PROFILES (extensão do auth.users do Supabase)
-- ============================================
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  avatar_url TEXT,
  role user_role NOT NULL DEFAULT 'PRESTADOR',
  phone TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  failed_login_attempts INTEGER DEFAULT 0,
  locked_until TIMESTAMPTZ,
  last_login_at TIMESTAMPTZ,
  notification_preferences JSONB DEFAULT '{
    "order_created": {"in_app": true, "email": true},
    "status_changed": {"in_app": true, "email": true},
    "comment_added": {"in_app": true, "email": false},
    "mention": {"in_app": true, "email": true},
    "attachment_added": {"in_app": true, "email": false},
    "artwork_approved": {"in_app": true, "email": true},
    "artwork_adjustment": {"in_app": true, "email": true},
    "quote_received": {"in_app": true, "email": true},
    "system_alert": {"in_app": true, "email": true},
    "label_changed": {"in_app": true, "email": false}
  }'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================
-- CLIENTS (Contatos)
-- ============================================
CREATE TABLE clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  person_type person_type NOT NULL DEFAULT 'FISICA',
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  company TEXT,
  document TEXT,                       -- CPF ou CNPJ
  logo_url TEXT,
  notes TEXT,
  -- Endereço
  zip_code TEXT,
  street TEXT,
  number TEXT,
  complement TEXT,
  neighborhood TEXT,
  city TEXT,
  state TEXT,
  country TEXT DEFAULT 'Brasil',
  -- Integração Tiny
  tiny_id BIGINT UNIQUE,
  tiny_synced_at TIMESTAMPTZ,
  -- Metadata
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_clients_name ON clients USING gin(name gin_trgm_ops);
CREATE INDEX idx_clients_document ON clients(document);
CREATE INDEX idx_clients_email ON clients(email);
CREATE INDEX idx_clients_tiny_id ON clients(tiny_id);

-- ============================================
-- PRODUCTS (Catálogo)
-- ============================================
CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  price DECIMAL(10,2),
  category TEXT,
  product_type TEXT,
  stock INTEGER DEFAULT 0,
  image_url TEXT,
  canvas_width INTEGER,               -- Largura do canvas de personalização
  canvas_height INTEGER,              -- Altura do canvas de personalização
  is_active BOOLEAN NOT NULL DEFAULT true,
  -- Integração Tiny
  tiny_id BIGINT UNIQUE,
  tiny_code TEXT,
  tiny_synced_at TIMESTAMPTZ,
  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================
-- ORDERS (Pedidos — coração do Kanban)
-- ============================================
CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number SERIAL UNIQUE,         -- Número sequencial legível
  title TEXT NOT NULL,
  description TEXT,
  client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
  status order_status NOT NULL DEFAULT 'FAZER',
  order_type order_type NOT NULL DEFAULT 'PERSONALIZADO',
  priority order_priority NOT NULL DEFAULT 'NORMAL',
  start_date DATE,
  due_date DATE,
  assigned_to UUID REFERENCES profiles(id),
  position INTEGER NOT NULL DEFAULT 0, -- Posição dentro da coluna (drag & drop)
  -- Integração Tiny
  tiny_order_id BIGINT,
  tiny_invoice_id BIGINT,
  -- Metadata
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_client ON orders(client_id);
CREATE INDEX idx_orders_assigned ON orders(assigned_to);
CREATE INDEX idx_orders_position ON orders(status, position);
CREATE INDEX idx_orders_due_date ON orders(due_date);

-- ============================================
-- ORDER_ITEMS (Produtos do pedido)
-- ============================================
CREATE TABLE order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  product_name TEXT NOT NULL,          -- Snapshot do nome (caso produto mude)
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price DECIMAL(10,2),
  total_price DECIMAL(10,2),
  personalization JSONB,              -- Dados de personalização
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_order_items_order ON order_items(order_id);

-- ============================================
-- ORDER_LABELS (Relação N:N pedido ↔ etiqueta)
-- ============================================
CREATE TABLE order_labels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  label label_type NOT NULL,
  added_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(order_id, label)
);

CREATE INDEX idx_order_labels_order ON order_labels(order_id);

-- ============================================
-- ORDER_WATCHERS (Observadores do pedido)
-- ============================================
CREATE TABLE order_watchers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(order_id, user_id)
);

-- ============================================
-- ARTWORKS (Artes vinculadas ao pedido)
-- ============================================
CREATE TABLE artworks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  file_url TEXT NOT NULL,
  file_name TEXT,
  file_size INTEGER,
  status artwork_status NOT NULL DEFAULT 'PENDENTE',
  version INTEGER NOT NULL DEFAULT 1,
  approved_by TEXT,                    -- Nome de quem aprovou (pode ser externo)
  approved_at TIMESTAMPTZ,
  adjustment_notes TEXT,              -- Notas do ajuste solicitado
  is_internal_decision BOOLEAN DEFAULT false,
  uploaded_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_artworks_order ON artworks(order_id);

-- ============================================
-- APPROVAL_TOKENS (Tokens de aprovação pública)
-- ============================================
CREATE TABLE approval_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  artwork_id UUID NOT NULL REFERENCES artworks(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  used_by_name TEXT,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_approval_tokens_token ON approval_tokens(token);

-- ============================================
-- COMMENTS (Comentários nos pedidos)
-- ============================================
CREATE TABLE comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id),
  content TEXT NOT NULL,
  mentions UUID[] DEFAULT '{}',       -- IDs de usuários mencionados
  is_system BOOLEAN DEFAULT false,    -- Comentário automático do sistema
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_comments_order ON comments(order_id);

-- ============================================
-- CHECKLISTS
-- ============================================
CREATE TABLE checklists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE checklist_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  checklist_id UUID NOT NULL REFERENCES checklists(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  is_completed BOOLEAN NOT NULL DEFAULT false,
  completed_by UUID REFERENCES profiles(id),
  completed_at TIMESTAMPTZ,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================
-- ATTACHMENTS (Anexos dos pedidos)
-- ============================================
CREATE TABLE attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  file_url TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size INTEGER,
  file_type TEXT,
  uploaded_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_attachments_order ON attachments(order_id);

-- ============================================
-- NOTIFICATIONS
-- ============================================
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL,                  -- order_created, status_changed, etc.
  title TEXT NOT NULL,
  message TEXT,
  data JSONB,                         -- { order_id, client_name, etc. }
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_notifications_user ON notifications(user_id);
CREATE INDEX idx_notifications_unread ON notifications(user_id) WHERE read_at IS NULL;

-- ============================================
-- AUDIT_LOGS
-- ============================================
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id),
  action audit_action NOT NULL,
  entity_type TEXT NOT NULL,           -- 'order', 'client', 'product', etc.
  entity_id UUID,
  old_data JSONB,
  new_data JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_user ON audit_logs(user_id);
CREATE INDEX idx_audit_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_created ON audit_logs(created_at DESC);

-- ============================================
-- PUBLIC_QUOTES (Orçamentos Públicos)
-- ============================================
CREATE TABLE public_quotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Dados do cliente
  client_name TEXT NOT NULL,
  client_email TEXT,
  client_phone TEXT,
  client_whatsapp TEXT,
  client_document TEXT,                -- CPF/CNPJ
  client_city TEXT,
  client_state TEXT,
  client_zip_code TEXT,
  client_street TEXT,
  client_number TEXT,
  client_complement TEXT,
  client_neighborhood TEXT,
  client_social_media TEXT,
  client_logo_url TEXT,
  is_existing_client BOOLEAN DEFAULT false,
  existing_client_id UUID REFERENCES clients(id),
  -- Pedido
  items JSONB NOT NULL,                -- [{product_id, product_name, quantity}]
  personalization JSONB,               -- {print_color, custom_color, notes}
  estimated_value DECIMAL(10,2),
  -- Gestão
  status quote_status NOT NULL DEFAULT 'PENDENTE',
  assigned_to UUID REFERENCES profiles(id),
  internal_notes TEXT,
  order_id UUID REFERENCES orders(id), -- Pedido criado se aprovado
  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_quotes_status ON public_quotes(status);

-- ============================================
-- ORDER_HISTORY (Histórico de mudanças)
-- ============================================
CREATE TABLE order_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id),
  action TEXT NOT NULL,                -- 'status_changed', 'assigned', 'label_added', etc.
  old_value TEXT,
  new_value TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_order_history_order ON order_history(order_id);

-- ============================================
-- TINY_SYNC_LOGS
-- ============================================
CREATE TABLE tiny_sync_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT NOT NULL,           -- 'client', 'product', 'order'
  entity_id UUID,
  tiny_id BIGINT,
  direction TEXT NOT NULL,             -- 'push' ou 'pull'
  status TEXT NOT NULL,                -- 'success', 'error'
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### 4.3 Functions & Triggers Essenciais

```sql
-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Aplicar em todas as tabelas com updated_at
CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_clients_updated BEFORE UPDATE ON clients
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_orders_updated BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
-- ... (repetir para demais tabelas)

-- Registrar mudança de status no histórico
CREATE OR REPLACE FUNCTION log_order_status_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO order_history (order_id, user_id, action, old_value, new_value)
    VALUES (NEW.id, auth.uid(), 'status_changed', OLD.status::text, NEW.status::text);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_order_status_change AFTER UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION log_order_status_change();

-- Recalcular posições após drag & drop
CREATE OR REPLACE FUNCTION reorder_column(
  p_status order_status,
  p_order_ids UUID[]
)
RETURNS void AS $$
DECLARE
  i INTEGER;
BEGIN
  FOR i IN 1..array_length(p_order_ids, 1) LOOP
    UPDATE orders SET position = i, status = p_status
    WHERE id = p_order_ids[i];
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função para validar token de aprovação
CREATE OR REPLACE FUNCTION validate_approval_token(p_token TEXT)
RETURNS TABLE (
  is_valid BOOLEAN,
  token_id UUID,
  order_id UUID,
  artwork_id UUID,
  order_title TEXT,
  artwork_url TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    (at.used_at IS NULL AND at.expires_at > now()) AS is_valid,
    at.id AS token_id,
    at.order_id,
    at.artwork_id,
    o.title AS order_title,
    a.file_url AS artwork_url
  FROM approval_tokens at
  JOIN orders o ON o.id = at.order_id
  JOIN artworks a ON a.id = at.artwork_id
  WHERE at.token = p_token;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### 4.4 Row Level Security (RLS)

```sql
-- Habilitar RLS em todas as tabelas
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE artworks ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
-- ... (todas as tabelas)

-- Helper: Pegar role do usuário atual
CREATE OR REPLACE FUNCTION get_user_role()
RETURNS user_role AS $$
  SELECT role FROM profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- PROFILES: Todos vêem perfis ativos, só MASTER/GESTOR editam
CREATE POLICY "profiles_select" ON profiles FOR SELECT USING (true);
CREATE POLICY "profiles_update" ON profiles FOR UPDATE
  USING (id = auth.uid() OR get_user_role() IN ('MASTER', 'GESTOR'));

-- ORDERS: PRESTADOR só vê pedidos atribuídos a ele
CREATE POLICY "orders_select" ON orders FOR SELECT
  USING (
    get_user_role() IN ('MASTER', 'GESTOR')
    OR assigned_to = auth.uid()
    OR EXISTS (SELECT 1 FROM order_watchers WHERE order_id = orders.id AND user_id = auth.uid())
  );

CREATE POLICY "orders_insert" ON orders FOR INSERT
  WITH CHECK (get_user_role() IN ('MASTER', 'GESTOR'));

CREATE POLICY "orders_update" ON orders FOR UPDATE
  USING (
    get_user_role() IN ('MASTER', 'GESTOR')
    OR assigned_to = auth.uid()
  );

-- NOTIFICATIONS: Só vê as próprias
CREATE POLICY "notifications_select" ON notifications FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "notifications_update" ON notifications FOR UPDATE
  USING (user_id = auth.uid());

-- AUDIT_LOGS: Só MASTER vê tudo
CREATE POLICY "audit_select" ON audit_logs FOR SELECT
  USING (get_user_role() = 'MASTER');

-- CLIENTS: MASTER/GESTOR vêem todos, PRESTADOR não vê
CREATE POLICY "clients_all" ON clients FOR ALL
  USING (get_user_role() IN ('MASTER', 'GESTOR'));
```

---

## 5. CONFIGURAÇÃO DO SUPABASE REALTIME

```typescript
// src/lib/supabase/realtime.ts

import { createBrowserClient } from './client'

export function subscribeToKanban(
  onOrderChange: (payload: any) => void
) {
  const supabase = createBrowserClient()

  const channel = supabase
    .channel('kanban-changes')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'orders',
      },
      (payload) => onOrderChange(payload)
    )
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'order_labels',
      },
      (payload) => onOrderChange(payload)
    )
    .subscribe()

  return () => {
    supabase.removeChannel(channel)
  }
}

export function subscribeToNotifications(
  userId: string,
  onNotification: (payload: any) => void
) {
  const supabase = createBrowserClient()

  const channel = supabase
    .channel(`notifications:${userId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${userId}`,
      },
      (payload) => onNotification(payload)
    )
    .subscribe()

  return () => {
    supabase.removeChannel(channel)
  }
}
```

---

## 6. MIDDLEWARE DE AUTH

```typescript
// middleware.ts

import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'

const publicRoutes = ['/login', '/forgot-password', '/quote', '/art/approve']

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Rotas públicas: permitir acesso
  if (publicRoutes.some(route => pathname.startsWith(route))) {
    return NextResponse.next()
  }

  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options)
          })
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // Verificar se conta está bloqueada
  const { data: profile } = await supabase
    .from('profiles')
    .select('is_active, locked_until')
    .eq('id', user.id)
    .single()

  if (!profile?.is_active) {
    return NextResponse.redirect(new URL('/login?error=inactive', request.url))
  }

  if (profile?.locked_until && new Date(profile.locked_until) > new Date()) {
    return NextResponse.redirect(new URL('/login?error=locked', request.url))
  }

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|logo|api/webhooks).*)'],
}
```

---

## 7. VARIÁVEIS DE AMBIENTE

```env
# .env.example

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# App
NEXT_PUBLIC_APP_URL=https://crm.adds.com.br
NEXT_PUBLIC_APP_NAME=ADDS CRM

# Tiny ERP
TINY_API_TOKEN=seu-token-aqui
TINY_API_URL=https://api.tiny.com.br/api2

# Email (Resend)
RESEND_API_KEY=re_xxxxx
EMAIL_FROM=crm@adds.com.br

# Storage
NEXT_PUBLIC_STORAGE_BUCKET=adds-crm
```

---

## 8. PALETA DE CORES + DESIGN TOKENS

```css
/* src/app/globals.css */

@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    /* ADDS Brand */
    --adds-blue: 199 82% 48%;          /* #21add6 */
    --adds-orange: 30 100% 47%;        /* #f07d00 */
    --adds-navy: 207 79% 23%;          /* #0b4269 */

    /* Design System */
    --background: 0 0% 100%;
    --foreground: 207 79% 15%;
    --card: 0 0% 100%;
    --card-foreground: 207 79% 15%;
    --popover: 0 0% 100%;
    --popover-foreground: 207 79% 15%;
    --primary: 199 82% 48%;            /* adds-blue */
    --primary-foreground: 0 0% 100%;
    --secondary: 210 20% 96%;
    --secondary-foreground: 207 79% 15%;
    --muted: 210 20% 96%;
    --muted-foreground: 215 14% 46%;
    --accent: 30 100% 47%;             /* adds-orange */
    --accent-foreground: 0 0% 100%;
    --destructive: 0 84% 60%;
    --destructive-foreground: 0 0% 100%;
    --border: 214 20% 90%;
    --input: 214 20% 90%;
    --ring: 199 82% 48%;
    --radius: 0.625rem;

    /* Status do Kanban */
    --status-fazer: 210 20% 96%;
    --status-ajuste: 38 100% 95%;
    --status-aprovacao: 199 82% 95%;
    --status-aguardando: 262 60% 95%;
    --status-aprovado: 142 60% 95%;
    --status-arte-aprovada: 142 72% 90%;
    --status-producao: 30 100% 95%;
    --status-expedicao: 24 80% 95%;
    --status-finalizado: 199 82% 92%;
    --status-entregue: 160 60% 92%;
    --status-faturado: 207 79% 92%;
    --status-arquivado: 215 14% 94%;

    /* Labels */
    --label-boleto: 210 60% 55%;
    --label-aguardando: 38 90% 55%;
    --label-cancelado: 0 84% 60%;
    --label-aprov-aguardando: 30 100% 50%;
    --label-amostras: 262 60% 55%;
    --label-pago: 142 72% 40%;
    --label-orcamento: 199 82% 48%;
  }

  .dark {
    --background: 222 47% 8%;
    --foreground: 210 20% 96%;
    --card: 222 47% 11%;
    --card-foreground: 210 20% 96%;
    --popover: 222 47% 11%;
    --popover-foreground: 210 20% 96%;
    --primary: 199 82% 48%;
    --primary-foreground: 0 0% 100%;
    --secondary: 217 33% 17%;
    --secondary-foreground: 210 20% 96%;
    --muted: 217 33% 17%;
    --muted-foreground: 215 14% 65%;
    --accent: 30 100% 47%;
    --accent-foreground: 0 0% 100%;
    --destructive: 0 63% 31%;
    --destructive-foreground: 0 0% 100%;
    --border: 217 33% 20%;
    --input: 217 33% 20%;
    --ring: 199 82% 48%;
  }
}
```

---

## 9. MAPA DE PERMISSÕES POR PERFIL

```typescript
// src/lib/permissions.ts

export const PERMISSIONS = {
  // Kanban
  'kanban.view':          ['MASTER', 'GESTOR', 'PRESTADOR'],
  'kanban.manage':        ['MASTER', 'GESTOR'],

  // Pedidos
  'orders.create':        ['MASTER', 'GESTOR'],
  'orders.view_all':      ['MASTER', 'GESTOR'],
  'orders.view_own':      ['MASTER', 'GESTOR', 'PRESTADOR'],
  'orders.edit':          ['MASTER', 'GESTOR', 'PRESTADOR'],
  'orders.delete':        ['MASTER'],
  'orders.change_status': ['MASTER', 'GESTOR', 'PRESTADOR'],
  'orders.assign':        ['MASTER', 'GESTOR'],

  // Clientes
  'clients.view':         ['MASTER', 'GESTOR'],
  'clients.create':       ['MASTER', 'GESTOR'],
  'clients.edit':         ['MASTER', 'GESTOR'],
  'clients.delete':       ['MASTER'],
  'clients.import':       ['MASTER', 'GESTOR'],
  'clients.sync_tiny':    ['MASTER', 'GESTOR'],

  // Produtos
  'products.view':        ['MASTER', 'GESTOR'],
  'products.manage':      ['MASTER', 'GESTOR'],

  // Artes
  'artworks.upload':      ['MASTER', 'GESTOR', 'PRESTADOR'],
  'artworks.approve':     ['MASTER', 'GESTOR'],
  'artworks.generate_token': ['MASTER', 'GESTOR'],

  // Dashboard
  'dashboard.view_full':  ['MASTER'],
  'dashboard.view_ops':   ['GESTOR'],

  // Configurações
  'settings.view':        ['MASTER', 'GESTOR'],
  'settings.security':    ['MASTER'],
  'settings.users':       ['MASTER', 'GESTOR'],
  'settings.manage_master': ['MASTER'],

  // Relatórios
  'reports.view':         ['MASTER', 'GESTOR'],
  'reports.export':       ['MASTER', 'GESTOR'],

  // Auditoria
  'audit.view':           ['MASTER'],
  'audit.export':         ['MASTER'],

  // Integrações
  'integrations.manage':  ['MASTER', 'GESTOR'],

  // Notificações
  'notifications.manage': ['MASTER', 'GESTOR'],

  // Orçamentos
  'quotes.view':          ['MASTER', 'GESTOR'],
  'quotes.manage':        ['MASTER', 'GESTOR'],

  // Backup
  'backup.manage':        ['MASTER'],

  // Etiquetas
  'labels.manage':        ['MASTER', 'GESTOR'],
  'labels.add_to_order':  ['MASTER', 'GESTOR'],

  // Uploads
  'files.upload':         ['MASTER', 'GESTOR', 'PRESTADOR'],
  'files.download':       ['MASTER', 'GESTOR', 'PRESTADOR'],
} as const

export type Permission = keyof typeof PERMISSIONS

export function hasPermission(role: string, permission: Permission): boolean {
  return PERMISSIONS[permission]?.includes(role as any) ?? false
}
```

---

## 10. ROADMAP DE DESENVOLVIMENTO (4 FASES)

### FASE 1 — Fundação (Semana 1-2)
- [x] Setup Next.js + Supabase + Tailwind + shadcn/ui
- [x] Autenticação (login, logout, middleware, sessões)
- [x] Layout (sidebar, header, providers)
- [x] Schema do banco (migrations completas)
- [x] RLS e permissões
- [x] Seed (usuário MASTER inicial)
- [x] Tipos TypeScript gerados do Supabase

### FASE 2 — Kanban + Pedidos (Semana 3-5)
- [ ] Board Kanban com 12 colunas
- [ ] Drag & Drop com @dnd-kit
- [ ] Cards com labels, prioridade, avatares
- [ ] Sheet de detalhe do pedido (slide-over)
- [ ] CRUD completo de pedidos
- [ ] Sistema de comentários
- [ ] Checklists
- [ ] Anexos (upload para Supabase Storage)
- [ ] Histórico de mudanças
- [ ] Realtime (Supabase Realtime)
- [ ] Filtros (status, responsável, prioridade, etiqueta, busca)

### FASE 3 — Contatos + Arte + Público (Semana 6-8)
- [ ] CRUD de contatos com busca e paginação
- [ ] Upload e gestão de artes
- [ ] Fluxo de aprovação com tokens
- [ ] Página pública de aprovação de arte
- [ ] Formulário público de orçamento (wizard 7 etapas)
- [ ] Gerenciador interno de orçamentos
- [ ] Sistema de notificações (in-app + popover)
- [ ] Notificações realtime

### FASE 4 — Dashboard + Integrações (Semana 9-12)
- [ ] Dashboard gerencial (6 abas)
- [ ] Gráficos com Recharts
- [ ] Integração Tiny ERP (clientes, produtos, pedidos, NFs)
- [ ] Logs de auditoria
- [ ] E-mails transacionais (Resend)
- [ ] Configurações do sistema
- [ ] Backup e exportações
- [ ] Importação em massa de contatos

---

## 11. CONFIGURAÇÃO CURSOR AI (.cursor/rules.md)

```markdown
# ADDS CRM — Regras do Cursor AI

## Stack
- Next.js 15 App Router + TypeScript + Tailwind CSS + shadcn/ui
- Supabase (Auth, DB, Storage, Realtime)
- Zustand (UI state) + TanStack Query (server state)
- React Hook Form + Zod (forms)
- @dnd-kit (Kanban drag & drop)

## Convenções
- Componentes: PascalCase (e.g., KanbanBoard.tsx)
- Arquivos: kebab-case (e.g., kanban-board.tsx)
- Hooks: use-*.ts
- Services: *.service.ts
- Types: *.types.ts
- Stores: *.store.ts
- Sempre use 'use client' apenas quando necessário
- Prefira Server Components por padrão
- Use absolute imports com @/ prefix

## Padrões
- Toda query ao Supabase deve usar o service layer (src/services/)
- Toda mutation deve invalidar cache do TanStack Query
- Toda mudança de status deve registrar no order_history
- Toda ação sensível deve registrar no audit_logs
- Use Zod para validar inputs antes de enviar ao DB
- Use RLS do Supabase como camada de segurança primária
- Nunca exponha service_role_key no client-side

## UI/UX
- Paleta: Azul #21add6, Laranja #f07d00, Navy #0b4269
- Mobile-first responsive
- Dark mode suportado
- Skeletons para loading states
- Toast (Sonner) para feedbacks
- Empty states com ilustrações
- Tudo em português brasileiro (pt-BR)

## Supabase
- Tipos gerados em src/types/database.types.ts
- Client browser: src/lib/supabase/client.ts
- Client server: src/lib/supabase/server.ts
- Admin (API routes): src/lib/supabase/admin.ts
```

---

## 12. SCRIPTS DE INICIALIZAÇÃO

### package.json (dependências)

```json
{
  "name": "adds-crm",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "db:types": "npx supabase gen types typescript --project-id $SUPABASE_PROJECT_ID > src/types/database.types.ts",
    "db:migrate": "npx supabase db push",
    "db:seed": "npx supabase db seed"
  },
  "dependencies": {
    "next": "^15.0.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "@supabase/supabase-js": "^2.45.0",
    "@supabase/ssr": "^0.5.0",
    "@dnd-kit/core": "^6.1.0",
    "@dnd-kit/sortable": "^8.0.0",
    "@dnd-kit/utilities": "^3.2.2",
    "@tanstack/react-query": "^5.50.0",
    "@tanstack/react-table": "^8.20.0",
    "react-hook-form": "^7.52.0",
    "@hookform/resolvers": "^3.9.0",
    "zod": "^3.23.0",
    "zustand": "^5.0.0",
    "recharts": "^2.12.0",
    "date-fns": "^3.6.0",
    "lucide-react": "^0.400.0",
    "sonner": "^1.5.0",
    "nuqs": "^2.0.0",
    "resend": "^4.0.0",
    "class-variance-authority": "^0.7.0",
    "clsx": "^2.1.0",
    "tailwind-merge": "^2.4.0"
  },
  "devDependencies": {
    "typescript": "^5.5.0",
    "@types/react": "^19.0.0",
    "@types/node": "^22.0.0",
    "tailwindcss": "^4.0.0",
    "eslint": "^9.0.0",
    "eslint-config-next": "^15.0.0",
    "prettier": "^3.3.0",
    "supabase": "^1.190.0"
  }
}
```

---

## 13. DIAGRAMA DE RELAÇÕES DO BANCO

```
profiles ──────┐
  │             │
  │ (auth)      │ (assigned_to, created_by)
  │             │
  ├──→ orders ←─┤
  │     │ │ │   │
  │     │ │ │   ├──→ order_items ──→ products
  │     │ │ │   ├──→ order_labels
  │     │ │ │   ├──→ order_watchers ──→ profiles
  │     │ │ │   ├──→ artworks
  │     │ │ │   │      └──→ approval_tokens
  │     │ │ │   ├──→ comments
  │     │ │ │   ├──→ checklists
  │     │ │ │   │      └──→ checklist_items
  │     │ │ │   ├──→ attachments
  │     │ │ │   └──→ order_history
  │     │ │ │
  │     │ │ └──→ clients
  │     │ │        └──→ tiny_id (sync)
  │     │ │
  │     │ └──→ public_quotes
  │     │
  │     └──→ notifications ──→ profiles
  │
  └──→ audit_logs
```

---

## 14. RESUMO EXECUTIVO

| Aspecto | Decisão |
|---|---|
| **Framework** | Next.js 15 (App Router) |
| **Linguagem** | TypeScript strict |
| **Estilo** | Tailwind CSS 4 + shadcn/ui |
| **Auth** | Supabase Auth + RLS |
| **Database** | Supabase PostgreSQL |
| **Realtime** | Supabase Realtime (WebSocket) |
| **Storage** | Supabase Storage |
| **State (client)** | Zustand |
| **State (server)** | TanStack Query |
| **Forms** | React Hook Form + Zod |
| **Drag & Drop** | @dnd-kit |
| **Charts** | Recharts |
| **Email** | Resend |
| **ERP** | Tiny API V3 |
| **Deploy** | Vercel |
| **IDE** | Cursor AI |
| **Package Manager** | pnpm |

> Este documento é a fonte de verdade do projeto. Copie-o para `.cursor/rules.md` (versão resumida) e mantenha como referência principal durante o desenvolvimento.
