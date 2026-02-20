# ADDS CRM — Implementação do Gerenciador de Orçamentos Públicos (Interno)

## OBJETIVO

Reescrever a página `/quotes` (gerenciador interno de orçamentos públicos) com:
1. **quotes.service.ts** — CRUD completo com Supabase
2. **quotes-table.tsx** — Tabela rica com filtros, busca, paginação, ações
3. **quote-detail-sheet.tsx** — Sheet lateral com detalhe + ações (aprovar, rejeitar, contactar)
4. **page.tsx** — Reescrita da página principal

---

## CONTEXTO DO PROJETO

- **Stack**: Next.js 15 (App Router) + TypeScript + Tailwind CSS 4 + shadcn/ui
- **Backend**: Supabase (Auth, PostgreSQL, Storage, Realtime)
- **State**: Zustand (UI) + TanStack Query 5 (server state)
- **Forms**: React Hook Form 7 + Zod 3
- **Idioma**: Tudo em pt-BR
- **Theme**: Dark mode ativo, paleta ADDS (azul #21add6, laranja #f07d00, navy #0b4269)
- **Convenções**: kebab-case nos arquivos, PascalCase nos componentes, services em `src/services/`, hooks em `src/hooks/`
- **Imports**: Sempre com `@/` prefix (absolute imports)

---

## 1. SCHEMA DA TABELA `public_quotes` (já existe no banco)

```sql
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

-- Enum de status
CREATE TYPE quote_status AS ENUM (
  'PENDENTE',
  'CONTACTADO',
  'CONCLUIDO',
  'APROVADO',
  'REJEITADO'
);
```

---

## 2. ARQUIVO: `src/services/quotes.service.ts`

Criar este arquivo do zero. Segue o mesmo padrão do `orders.service.ts`.

```typescript
import { createBrowserClient } from '@/lib/supabase/client'

export type QuoteStatus = 'PENDENTE' | 'CONTACTADO' | 'CONCLUIDO' | 'APROVADO' | 'REJEITADO'

export interface QuoteItem {
  product_id: string
  product_name: string
  quantity: number
  colors?: string[]
  custom_color?: string | null
}

export interface QuotePersonalization {
  print_color?: string
  custom_color?: string | null
  notes?: string
}

export interface PublicQuote {
  id: string
  client_name: string
  client_email: string | null
  client_phone: string | null
  client_whatsapp: string | null
  client_document: string | null
  client_city: string | null
  client_state: string | null
  client_zip_code: string | null
  client_street: string | null
  client_number: string | null
  client_complement: string | null
  client_neighborhood: string | null
  client_social_media: string | null
  client_logo_url: string | null
  is_existing_client: boolean
  existing_client_id: string | null
  items: QuoteItem[]
  personalization: QuotePersonalization | null
  estimated_value: number | null
  status: QuoteStatus
  assigned_to: string | null
  internal_notes: string | null
  order_id: string | null
  created_at: string
  updated_at: string
  // Relações (join)
  assigned_profile?: {
    id: string
    full_name: string
    avatar_url: string | null
  } | null
}

export interface QuoteFilters {
  status?: QuoteStatus | 'ALL'
  search?: string
  page?: number
  limit?: number
}

export interface QuoteUpdateData {
  status?: QuoteStatus
  assigned_to?: string | null
  internal_notes?: string | null
  estimated_value?: number | null
}

const PAGE_SIZE = 20

// ============================================
// LISTAR ORÇAMENTOS COM FILTROS E PAGINAÇÃO
// ============================================
export async function getQuotes(filters: QuoteFilters = {}) {
  const supabase = createBrowserClient()
  const { status = 'ALL', search, page = 1, limit = PAGE_SIZE } = filters

  let query = supabase
    .from('public_quotes')
    .select(`
      *,
      assigned_profile:profiles!public_quotes_assigned_to_fkey(
        id, full_name, avatar_url
      )
    `, { count: 'exact' })
    .order('created_at', { ascending: false })

  // Filtro de status
  if (status && status !== 'ALL') {
    query = query.eq('status', status)
  }

  // Busca por texto (nome, email, telefone, documento)
  if (search && search.trim().length >= 2) {
    query = query.or(
      `client_name.ilike.%${search}%,client_email.ilike.%${search}%,client_phone.ilike.%${search}%,client_document.ilike.%${search}%`
    )
  }

  // Paginação
  const from = (page - 1) * limit
  const to = from + limit - 1
  query = query.range(from, to)

  const { data, error, count } = await query

  if (error) throw error

  return {
    quotes: (data || []) as PublicQuote[],
    total: count || 0,
    page,
    totalPages: Math.ceil((count || 0) / limit),
  }
}

// ============================================
// BUSCAR ORÇAMENTO POR ID
// ============================================
export async function getQuoteById(id: string) {
  const supabase = createBrowserClient()

  const { data, error } = await supabase
    .from('public_quotes')
    .select(`
      *,
      assigned_profile:profiles!public_quotes_assigned_to_fkey(
        id, full_name, avatar_url
      )
    `)
    .eq('id', id)
    .single()

  if (error) throw error
  return data as PublicQuote
}

// ============================================
// ATUALIZAR ORÇAMENTO (status, notas, responsável, valor)
// ============================================
export async function updateQuote(id: string, data: QuoteUpdateData) {
  const supabase = createBrowserClient()

  const { data: updated, error } = await supabase
    .from('public_quotes')
    .update({
      ...data,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return updated as PublicQuote
}

// ============================================
// APROVAR ORÇAMENTO → CRIAR PEDIDO NO KANBAN
// ============================================
export async function approveQuote(quoteId: string) {
  const supabase = createBrowserClient()

  // 1. Buscar dados do orçamento
  const { data: quote, error: fetchError } = await supabase
    .from('public_quotes')
    .select('*')
    .eq('id', quoteId)
    .single()

  if (fetchError) throw fetchError

  // 2. Buscar ou criar cliente
  let clientId = quote.existing_client_id

  if (!clientId) {
    // Criar cliente a partir dos dados do orçamento
    const { data: newClient, error: clientError } = await supabase
      .from('clients')
      .insert({
        name: quote.client_name,
        email: quote.client_email,
        phone: quote.client_phone || quote.client_whatsapp,
        document: quote.client_document,
        city: quote.client_city,
        state: quote.client_state,
        zip_code: quote.client_zip_code,
        street: quote.client_street,
        number: quote.client_number,
        complement: quote.client_complement,
        neighborhood: quote.client_neighborhood,
      })
      .select()
      .single()

    if (clientError) throw clientError
    clientId = newClient.id
  }

  // 3. Criar pedido
  const { data: order, error: orderError } = await supabase
    .from('orders')
    .insert({
      title: quote.client_name,
      description: quote.personalization?.notes || null,
      client_id: clientId,
      status: 'FAZER',
      order_type: 'ORCAMENTO_PUBLICO',
      priority: 'NORMAL',
      start_date: new Date().toISOString().split('T')[0],
      position: 0,
    })
    .select()
    .single()

  if (orderError) throw orderError

  // 4. Criar order_items a partir dos items do orçamento
  if (quote.items && Array.isArray(quote.items)) {
    const orderItems = quote.items.map((item: QuoteItem) => ({
      order_id: order.id,
      product_id: item.product_id || null,
      product_name: item.product_name,
      quantity: item.quantity,
      personalization: {
        colors: item.colors || [],
        custom_color: item.custom_color || null,
        notes: quote.personalization?.notes || '',
      },
    }))

    const { error: itemsError } = await supabase
      .from('order_items')
      .insert(orderItems)

    if (itemsError) throw itemsError
  }

  // 5. Atualizar orçamento com status APROVADO e link para o pedido
  const { error: updateError } = await supabase
    .from('public_quotes')
    .update({
      status: 'APROVADO',
      order_id: order.id,
      updated_at: new Date().toISOString(),
    })
    .eq('id', quoteId)

  if (updateError) throw updateError

  return order
}

// ============================================
// REJEITAR ORÇAMENTO
// ============================================
export async function rejectQuote(quoteId: string, reason?: string) {
  const supabase = createBrowserClient()

  const { data, error } = await supabase
    .from('public_quotes')
    .update({
      status: 'REJEITADO',
      internal_notes: reason || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', quoteId)
    .select()
    .single()

  if (error) throw error
  return data as PublicQuote
}

// ============================================
// MARCAR COMO CONTACTADO
// ============================================
export async function markAsContacted(quoteId: string) {
  return updateQuote(quoteId, { status: 'CONTACTADO' })
}

// ============================================
// CONTAGEM POR STATUS (para badges)
// ============================================
export async function getQuoteCounts() {
  const supabase = createBrowserClient()

  const { data, error } = await supabase
    .from('public_quotes')
    .select('status')

  if (error) throw error

  const counts = {
    PENDENTE: 0,
    CONTACTADO: 0,
    CONCLUIDO: 0,
    APROVADO: 0,
    REJEITADO: 0,
    TOTAL: data?.length || 0,
  }

  data?.forEach((q) => {
    if (q.status in counts) {
      counts[q.status as keyof typeof counts]++
    }
  })

  return counts
}
```

---

## 3. ARQUIVO: `src/app/(dashboard)/quotes/page.tsx`

Reescrever completamente. Esta é a página principal.

```tsx
'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { FileText, Plus } from 'lucide-react'
import { getQuotes, getQuoteCounts, type QuoteStatus } from '@/services/quotes.service'
import { QuotesTable } from './_components/quotes-table'
import { QuoteDetailSheet } from './_components/quote-detail-sheet'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'

const STATUS_OPTIONS = [
  { value: 'ALL', label: 'Todos' },
  { value: 'PENDENTE', label: 'Pendentes' },
  { value: 'CONTACTADO', label: 'Contactados' },
  { value: 'CONCLUIDO', label: 'Concluídos' },
  { value: 'APROVADO', label: 'Aprovados' },
  { value: 'REJEITADO', label: 'Rejeitados' },
] as const

export default function QuotesPage() {
  const [statusFilter, setStatusFilter] = useState<QuoteStatus | 'ALL'>('ALL')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [selectedQuoteId, setSelectedQuoteId] = useState<string | null>(null)

  // Buscar orçamentos
  const { data, isLoading, error } = useQuery({
    queryKey: ['quotes', statusFilter, search, page],
    queryFn: () => getQuotes({ status: statusFilter, search, page }),
  })

  // Contagem por status
  const { data: counts } = useQuery({
    queryKey: ['quote-counts'],
    queryFn: getQuoteCounts,
  })

  const handleSearch = (value: string) => {
    setSearch(value)
    setPage(1) // Reset para página 1 ao buscar
  }

  const handleStatusChange = (value: string) => {
    setStatusFilter(value as QuoteStatus | 'ALL')
    setPage(1)
  }

  return (
    <div className="flex-1 space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight">
              Orçamentos Públicos
            </h1>
            {counts && counts.PENDENTE > 0 && (
              <Badge variant="default" className="bg-amber-500 text-white">
                {counts.PENDENTE} pendente{counts.PENDENTE > 1 ? 's' : ''}
              </Badge>
            )}
          </div>
          <p className="text-muted-foreground mt-1">
            Gerencie orçamentos enviados pelo formulário público
          </p>
        </div>

        {/* Futuramente: botão para copiar link do formulário público */}
        <Button variant="outline" size="sm" className="gap-2" disabled>
          <FileText className="h-4 w-4" />
          Link do formulário
        </Button>
      </div>

      {/* Filtros */}
      <div className="flex items-center gap-4">
        <Select value={statusFilter} onValueChange={handleStatusChange}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filtrar por status" />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                <div className="flex items-center gap-2">
                  {option.label}
                  {option.value !== 'ALL' && counts && counts[option.value as QuoteStatus] > 0 && (
                    <Badge variant="secondary" className="text-xs px-1.5 py-0">
                      {counts[option.value as QuoteStatus]}
                    </Badge>
                  )}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="relative flex-1 max-w-sm">
          <Input
            placeholder="Buscar por nome, e-mail, telefone ou documento..."
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            className="pl-9"
          />
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"
            fill="none" viewBox="0 0 24 24" stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>

        {/* Contadores resumidos */}
        {counts && (
          <div className="hidden lg:flex items-center gap-2 text-sm text-muted-foreground ml-auto">
            <span>{counts.TOTAL} total</span>
            <span>·</span>
            <span className="text-amber-500">{counts.PENDENTE} pendentes</span>
            <span>·</span>
            <span className="text-green-500">{counts.APROVADO} aprovados</span>
          </div>
        )}
      </div>

      {/* Tabela */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <p className="text-destructive text-lg font-medium">Erro ao carregar orçamentos</p>
          <p className="text-muted-foreground text-sm mt-1">
            {error instanceof Error ? error.message : 'Tente novamente'}
          </p>
        </div>
      ) : (
        <QuotesTable
          quotes={data?.quotes || []}
          total={data?.total || 0}
          page={page}
          totalPages={data?.totalPages || 0}
          onPageChange={setPage}
          onSelectQuote={setSelectedQuoteId}
        />
      )}

      {/* Detail Sheet */}
      <QuoteDetailSheet
        quoteId={selectedQuoteId}
        open={!!selectedQuoteId}
        onClose={() => setSelectedQuoteId(null)}
      />
    </div>
  )
}
```

---

## 4. ARQUIVO: `src/app/(dashboard)/quotes/_components/quotes-table.tsx`

```tsx
'use client'

import { formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import {
  MoreHorizontal,
  Eye,
  CheckCircle2,
  XCircle,
  Phone,
  Mail,
  MessageCircle,
  ExternalLink,
} from 'lucide-react'
import { type PublicQuote, type QuoteStatus } from '@/services/quotes.service'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

// ============================================
// STATUS CONFIG (cor + label)
// ============================================
const STATUS_CONFIG: Record<QuoteStatus, { label: string; variant: string; className: string }> = {
  PENDENTE: {
    label: 'Pendente',
    variant: 'outline',
    className: 'border-amber-500/50 text-amber-500 bg-amber-500/10',
  },
  CONTACTADO: {
    label: 'Contactado',
    variant: 'outline',
    className: 'border-blue-500/50 text-blue-500 bg-blue-500/10',
  },
  CONCLUIDO: {
    label: 'Concluído',
    variant: 'outline',
    className: 'border-cyan-500/50 text-cyan-500 bg-cyan-500/10',
  },
  APROVADO: {
    label: 'Aprovado',
    variant: 'outline',
    className: 'border-green-500/50 text-green-500 bg-green-500/10',
  },
  REJEITADO: {
    label: 'Rejeitado',
    variant: 'outline',
    className: 'border-red-500/50 text-red-500 bg-red-500/10',
  },
}

// ============================================
// HELPER: Iniciais do nome
// ============================================
function getInitials(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase()
}

// ============================================
// HELPER: Formatar valor
// ============================================
function formatCurrency(value: number | null) {
  if (!value) return '—'
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value)
}

// ============================================
// HELPER: Formatar produtos do JSONB
// ============================================
function formatProducts(items: any[]) {
  if (!items || items.length === 0) return '—'
  return items
    .map((item) => `${item.product_name} (${item.quantity})`)
    .join(' · ')
}

// ============================================
// PROPS
// ============================================
interface QuotesTableProps {
  quotes: PublicQuote[]
  total: number
  page: number
  totalPages: number
  onPageChange: (page: number) => void
  onSelectQuote: (id: string) => void
}

export function QuotesTable({
  quotes,
  total,
  page,
  totalPages,
  onPageChange,
  onSelectQuote,
}: QuotesTableProps) {
  if (quotes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
          <MessageCircle className="h-8 w-8 text-muted-foreground" />
        </div>
        <p className="text-lg font-medium">Nenhum orçamento encontrado</p>
        <p className="text-muted-foreground text-sm mt-1">
          Os orçamentos aparecerão aqui quando clientes enviarem pelo formulário público
        </p>
      </div>
    )
  }

  return (
    <div>
      {/* Tabela */}
      <div className="rounded-lg border border-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30 hover:bg-muted/30">
              <TableHead className="w-[280px]">Cliente</TableHead>
              <TableHead className="w-[250px]">Produtos</TableHead>
              <TableHead className="w-[120px] text-right">Valor</TableHead>
              <TableHead className="w-[130px]">Status</TableHead>
              <TableHead className="w-[100px]">Responsável</TableHead>
              <TableHead className="w-[140px]">Data</TableHead>
              <TableHead className="w-[60px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {quotes.map((quote) => {
              const statusConfig = STATUS_CONFIG[quote.status]
              return (
                <TableRow
                  key={quote.id}
                  className="cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => onSelectQuote(quote.id)}
                >
                  {/* Cliente */}
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-9 w-9 shrink-0">
                        <AvatarFallback className="bg-primary/10 text-primary text-xs font-medium">
                          {getInitials(quote.client_name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="font-medium truncate">{quote.client_name}</p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          {quote.client_phone && (
                            <span className="truncate">{quote.client_phone}</span>
                          )}
                          {quote.client_phone && quote.client_city && <span>·</span>}
                          {quote.client_city && (
                            <span className="truncate">
                              {quote.client_city}
                              {quote.client_state ? `/${quote.client_state}` : ''}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </TableCell>

                  {/* Produtos */}
                  <TableCell>
                    <p className="text-sm truncate max-w-[230px]">
                      {formatProducts(quote.items)}
                    </p>
                  </TableCell>

                  {/* Valor */}
                  <TableCell className="text-right font-medium tabular-nums">
                    {formatCurrency(quote.estimated_value)}
                  </TableCell>

                  {/* Status */}
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={statusConfig.className}
                    >
                      {statusConfig.label}
                    </Badge>
                  </TableCell>

                  {/* Responsável */}
                  <TableCell>
                    {quote.assigned_profile ? (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger>
                            <Avatar className="h-7 w-7">
                              <AvatarFallback className="text-xs bg-secondary">
                                {getInitials(quote.assigned_profile.full_name)}
                              </AvatarFallback>
                            </Avatar>
                          </TooltipTrigger>
                          <TooltipContent>
                            {quote.assigned_profile.full_name}
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    ) : (
                      <span className="text-muted-foreground text-sm">—</span>
                    )}
                  </TableCell>

                  {/* Data */}
                  <TableCell>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger className="text-sm text-muted-foreground">
                          {formatDistanceToNow(new Date(quote.created_at), {
                            addSuffix: true,
                            locale: ptBR,
                          })}
                        </TooltipTrigger>
                        <TooltipContent>
                          {new Date(quote.created_at).toLocaleString('pt-BR')}
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </TableCell>

                  {/* Ações */}
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={(e) => {
                          e.stopPropagation()
                          onSelectQuote(quote.id)
                        }}>
                          <Eye className="mr-2 h-4 w-4" />
                          Ver detalhes
                        </DropdownMenuItem>

                        {quote.client_phone && (
                          <DropdownMenuItem asChild>
                            <a
                              href={`https://wa.me/55${quote.client_phone.replace(/\D/g, '')}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <MessageCircle className="mr-2 h-4 w-4" />
                              WhatsApp
                            </a>
                          </DropdownMenuItem>
                        )}

                        {quote.client_email && (
                          <DropdownMenuItem asChild>
                            <a
                              href={`mailto:${quote.client_email}`}
                              onClick={(e) => e.stopPropagation()}
                            >
                              <Mail className="mr-2 h-4 w-4" />
                              E-mail
                            </a>
                          </DropdownMenuItem>
                        )}

                        {quote.order_id && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem asChild>
                              <a href={`/pipeline?order=${quote.order_id}`}>
                                <ExternalLink className="mr-2 h-4 w-4" />
                                Ver pedido no Pipeline
                              </a>
                            </DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>

      {/* Paginação */}
      <div className="flex items-center justify-between mt-4">
        <p className="text-sm text-muted-foreground">
          {total} registro{total !== 1 ? 's' : ''} no total
        </p>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1}
          >
            Anterior
          </Button>
          <span className="text-sm text-muted-foreground">
            Página {page} de {totalPages || 1}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange(page + 1)}
            disabled={page >= totalPages}
          >
            Próxima
          </Button>
        </div>
      </div>
    </div>
  )
}
```

---

## 5. ARQUIVO: `src/app/(dashboard)/quotes/_components/quote-detail-sheet.tsx`

```tsx
'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { toast } from 'sonner'
import {
  User,
  Phone,
  Mail,
  MapPin,
  Package,
  MessageCircle,
  CheckCircle2,
  XCircle,
  PhoneCall,
  ExternalLink,
  FileText,
  Globe,
  Copy,
  Loader2,
  Image as ImageIcon,
} from 'lucide-react'
import {
  getQuoteById,
  updateQuote,
  approveQuote,
  rejectQuote,
  markAsContacted,
  type PublicQuote,
  type QuoteStatus,
} from '@/services/quotes.service'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'

// ============================================
// STATUS CONFIG
// ============================================
const STATUS_CONFIG: Record<QuoteStatus, { label: string; className: string; icon: any }> = {
  PENDENTE: {
    label: 'Pendente',
    className: 'border-amber-500/50 text-amber-500 bg-amber-500/10',
    icon: FileText,
  },
  CONTACTADO: {
    label: 'Contactado',
    className: 'border-blue-500/50 text-blue-500 bg-blue-500/10',
    icon: PhoneCall,
  },
  CONCLUIDO: {
    label: 'Concluído',
    className: 'border-cyan-500/50 text-cyan-500 bg-cyan-500/10',
    icon: CheckCircle2,
  },
  APROVADO: {
    label: 'Aprovado',
    className: 'border-green-500/50 text-green-500 bg-green-500/10',
    icon: CheckCircle2,
  },
  REJEITADO: {
    label: 'Rejeitado',
    className: 'border-red-500/50 text-red-500 bg-red-500/10',
    icon: XCircle,
  },
}

// ============================================
// HELPERS
// ============================================
function getInitials(name: string) {
  return name.split(' ').filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase()
}

function formatCurrency(value: number | null) {
  if (!value) return '—'
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
}

function formatDocument(doc: string | null) {
  if (!doc) return null
  const clean = doc.replace(/\D/g, '')
  if (clean.length === 11) {
    return clean.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')
  }
  if (clean.length === 14) {
    return clean.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5')
  }
  return doc
}

function copyToClipboard(text: string, label: string) {
  navigator.clipboard.writeText(text)
  toast.success(`${label} copiado!`)
}

// ============================================
// PROPS
// ============================================
interface QuoteDetailSheetProps {
  quoteId: string | null
  open: boolean
  onClose: () => void
}

export function QuoteDetailSheet({ quoteId, open, onClose }: QuoteDetailSheetProps) {
  const queryClient = useQueryClient()
  const [internalNotes, setInternalNotes] = useState('')
  const [estimatedValue, setEstimatedValue] = useState('')
  const [rejectReason, setRejectReason] = useState('')

  // Buscar dados do orçamento
  const { data: quote, isLoading } = useQuery({
    queryKey: ['quote', quoteId],
    queryFn: () => getQuoteById(quoteId!),
    enabled: !!quoteId && open,
  })

  // Quando dados carregam, preencher campos
  const handleQuoteLoaded = (q: PublicQuote) => {
    setInternalNotes(q.internal_notes || '')
    setEstimatedValue(q.estimated_value?.toString() || '')
  }

  // Se o quote mudou, atualizar campos
  if (quote && internalNotes === '' && estimatedValue === '') {
    handleQuoteLoaded(quote)
  }

  // ============================================
  // MUTATIONS
  // ============================================
  const invalidateQueries = () => {
    queryClient.invalidateQueries({ queryKey: ['quotes'] })
    queryClient.invalidateQueries({ queryKey: ['quote-counts'] })
    queryClient.invalidateQueries({ queryKey: ['quote', quoteId] })
  }

  const approveMutation = useMutation({
    mutationFn: () => approveQuote(quoteId!),
    onSuccess: (order) => {
      toast.success('Orçamento aprovado!', {
        description: `Pedido #${order.order_number || ''} criado no Pipeline`,
      })
      invalidateQueries()
      onClose()
    },
    onError: (error) => {
      toast.error('Erro ao aprovar orçamento', {
        description: error instanceof Error ? error.message : 'Tente novamente',
      })
    },
  })

  const rejectMutation = useMutation({
    mutationFn: () => rejectQuote(quoteId!, rejectReason),
    onSuccess: () => {
      toast.success('Orçamento rejeitado')
      setRejectReason('')
      invalidateQueries()
      onClose()
    },
    onError: (error) => {
      toast.error('Erro ao rejeitar', {
        description: error instanceof Error ? error.message : 'Tente novamente',
      })
    },
  })

  const contactMutation = useMutation({
    mutationFn: () => markAsContacted(quoteId!),
    onSuccess: () => {
      toast.success('Marcado como contactado')
      invalidateQueries()
    },
    onError: (error) => {
      toast.error('Erro ao atualizar', {
        description: error instanceof Error ? error.message : 'Tente novamente',
      })
    },
  })

  const saveNotesMutation = useMutation({
    mutationFn: () =>
      updateQuote(quoteId!, {
        internal_notes: internalNotes || null,
        estimated_value: estimatedValue ? parseFloat(estimatedValue) : null,
      }),
    onSuccess: () => {
      toast.success('Notas salvas')
      invalidateQueries()
    },
    onError: (error) => {
      toast.error('Erro ao salvar', {
        description: error instanceof Error ? error.message : 'Tente novamente',
      })
    },
  })

  const isActionDisabled =
    approveMutation.isPending ||
    rejectMutation.isPending ||
    contactMutation.isPending

  if (!quoteId) return null

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="w-full sm:max-w-[540px] overflow-y-auto p-0">
        {isLoading || !quote ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : (
          <>
            {/* Header */}
            <SheetHeader className="p-6 pb-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <Avatar className="h-12 w-12">
                    <AvatarFallback className="bg-primary/10 text-primary font-medium">
                      {getInitials(quote.client_name)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <SheetTitle className="text-lg">
                      {quote.client_name}
                    </SheetTitle>
                    <p className="text-sm text-muted-foreground">
                      Enviado{' '}
                      {formatDistanceToNow(new Date(quote.created_at), {
                        addSuffix: true,
                        locale: ptBR,
                      })}
                    </p>
                  </div>
                </div>
                <Badge
                  variant="outline"
                  className={STATUS_CONFIG[quote.status].className}
                >
                  {STATUS_CONFIG[quote.status].label}
                </Badge>
              </div>
            </SheetHeader>

            <Separator />

            <div className="p-6 space-y-6">
              {/* ============================================ */}
              {/* SEÇÃO: Dados do Cliente */}
              {/* ============================================ */}
              <div>
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                  Dados do Cliente
                </h3>
                <div className="space-y-2.5">
                  {/* Telefone */}
                  {(quote.client_phone || quote.client_whatsapp) && (
                    <div className="flex items-center justify-between group">
                      <div className="flex items-center gap-2 text-sm">
                        <Phone className="h-4 w-4 text-muted-foreground" />
                        <span>{quote.client_phone || quote.client_whatsapp}</span>
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() =>
                            copyToClipboard(
                              (quote.client_phone || quote.client_whatsapp)!,
                              'Telefone'
                            )
                          }
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </Button>
                        {(quote.client_whatsapp || quote.client_phone) && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-green-500"
                            asChild
                          >
                            <a
                              href={`https://wa.me/55${(
                                quote.client_whatsapp ||
                                quote.client_phone ||
                                ''
                              ).replace(/\D/g, '')}`}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <MessageCircle className="h-3.5 w-3.5" />
                            </a>
                          </Button>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Email */}
                  {quote.client_email && (
                    <div className="flex items-center justify-between group">
                      <div className="flex items-center gap-2 text-sm">
                        <Mail className="h-4 w-4 text-muted-foreground" />
                        <span>{quote.client_email}</span>
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => copyToClipboard(quote.client_email!, 'E-mail')}
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7" asChild>
                          <a href={`mailto:${quote.client_email}`}>
                            <Mail className="h-3.5 w-3.5" />
                          </a>
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Documento */}
                  {quote.client_document && (
                    <div className="flex items-center gap-2 text-sm">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      <span>{formatDocument(quote.client_document)}</span>
                    </div>
                  )}

                  {/* Endereço */}
                  {(quote.client_city || quote.client_state) && (
                    <div className="flex items-center gap-2 text-sm">
                      <MapPin className="h-4 w-4 text-muted-foreground" />
                      <span>
                        {[
                          quote.client_street,
                          quote.client_number,
                          quote.client_neighborhood,
                          quote.client_city,
                          quote.client_state,
                          quote.client_zip_code,
                        ]
                          .filter(Boolean)
                          .join(', ')}
                      </span>
                    </div>
                  )}

                  {/* Redes sociais */}
                  {quote.client_social_media && (
                    <div className="flex items-center gap-2 text-sm">
                      <Globe className="h-4 w-4 text-muted-foreground" />
                      <span>{quote.client_social_media}</span>
                    </div>
                  )}

                  {/* Logo */}
                  {quote.client_logo_url && (
                    <div className="flex items-center gap-2 text-sm">
                      <ImageIcon className="h-4 w-4 text-muted-foreground" />
                      <a
                        href={quote.client_logo_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline"
                      >
                        Ver logo do cliente
                      </a>
                    </div>
                  )}
                </div>
              </div>

              <Separator />

              {/* ============================================ */}
              {/* SEÇÃO: Produtos */}
              {/* ============================================ */}
              <div>
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                  Produtos Solicitados
                </h3>
                <div className="space-y-2">
                  {quote.items?.map((item: any, index: number) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border"
                    >
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded bg-primary/10 flex items-center justify-center">
                          <Package className="h-4 w-4 text-primary" />
                        </div>
                        <div>
                          <p className="text-sm font-medium">{item.product_name}</p>
                          {item.colors && item.colors.length > 0 && (
                            <p className="text-xs text-muted-foreground">
                              Cores: {item.colors.join(', ')}
                            </p>
                          )}
                        </div>
                      </div>
                      <Badge variant="secondary" className="tabular-nums">
                        {item.quantity} un
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>

              {/* ============================================ */}
              {/* SEÇÃO: Personalização */}
              {/* ============================================ */}
              {quote.personalization && (
                <>
                  <Separator />
                  <div>
                    <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                      Personalização
                    </h3>
                    <div className="p-3 rounded-lg bg-muted/30 border border-border">
                      {quote.personalization.print_color && (
                        <p className="text-sm mb-1">
                          <span className="text-muted-foreground">Cor de impressão:</span>{' '}
                          {quote.personalization.print_color}
                        </p>
                      )}
                      {quote.personalization.custom_color && (
                        <p className="text-sm mb-1">
                          <span className="text-muted-foreground">Cor personalizada:</span>{' '}
                          {quote.personalization.custom_color}
                        </p>
                      )}
                      {quote.personalization.notes && (
                        <p className="text-sm">
                          <span className="text-muted-foreground">Observações:</span>{' '}
                          {quote.personalization.notes}
                        </p>
                      )}
                    </div>
                  </div>
                </>
              )}

              <Separator />

              {/* ============================================ */}
              {/* SEÇÃO: Gestão Interna */}
              {/* ============================================ */}
              <div>
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                  Gestão Interna
                </h3>
                <div className="space-y-4">
                  {/* Valor estimado */}
                  <div className="space-y-1.5">
                    <Label htmlFor="estimated_value" className="text-sm">
                      Valor Estimado
                    </Label>
                    <Input
                      id="estimated_value"
                      type="number"
                      step="0.01"
                      placeholder="R$ 0,00"
                      value={estimatedValue}
                      onChange={(e) => setEstimatedValue(e.target.value)}
                    />
                  </div>

                  {/* Notas internas */}
                  <div className="space-y-1.5">
                    <Label htmlFor="internal_notes" className="text-sm">
                      Notas Internas
                    </Label>
                    <Textarea
                      id="internal_notes"
                      placeholder="Observações internas sobre este orçamento..."
                      rows={3}
                      value={internalNotes}
                      onChange={(e) => setInternalNotes(e.target.value)}
                    />
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => saveNotesMutation.mutate()}
                    disabled={saveNotesMutation.isPending}
                  >
                    {saveNotesMutation.isPending ? (
                      <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                    ) : null}
                    Salvar notas
                  </Button>
                </div>
              </div>

              {/* Link para pedido se aprovado */}
              {quote.order_id && (
                <>
                  <Separator />
                  <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                        <span className="text-sm font-medium text-green-500">
                          Pedido criado no Pipeline
                        </span>
                      </div>
                      <Button variant="outline" size="sm" asChild>
                        <a href={`/pipeline?order=${quote.order_id}`}>
                          <ExternalLink className="mr-2 h-3.5 w-3.5" />
                          Abrir pedido
                        </a>
                      </Button>
                    </div>
                  </div>
                </>
              )}

              <Separator />

              {/* ============================================ */}
              {/* SEÇÃO: Ações */}
              {/* ============================================ */}
              {quote.status !== 'APROVADO' && quote.status !== 'REJEITADO' && (
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                    Ações
                  </h3>

                  <div className="flex flex-wrap gap-2">
                    {/* Aprovar */}
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          className="bg-green-600 hover:bg-green-700 text-white gap-2"
                          disabled={isActionDisabled}
                        >
                          <CheckCircle2 className="h-4 w-4" />
                          Aprovar e criar pedido
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Aprovar orçamento?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Isso vai criar automaticamente um pedido no Pipeline com os dados
                            deste orçamento e o cliente será cadastrado (se ainda não existir).
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction
                            className="bg-green-600 hover:bg-green-700"
                            onClick={() => approveMutation.mutate()}
                          >
                            {approveMutation.isPending && (
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            )}
                            Confirmar aprovação
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>

                    {/* Marcar como contactado */}
                    {quote.status === 'PENDENTE' && (
                      <Button
                        variant="outline"
                        className="gap-2"
                        onClick={() => contactMutation.mutate()}
                        disabled={isActionDisabled}
                      >
                        {contactMutation.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <PhoneCall className="h-4 w-4" />
                        )}
                        Marcar contactado
                      </Button>
                    )}

                    {/* Rejeitar */}
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="outline"
                          className="gap-2 border-red-500/50 text-red-500 hover:bg-red-500/10"
                          disabled={isActionDisabled}
                        >
                          <XCircle className="h-4 w-4" />
                          Rejeitar
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Rejeitar orçamento?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Deseja rejeitar este orçamento? Você pode informar o motivo abaixo.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <Textarea
                          placeholder="Motivo da rejeição (opcional)..."
                          value={rejectReason}
                          onChange={(e) => setRejectReason(e.target.value)}
                          rows={3}
                        />
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction
                            className="bg-red-600 hover:bg-red-700"
                            onClick={() => rejectMutation.mutate()}
                          >
                            {rejectMutation.isPending && (
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            )}
                            Confirmar rejeição
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}
```

---

## 6. ORDEM DE IMPLEMENTAÇÃO NO CURSOR

### Passo 1: Criar o service
```
Crie o arquivo src/services/quotes.service.ts com o conteúdo acima
```

### Passo 2: Criar os componentes
```
Crie o arquivo src/app/(dashboard)/quotes/_components/quotes-table.tsx
Crie o arquivo src/app/(dashboard)/quotes/_components/quote-detail-sheet.tsx
```

### Passo 3: Reescrever a página
```
Reescreva src/app/(dashboard)/quotes/page.tsx com o conteúdo acima
```

### Passo 4: Verificar dependências
Certifique-se que estes componentes shadcn/ui existem:
- `sheet` (se não: `npx shadcn@latest add sheet`)
- `alert-dialog` (se não: `npx shadcn@latest add alert-dialog`)
- `separator` (se não: `npx shadcn@latest add separator`)
- `label` (se não: `npx shadcn@latest add label`)
- `tooltip` (se não: `npx shadcn@latest add tooltip`)

### Passo 5: Testar
1. Inserir um orçamento de teste no Supabase manualmente:
```sql
INSERT INTO public_quotes (
  client_name, client_email, client_phone, client_city, client_state,
  items, personalization, status
) VALUES (
  'Clínica Sorriso LTDA',
  'contato@clinicasorriso.com.br',
  '(11) 99999-8888',
  'São Paulo', 'SP',
  '[{"product_name": "ADDS Implant", "quantity": 100}, {"product_name": "ADDS Ultra", "quantity": 50}]'::jsonb,
  '{"print_color": "Branco", "notes": "Logo na embalagem, texto lateral"}'::jsonb,
  'PENDENTE'
);
```
2. Verificar se a tabela renderiza corretamente
3. Testar o sheet de detalhes clicando em um orçamento
4. Testar aprovar (verifica se cria pedido no Pipeline)
5. Testar rejeitar

---

## 7. NOTAS IMPORTANTES

### RLS (Row Level Security)
A tabela `public_quotes` precisa de policies RLS. Se ainda não existem, criar:
```sql
ALTER TABLE public_quotes ENABLE ROW LEVEL SECURITY;

-- MASTER e GESTOR podem ver e gerenciar todos
CREATE POLICY "quotes_select" ON public_quotes FOR SELECT
  USING (get_user_role() IN ('MASTER', 'GESTOR'));

CREATE POLICY "quotes_update" ON public_quotes FOR UPDATE
  USING (get_user_role() IN ('MASTER', 'GESTOR'));

-- Inserção pública (para o formulário público sem auth)
CREATE POLICY "quotes_public_insert" ON public_quotes FOR INSERT
  WITH CHECK (true);
```

### Foreign Key do JOIN
O SELECT com join de `profiles` assume que existe uma FK chamada `public_quotes_assigned_to_fkey`. Se o nome gerado pelo Supabase for diferente, ajuste no service. Alternativa sem FK nomeada:
```typescript
// Se o join nomeado não funcionar, usar subquery:
assigned_profile:profiles(id, full_name, avatar_url)
```

### Trigger updated_at
Verificar se a tabela `public_quotes` tem trigger de updated_at:
```sql
CREATE TRIGGER trg_quotes_updated BEFORE UPDATE ON public_quotes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
```
