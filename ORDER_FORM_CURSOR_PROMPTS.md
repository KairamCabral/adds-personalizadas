# ADDS CRM — Prompts Cursor Agent: Novo Cadastro de Pedido

## CONTEXTO (cole no início da sessão)

```
Leia o arquivo ORDER_FORM_ARCHITECTURE.md na raiz do projeto. Ele descreve o novo fluxo
de cadastro de pedido que substitui o formulário atual.

Resumo: O form antigo (order-form.tsx) vira um wizard de 3 passos:
1. Buscar/selecionar cliente (com busca no Tiny ERP + banco local)
2. Selecionar produtos com cores, quantidade, personalização e upload de logo
3. Revisão + prioridade + criar pedido

Campos removidos: título (agora automático = nome do cliente), tipo (automático = PERSONALIZADO),
datas (automáticas), responsável (automático = created_by).

Stack: Next.js 15 App Router, TypeScript, Supabase, shadcn/ui, Tailwind, React Hook Form, Zod.
Idioma: português brasileiro.
```

---

## ETAPA P1 — MIGRATION + TYPES

```
Preciso preparar o banco para o novo formulário de pedido.

### 1. Crie a migration `supabase/migrations/00003_product_colors.sql`

ALTER TABLE products ADD COLUMN IF NOT EXISTS
  available_colors JSONB DEFAULT '[]'::jsonb;

ALTER TABLE products ADD COLUMN IF NOT EXISTS
  allows_custom_color BOOLEAN DEFAULT true;

UPDATE products SET available_colors = '[
  {"key": "branco", "label": "Branco", "hex": "#FFFFFF"},
  {"key": "preto", "label": "Preto", "hex": "#000000"}
]'::jsonb
WHERE available_colors = '[]'::jsonb;

### 2. Atualize os types

Em `src/types/database.types.ts`, adicione `available_colors` e `allows_custom_color`
no type do Product (Row, Insert e Update).

### 3. Atualize o Zod schema

Em `src/lib/validations.ts`, atualize productSchema para incluir os novos campos.

Crie um novo schema para o formulário de pedido:

export const newOrderSchema = z.object({
  client_id: z.string().uuid("Selecione um cliente"),
  client_name: z.string().min(1),
  items: z.array(z.object({
    product_id: z.string().uuid(),
    product_name: z.string(),
    quantity: z.number().int().min(1, "Mínimo 1 unidade"),
    colors: z.array(z.string()).min(1, "Selecione pelo menos 1 cor"),
    custom_color: z.string().nullable().optional(),
  })).min(1, "Adicione pelo menos 1 produto"),
  personalization_notes: z.string().optional(),
  logo_file: z.any().optional(),
  priority: z.enum(["NORMAL", "ALTA"]).default("NORMAL"),
});

export type NewOrderFormData = z.infer<typeof newOrderSchema>;

Execute `pnpm build` ao final.
```

---

## ETAPA P2 — BUSCA DE CLIENTE (Passo 1)

```
Crie o Passo 1 do wizard: busca e seleção de cliente.

### 1. `src/app/(dashboard)/pipeline/_components/client-search.tsx`

Componente de busca que:
- Tem um input de texto com ícone de busca e placeholder "Buscar por nome, telefone ou CPF/CNPJ..."
- Debounce de 400ms antes de buscar
- Ao digitar 3+ caracteres, busca em PARALELO:
  a) Banco local: `clients` table com busca por name (ilike), phone (ilike), document (ilike)
  b) Tiny ERP: se o serviço tiny.service.ts tiver uma função searchContacts, usar.
     Se não existir, criar uma que faz GET na API Tiny buscando contatos.
     Se a integração Tiny não estiver configurada, buscar apenas localmente.
- Mostrar resultados em lista scrollable:
  - Cada item mostra: nome, telefone, CPF/CNPJ (mascarado), badge "CRM" ou "Tiny"
  - Botão "Selecionar" em cada item
- Se nenhum resultado: mostrar "Nenhum cliente encontrado"
- Link "Cadastrar novo cliente" que abre um mini-form inline:
  - Campos: Nome (obrigatório), Telefone, CPF/CNPJ
  - Botão "Salvar e usar"
  - Ao salvar: insere na tabela clients e seleciona automaticamente
- Ao selecionar um cliente do Tiny que não existe localmente:
  - Criar automaticamente na tabela clients com os dados do Tiny
  - Salvar o tiny_id para referência
- Quando um cliente é selecionado, mostrar card de confirmação:
  - Nome em destaque, telefone, documento
  - Botão "Trocar" para voltar à busca

Props do componente:
- onClientSelect(client: { id: string, name: string, phone: string | null, document: string | null })
- selectedClient: { id, name, phone, document } | null

### 2. `src/app/(dashboard)/pipeline/_components/order-form-step-client.tsx`

Passo 1 do wizard que:
- Renderiza o client-search
- Mostra stepper visual no topo: ● Cliente — ○ Produtos — ○ Revisão
- Botão "Próximo" habilitado apenas quando um cliente está selecionado
- Botão "Cancelar" que fecha o dialog

O stepper visual deve ser um componente inline com 3 círculos conectados por linha:
- Passo atual: círculo azul preenchido (#21add6) com texto bold
- Passo concluído: círculo verde com check
- Passo futuro: círculo cinza outline

Execute `pnpm build` ao final.
```

---

## ETAPA P3 — PRODUTOS, CORES E LOGO (Passo 2)

```
Crie o Passo 2 do wizard: seleção de produtos com cores, personalização e upload de logo.

### 1. `src/app/(dashboard)/pipeline/_components/color-picker.tsx`

Componente de seleção de cores para um produto:

Props:
- availableColors: { key: string, label: string, hex: string | null }[]
- allowsCustomColor: boolean
- selectedColors: string[]
- customColor: string | null
- onChange(colors: string[], customColor: string | null): void

Renderização:
- Chips clicáveis para cada cor disponível
  - Cada chip mostra: bolinha colorida (usando hex) + nome
  - Se hex é null (cor custom): bolinha com gradiente rainbow
  - Selecionado: chip com borda azul + fundo azul claro
  - Não selecionado: chip outline
  - Clicar toggle: adiciona/remove da seleção
- Se allowsCustomColor e "custom" está selecionado:
  - Input extra: "Nome ou código da cor personalizada"
- Multi-select: pode selecionar várias cores

### 2. `src/app/(dashboard)/pipeline/_components/product-selector.tsx`

Card individual de um produto selecionado:

Props:
- product: Product (com available_colors e allows_custom_color)
- quantity: number
- selectedColors: string[]
- customColor: string | null
- onQuantityChange(qty: number): void
- onColorsChange(colors: string[], customColor: string | null): void
- onRemove(): void

Renderização:
- Card com borda, padding, fundo card:
  - Nome do produto em bold (com imagem pequena se tiver image_url)
  - color-picker component
  - Quantidade: botão [-] · input numérico · botão [+] (mínimo 1)
  - Botão "Remover" no canto inferior direito (texto vermelho, discreto)

### 3. `src/app/(dashboard)/pipeline/_components/logo-upload.tsx`

Upload de logo do cliente (máximo 1 arquivo):

Props:
- file: File | null
- previewUrl: string | null
- onFileChange(file: File | null): void

Renderização:
- Se nenhum arquivo: zona de drop com ícone de upload
  - Texto: "Arraste a logo ou clique para selecionar"
  - Subtexto: "JPG, PNG, PDF ou CDR · Máximo 10MB"
  - Aceitar: .jpg, .jpeg, .png, .pdf, .cdr
- Se tem arquivo:
  - Se imagem (jpg/png): preview miniatura
  - Se pdf/cdr: ícone de arquivo + nome
  - Nome do arquivo + tamanho
  - Botão "Remover" (ícone X)
- Validar:
  - Tipo de arquivo (rejeitar outros)
  - Tamanho máximo 10MB
  - Mostrar toast de erro se inválido

### 4. `src/app/(dashboard)/pipeline/_components/order-form-step-products.tsx`

Passo 2 do wizard:
- Stepper no topo (passo 2 ativo)
- Mostra card do cliente selecionado no topo (nome + telefone, pequeno)
- Seção "Produtos":
  - Lista de product-selector cards para cada produto adicionado
  - Botão "+ Adicionar produto" que abre um dropdown/combobox:
    - Lista os produtos ativos (useQuery em products table)
    - Busca por nome
    - Ao selecionar: adiciona um novo product-selector card
    - Não permitir adicionar o mesmo produto duas vezes
  - Se nenhum produto: mensagem "Adicione pelo menos 1 produto"
- Seção "Personalização":
  - Textarea grande com placeholder "Descreva os detalhes: textos, posicionamento, observações..."
  - Sem label pesado, apenas placeholder e borda clean
- Seção "Logo do cliente":
  - logo-upload component
- Botões: "← Voltar" (volta ao passo 1) | "Próximo →" (só se tem ≥1 produto com ≥1 cor)

Execute `pnpm build` ao final.
```

---

## ETAPA P4 — REVISÃO E CRIAÇÃO (Passo 3)

```
Crie o Passo 3 do wizard: revisão de todos os dados e criação do pedido.

### 1. `src/app/(dashboard)/pipeline/_components/order-form-step-review.tsx`

Passo final do wizard:
- Stepper no topo (passo 3 ativo, 1 e 2 com check verde)
- Card de resumo visual com seções:

  **Cliente**
  - Nome em destaque
  - Telefone e documento (se tiver)

  **Produtos** (para cada item)
  - Nome do produto
  - Cores selecionadas (badges coloridas)
  - Cor personalizada (se tiver)
  - Quantidade

  **Personalização**
  - Texto da personalização (ou "Nenhuma observação" em cinza)

  **Logo**
  - Nome do arquivo + tamanho (ou "Nenhuma logo anexada" em cinza)
  - Preview miniatura se for imagem

  **Prioridade**
  - Select simples: Normal | Alta
  - Default: Normal

- Botões: "← Voltar" | "Criar Pedido ✓" (azul, com loading state)

### 2. Lógica de criação (ao clicar "Criar Pedido")

Sequência de ações:

1. **Gerar título automático:**
   - title = client.name (ex: "Clínica Sorriso LTDA")

2. **Criar o pedido na tabela orders:**
   ```
   {
     title: client.name,
     description: personalization_notes || null,
     client_id: client.id,
     status: 'FAZER',
     order_type: 'PERSONALIZADO',
     priority: selectedPriority,
     start_date: new Date().toISOString().split('T')[0],
     assigned_to: null,
     created_by: currentUser.id,
     position: (max position in FAZER column) + 1
   }
   ```

3. **Criar order_items (1 por produto):**
   ```
   {
     order_id: newOrder.id,
     product_id: item.product_id,
     product_name: item.product_name,
     quantity: item.quantity,
     personalization: {
       colors: item.colors,
       custom_color: item.custom_color
     }
   }
   ```

4. **Upload da logo (se tiver):**
   - Upload para Supabase Storage: `adds-crm/logos/{order_id}/{filename}`
   - Criar registro em attachments:
     ```
     {
       order_id: newOrder.id,
       file_url: publicUrl,
       file_name: file.name,
       file_size: file.size,
       file_type: file.type,
       uploaded_by: currentUser.id
     }
     ```

5. **Registrar no order_history:**
   ```
   {
     order_id: newOrder.id,
     user_id: currentUser.id,
     action: 'created',
     new_value: 'FAZER'
   }
   ```

6. **Invalidar cache** do TanStack Query (key: "orders")

7. **Toast de sucesso:** "Pedido criado com sucesso!"

8. **Fechar o dialog** e o novo card aparece na coluna FAZER

Se qualquer etapa falhar: toast de erro e NÃO fechar o dialog.

Execute `pnpm build` ao final.
```

---

## ETAPA P5 — REESCREVER ORDER-FORM.TSX

```
Agora integre tudo no componente principal.

### 1. Reescreva `src/app/(dashboard)/pipeline/_components/order-form.tsx`

O componente agora é um wizard controller:

- State: currentStep (1, 2 ou 3)
- State: formData acumulado entre os passos:
  ```
  {
    client: { id, name, phone, document } | null,
    items: [{ product_id, product_name, quantity, colors, custom_color }],
    personalization_notes: string,
    logo_file: File | null,
    logo_preview: string | null,
    priority: 'NORMAL' | 'ALTA'
  }
  ```
- Renderiza o step component baseado no currentStep
- Passa callbacks para cada step: onNext, onBack, onChange
- O Dialog/Sheet usa o useUIStore.createOrderOpen para abrir/fechar
- Ao fechar: reset de todo o formData e voltar para step 1
- Animação de transição entre steps (fade ou slide suave)

### 2. Remova campos antigos

- Remova do form: título, tipo, data início, data entrega, responsável
- Esses campos agora são automáticos

### 3. Atualize o kanban-board.tsx

- O botão "Novo Pedido" e "+ Adicionar pedido" devem abrir o novo wizard
- Após criar: o card aparece na coluna FAZER com o nome do cliente como título

### 4. Atualize o Kanban Card

No kanban-card.tsx, quando o pedido tem items:
- Mostrar abaixo do título: "ADDS Ultra (100) · ADDS Implant (50)" em texto pequeno cinza
- Se tem logo em attachments: mostrar ícone de paperclip

### 5. Limpe imports e código morto

Remova qualquer referência ao formulário antigo que não é mais usado.

Execute `pnpm build` ao final para garantir zero erros.
```

---

## ETAPA P6 — CONFIGURAÇÃO DE CORES NOS PRODUTOS

```
Adicione a configuração de cores na página de settings de produtos.

### Em `src/app/(dashboard)/settings/products/page.tsx`

No formulário de edição de produto, adicione uma seção "Cores disponíveis":

1. Lista das cores atuais como chips editáveis:
   - Cada cor: bolinha colorida + nome + botão remover
   - Botão "+ Adicionar cor"
   - Ao clicar: abre inline com campos: Nome da cor, Código hex (com color picker)
   - Botão salvar

2. Toggle "Permitir cor personalizada"
   - Se ativo: no formulário de pedido aparece opção de cor custom
   - Salva em products.allows_custom_color

3. Cores padrão sugeridas (para facilitar):
   - Ao criar um novo produto, pré-popular com Branco e Preto

As cores são salvas em products.available_colors como JSONB array.

Execute `pnpm build` ao final.
```

---

## RESUMO DAS ETAPAS

```
P1: Migration + Types + Schemas          (~15 min)
 │
P2: Busca de cliente (Passo 1)           (~45 min)
 │
P3: Produtos + Cores + Logo (Passo 2)    (~60 min)
 │
P4: Revisão + Criação (Passo 3)          (~45 min)
 │
P5: Integrar tudo no order-form.tsx      (~30 min)
 │
P6: Config de cores em Settings          (~20 min)
 │
 ▼
✅ Novo formulário de pedido completo
```

Sempre `pnpm build` entre etapas. A ordem é sequencial — cada etapa depende da anterior.
