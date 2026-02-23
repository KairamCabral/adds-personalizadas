# ADDS CRM — Sistema de Personalização ao Vivo ("Faça Você Mesmo")

## OBJETIVO

Criar uma experiência de personalização ao vivo dentro da etapa 3 do wizard público (`/quote`),
onde o cliente monta visualmente sua escova personalizada e vê o resultado em tempo real.
O sistema deve ser extremamente intuitivo — o cliente vê a escova se atualizando conforme edita.

---

## CONCEITO DE UX

### Layout da tela (split view)

```
┌──────────────────────────────────────────────────────────────────────┐
│  ADDS Brasil                                                         │
│  ── ✓ ── ✓ ── ● ── ○                                               │
│  Dados  Prod  Person  Revisão                                        │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌─────────────────────────────┐  ┌──────────────────────────────┐  │
│  │                             │  │                              │  │
│  │     PREVIEW AO VIVO        │  │   PAINEL DE EDIÇÃO           │  │
│  │                             │  │                              │  │
│  │  ┌───────────────────────┐  │  │  ── Texto ──────────────── │  │
│  │  │                       │  │  │  Linha 1: [Dr. João Silva] │  │
│  │  │   ┌───────────────┐   │  │  │  Linha 2: [(11) 99999...]  │  │
│  │  │   │  LOGO         │   │  │  │                              │  │
│  │  │   │  cliente      │   │  │  │  ── Atalhos ─────────────── │  │
│  │  │   └───────────────┘   │  │  │  [👤 Nome] [📱 WhatsApp]   │  │
│  │  │                       │  │  │  [📞 Telefone] [✉ Email]    │  │
│  │  │   Dr. João Silva      │  │  │                              │  │
│  │  │   📱 (11) 99999-8888  │  │  │  ── Logo ──────────────── │  │
│  │  │                       │  │  │  [📎 Enviar logo]           │  │
│  │  │        ADDS           │  │  │  ou arraste aqui            │  │
│  │  └───────────────────────┘  │  │                              │  │
│  │                             │  │  ── Cor de Impressão ────── │  │
│  │  Escova: ADDS Implant      │  │  ○ Branca  ● Colorida       │  │
│  │  Cor: Branco                │  │  ○ Preta                     │  │
│  │                             │  │                              │  │
│  │  [← prev]  1/2  [next →]   │  │                              │  │
│  │                             │  │                              │  │
│  └─────────────────────────────┘  └──────────────────────────────┘  │
│                                                                      │
│                                           [← Voltar]  [Próximo →]   │
└──────────────────────────────────────────────────────────────────────┘
```

### No mobile: stacked (preview em cima, painel embaixo com scroll)

### Princípios de UX
1. **Feedback instantâneo** — cada tecla digitada atualiza o preview
2. **Atalhos inteligentes** — 1 clique preenche "Nome completo", "WhatsApp + telefone" etc.
3. **Zero fricção** — sem popups, sem confirmações desnecessárias
4. **Navegação entre produtos** — se tem 2 produtos, navega com setas
5. **Proteção de download** — overlay invisível, right-click bloqueado, sem canvas exportável

---

## CONTEXTO TÉCNICO

- **Stack**: Next.js 15 + TypeScript + Tailwind CSS 4 + shadcn/ui
- **Onde vive**: dentro do wizard em `src/app/(public)/quote/_components/`
- **Dados recebidos**: produtos selecionados (step anterior), dados do cliente (step anterior)
- **Dados que produz**: personalização por produto (texto, logo, cor) → salvo no wizard state

---

## ESTRUTURA DE ARQUIVOS A CRIAR

```
src/app/(public)/quote/_components/
├── step-personalization.tsx              ← REESCREVER — agora tem 3 opções
├── personalization-diy/
│   ├── diy-editor.tsx                    ← CRIAR — Componente principal (split view)
│   ├── diy-preview.tsx                   ← CRIAR — Preview visual da escova
│   ├── diy-panel.tsx                     ← CRIAR — Painel de edição (texto, logo, cor)
│   ├── diy-shortcuts.tsx                 ← CRIAR — Botões de atalho
│   ├── diy-logo-upload.tsx               ← CRIAR — Upload de logo inline
│   ├── diy-color-selector.tsx            ← CRIAR — Seletor de cor de impressão
│   └── diy-product-navigator.tsx         ← CRIAR — Navegação entre produtos
```

---

## 1. REESCREVER: `step-personalization.tsx`

A etapa de personalização agora mostra 3 cards de escolha. Ao clicar em "Faça você mesmo",
abre o editor DIY. As outras opções (Usar última arte / Solicitar criação) seguem o fluxo
existente.

```tsx
'use client'

import { useState } from 'react'
import { ArrowLeft, ArrowRight, Copy, MessageCircleMore, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { DiyEditor } from './personalization-diy/diy-editor'
import type { WizardPersonalization, WizardProductItem, WizardClientData } from './quote-wizard'

type PersonalizationMode = 'reuse' | 'request' | 'diy' | null

interface StepPersonalizationProps {
  data: WizardPersonalization
  onChange: (data: WizardPersonalization) => void
  products: WizardProductItem[]
  clientData: WizardClientData
  onNext: () => void
  onBack: () => void
}

const MODE_OPTIONS = [
  {
    id: 'reuse' as const,
    icon: Copy,
    title: 'Usar última arte',
    description: 'Reutilizar arte de um pedido anterior',
    badge: null,
    disabled: false,
  },
  {
    id: 'request' as const,
    icon: MessageCircleMore,
    title: 'Solicitar criação da arte',
    description: 'Nossa equipe cria a arte para você',
    badge: 'Mais usado',
    disabled: false,
  },
  {
    id: 'diy' as const,
    icon: Sparkles,
    title: 'Faça você mesmo',
    description: 'Personalize agora e veja o resultado',
    badge: 'Novo',
    disabled: false,
  },
]

export function StepPersonalization({
  data,
  onChange,
  products,
  clientData,
  onNext,
  onBack,
}: StepPersonalizationProps) {
  const [mode, setMode] = useState<PersonalizationMode>(data.mode || null)

  const handleModeSelect = (selectedMode: PersonalizationMode) => {
    setMode(selectedMode)
    onChange({ ...data, mode: selectedMode })
  }

  // Se modo DIY está ativo, mostra o editor em tela cheia
  if (mode === 'diy') {
    return (
      <DiyEditor
        products={products}
        clientData={clientData}
        data={data}
        onChange={onChange}
        onNext={onNext}
        onBack={() => setMode(null)}
      />
    )
  }

  // Se modo "reuse" ou "request", mostrar campo simples de observações
  if (mode === 'reuse' || mode === 'request') {
    return (
      <div className="space-y-6 max-w-xl mx-auto">
        <div className="text-center">
          <h2 className="text-2xl font-bold">
            {mode === 'reuse' ? 'Reutilizar Arte Anterior' : 'Solicitar Criação'}
          </h2>
          <p className="text-muted-foreground mt-1">
            {mode === 'reuse'
              ? 'Descreva qual arte deseja reutilizar e quais ajustes, se houver'
              : 'Descreva o que deseja na personalização e nossa equipe vai criar'}
          </p>
        </div>

        <div className="space-y-4">
          <textarea
            className="w-full min-h-[120px] rounded-lg border border-border bg-background p-4 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary resize-none"
            placeholder={
              mode === 'reuse'
                ? 'Ex: Mesma arte do último pedido, mas trocar o telefone para (11) 99999-0000...'
                : 'Ex: Logo centralizada, nome "Dr. João Silva" embaixo, telefone com ícone do WhatsApp...'
            }
            value={data.notes}
            onChange={(e) => onChange({ ...data, notes: e.target.value })}
          />

          {/* Upload de logo (para ambos os modos) */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Logo (opcional)</label>
            <input
              type="file"
              accept=".jpg,.jpeg,.png,.pdf,.cdr"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) onChange({ ...data, logo_file: file })
              }}
              className="w-full text-sm file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-primary/10 file:text-primary file:font-medium file:cursor-pointer"
            />
          </div>
        </div>

        <div className="flex justify-between pt-4">
          <Button variant="ghost" onClick={() => setMode(null)} className="gap-2">
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

  // Seleção de modo (tela inicial)
  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div className="text-center">
        <h2 className="text-2xl font-bold">Como deseja personalizar?</h2>
        <p className="text-muted-foreground mt-1">
          Escolha a opção que melhor se encaixa no seu pedido
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {MODE_OPTIONS.map((option) => {
          const Icon = option.icon
          return (
            <Card
              key={option.id}
              className={cn(
                'cursor-pointer transition-all relative group',
                option.disabled
                  ? 'opacity-50 cursor-not-allowed'
                  : 'hover:border-primary hover:shadow-lg'
              )}
              onClick={() => !option.disabled && handleModeSelect(option.id)}
            >
              <CardContent className="flex flex-col gap-4 p-6">
                {option.badge && (
                  <Badge
                    variant="secondary"
                    className={cn(
                      'absolute top-3 right-3 text-xs',
                      option.badge === 'Novo' && 'bg-green-500/10 text-green-500 border-green-500/30',
                      option.badge === 'Mais usado' && 'bg-primary/10 text-primary border-primary/30'
                    )}
                  >
                    {option.badge}
                  </Badge>
                )}
                <div className="h-12 w-12 rounded-xl bg-muted flex items-center justify-center group-hover:bg-primary/10 transition-colors">
                  <Icon className="h-6 w-6 text-muted-foreground group-hover:text-primary transition-colors" />
                </div>
                <div>
                  <p className="font-semibold">{option.title}</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    {option.description}
                  </p>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <Button variant="ghost" onClick={onBack} className="gap-2">
        <ArrowLeft className="h-4 w-4" />
        Voltar
      </Button>
    </div>
  )
}
```

**NOTA**: O tipo `WizardPersonalization` no `quote-wizard.tsx` precisa ser atualizado para incluir:
```typescript
export interface WizardPersonalization {
  mode: 'reuse' | 'request' | 'diy' | null
  notes: string
  logo_file: File | null
  // Dados DIY (por produto)
  diy_customizations: DiyCustomization[]
}

export interface DiyCustomization {
  product_id: string
  product_name: string
  line1: string
  line2: string
  logo_file: File | null
  logo_preview_url: string | null
  print_color: 'colorida' | 'branca' | 'preta'
}
```

---

## 2. CRIAR: `personalization-diy/diy-editor.tsx`

Componente principal com layout split (preview + painel):

```tsx
'use client'

import { useState, useEffect } from 'react'
import { ArrowLeft, ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DiyPreview } from './diy-preview'
import { DiyPanel } from './diy-panel'
import { DiyProductNavigator } from './diy-product-navigator'
import type {
  WizardPersonalization,
  WizardProductItem,
  WizardClientData,
  DiyCustomization,
} from '../quote-wizard'

interface DiyEditorProps {
  products: WizardProductItem[]
  clientData: WizardClientData
  data: WizardPersonalization
  onChange: (data: WizardPersonalization) => void
  onNext: () => void
  onBack: () => void
}

export function DiyEditor({
  products,
  clientData,
  data,
  onChange,
  onNext,
  onBack,
}: DiyEditorProps) {
  const [activeProductIndex, setActiveProductIndex] = useState(0)

  // Inicializar customizações se ainda não existem
  useEffect(() => {
    if (!data.diy_customizations || data.diy_customizations.length === 0) {
      const initial: DiyCustomization[] = products.map((p) => ({
        product_id: p.product_id,
        product_name: p.product_name,
        line1: '',
        line2: '',
        logo_file: null,
        logo_preview_url: null,
        print_color: 'colorida',
      }))
      onChange({ ...data, diy_customizations: initial })
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const customizations = data.diy_customizations || []
  const currentCustomization = customizations[activeProductIndex]
  const currentProduct = products[activeProductIndex]

  if (!currentCustomization || !currentProduct) return null

  // Atualizar customização do produto ativo
  const updateCurrentCustomization = (updates: Partial<DiyCustomization>) => {
    const updated = customizations.map((c, i) =>
      i === activeProductIndex ? { ...c, ...updates } : c
    )
    onChange({ ...data, diy_customizations: updated })
  }

  // Verificar se tem pelo menos 1 produto com algum conteúdo
  const hasContent = customizations.some(
    (c) => c.line1.trim() || c.line2.trim() || c.logo_file
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <h2 className="text-2xl font-bold">Personalize sua escova</h2>
        <p className="text-muted-foreground mt-1">
          Edite e veja o resultado em tempo real
        </p>
      </div>

      {/* Navegação entre produtos (se mais de 1) */}
      {products.length > 1 && (
        <DiyProductNavigator
          products={products}
          activeIndex={activeProductIndex}
          onNavigate={setActiveProductIndex}
          customizations={customizations}
        />
      )}

      {/* Split view: Preview + Painel */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Preview ao vivo */}
        <div className="order-1">
          <DiyPreview
            customization={currentCustomization}
            product={currentProduct}
          />
        </div>

        {/* Painel de edição */}
        <div className="order-2">
          <DiyPanel
            customization={currentCustomization}
            clientData={clientData}
            onChange={updateCurrentCustomization}
          />
        </div>
      </div>

      {/* Copiar personalização para outros produtos */}
      {products.length > 1 && (
        <div className="flex justify-center">
          <Button
            variant="outline"
            size="sm"
            className="text-xs"
            onClick={() => {
              const current = customizations[activeProductIndex]
              const updated = customizations.map((c) => ({
                ...c,
                line1: current.line1,
                line2: current.line2,
                logo_file: current.logo_file,
                logo_preview_url: current.logo_preview_url,
                print_color: current.print_color,
              }))
              onChange({ ...data, diy_customizations: updated })
            }}
          >
            Aplicar mesma personalização em todos os produtos
          </Button>
        </div>
      )}

      {/* Navegação */}
      <div className="flex justify-between pt-4">
        <Button variant="ghost" onClick={onBack} className="gap-2">
          <ArrowLeft className="h-4 w-4" />
          Voltar
        </Button>
        <Button onClick={onNext} disabled={!hasContent} className="gap-2">
          Próximo
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
```

---

## 3. CRIAR: `personalization-diy/diy-preview.tsx`

O coração visual — preview da escova com personalização em tempo real.
Usa CSS puro (não canvas) para facilitar manutenção, com camada de proteção contra download.

```tsx
'use client'

import { useRef } from 'react'
import { Shield } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { DiyCustomization, WizardProductItem } from '../quote-wizard'

interface DiyPreviewProps {
  customization: DiyCustomization
  product: WizardProductItem
}

// Cores da impressão no preview
const PRINT_COLORS = {
  colorida: {
    textColor: '#21add6',    // azul ADDS
    bgGradient: 'from-white to-gray-50',
    label: 'Impressão Colorida',
  },
  branca: {
    textColor: '#FFFFFF',
    bgGradient: 'from-gray-800 to-gray-900',
    label: 'Impressão Branca',
  },
  preta: {
    textColor: '#1a1a1a',
    bgGradient: 'from-white to-gray-50',
    label: 'Impressão Preta',
  },
}

export function DiyPreview({ customization, product }: DiyPreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const colorConfig = PRINT_COLORS[customization.print_color]

  const hasLine1 = customization.line1.trim().length > 0
  const hasLine2 = customization.line2.trim().length > 0
  const hasLogo = !!customization.logo_preview_url
  const hasAnyContent = hasLine1 || hasLine2 || hasLogo

  return (
    <div className="space-y-3">
      {/* Label do produto */}
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-muted-foreground">
          Preview: <span className="text-foreground">{product.product_name}</span>
        </p>
        <span
          className="text-xs px-2 py-0.5 rounded-full border"
          style={{ color: colorConfig.textColor === '#FFFFFF' ? '#999' : colorConfig.textColor }}
        >
          {colorConfig.label}
        </span>
      </div>

      {/* Container do preview com proteção */}
      <div
        ref={containerRef}
        className="relative select-none"
        onContextMenu={(e) => e.preventDefault()}
        onDragStart={(e) => e.preventDefault()}
      >
        {/* Mockup da escova */}
        <div
          className={cn(
            'relative rounded-2xl overflow-hidden shadow-xl border border-border',
            'aspect-[3/4] max-h-[480px]',
            'bg-gradient-to-b',
            colorConfig.bgGradient
          )}
        >
          {/* Corpo da escova — área de personalização */}
          <div className="absolute inset-0 flex flex-col items-center justify-center p-8">
            {/* Área imprimível */}
            <div
              className={cn(
                'w-full max-w-[220px] flex flex-col items-center gap-4 transition-all duration-200',
                !hasAnyContent && 'opacity-30'
              )}
            >
              {/* Logo do cliente */}
              {hasLogo ? (
                <div className="w-24 h-24 flex items-center justify-center">
                  <img
                    src={customization.logo_preview_url!}
                    alt="Logo"
                    className="max-w-full max-h-full object-contain pointer-events-none"
                    draggable={false}
                  />
                </div>
              ) : (
                <div className="w-24 h-24 rounded-lg border-2 border-dashed border-muted-foreground/20 flex items-center justify-center">
                  <span className="text-xs text-muted-foreground/40">Logo</span>
                </div>
              )}

              {/* Textos */}
              <div className="text-center space-y-1 w-full">
                {/* Linha 1 */}
                <p
                  className={cn(
                    'font-bold text-base leading-tight tracking-wide transition-all duration-150 break-words',
                    !hasLine1 && 'text-muted-foreground/20'
                  )}
                  style={{
                    color: hasLine1 ? colorConfig.textColor : undefined,
                    textShadow:
                      customization.print_color === 'branca'
                        ? '0 1px 3px rgba(0,0,0,0.3)'
                        : 'none',
                  }}
                >
                  {customization.line1 || 'Linha 1'}
                </p>

                {/* Linha 2 */}
                <p
                  className={cn(
                    'text-sm leading-tight tracking-wide transition-all duration-150 break-words',
                    !hasLine2 && 'text-muted-foreground/20'
                  )}
                  style={{
                    color: hasLine2 ? colorConfig.textColor : undefined,
                    textShadow:
                      customization.print_color === 'branca'
                        ? '0 1px 3px rgba(0,0,0,0.3)'
                        : 'none',
                  }}
                >
                  {customization.line2 || 'Linha 2'}
                </p>
              </div>
            </div>

            {/* Logo ADDS (sempre presente no fundo) */}
            <div className="absolute bottom-6 opacity-20">
              <img
                src="/logo-adds.svg"
                alt=""
                className="h-6 pointer-events-none"
                draggable={false}
              />
            </div>
          </div>

          {/* Overlay de proteção (transparente, bloqueia interação direta com a imagem) */}
          <div
            className="absolute inset-0 z-10"
            style={{ WebkitUserSelect: 'none', userSelect: 'none' }}
          />

          {/* Watermark sutil (proteção extra) */}
          <div className="absolute inset-0 z-20 pointer-events-none overflow-hidden opacity-[0.03]">
            <div className="absolute inset-0 flex flex-wrap gap-8 rotate-[-30deg] scale-150 translate-x-[-20%] translate-y-[-20%]">
              {Array.from({ length: 20 }).map((_, i) => (
                <span key={i} className="text-xs font-bold whitespace-nowrap text-foreground">
                  ADDS BRASIL · PREVIEW
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Badge de proteção */}
        <div className="absolute bottom-2 right-2 z-30 flex items-center gap-1 bg-background/80 backdrop-blur-sm rounded-full px-2 py-1 text-[10px] text-muted-foreground">
          <Shield className="h-3 w-3" />
          Preview protegido
        </div>
      </div>

      {/* Indicador de cor da escova selecionada */}
      {product.colors.length > 0 && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>Cor da escova:</span>
          <div className="flex gap-1">
            {product.colors.map((color) => (
              <span
                key={color}
                className="px-2 py-0.5 rounded-full bg-muted text-xs capitalize"
              >
                {color}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
```

---

## 4. CRIAR: `personalization-diy/diy-panel.tsx`

Painel lateral de edição com todos os controles:

```tsx
'use client'

import { DiyShortcuts } from './diy-shortcuts'
import { DiyLogoUpload } from './diy-logo-upload'
import { DiyColorSelector } from './diy-color-selector'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import type { DiyCustomization, WizardClientData } from '../quote-wizard'

interface DiyPanelProps {
  customization: DiyCustomization
  clientData: WizardClientData
  onChange: (updates: Partial<DiyCustomization>) => void
}

const MAX_LINE_LENGTH = 50

export function DiyPanel({ customization, clientData, onChange }: DiyPanelProps) {
  return (
    <div className="space-y-5 rounded-xl border border-border bg-card p-5">
      {/* ════════════════════════════════════ */}
      {/* SEÇÃO: Texto */}
      {/* ════════════════════════════════════ */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-semibold">Texto da Personalização</Label>
          <span className="text-[10px] text-muted-foreground">
            Máx. {MAX_LINE_LENGTH} caracteres por linha
          </span>
        </div>

        {/* Linha 1 */}
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <label className="text-xs text-muted-foreground">Linha 1</label>
            <span
              className={`text-[10px] tabular-nums ${
                customization.line1.length > MAX_LINE_LENGTH
                  ? 'text-destructive font-medium'
                  : 'text-muted-foreground'
              }`}
            >
              {customization.line1.length}/{MAX_LINE_LENGTH}
            </span>
          </div>
          <Input
            placeholder="Ex: Dr. João Silva"
            value={customization.line1}
            onChange={(e) => {
              if (e.target.value.length <= MAX_LINE_LENGTH) {
                onChange({ line1: e.target.value })
              }
            }}
            className="font-medium"
          />
        </div>

        {/* Linha 2 */}
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <label className="text-xs text-muted-foreground">Linha 2</label>
            <span
              className={`text-[10px] tabular-nums ${
                customization.line2.length > MAX_LINE_LENGTH
                  ? 'text-destructive font-medium'
                  : 'text-muted-foreground'
              }`}
            >
              {customization.line2.length}/{MAX_LINE_LENGTH}
            </span>
          </div>
          <Input
            placeholder="Ex: (11) 99999-8888"
            value={customization.line2}
            onChange={(e) => {
              if (e.target.value.length <= MAX_LINE_LENGTH) {
                onChange({ line2: e.target.value })
              }
            }}
          />
        </div>
      </div>

      <Separator />

      {/* ════════════════════════════════════ */}
      {/* SEÇÃO: Atalhos rápidos */}
      {/* ════════════════════════════════════ */}
      <DiyShortcuts
        clientData={clientData}
        onApply={(line1, line2) => {
          onChange({
            line1: line1.substring(0, MAX_LINE_LENGTH),
            line2: line2.substring(0, MAX_LINE_LENGTH),
          })
        }}
      />

      <Separator />

      {/* ════════════════════════════════════ */}
      {/* SEÇÃO: Logo */}
      {/* ════════════════════════════════════ */}
      <DiyLogoUpload
        logoFile={customization.logo_file}
        logoPreviewUrl={customization.logo_preview_url}
        onChange={(file, previewUrl) =>
          onChange({ logo_file: file, logo_preview_url: previewUrl })
        }
      />

      <Separator />

      {/* ════════════════════════════════════ */}
      {/* SEÇÃO: Cor de impressão */}
      {/* ════════════════════════════════════ */}
      <DiyColorSelector
        value={customization.print_color}
        onChange={(color) => onChange({ print_color: color })}
      />
    </div>
  )
}
```

---

## 5. CRIAR: `personalization-diy/diy-shortcuts.tsx`

Botões de atalho que preenchem as linhas com 1 clique:

```tsx
'use client'

import { User, Phone, MessageCircle, Mail, Stethoscope } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import type { WizardClientData } from '../quote-wizard'

interface DiyShortcutsProps {
  clientData: WizardClientData
  onApply: (line1: string, line2: string) => void
}

export function DiyShortcuts({ clientData, onApply }: DiyShortcutsProps) {
  // Formatar telefone limpo para display
  const formatPhone = (phone: string) => {
    const clean = phone.replace(/\D/g, '')
    if (clean.length === 11) {
      return `(${clean.slice(0, 2)}) ${clean.slice(2, 7)}-${clean.slice(7)}`
    }
    if (clean.length === 10) {
      return `(${clean.slice(0, 2)}) ${clean.slice(2, 6)}-${clean.slice(6)}`
    }
    return phone
  }

  const phone = clientData.client_phone || clientData.client_whatsapp || ''
  const whatsapp = clientData.client_whatsapp || clientData.client_phone || ''
  const formattedPhone = formatPhone(phone)
  const formattedWhatsapp = formatPhone(whatsapp)

  const shortcuts = [
    {
      icon: User,
      label: 'Nome completo',
      action: () => onApply(clientData.client_name, ''),
      disabled: !clientData.client_name,
    },
    {
      icon: MessageCircle,
      // Ícone WhatsApp + telefone
      label: '📱 WhatsApp',
      action: () => onApply(clientData.client_name, `📱 ${formattedWhatsapp}`),
      disabled: !whatsapp,
    },
    {
      icon: Phone,
      // Ícone telefone + telefone
      label: '📞 Telefone',
      action: () => onApply(clientData.client_name, `📞 ${formattedPhone}`),
      disabled: !phone,
    },
    {
      icon: Mail,
      label: '✉ E-mail',
      action: () => onApply(clientData.client_name, clientData.client_email || ''),
      disabled: !clientData.client_email,
    },
    {
      icon: Stethoscope,
      // Para dentistas: nome + CRO (se tiver)
      label: 'Profissional',
      action: () => onApply(clientData.client_name, `${clientData.client_city || ''} ${clientData.client_state || ''}`),
      disabled: !clientData.client_name,
    },
  ]

  return (
    <div className="space-y-2.5">
      <Label className="text-sm font-semibold">Atalhos Rápidos</Label>
      <p className="text-xs text-muted-foreground">
        Clique para preencher automaticamente com seus dados
      </p>

      <div className="flex flex-wrap gap-2">
        {shortcuts.map((shortcut) => (
          <Button
            key={shortcut.label}
            variant="outline"
            size="sm"
            className="text-xs h-8 gap-1.5 hover:bg-primary/10 hover:border-primary/50 hover:text-primary transition-colors"
            onClick={shortcut.action}
            disabled={shortcut.disabled}
          >
            {shortcut.label}
          </Button>
        ))}
      </div>
    </div>
  )
}
```

---

## 6. CRIAR: `personalization-diy/diy-logo-upload.tsx`

Upload inline de logo com preview:

```tsx
'use client'

import { useRef, useState } from 'react'
import { Upload, X, Image as ImageIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'

interface DiyLogoUploadProps {
  logoFile: File | null
  logoPreviewUrl: string | null
  onChange: (file: File | null, previewUrl: string | null) => void
}

const MAX_SIZE = 10 * 1024 * 1024 // 10MB
const ACCEPTED = '.jpg,.jpeg,.png,.svg,.pdf,.cdr'

export function DiyLogoUpload({ logoFile, logoPreviewUrl, onChange }: DiyLogoUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [dragOver, setDragOver] = useState(false)

  const handleFile = (file: File) => {
    if (file.size > MAX_SIZE) {
      alert('Arquivo muito grande. Máximo 10MB.')
      return
    }

    // Gerar preview se for imagem
    const isImage = file.type.startsWith('image/')
    if (isImage) {
      const url = URL.createObjectURL(file)
      onChange(file, url)
    } else {
      onChange(file, null)
    }
  }

  const removeLogo = () => {
    if (logoPreviewUrl) URL.revokeObjectURL(logoPreviewUrl)
    onChange(null, null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  return (
    <div className="space-y-2.5">
      <Label className="text-sm font-semibold">Logo</Label>

      {logoFile ? (
        <div className="flex items-center gap-3 p-3 rounded-lg border border-border bg-muted/30">
          {logoPreviewUrl ? (
            <img
              src={logoPreviewUrl}
              alt="Logo"
              className="h-12 w-12 rounded object-contain bg-white p-1"
            />
          ) : (
            <div className="h-12 w-12 rounded bg-muted flex items-center justify-center">
              <ImageIcon className="h-5 w-5 text-muted-foreground" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{logoFile.name}</p>
            <p className="text-xs text-muted-foreground">
              {(logoFile.size / 1024).toFixed(0)} KB
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0 text-destructive hover:text-destructive"
            onClick={removeLogo}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      ) : (
        <div
          className={`border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors ${
            dragOver ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
          }`}
          onClick={() => fileInputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault()
            setDragOver(false)
            const file = e.dataTransfer.files?.[0]
            if (file) handleFile(file)
          }}
        >
          <Upload className="h-5 w-5 text-muted-foreground mx-auto mb-1" />
          <p className="text-xs text-muted-foreground">
            Arraste ou clique · JPG, PNG, SVG · Máx 10MB
          </p>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPTED}
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) handleFile(file)
        }}
        className="hidden"
      />
    </div>
  )
}
```

---

## 7. CRIAR: `personalization-diy/diy-color-selector.tsx`

Seletor de cor de impressão com visual radio cards:

```tsx
'use client'

import { cn } from '@/lib/utils'
import { Label } from '@/components/ui/label'

type PrintColor = 'colorida' | 'branca' | 'preta'

interface DiyColorSelectorProps {
  value: PrintColor
  onChange: (color: PrintColor) => void
}

const COLOR_OPTIONS: { id: PrintColor; label: string; preview: string; desc: string }[] = [
  {
    id: 'colorida',
    label: 'Colorida',
    preview: 'bg-gradient-to-br from-[#21add6] to-[#f07d00]',
    desc: 'Impressão em cores (logo colorido)',
  },
  {
    id: 'branca',
    label: 'Branca',
    preview: 'bg-white border border-gray-200',
    desc: 'Impressão branca sobre escova escura',
  },
  {
    id: 'preta',
    label: 'Preta',
    preview: 'bg-gray-900',
    desc: 'Impressão preta sobre escova clara',
  },
]

export function DiyColorSelector({ value, onChange }: DiyColorSelectorProps) {
  return (
    <div className="space-y-2.5">
      <Label className="text-sm font-semibold">Cor da Impressão</Label>

      <div className="grid grid-cols-3 gap-2">
        {COLOR_OPTIONS.map((option) => (
          <button
            key={option.id}
            onClick={() => onChange(option.id)}
            className={cn(
              'flex flex-col items-center gap-2 p-3 rounded-lg border-2 transition-all text-center',
              value === option.id
                ? 'border-primary bg-primary/5 ring-1 ring-primary/30'
                : 'border-border hover:border-primary/40'
            )}
          >
            {/* Preview da cor */}
            <div className={cn('h-8 w-8 rounded-full', option.preview)} />
            <div>
              <p className="text-xs font-medium">{option.label}</p>
            </div>
          </button>
        ))}
      </div>

      <p className="text-[10px] text-muted-foreground">
        {COLOR_OPTIONS.find((o) => o.id === value)?.desc}
      </p>
    </div>
  )
}
```

---

## 8. CRIAR: `personalization-diy/diy-product-navigator.tsx`

Navegação entre produtos quando tem mais de 1:

```tsx
'use client'

import { ChevronLeft, ChevronRight, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { WizardProductItem, DiyCustomization } from '../quote-wizard'

interface DiyProductNavigatorProps {
  products: WizardProductItem[]
  activeIndex: number
  onNavigate: (index: number) => void
  customizations: DiyCustomization[]
}

export function DiyProductNavigator({
  products,
  activeIndex,
  onNavigate,
  customizations,
}: DiyProductNavigatorProps) {
  const isCustomized = (index: number) => {
    const c = customizations[index]
    return c && (c.line1.trim() || c.line2.trim() || c.logo_file)
  }

  return (
    <div className="flex items-center justify-center gap-2">
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8"
        onClick={() => onNavigate(Math.max(0, activeIndex - 1))}
        disabled={activeIndex === 0}
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>

      <div className="flex items-center gap-1.5">
        {products.map((product, index) => (
          <button
            key={product.product_id}
            onClick={() => onNavigate(index)}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all',
              index === activeIndex
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
            )}
          >
            {isCustomized(index) && (
              <Check className="h-3 w-3" />
            )}
            {product.product_name}
          </button>
        ))}
      </div>

      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8"
        onClick={() => onNavigate(Math.min(products.length - 1, activeIndex + 1))}
        disabled={activeIndex === products.length - 1}
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  )
}
```

---

## 9. PROTEÇÃO CONTRA DOWNLOAD

A proteção é aplicada em múltiplas camadas no `diy-preview.tsx`:

### Camada 1: CSS
```css
select-none              /* Impede seleção de texto */
pointer-events-none      /* Em imagens, impede drag */
```

### Camada 2: Eventos JavaScript
```tsx
onContextMenu={(e) => e.preventDefault()}   /* Bloqueia right-click */
onDragStart={(e) => e.preventDefault()}     /* Bloqueia drag de imagem */
```

### Camada 3: Overlay invisível
Um `<div>` transparente cobre toda a área do preview (z-index acima das imagens),
impedindo que o usuário interaja diretamente com as imagens.

### Camada 4: Watermark
Texto repetido "ADDS BRASIL · PREVIEW" com opacidade 3% rotacionado a -30°.
Visível apenas se alguém fizer print screen e ampliar.

### Camada 5: Sem Canvas exportável
O preview é feito com CSS/HTML puro (não `<canvas>`), o que impede
`canvas.toBlob()` / `canvas.toDataURL()`.

**Nota**: Nenhuma proteção é 100% infalível (print screen sempre funciona), mas essas
5 camadas combinadas são suficientes para desencorajar o download casual.

---

## 10. ATUALIZAR O `quote-wizard.tsx`

### Mudanças no tipo `WizardPersonalization`:

```typescript
// ANTES
export interface WizardPersonalization {
  print_color: string
  custom_color: string
  notes: string
  logo_file: File | null
}

// DEPOIS
export interface WizardPersonalization {
  mode: 'reuse' | 'request' | 'diy' | null
  notes: string
  logo_file: File | null
  // Dados DIY (por produto)
  diy_customizations: DiyCustomization[]
}

export interface DiyCustomization {
  product_id: string
  product_name: string
  line1: string
  line2: string
  logo_file: File | null
  logo_preview_url: string | null
  print_color: 'colorida' | 'branca' | 'preta'
}
```

### Mudanças no valor inicial:

```typescript
const INITIAL_PERSONALIZATION: WizardPersonalization = {
  mode: null,
  notes: '',
  logo_file: null,
  diy_customizations: [],
}
```

### Mudanças na props do StepPersonalization:

O componente `StepPersonalization` agora precisa receber `products` e `clientData`
para passar ao editor DIY:

```tsx
// No quote-wizard.tsx, onde renderiza StepPersonalization:
{currentStep === 'personalization' && (
  <StepPersonalization
    data={personalization}
    onChange={setPersonalization}
    products={products}           // ← NOVO
    clientData={clientData}       // ← NOVO
    onNext={() => goTo('review')}
    onBack={() => goTo('products')}
  />
)}
```

### Mudanças no submit (handleSubmit):

```typescript
// No handleSubmit do quote-wizard.tsx, adaptar para os 3 modos:

// Upload de logos (pode ter 1 por produto no modo DIY)
let logoUrl: string | undefined
if (personalization.mode === 'diy') {
  // Para DIY, upload do logo do primeiro produto que tem logo
  const firstWithLogo = personalization.diy_customizations.find((c) => c.logo_file)
  if (firstWithLogo?.logo_file) {
    logoUrl = await uploadQuoteLogo(firstWithLogo.logo_file)
  }
} else if (personalization.logo_file) {
  logoUrl = await uploadQuoteLogo(personalization.logo_file)
}

// Montar personalization no payload
const quoteData: CreatePublicQuoteData = {
  // ... dados do cliente ...
  client_logo_url: logoUrl,
  items: products.map((p) => {
    const diy = personalization.diy_customizations.find(
      (c) => c.product_id === p.product_id
    )
    return {
      product_id: p.product_id,
      product_name: p.product_name,
      quantity: p.quantity,
      colors: p.colors,
      custom_color: p.custom_color,
    }
  }),
  personalization: personalization.mode === 'diy'
    ? {
        mode: 'diy',
        customizations: personalization.diy_customizations.map((c) => ({
          product_id: c.product_id,
          line1: c.line1,
          line2: c.line2,
          print_color: c.print_color,
          has_logo: !!c.logo_file,
        })),
      }
    : {
        mode: personalization.mode,
        notes: personalization.notes,
        has_logo: !!personalization.logo_file,
      },
}
```

---

## 11. ATUALIZAR O `step-review.tsx`

Adicionar display das customizações DIY na revisão:

```tsx
{/* Dentro do card de Personalização na StepReview */}
{personalization.mode === 'diy' && personalization.diy_customizations.length > 0 && (
  <div className="space-y-2">
    {personalization.diy_customizations.map((c, i) => (
      <div key={i} className="p-2 rounded bg-muted/30 text-sm">
        <p className="font-medium text-xs text-muted-foreground mb-1">
          {c.product_name}
        </p>
        {c.line1 && <p>Linha 1: {c.line1}</p>}
        {c.line2 && <p>Linha 2: {c.line2}</p>}
        <p className="text-xs text-muted-foreground capitalize">
          Impressão: {c.print_color}
        </p>
        {c.logo_file && (
          <p className="text-xs text-green-500">✅ Logo anexado</p>
        )}
      </div>
    ))}
  </div>
)}
```

---

## 12. ORDEM DE IMPLEMENTAÇÃO NO CURSOR

1. **Atualizar tipos** — Mudar `WizardPersonalization` e criar `DiyCustomization` no `quote-wizard.tsx`
2. **Atualizar valores iniciais** — `INITIAL_PERSONALIZATION` no `quote-wizard.tsx`
3. **Atualizar props** — Passar `products` e `clientData` para `StepPersonalization`
4. **Criar pasta** — `src/app/(public)/quote/_components/personalization-diy/`
5. **Criar componentes** na ordem (cada um depende do anterior):
   - `diy-color-selector.tsx` (sem dependências internas)
   - `diy-logo-upload.tsx` (sem dependências internas)
   - `diy-shortcuts.tsx` (sem dependências internas)
   - `diy-product-navigator.tsx` (sem dependências internas)
   - `diy-preview.tsx` (sem dependências internas)
   - `diy-panel.tsx` (importa os 3 componentes acima)
   - `diy-editor.tsx` (importa panel + preview + navigator)
6. **Reescrever** `step-personalization.tsx` (importa diy-editor)
7. **Atualizar** `step-review.tsx` (adicionar display DIY)
8. **Atualizar** `handleSubmit` no `quote-wizard.tsx`
9. **Testar** — acessar `/quote`, ir até etapa 3, clicar "Faça você mesmo"

---

## 13. MELHORIAS FUTURAS (não implementar agora)

- **Canvas real**: trocar o preview CSS por um `<canvas>` com renderização de imagem real da escova
  → permitiria posicionar texto/logo com precisão sobre foto da escova
- **Imagens reais por produto**: usar `products.image_url` como background do preview
- **Fontes customizadas**: permitir escolher entre 3-4 fontes para o texto
- **Posicionamento drag**: permitir arrastar logo/texto dentro do preview
- **Tamanho do texto**: slider para ajustar o tamanho da fonte
- **Preview 3D**: modelo 3D da escova com Three.js (longo prazo)
