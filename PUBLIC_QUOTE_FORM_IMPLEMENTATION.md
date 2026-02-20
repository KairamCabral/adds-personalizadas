# ADDS CRM — Formulário Público de Orçamento (Wizard)

## OBJETIVO

Criar o formulário público acessível em `/quote` (sem autenticação) onde clientes externos
solicitam orçamentos de escovas personalizadas. O formulário é um wizard de 6 etapas que coleta
dados do cliente, produtos desejados e detalhes de personalização. Ao enviar, cria um registro
na tabela `public_quotes` que aparece no gerenciador interno (`/quotes`) já implementado.

---

## CONTEXTO TÉCNICO

- **Stack**: Next.js 15 (App Router) + TypeScript + Tailwind CSS 4 + shadcn/ui
- **Backend**: Supabase (Auth, PostgreSQL, Storage)
- **Forms**: React Hook Form 7 + Zod 3
- **Idioma**: pt-BR
- **Rota pública**: `/quote` já está no array `publicRoutes` do middleware.ts
- **Layout**: Grupo `(public)` — layout próprio com branding ADDS, SEM sidebar, SEM auth
- **Paleta**: Azul #21add6, Laranja #f07d00, Navy #0b4269
- **Service**: `src/services/quotes.service.ts` já existe — adicionar `createPublicQuote()`
- **Integração Tiny**: JÁ FUNCIONA — pode integrar busca de cliente existente

---

## 1. SCHEMA DE DESTINO (tabela `public_quotes` — já existe)

```sql
CREATE TABLE public_quotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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
  items JSONB NOT NULL,                -- [{product_id, product_name, quantity, colors}]
  personalization JSONB,               -- {print_color, custom_color, notes}
  estimated_value DECIMAL(10,2),
  status quote_status NOT NULL DEFAULT 'PENDENTE',
  assigned_to UUID,
  internal_notes TEXT,
  order_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS: inserção pública já configurada
CREATE POLICY "quotes_public_insert" ON public_quotes FOR INSERT WITH CHECK (true);
```

---

## 2. TABELA `products` (referência para catálogo)

```sql
CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  price DECIMAL(10,2),
  category TEXT,
  product_type TEXT,
  image_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  -- Campos de cores (se já adicionados via ORDER_FORM migration):
  available_colors JSONB DEFAULT '[]'::jsonb,
  -- Ex: [{"key":"branco","label":"Branco","hex":"#FFFFFF"},{"key":"preto","label":"Preto","hex":"#000000"}]
  allows_custom_color BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

**IMPORTANTE**: Os produtos precisam de uma policy RLS para leitura pública (o formulário não tem auth):
```sql
-- Se ainda não existe, criar:
CREATE POLICY "products_public_read" ON products FOR SELECT
  USING (is_active = true);
```

---

## 3. FLUXO DO WIZARD (6 ETAPAS)

```
ETAPA 1: BEM-VINDO
├── "Já é cliente ADDS?" → Sim / Não
├── Se Sim → vai para Etapa 2 (busca no Tiny)
└── Se Não → vai para Etapa 3 (cadastro)

ETAPA 2: BUSCAR CLIENTE EXISTENTE
├── Campo de busca: e-mail, CPF/CNPJ ou telefone
├── Busca na API do Tiny ERP + tabela clients local
├── Resultados em lista com badge "Tiny" ou "CRM"
├── Ao selecionar: preenche dados automaticamente
└── "Não encontrou?" → vai para Etapa 3

ETAPA 3: DADOS DO CLIENTE (cadastro ou edição)
├── Nome completo *
├── E-mail
├── Telefone
├── WhatsApp *
├── CPF ou CNPJ
├── CEP (com auto-preenchimento via ViaCEP)
├── Cidade / Estado / Bairro / Rua / Número / Complemento
└── Rede social (Instagram, site, etc.)

ETAPA 4: PRODUTOS
├── Lista de produtos ativos do catálogo (cards visuais)
├── Para cada produto selecionado:
│   ├── Cores disponíveis (chips clicáveis a partir de available_colors)
│   ├── Cor personalizada (se allows_custom_color)
│   └── Quantidade (input numérico com +/-)
├── Pode adicionar múltiplos produtos
└── Mínimo: 1 produto selecionado

ETAPA 5: PERSONALIZAÇÃO
├── Cor de impressão (select ou input)
├── Cor personalizada (hex ou nome)
├── Observações de personalização (textarea)
├── Upload de logo do cliente (1 arquivo, max 10MB)
│   └── Aceita: jpg, jpeg, png, pdf, cdr
│   └── Upload para Supabase Storage bucket "adds-crm" pasta "logos/quotes/{quote_id}/"
└── Logo é opcional

ETAPA 6: REVISÃO E ENVIO
├── Resumo completo de todos os dados
├── Dados do cliente (nome, contato, endereço)
├── Produtos com cores e quantidades
├── Personalização e logo
├── Botão "Enviar Orçamento"
└── Ao enviar: cria registro em public_quotes → redireciona para /quote/success
```

---

## 4. ESTRUTURA DE ARQUIVOS A CRIAR

```
src/
├── app/
│   ├── (public)/
│   │   ├── layout.tsx                    ← CRIAR — Layout público (branding ADDS)
│   │   ├── quote/
│   │   │   ├── page.tsx                  ← CRIAR — Página do wizard
│   │   │   ├── success/
│   │   │   │   └── page.tsx              ← CRIAR — Página de sucesso
│   │   │   └── _components/
│   │   │       ├── quote-wizard.tsx       ← CRIAR — Controlador do wizard
│   │   │       ├── step-welcome.tsx       ← CRIAR — Etapa 1
│   │   │       ├── step-search.tsx        ← CRIAR — Etapa 2 (busca Tiny + local)
│   │   │       ├── step-client-data.tsx   ← CRIAR — Etapa 3
│   │   │       ├── step-products.tsx      ← CRIAR — Etapa 4
│   │   │       ├── step-personalization.tsx ← CRIAR — Etapa 5
│   │   │       ├── step-review.tsx        ← CRIAR — Etapa 6
│   │   │       ├── cep-lookup.tsx         ← CRIAR — Input CEP com auto-fill
│   │   │       ├── product-card.tsx       ← CRIAR — Card de produto selecionável
│   │   │       ├── logo-upload.tsx        ← CRIAR — Upload de logo
│   │   │       └── wizard-progress.tsx    ← CRIAR — Barra de progresso do wizard
│   │   │
│   │   (atualizar também:)
│   │
├── services/
│   └── quotes.service.ts                 ← ATUALIZAR — Adicionar createPublicQuote()
│
└── app/api/
    └── tiny/
        └── search/route.ts               ← CRIAR — API route para busca no Tiny (proxy)
```

---

## 5. ATUALIZAR: `src/services/quotes.service.ts`

Adicionar esta função ao service já existente:

```typescript
// ============================================
// CRIAR ORÇAMENTO PÚBLICO (chamado pelo formulário sem auth)
// ============================================
export interface CreatePublicQuoteData {
  // Cliente
  client_name: string
  client_email?: string
  client_phone?: string
  client_whatsapp?: string
  client_document?: string
  client_city?: string
  client_state?: string
  client_zip_code?: string
  client_street?: string
  client_number?: string
  client_complement?: string
  client_neighborhood?: string
  client_social_media?: string
  client_logo_url?: string
  is_existing_client?: boolean
  existing_client_id?: string
  // Produtos
  items: QuoteItem[]
  // Personalização
  personalization?: QuotePersonalization
}

export async function createPublicQuote(data: CreatePublicQuoteData) {
  const supabase = createBrowserClient()

  const { data: quote, error } = await supabase
    .from('public_quotes')
    .insert({
      ...data,
      status: 'PENDENTE',
    })
    .select()
    .single()

  if (error) throw error
  return quote as PublicQuote
}

// ============================================
// BUSCAR PRODUTOS ATIVOS (para formulário público, sem auth)
// ============================================
export async function getActiveProducts() {
  const supabase = createBrowserClient()

  const { data, error } = await supabase
    .from('products')
    .select('id, name, description, price, image_url, category, available_colors, allows_custom_color')
    .eq('is_active', true)
    .order('name')

  if (error) throw error
  return data || []
}

// ============================================
// UPLOAD DE LOGO (Supabase Storage, sem auth)
// ============================================
export async function uploadQuoteLogo(file: File): Promise<string> {
  const supabase = createBrowserClient()
  
  const fileExt = file.name.split('.').pop()
  const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`
  const filePath = `logos/quotes/${fileName}`

  const { error: uploadError } = await supabase.storage
    .from('adds-crm')
    .upload(filePath, file, {
      cacheControl: '3600',
      upsert: false,
    })

  if (uploadError) throw uploadError

  const { data } = supabase.storage.from('adds-crm').getPublicUrl(filePath)
  return data.publicUrl
}
```

---

## 6. CRIAR: `src/app/api/tiny/search/route.ts`

API Route para buscar clientes no Tiny ERP (proxy server-side para não expor token):

```typescript
import { NextRequest, NextResponse } from 'next/server'

const TINY_API_URL = process.env.TINY_API_URL || 'https://api.tiny.com.br/api2'
const TINY_API_TOKEN = process.env.TINY_API_TOKEN

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const query = searchParams.get('q')

  if (!query || query.length < 3) {
    return NextResponse.json({ contacts: [] })
  }

  if (!TINY_API_TOKEN) {
    return NextResponse.json({ error: 'Tiny API not configured' }, { status: 500 })
  }

  try {
    // Buscar no Tiny ERP
    const tinyResponse = await fetch(`${TINY_API_URL}/contatos.pesquisa.php`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        token: TINY_API_TOKEN,
        pesquisa: query,
        formato: 'json',
      }),
    })

    const tinyData = await tinyResponse.json()

    // Tiny retorna em formato específico
    const contacts = tinyData?.retorno?.contatos?.map((c: any) => ({
      id: c.contato.id,
      name: c.contato.nome,
      document: c.contato.cpf_cnpj,
      email: c.contato.email,
      phone: c.contato.fone,
      city: c.contato.cidade,
      state: c.contato.uf,
      source: 'tiny' as const,
    })) || []

    return NextResponse.json({ contacts })
  } catch (error) {
    console.error('Tiny search error:', error)
    return NextResponse.json({ contacts: [] })
  }
}
```

**IMPORTANTE**: Verifique o formato real da API do Tiny no seu projeto. O endpoint e campos podem variar dependendo da versão da API que você usa (V2 vs V3). Ajuste os campos `c.contato.nome`, `c.contato.cpf_cnpj`, etc. conforme a resposta real do Tiny.

---

## 7. CRIAR: `src/app/(public)/layout.tsx`

Layout público com branding ADDS, sem sidebar, sem auth:

```tsx
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Orçamento | ADDS Brasil',
  description: 'Solicite um orçamento de escovas personalizadas',
}

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      {/* Header com logo */}
      <header className="border-b border-border/50 bg-card/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center gap-3">
          <img
            src="/logo-adds.svg"
            alt="ADDS Brasil"
            className="h-8 w-8"
          />
          <span className="font-semibold text-lg">ADDS Brasil</span>
        </div>
      </header>

      {/* Conteúdo */}
      <main className="max-w-4xl mx-auto px-4 py-8">
        {children}
      </main>

      {/* Footer */}
      <footer className="border-t border-border/50 mt-auto">
        <div className="max-w-4xl mx-auto px-4 py-4 text-center text-sm text-muted-foreground">
          © {new Date().getFullYear()} ADDS Brasil — Escovas Personalizadas
        </div>
      </footer>
    </div>
  )
}
```

---

## 8. CRIAR: `src/app/(public)/quote/page.tsx`

```tsx
import { QuoteWizard } from './_components/quote-wizard'

export default function QuotePage() {
  return <QuoteWizard />
}
```

---

## 9. CRIAR: `src/app/(public)/quote/_components/quote-wizard.tsx`

Controlador principal do wizard — gerencia steps, dados acumulados e navegação:

```tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { createPublicQuote, uploadQuoteLogo, type CreatePublicQuoteData, type QuoteItem } from '@/services/quotes.service'
import { WizardProgress } from './wizard-progress'
import { StepWelcome } from './step-welcome'
import { StepSearch } from './step-search'
import { StepClientData } from './step-client-data'
import { StepProducts } from './step-products'
import { StepPersonalization } from './step-personalization'
import { StepReview } from './step-review'

// ============================================
// TIPOS DO WIZARD
// ============================================
export interface WizardClientData {
  client_name: string
  client_email: string
  client_phone: string
  client_whatsapp: string
  client_document: string
  client_city: string
  client_state: string
  client_zip_code: string
  client_street: string
  client_number: string
  client_complement: string
  client_neighborhood: string
  client_social_media: string
  is_existing_client: boolean
  existing_client_id: string | null
}

export interface WizardProductItem {
  product_id: string
  product_name: string
  quantity: number
  colors: string[]
  custom_color: string | null
}

export interface WizardPersonalization {
  print_color: string
  custom_color: string
  notes: string
  logo_file: File | null
}

export type WizardStep = 'welcome' | 'search' | 'client-data' | 'products' | 'personalization' | 'review'

const STEP_ORDER: WizardStep[] = ['welcome', 'search', 'client-data', 'products', 'personalization', 'review']
const STEP_LABELS: Record<WizardStep, string> = {
  'welcome': 'Início',
  'search': 'Buscar',
  'client-data': 'Seus Dados',
  'products': 'Produtos',
  'personalization': 'Personalização',
  'review': 'Revisão',
}

// ============================================
// VALORES INICIAIS
// ============================================
const INITIAL_CLIENT: WizardClientData = {
  client_name: '',
  client_email: '',
  client_phone: '',
  client_whatsapp: '',
  client_document: '',
  client_city: '',
  client_state: '',
  client_zip_code: '',
  client_street: '',
  client_number: '',
  client_complement: '',
  client_neighborhood: '',
  client_social_media: '',
  is_existing_client: false,
  existing_client_id: null,
}

const INITIAL_PERSONALIZATION: WizardPersonalization = {
  print_color: '',
  custom_color: '',
  notes: '',
  logo_file: null,
}

// ============================================
// COMPONENTE
// ============================================
export function QuoteWizard() {
  const router = useRouter()
  const [currentStep, setCurrentStep] = useState<WizardStep>('welcome')
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Dados acumulados
  const [clientData, setClientData] = useState<WizardClientData>(INITIAL_CLIENT)
  const [products, setProducts] = useState<WizardProductItem[]>([])
  const [personalization, setPersonalization] = useState<WizardPersonalization>(INITIAL_PERSONALIZATION)

  // ============================================
  // NAVEGAÇÃO
  // ============================================
  const goTo = (step: WizardStep) => {
    setCurrentStep(step)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const goNext = () => {
    const currentIndex = STEP_ORDER.indexOf(currentStep)
    if (currentIndex < STEP_ORDER.length - 1) {
      goTo(STEP_ORDER[currentIndex + 1])
    }
  }

  const goBack = () => {
    const currentIndex = STEP_ORDER.indexOf(currentStep)
    if (currentIndex > 0) {
      goTo(STEP_ORDER[currentIndex - 1])
    }
  }

  // Welcome → decide se vai para search ou client-data
  const handleWelcome = (isExistingClient: boolean) => {
    if (isExistingClient) {
      goTo('search')
    } else {
      setClientData({ ...INITIAL_CLIENT, is_existing_client: false })
      goTo('client-data')
    }
  }

  // Search → encontrou cliente, preenche e vai para products
  const handleClientFound = (data: Partial<WizardClientData>) => {
    setClientData({
      ...INITIAL_CLIENT,
      ...data,
      is_existing_client: true,
    })
    goTo('client-data') // Vai para dados do cliente para revisar/completar
  }

  // Search → não encontrou, vai para cadastro
  const handleClientNotFound = () => {
    setClientData({ ...INITIAL_CLIENT, is_existing_client: false })
    goTo('client-data')
  }

  // ============================================
  // SUBMIT FINAL
  // ============================================
  const handleSubmit = async () => {
    setIsSubmitting(true)
    try {
      // 1. Upload da logo se existir
      let logoUrl: string | undefined
      if (personalization.logo_file) {
        logoUrl = await uploadQuoteLogo(personalization.logo_file)
      }

      // 2. Montar dados para o service
      const quoteData: CreatePublicQuoteData = {
        client_name: clientData.client_name,
        client_email: clientData.client_email || undefined,
        client_phone: clientData.client_phone || undefined,
        client_whatsapp: clientData.client_whatsapp || undefined,
        client_document: clientData.client_document || undefined,
        client_city: clientData.client_city || undefined,
        client_state: clientData.client_state || undefined,
        client_zip_code: clientData.client_zip_code || undefined,
        client_street: clientData.client_street || undefined,
        client_number: clientData.client_number || undefined,
        client_complement: clientData.client_complement || undefined,
        client_neighborhood: clientData.client_neighborhood || undefined,
        client_social_media: clientData.client_social_media || undefined,
        client_logo_url: logoUrl,
        is_existing_client: clientData.is_existing_client,
        existing_client_id: clientData.existing_client_id || undefined,
        items: products.map((p) => ({
          product_id: p.product_id,
          product_name: p.product_name,
          quantity: p.quantity,
          colors: p.colors,
          custom_color: p.custom_color,
        })),
        personalization: {
          print_color: personalization.print_color || undefined,
          custom_color: personalization.custom_color || undefined,
          notes: personalization.notes || undefined,
        },
      }

      // 3. Criar no Supabase
      await createPublicQuote(quoteData)

      // 4. Redirecionar para sucesso
      router.push('/quote/success')
    } catch (error) {
      console.error('Erro ao enviar orçamento:', error)
      toast.error('Erro ao enviar orçamento', {
        description: 'Tente novamente. Se o problema persistir, entre em contato conosco.',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  // ============================================
  // STEPS VISÍVEIS NA PROGRESS BAR
  // (welcome e search não aparecem na barra, são etapas de decisão)
  // ============================================
  const progressSteps = ['client-data', 'products', 'personalization', 'review'] as WizardStep[]
  const currentProgressIndex = progressSteps.indexOf(currentStep)

  return (
    <div className="space-y-8">
      {/* Progress bar — só aparece depois do welcome/search */}
      {currentProgressIndex >= 0 && (
        <WizardProgress
          steps={progressSteps.map((s) => STEP_LABELS[s])}
          currentIndex={currentProgressIndex}
        />
      )}

      {/* Steps */}
      {currentStep === 'welcome' && (
        <StepWelcome onSelect={handleWelcome} />
      )}

      {currentStep === 'search' && (
        <StepSearch
          onClientFound={handleClientFound}
          onClientNotFound={handleClientNotFound}
          onBack={() => goTo('welcome')}
        />
      )}

      {currentStep === 'client-data' && (
        <StepClientData
          data={clientData}
          onChange={setClientData}
          onNext={() => goTo('products')}
          onBack={() => goTo(clientData.is_existing_client ? 'search' : 'welcome')}
        />
      )}

      {currentStep === 'products' && (
        <StepProducts
          selectedProducts={products}
          onChange={setProducts}
          onNext={() => goTo('personalization')}
          onBack={() => goTo('client-data')}
        />
      )}

      {currentStep === 'personalization' && (
        <StepPersonalization
          data={personalization}
          onChange={setPersonalization}
          onNext={() => goTo('review')}
          onBack={() => goTo('products')}
        />
      )}

      {currentStep === 'review' && (
        <StepReview
          clientData={clientData}
          products={products}
          personalization={personalization}
          onSubmit={handleSubmit}
          isSubmitting={isSubmitting}
          onBack={() => goTo('personalization')}
          onEditClient={() => goTo('client-data')}
          onEditProducts={() => goTo('products')}
          onEditPersonalization={() => goTo('personalization')}
        />
      )}
    </div>
  )
}
```

---

## 10. CRIAR: `src/app/(public)/quote/_components/wizard-progress.tsx`

Barra de progresso visual com steps numerados:

```tsx
'use client'

import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'

interface WizardProgressProps {
  steps: string[]
  currentIndex: number
}

export function WizardProgress({ steps, currentIndex }: WizardProgressProps) {
  return (
    <div className="flex items-center justify-center gap-0">
      {steps.map((label, index) => {
        const isCompleted = index < currentIndex
        const isCurrent = index === currentIndex
        const isLast = index === steps.length - 1

        return (
          <div key={label} className="flex items-center">
            {/* Step circle + label */}
            <div className="flex flex-col items-center gap-1.5">
              <div
                className={cn(
                  'h-9 w-9 rounded-full flex items-center justify-center text-sm font-medium transition-all',
                  isCompleted && 'bg-primary text-primary-foreground',
                  isCurrent && 'bg-primary text-primary-foreground ring-4 ring-primary/20',
                  !isCompleted && !isCurrent && 'bg-muted text-muted-foreground'
                )}
              >
                {isCompleted ? <Check className="h-4 w-4" /> : index + 1}
              </div>
              <span
                className={cn(
                  'text-xs font-medium whitespace-nowrap',
                  isCurrent ? 'text-primary' : 'text-muted-foreground'
                )}
              >
                {label}
              </span>
            </div>

            {/* Connector line */}
            {!isLast && (
              <div
                className={cn(
                  'h-0.5 w-12 sm:w-20 mx-2 mt-[-18px] transition-colors',
                  isCompleted ? 'bg-primary' : 'bg-muted'
                )}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}
```

---

## 11. CRIAR: `src/app/(public)/quote/_components/step-welcome.tsx`

Tela de boas-vindas com escolha "já é cliente ou não":

```tsx
'use client'

import { UserCheck, UserPlus } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'

interface StepWelcomeProps {
  onSelect: (isExistingClient: boolean) => void
}

export function StepWelcome({ onSelect }: StepWelcomeProps) {
  return (
    <div className="text-center space-y-8 py-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          Solicite seu Orçamento
        </h1>
        <p className="text-muted-foreground mt-2 text-lg">
          Escovas personalizadas com a sua marca
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-xl mx-auto">
        {/* Já é cliente */}
        <Card
          className="cursor-pointer hover:border-primary hover:shadow-lg transition-all group"
          onClick={() => onSelect(true)}
        >
          <CardContent className="flex flex-col items-center gap-4 p-8">
            <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
              <UserCheck className="h-8 w-8 text-primary" />
            </div>
            <div>
              <p className="font-semibold text-lg">Já sou cliente</p>
              <p className="text-sm text-muted-foreground mt-1">
                Buscar meus dados cadastrados
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Novo cliente */}
        <Card
          className="cursor-pointer hover:border-primary hover:shadow-lg transition-all group"
          onClick={() => onSelect(false)}
        >
          <CardContent className="flex flex-col items-center gap-4 p-8">
            <div className="h-16 w-16 rounded-full bg-accent/10 flex items-center justify-center group-hover:bg-accent/20 transition-colors">
              <UserPlus className="h-8 w-8 text-accent" />
            </div>
            <div>
              <p className="font-semibold text-lg">Sou novo cliente</p>
              <p className="text-sm text-muted-foreground mt-1">
                Preencher meus dados
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
```

---

## 12. CRIAR: `src/app/(public)/quote/_components/step-search.tsx`

Busca de cliente existente no Tiny + banco local:

```tsx
'use client'

import { useState } from 'react'
import { Search, ArrowLeft, Loader2, User } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { createBrowserClient } from '@/lib/supabase/client'
import type { WizardClientData } from './quote-wizard'

interface SearchResult {
  id: string
  name: string
  document: string | null
  email: string | null
  phone: string | null
  city: string | null
  state: string | null
  source: 'tiny' | 'crm'
}

interface StepSearchProps {
  onClientFound: (data: Partial<WizardClientData>) => void
  onClientNotFound: () => void
  onBack: () => void
}

export function StepSearch({ onClientFound, onClientNotFound, onBack }: StepSearchProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)

  const handleSearch = async () => {
    if (query.trim().length < 3) return

    setIsSearching(true)
    setHasSearched(true)

    try {
      const combined: SearchResult[] = []

      // 1. Buscar no banco local (clients)
      const supabase = createBrowserClient()
      const { data: localClients } = await supabase
        .from('clients')
        .select('id, name, document, email, phone, city, state')
        .or(`name.ilike.%${query}%,document.ilike.%${query}%,email.ilike.%${query}%,phone.ilike.%${query}%`)
        .limit(10)

      if (localClients) {
        combined.push(
          ...localClients.map((c) => ({
            id: c.id,
            name: c.name,
            document: c.document,
            email: c.email,
            phone: c.phone,
            city: c.city,
            state: c.state,
            source: 'crm' as const,
          }))
        )
      }

      // 2. Buscar no Tiny ERP via API route
      try {
        const tinyResponse = await fetch(`/api/tiny/search?q=${encodeURIComponent(query)}`)
        const tinyData = await tinyResponse.json()
        if (tinyData.contacts) {
          // Filtrar duplicatas (se já existe no CRM pelo document)
          const localDocs = new Set(combined.map((c) => c.document).filter(Boolean))
          const tinyUnique = tinyData.contacts.filter(
            (c: SearchResult) => !c.document || !localDocs.has(c.document)
          )
          combined.push(...tinyUnique)
        }
      } catch (e) {
        // Tiny pode falhar, não bloqueia a busca
        console.warn('Tiny search failed:', e)
      }

      setResults(combined)
    } catch (error) {
      console.error('Search error:', error)
    } finally {
      setIsSearching(false)
    }
  }

  const handleSelect = (result: SearchResult) => {
    onClientFound({
      client_name: result.name,
      client_email: result.email || '',
      client_phone: result.phone || '',
      client_document: result.document || '',
      client_city: result.city || '',
      client_state: result.state || '',
      is_existing_client: true,
      existing_client_id: result.source === 'crm' ? result.id : null,
    })
  }

  return (
    <div className="space-y-6 max-w-xl mx-auto">
      <div>
        <h2 className="text-2xl font-bold">Buscar seus dados</h2>
        <p className="text-muted-foreground mt-1">
          Informe seu e-mail, CPF/CNPJ ou telefone para buscarmos seu cadastro
        </p>
      </div>

      {/* Campo de busca */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="E-mail, CPF/CNPJ ou telefone..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            className="pl-9"
          />
        </div>
        <Button onClick={handleSearch} disabled={query.length < 3 || isSearching}>
          {isSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Buscar'}
        </Button>
      </div>

      {/* Resultados */}
      {isSearching && (
        <div className="text-center py-8 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
          Buscando...
        </div>
      )}

      {!isSearching && hasSearched && results.length === 0 && (
        <div className="text-center py-8">
          <p className="text-muted-foreground">Nenhum cadastro encontrado</p>
          <Button variant="link" className="mt-2" onClick={onClientNotFound}>
            Preencher dados manualmente →
          </Button>
        </div>
      )}

      {!isSearching && results.length > 0 && (
        <div className="space-y-2">
          {results.map((result) => (
            <Card
              key={`${result.source}-${result.id}`}
              className="cursor-pointer hover:border-primary transition-colors"
              onClick={() => handleSelect(result)}
            >
              <CardContent className="flex items-center justify-between p-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <User className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium">{result.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {[result.phone, result.document, result.city].filter(Boolean).join(' · ')}
                    </p>
                  </div>
                </div>
                <Badge
                  variant="secondary"
                  className={result.source === 'tiny' ? 'bg-purple-500/10 text-purple-500' : 'bg-primary/10 text-primary'}
                >
                  {result.source === 'tiny' ? 'Tiny' : 'CRM'}
                </Badge>
              </CardContent>
            </Card>
          ))}

          <Button variant="link" className="w-full mt-2" onClick={onClientNotFound}>
            Não encontrou? Preencher manualmente →
          </Button>
        </div>
      )}

      {/* Voltar */}
      <Button variant="ghost" onClick={onBack} className="gap-2">
        <ArrowLeft className="h-4 w-4" />
        Voltar
      </Button>
    </div>
  )
}
```

---

## 13. CRIAR: `src/app/(public)/quote/_components/step-client-data.tsx`

Formulário de dados do cliente com busca de CEP:

```tsx
'use client'

import { ArrowLeft, ArrowRight } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { CepLookup } from './cep-lookup'
import type { WizardClientData } from './quote-wizard'

interface StepClientDataProps {
  data: WizardClientData
  onChange: (data: WizardClientData) => void
  onNext: () => void
  onBack: () => void
}

export function StepClientData({ data, onChange, onNext, onBack }: StepClientDataProps) {
  const update = (field: keyof WizardClientData, value: string) => {
    onChange({ ...data, [field]: value })
  }

  const isValid = data.client_name.trim().length >= 2 && data.client_whatsapp.trim().length >= 8

  const handleCepResult = (address: {
    street: string
    neighborhood: string
    city: string
    state: string
  }) => {
    onChange({
      ...data,
      client_street: address.street,
      client_neighborhood: address.neighborhood,
      client_city: address.city,
      client_state: address.state,
    })
  }

  return (
    <div className="space-y-6 max-w-xl mx-auto">
      <div>
        <h2 className="text-2xl font-bold">Seus Dados</h2>
        <p className="text-muted-foreground mt-1">
          {data.is_existing_client
            ? 'Confirme e complete seus dados abaixo'
            : 'Preencha seus dados para o orçamento'}
        </p>
      </div>

      <div className="space-y-4">
        {/* Nome */}
        <div className="space-y-1.5">
          <Label htmlFor="name">Nome completo *</Label>
          <Input
            id="name"
            placeholder="Seu nome ou nome da empresa"
            value={data.client_name}
            onChange={(e) => update('client_name', e.target.value)}
          />
        </div>

        {/* E-mail + WhatsApp */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="email">E-mail</Label>
            <Input
              id="email"
              type="email"
              placeholder="email@exemplo.com"
              value={data.client_email}
              onChange={(e) => update('client_email', e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="whatsapp">WhatsApp *</Label>
            <Input
              id="whatsapp"
              placeholder="(00) 00000-0000"
              value={data.client_whatsapp}
              onChange={(e) => update('client_whatsapp', e.target.value)}
            />
          </div>
        </div>

        {/* Telefone + Documento */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="phone">Telefone</Label>
            <Input
              id="phone"
              placeholder="(00) 0000-0000"
              value={data.client_phone}
              onChange={(e) => update('client_phone', e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="document">CPF ou CNPJ</Label>
            <Input
              id="document"
              placeholder="000.000.000-00 ou 00.000.000/0001-00"
              value={data.client_document}
              onChange={(e) => update('client_document', e.target.value)}
            />
          </div>
        </div>

        {/* CEP com auto-preenchimento */}
        <CepLookup
          value={data.client_zip_code}
          onChange={(cep) => update('client_zip_code', cep)}
          onAddressFound={handleCepResult}
        />

        {/* Endereço (preenchido pelo CEP ou manual) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="city">Cidade</Label>
            <Input
              id="city"
              value={data.client_city}
              onChange={(e) => update('client_city', e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="state">Estado (UF)</Label>
            <Input
              id="state"
              maxLength={2}
              placeholder="SP"
              value={data.client_state}
              onChange={(e) => update('client_state', e.target.value.toUpperCase())}
            />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div className="col-span-2 space-y-1.5">
            <Label htmlFor="street">Rua</Label>
            <Input
              id="street"
              value={data.client_street}
              onChange={(e) => update('client_street', e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="number">Número</Label>
            <Input
              id="number"
              value={data.client_number}
              onChange={(e) => update('client_number', e.target.value)}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="neighborhood">Bairro</Label>
            <Input
              id="neighborhood"
              value={data.client_neighborhood}
              onChange={(e) => update('client_neighborhood', e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="complement">Complemento</Label>
            <Input
              id="complement"
              placeholder="Sala 100, Bloco B..."
              value={data.client_complement}
              onChange={(e) => update('client_complement', e.target.value)}
            />
          </div>
        </div>

        {/* Rede social */}
        <div className="space-y-1.5">
          <Label htmlFor="social_media">Instagram ou site</Label>
          <Input
            id="social_media"
            placeholder="@suaempresa ou www.site.com.br"
            value={data.client_social_media}
            onChange={(e) => update('client_social_media', e.target.value)}
          />
        </div>
      </div>

      {/* Navegação */}
      <div className="flex justify-between pt-4">
        <Button variant="ghost" onClick={onBack} className="gap-2">
          <ArrowLeft className="h-4 w-4" />
          Voltar
        </Button>
        <Button onClick={onNext} disabled={!isValid} className="gap-2">
          Próximo
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
```

---

## 14. CRIAR: `src/app/(public)/quote/_components/cep-lookup.tsx`

Input de CEP que auto-preenche via ViaCEP:

```tsx
'use client'

import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface CepLookupProps {
  value: string
  onChange: (cep: string) => void
  onAddressFound: (address: {
    street: string
    neighborhood: string
    city: string
    state: string
  }) => void
}

export function CepLookup({ value, onChange, onAddressFound }: CepLookupProps) {
  const [isLoading, setIsLoading] = useState(false)

  const handleCepChange = async (rawCep: string) => {
    // Formatar CEP: 00000-000
    const clean = rawCep.replace(/\D/g, '')
    const formatted = clean.length > 5 ? `${clean.slice(0, 5)}-${clean.slice(5, 8)}` : clean
    onChange(formatted)

    // Buscar quando tiver 8 dígitos
    if (clean.length === 8) {
      setIsLoading(true)
      try {
        const response = await fetch(`https://viacep.com.br/ws/${clean}/json/`)
        const data = await response.json()

        if (!data.erro) {
          onAddressFound({
            street: data.logradouro || '',
            neighborhood: data.bairro || '',
            city: data.localidade || '',
            state: data.uf || '',
          })
        }
      } catch (error) {
        console.warn('CEP lookup failed:', error)
      } finally {
        setIsLoading(false)
      }
    }
  }

  return (
    <div className="space-y-1.5">
      <Label htmlFor="cep">CEP</Label>
      <div className="relative">
        <Input
          id="cep"
          placeholder="00000-000"
          maxLength={9}
          value={value}
          onChange={(e) => handleCepChange(e.target.value)}
        />
        {isLoading && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
        )}
      </div>
    </div>
  )
}
```

---

## 15. CRIAR: `src/app/(public)/quote/_components/step-products.tsx`

Seleção de produtos do catálogo:

```tsx
'use client'

import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, ArrowRight, Plus, Minus, Trash2, Loader2, Package } from 'lucide-react'
import { getActiveProducts } from '@/services/quotes.service'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import type { WizardProductItem } from './quote-wizard'

interface StepProductsProps {
  selectedProducts: WizardProductItem[]
  onChange: (products: WizardProductItem[]) => void
  onNext: () => void
  onBack: () => void
}

export function StepProducts({ selectedProducts, onChange, onNext, onBack }: StepProductsProps) {
  const { data: products, isLoading } = useQuery({
    queryKey: ['public-products'],
    queryFn: getActiveProducts,
  })

  const isProductSelected = (productId: string) =>
    selectedProducts.some((p) => p.product_id === productId)

  const addProduct = (product: any) => {
    if (isProductSelected(product.id)) return
    onChange([
      ...selectedProducts,
      {
        product_id: product.id,
        product_name: product.name,
        quantity: 100,
        colors: [],
        custom_color: null,
      },
    ])
  }

  const removeProduct = (productId: string) => {
    onChange(selectedProducts.filter((p) => p.product_id !== productId))
  }

  const updateProduct = (productId: string, updates: Partial<WizardProductItem>) => {
    onChange(
      selectedProducts.map((p) =>
        p.product_id === productId ? { ...p, ...updates } : p
      )
    )
  }

  const toggleColor = (productId: string, colorKey: string) => {
    const product = selectedProducts.find((p) => p.product_id === productId)
    if (!product) return

    const colors = product.colors.includes(colorKey)
      ? product.colors.filter((c) => c !== colorKey)
      : [...product.colors, colorKey]

    updateProduct(productId, { colors })
  }

  const isValid = selectedProducts.length > 0 && selectedProducts.every((p) => p.quantity > 0)

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div>
        <h2 className="text-2xl font-bold">Produtos</h2>
        <p className="text-muted-foreground mt-1">
          Selecione os produtos e quantidades desejadas
        </p>
      </div>

      {/* Catálogo de produtos */}
      {isLoading ? (
        <div className="text-center py-8">
          <Loader2 className="h-6 w-6 animate-spin mx-auto" />
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm font-medium text-muted-foreground">
            Clique para adicionar:
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {products?.map((product: any) => {
              const selected = isProductSelected(product.id)
              return (
                <Card
                  key={product.id}
                  className={cn(
                    'cursor-pointer transition-all',
                    selected
                      ? 'border-primary bg-primary/5 ring-1 ring-primary'
                      : 'hover:border-primary/50'
                  )}
                  onClick={() => !selected && addProduct(product)}
                >
                  <CardContent className="flex flex-col items-center gap-2 p-4 text-center">
                    {product.image_url ? (
                      <img
                        src={product.image_url}
                        alt={product.name}
                        className="h-12 w-12 rounded object-contain"
                      />
                    ) : (
                      <div className="h-12 w-12 rounded bg-muted flex items-center justify-center">
                        <Package className="h-6 w-6 text-muted-foreground" />
                      </div>
                    )}
                    <p className="text-sm font-medium">{product.name}</p>
                    {selected && (
                      <Badge variant="default" className="text-xs">
                        Adicionado
                      </Badge>
                    )}
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </div>
      )}

      {/* Produtos selecionados — edição */}
      {selectedProducts.length > 0 && (
        <div className="space-y-3">
          <p className="text-sm font-medium text-muted-foreground">
            Produtos selecionados:
          </p>
          {selectedProducts.map((item) => {
            // Buscar dados do produto no catálogo para cores
            const catalogProduct = products?.find((p: any) => p.id === item.product_id)
            const availableColors = catalogProduct?.available_colors || []

            return (
              <Card key={item.product_id} className="border-primary/30">
                <CardContent className="p-4 space-y-3">
                  {/* Header do produto */}
                  <div className="flex items-center justify-between">
                    <p className="font-semibold">{item.product_name}</p>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive"
                      onClick={() => removeProduct(item.product_id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>

                  {/* Cores */}
                  {availableColors.length > 0 && (
                    <div className="space-y-1.5">
                      <p className="text-xs text-muted-foreground">Cores:</p>
                      <div className="flex flex-wrap gap-2">
                        {availableColors.map((color: any) => (
                          <button
                            key={color.key}
                            onClick={() => toggleColor(item.product_id, color.key)}
                            className={cn(
                              'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors',
                              item.colors.includes(color.key)
                                ? 'border-primary bg-primary/10 text-primary'
                                : 'border-border hover:border-primary/50'
                            )}
                          >
                            {color.hex && (
                              <span
                                className="h-3 w-3 rounded-full border border-border/50"
                                style={{ backgroundColor: color.hex }}
                              />
                            )}
                            {color.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Cor personalizada */}
                  {catalogProduct?.allows_custom_color && (
                    <div className="space-y-1.5">
                      <p className="text-xs text-muted-foreground">Cor personalizada:</p>
                      <Input
                        placeholder="Ex: Azul Tiffany, Pantone 485C..."
                        value={item.custom_color || ''}
                        onChange={(e) =>
                          updateProduct(item.product_id, {
                            custom_color: e.target.value || null,
                          })
                        }
                        className="h-8 text-sm"
                      />
                    </div>
                  )}

                  {/* Quantidade */}
                  <div className="flex items-center gap-3">
                    <p className="text-xs text-muted-foreground">Quantidade:</p>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() =>
                          updateProduct(item.product_id, {
                            quantity: Math.max(1, item.quantity - 50),
                          })
                        }
                      >
                        <Minus className="h-3 w-3" />
                      </Button>
                      <Input
                        type="number"
                        min={1}
                        value={item.quantity}
                        onChange={(e) =>
                          updateProduct(item.product_id, {
                            quantity: parseInt(e.target.value) || 1,
                          })
                        }
                        className="h-8 w-20 text-center text-sm"
                      />
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() =>
                          updateProduct(item.product_id, {
                            quantity: item.quantity + 50,
                          })
                        }
                      >
                        <Plus className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Navegação */}
      <div className="flex justify-between pt-4">
        <Button variant="ghost" onClick={onBack} className="gap-2">
          <ArrowLeft className="h-4 w-4" />
          Voltar
        </Button>
        <Button onClick={onNext} disabled={!isValid} className="gap-2">
          Próximo
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
```

---

## 16. CRIAR: `src/app/(public)/quote/_components/step-personalization.tsx`

```tsx
'use client'

import { ArrowLeft, ArrowRight, Upload, X, FileIcon, Image as ImageIcon } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import type { WizardPersonalization } from './quote-wizard'
import { useRef, useState } from 'react'

interface StepPersonalizationProps {
  data: WizardPersonalization
  onChange: (data: WizardPersonalization) => void
  onNext: () => void
  onBack: () => void
}

const ACCEPTED_TYPES = ['.jpg', '.jpeg', '.png', '.pdf', '.cdr']
const MAX_SIZE = 10 * 1024 * 1024 // 10MB

export function StepPersonalization({ data, onChange, onNext, onBack }: StepPersonalizationProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [dragOver, setDragOver] = useState(false)

  const update = (field: keyof WizardPersonalization, value: string) => {
    onChange({ ...data, [field]: value })
  }

  const handleFile = (file: File) => {
    if (file.size > MAX_SIZE) {
      alert('Arquivo muito grande. Máximo 10MB.')
      return
    }
    onChange({ ...data, logo_file: file })
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files?.[0]
    if (file) handleFile(file)
  }

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
  }

  const removeLogo = () => {
    onChange({ ...data, logo_file: null })
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const isImage = data.logo_file?.type.startsWith('image/')
  const logoPreviewUrl = data.logo_file && isImage ? URL.createObjectURL(data.logo_file) : null

  return (
    <div className="space-y-6 max-w-xl mx-auto">
      <div>
        <h2 className="text-2xl font-bold">Personalização</h2>
        <p className="text-muted-foreground mt-1">
          Detalhes de cores, arte e sua logo
        </p>
      </div>

      <div className="space-y-4">
        {/* Cor de impressão */}
        <div className="space-y-1.5">
          <Label htmlFor="print_color">Cor de impressão</Label>
          <Input
            id="print_color"
            placeholder="Ex: Branco, Prata, Dourado..."
            value={data.print_color}
            onChange={(e) => update('print_color', e.target.value)}
          />
        </div>

        {/* Cor personalizada */}
        <div className="space-y-1.5">
          <Label htmlFor="custom_color">Cor personalizada (se aplicável)</Label>
          <Input
            id="custom_color"
            placeholder="Ex: Pantone 485C, #FF0000, Azul Tiffany..."
            value={data.custom_color}
            onChange={(e) => update('custom_color', e.target.value)}
          />
        </div>

        {/* Observações */}
        <div className="space-y-1.5">
          <Label htmlFor="notes">Observações sobre a personalização</Label>
          <Textarea
            id="notes"
            placeholder="Descreva detalhes da arte, textos na embalagem, posicionamento do logo, referências visuais..."
            rows={4}
            value={data.notes}
            onChange={(e) => update('notes', e.target.value)}
          />
        </div>

        {/* Upload de logo */}
        <div className="space-y-1.5">
          <Label>Logo do cliente</Label>

          {data.logo_file ? (
            <div className="flex items-center gap-3 p-3 rounded-lg border border-border bg-muted/30">
              {logoPreviewUrl ? (
                <img src={logoPreviewUrl} alt="Preview" className="h-12 w-12 rounded object-contain" />
              ) : (
                <FileIcon className="h-12 w-12 text-muted-foreground" />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{data.logo_file.name}</p>
                <p className="text-xs text-muted-foreground">
                  {(data.logo_file.size / 1024).toFixed(0)} KB
                </p>
              </div>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={removeLogo}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <div
              className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                dragOver ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
              }`}
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
            >
              <Upload className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">
                Arraste ou clique para enviar sua logo
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                JPG, PNG, PDF ou CDR · Máximo 10MB
              </p>
            </div>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPTED_TYPES.join(',')}
            onChange={handleFileInput}
            className="hidden"
          />
        </div>
      </div>

      {/* Navegação */}
      <div className="flex justify-between pt-4">
        <Button variant="ghost" onClick={onBack} className="gap-2">
          <ArrowLeft className="h-4 w-4" />
          Voltar
        </Button>
        <Button onClick={onNext} className="gap-2">
          Próximo
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
```

---

## 17. CRIAR: `src/app/(public)/quote/_components/step-review.tsx`

```tsx
'use client'

import { ArrowLeft, Loader2, Send, Pencil, Package, User, Palette, Image as ImageIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import type { WizardClientData, WizardProductItem, WizardPersonalization } from './quote-wizard'

interface StepReviewProps {
  clientData: WizardClientData
  products: WizardProductItem[]
  personalization: WizardPersonalization
  onSubmit: () => void
  isSubmitting: boolean
  onBack: () => void
  onEditClient: () => void
  onEditProducts: () => void
  onEditPersonalization: () => void
}

export function StepReview({
  clientData,
  products,
  personalization,
  onSubmit,
  isSubmitting,
  onBack,
  onEditClient,
  onEditProducts,
  onEditPersonalization,
}: StepReviewProps) {
  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div className="text-center">
        <h2 className="text-2xl font-bold">Revisão do Orçamento</h2>
        <p className="text-muted-foreground mt-1">
          Confira todos os dados antes de enviar
        </p>
      </div>

      {/* Dados do cliente */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <User className="h-4 w-4" />
            Seus Dados
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={onEditClient} className="gap-1.5 text-xs">
            <Pencil className="h-3 w-3" /> Editar
          </Button>
        </CardHeader>
        <CardContent className="space-y-1 text-sm">
          <p className="font-medium">{clientData.client_name}</p>
          {clientData.client_whatsapp && <p className="text-muted-foreground">WhatsApp: {clientData.client_whatsapp}</p>}
          {clientData.client_phone && <p className="text-muted-foreground">Tel: {clientData.client_phone}</p>}
          {clientData.client_email && <p className="text-muted-foreground">{clientData.client_email}</p>}
          {clientData.client_document && <p className="text-muted-foreground">{clientData.client_document}</p>}
          {clientData.client_city && (
            <p className="text-muted-foreground">
              {[clientData.client_street, clientData.client_number, clientData.client_neighborhood, clientData.client_city, clientData.client_state]
                .filter(Boolean).join(', ')}
            </p>
          )}
          {clientData.client_social_media && <p className="text-muted-foreground">{clientData.client_social_media}</p>}
        </CardContent>
      </Card>

      {/* Produtos */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Package className="h-4 w-4" />
            Produtos
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={onEditProducts} className="gap-1.5 text-xs">
            <Pencil className="h-3 w-3" /> Editar
          </Button>
        </CardHeader>
        <CardContent className="space-y-2">
          {products.map((item, index) => (
            <div key={index} className="flex items-center justify-between p-2 rounded bg-muted/30">
              <div>
                <p className="text-sm font-medium">{item.product_name}</p>
                <div className="flex gap-1 mt-0.5">
                  {item.colors.map((c) => (
                    <Badge key={c} variant="secondary" className="text-xs">{c}</Badge>
                  ))}
                  {item.custom_color && (
                    <Badge variant="outline" className="text-xs">{item.custom_color}</Badge>
                  )}
                </div>
              </div>
              <Badge variant="default" className="tabular-nums">{item.quantity} un</Badge>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Personalização */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Palette className="h-4 w-4" />
            Personalização
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={onEditPersonalization} className="gap-1.5 text-xs">
            <Pencil className="h-3 w-3" /> Editar
          </Button>
        </CardHeader>
        <CardContent className="space-y-1 text-sm">
          {personalization.print_color && (
            <p><span className="text-muted-foreground">Cor de impressão:</span> {personalization.print_color}</p>
          )}
          {personalization.custom_color && (
            <p><span className="text-muted-foreground">Cor personalizada:</span> {personalization.custom_color}</p>
          )}
          {personalization.notes && (
            <p><span className="text-muted-foreground">Observações:</span> {personalization.notes}</p>
          )}
          {personalization.logo_file && (
            <div className="flex items-center gap-2 mt-2">
              <ImageIcon className="h-4 w-4 text-green-500" />
              <span className="text-green-500 text-sm">
                {personalization.logo_file.name} ({(personalization.logo_file.size / 1024).toFixed(0)} KB)
              </span>
            </div>
          )}
          {!personalization.print_color && !personalization.custom_color && !personalization.notes && !personalization.logo_file && (
            <p className="text-muted-foreground italic">Nenhuma personalização informada</p>
          )}
        </CardContent>
      </Card>

      {/* Botões */}
      <div className="flex justify-between pt-4">
        <Button variant="ghost" onClick={onBack} className="gap-2">
          <ArrowLeft className="h-4 w-4" />
          Voltar
        </Button>
        <Button
          onClick={onSubmit}
          disabled={isSubmitting}
          size="lg"
          className="gap-2 bg-green-600 hover:bg-green-700 text-white"
        >
          {isSubmitting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
          Enviar Orçamento
        </Button>
      </div>
    </div>
  )
}
```

---

## 18. CRIAR: `src/app/(public)/quote/success/page.tsx`

```tsx
import { CheckCircle2, ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import Link from 'next/link'

export default function QuoteSuccessPage() {
  return (
    <div className="text-center py-16 space-y-6 max-w-md mx-auto">
      <div className="h-20 w-20 rounded-full bg-green-500/10 flex items-center justify-center mx-auto">
        <CheckCircle2 className="h-10 w-10 text-green-500" />
      </div>

      <div>
        <h1 className="text-3xl font-bold">Orçamento Enviado!</h1>
        <p className="text-muted-foreground mt-3 text-lg">
          Recebemos sua solicitação. Nossa equipe vai analisar e entrar em contato
          pelo WhatsApp em breve.
        </p>
      </div>

      <div className="pt-4">
        <Button asChild variant="outline" className="gap-2">
          <Link href="/quote">
            <ArrowLeft className="h-4 w-4" />
            Enviar outro orçamento
          </Link>
        </Button>
      </div>
    </div>
  )
}
```

---

## 19. PRÉ-REQUISITOS / VERIFICAÇÕES

### RLS para products (leitura pública)
```sql
-- Permitir leitura pública de produtos ativos (formulário sem auth)
CREATE POLICY "products_public_read" ON products FOR SELECT
  USING (is_active = true);
```

### Storage bucket (upload de logo sem auth)
Verificar no Supabase Dashboard → Storage que:
1. Bucket `adds-crm` existe
2. Pasta `logos/quotes/` permite upload público, OU
3. Configurar uma policy de storage para upload anônimo:
```sql
-- Storage policy para upload anônimo na pasta logos/quotes/
CREATE POLICY "public_logo_upload" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'adds-crm' AND (storage.foldername(name))[1] = 'logos');
```

### Verificar columns available_colors nos products
Se a migration `00003_product_colors.sql` do ORDER_FORM_ARCHITECTURE ainda não foi aplicada:
```sql
ALTER TABLE products ADD COLUMN IF NOT EXISTS available_colors JSONB DEFAULT '[]'::jsonb;
ALTER TABLE products ADD COLUMN IF NOT EXISTS allows_custom_color BOOLEAN DEFAULT true;

-- Atualizar produtos existentes com cores padrão
UPDATE products SET available_colors = '[
  {"key": "branco", "label": "Branco", "hex": "#FFFFFF"},
  {"key": "preto", "label": "Preto", "hex": "#000000"}
]'::jsonb
WHERE available_colors = '[]'::jsonb;
```

### TanStack QueryClientProvider
Verificar que o `QueryClientProvider` do TanStack Query está no layout público também.
Se o provider só está no `(dashboard)/layout.tsx`, mover para o `src/app/layout.tsx` raiz,
ou adicionar um provider no `(public)/layout.tsx`.

---

## 20. ORDEM DE IMPLEMENTAÇÃO NO CURSOR

1. **SQL** — Rodar as queries de RLS e storage (seção 19)
2. **quotes.service.ts** — Adicionar `createPublicQuote()`, `getActiveProducts()`, `uploadQuoteLogo()` (seção 5)
3. **API route** — `src/app/api/tiny/search/route.ts` (seção 6)
4. **Layout público** — `src/app/(public)/layout.tsx` (seção 7)
5. **Componentes do wizard** na ordem:
   - `wizard-progress.tsx`
   - `cep-lookup.tsx`
   - `step-welcome.tsx`
   - `step-search.tsx`
   - `step-client-data.tsx`
   - `step-products.tsx`
   - `step-personalization.tsx`
   - `step-review.tsx`
6. **Controlador** — `quote-wizard.tsx` (seção 9)
7. **Páginas** — `quote/page.tsx` + `quote/success/page.tsx`
8. **Testar** — acessar `/quote` e percorrer todo o fluxo
