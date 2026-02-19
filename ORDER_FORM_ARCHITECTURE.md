# ADDS CRM — Novo Fluxo de Cadastro de Pedido

## PROBLEMA ATUAL

O formulário atual pede informações desnecessárias (título manual, tipo, datas, responsável)
e não conecta com o Tiny ERP. O operador precisa preencher tudo manualmente, o que é lento
e propenso a erros. A experiência não reflete o fluxo real de trabalho da ADDS.

---

## NOVO FLUXO (3 ETAPAS VISUAIS)

O formulário vira um **wizard de 3 passos** dentro de um Dialog/Sheet, guiando
o operador de forma intuitiva:

```
┌─────────────────────────────────────────────────────┐
│  PASSO 1          PASSO 2            PASSO 3        │
│  ● Cliente    ─── ○ Produtos    ─── ○ Revisão       │
│                                                      │
│  Buscar cliente no Tiny ERP                          │
│  ┌─────────────────────────────────────────┐        │
│  │ 🔍 Nome, telefone ou CPF/CNPJ...       │        │
│  └─────────────────────────────────────────┘        │
│                                                      │
│  Resultados:                                         │
│  ┌──────────────────────────────────────┐           │
│  │ 👤 Clínica Sorriso LTDA             │           │
│  │    (11) 3333-4444 · 12.345.678/0001 │  [Usar]   │
│  ├──────────────────────────────────────┤           │
│  │ 👤 Dr. Carlos Mendes                │           │
│  │    (21) 98888-7777 · 123.456.789-00 │  [Usar]   │
│  └──────────────────────────────────────┘           │
│                                                      │
│  ☐ Cliente não encontrado? Cadastrar novo            │
│                                                      │
│                               [Cancelar]  [Próximo →]│
└─────────────────────────────────────────────────────┘
```

```
┌─────────────────────────────────────────────────────┐
│  PASSO 1          PASSO 2            PASSO 3        │
│  ✓ Cliente    ─── ● Produtos    ─── ○ Revisão       │
│                                                      │
│  Cliente: Clínica Sorriso LTDA          [Trocar]     │
│                                                      │
│  ┌─ Produtos ──────────────────────────────────┐    │
│  │                                              │    │
│  │  ┌─────────────────────────────────────┐    │    │
│  │  │ ADDS Ultra                          │    │    │
│  │  │ Cor: [Branco ▼] [Preto ▼] [Custom] │    │    │
│  │  │ Qtd: [- 100 +]                     │    │    │
│  │  │                          [Remover]  │    │    │
│  │  └─────────────────────────────────────┘    │    │
│  │                                              │    │
│  │  ┌─────────────────────────────────────┐    │    │
│  │  │ ADDS Implant                        │    │    │
│  │  │ Cor: [Branco ▼]                     │    │    │
│  │  │ Qtd: [- 50 +]                      │    │    │
│  │  │                          [Remover]  │    │    │
│  │  └─────────────────────────────────────┘    │    │
│  │                                              │    │
│  │  [+ Adicionar produto]                       │    │
│  └──────────────────────────────────────────────┘    │
│                                                      │
│  ┌─ Personalização ───────────────────────────┐     │
│  │ Informações, textos, observações sobre a    │     │
│  │ arte e personalização deste pedido...       │     │
│  └─────────────────────────────────────────────┘     │
│                                                      │
│  ┌─ Logo do cliente ──────────────────────────┐     │
│  │  ┌─────────┐                               │     │
│  │  │  📎     │  Arraste ou clique para       │     │
│  │  │  Drop   │  anexar a logo                │     │
│  │  └─────────┘  JPG, PNG, PDF ou CDR (máx 10MB)│   │
│  └─────────────────────────────────────────────┘     │
│                                                      │
│                          [← Voltar]  [Próximo →]     │
└─────────────────────────────────────────────────────┘
```

```
┌─────────────────────────────────────────────────────┐
│  PASSO 1          PASSO 2            PASSO 3        │
│  ✓ Cliente    ─── ✓ Produtos    ─── ● Revisão       │
│                                                      │
│  ┌─ Resumo do Pedido ─────────────────────────┐     │
│  │                                              │     │
│  │  📋 Pedido: Clínica Sorriso LTDA            │     │
│  │                                              │     │
│  │  Cliente                                     │     │
│  │  Clínica Sorriso LTDA                        │     │
│  │  (11) 3333-4444 · CNPJ 12.345.678/0001-99  │     │
│  │                                              │     │
│  │  Produtos                                    │     │
│  │  • ADDS Ultra — Branco, Preto — 100 un      │     │
│  │  • ADDS Implant — Branco — 50 un            │     │
│  │                                              │     │
│  │  Personalização                              │     │
│  │  "Texto na embalagem: Clínica Sorriso..."   │     │
│  │                                              │     │
│  │  Logo                                        │     │
│  │  ✅ logo-clinica.png (245 KB)               │     │
│  │                                              │     │
│  │  Prioridade: [Normal ▼]                      │     │
│  │                                              │     │
│  └──────────────────────────────────────────────┘     │
│                                                      │
│                     [← Voltar]  [Criar Pedido ✓]     │
└─────────────────────────────────────────────────────┘
```

---

## REGRAS DE NEGÓCIO

### Título automático
- **NÃO** tem campo de título editável
- O título é gerado automaticamente: `"{Nome do Cliente}"` 
- Se vier do Tiny com ID: `"#{tiny_id} — {Nome do Cliente}"`
- Salvo no campo `orders.title`

### Tipo automático
- Pedido criado manualmente → `order_type = 'PERSONALIZADO'`
- Pedido criado via orçamento público → `order_type = 'ORCAMENTO_PUBLICO'`
- O campo NÃO aparece no formulário

### Responsável
- NÃO aparece no formulário
- `created_by` = usuário logado (automático)
- `assigned_to` = NULL (atribuído depois no Kanban)

### Datas
- NÃO aparecem no formulário
- `start_date` = data de criação (automático)
- `due_date` = NULL (definido depois)

### Prioridade
- Aparece no Passo 3 (revisão) como select simples
- Default: NORMAL
- Opções: Normal | Alta

---

## BUSCA DE CLIENTE (Passo 1)

### Fluxo de busca
1. Operador digita no campo de busca (mínimo 3 caracteres)
2. Sistema busca SIMULTANEAMENTE:
   - No banco local (tabela `clients`) — busca por nome, telefone, documento
   - Na API do Tiny ERP — busca por nome, telefone ou CPF/CNPJ
3. Resultados aparecem em lista unificada com indicador de origem:
   - Badge "CRM" para clientes locais
   - Badge "Tiny" para clientes só no Tiny
4. Ao selecionar:
   - Se é cliente local: usa os dados do CRM
   - Se é cliente só do Tiny: importa para o CRM automaticamente e usa
5. Dados pré-preenchidos: nome, telefone, CPF/CNPJ, empresa

### Cadastro rápido
- Link "Cliente não encontrado? Cadastrar novo"
- Abre formulário inline com campos mínimos: nome, telefone, CPF/CNPJ
- Após salvar, seleciona automaticamente

---

## PRODUTOS E CORES (Passo 2)

### Modelo de cores nos produtos

A tabela `products` precisa de um campo novo para definir as variações de cor disponíveis:

```sql
ALTER TABLE products ADD COLUMN available_colors JSONB DEFAULT '[]'::jsonb;
-- Exemplo: [
--   {"key": "branco", "label": "Branco", "hex": "#FFFFFF"},
--   {"key": "preto", "label": "Preto", "hex": "#000000"},
--   {"key": "custom", "label": "Cor personalizada", "hex": null}
-- ]

ALTER TABLE products ADD COLUMN allows_custom_color BOOLEAN DEFAULT true;
-- Se true, aparece opção "Cor personalizada" com input de hex/nome
```

### Seleção de produtos
1. Botão "+ Adicionar produto" abre dropdown/combobox com produtos ativos
2. Ao selecionar um produto, ele aparece como card:
   - Nome do produto
   - Cores disponíveis (chips clicáveis ou multi-select baseado em `available_colors`)
   - Se `allows_custom_color`: input adicional para cor personalizada
   - Quantidade (input numérico com botões +/-)
3. Pode adicionar vários produtos
4. Pode remover com botão "Remover"

### Campo de personalização
- Textarea grande e limpo
- Placeholder: "Descreva os detalhes da personalização: textos, posicionamento, observações..."
- Opcional mas importante

### Upload de logo
- Componente de drag & drop
- Aceita: `.jpg`, `.jpeg`, `.png`, `.pdf`, `.cdr`
- Máximo: 1 arquivo, até 10MB
- Preview da imagem (se jpg/png)
- Ícone de arquivo (se pdf/cdr)
- Botão de remover
- Upload vai para Supabase Storage bucket `adds-crm` pasta `logos/{order_id}/`

---

## DADOS SALVOS

Ao clicar "Criar Pedido":

### Tabela `orders`
```json
{
  "title": "Clínica Sorriso LTDA",
  "description": null,
  "client_id": "uuid-do-cliente",
  "status": "FAZER",
  "order_type": "PERSONALIZADO",
  "priority": "NORMAL",
  "start_date": "2026-02-19",
  "assigned_to": null,
  "created_by": "uuid-do-usuario-logado",
  "position": 0
}
```

### Tabela `order_items` (1 por produto)
```json
{
  "order_id": "uuid-do-pedido",
  "product_id": "uuid-do-produto",
  "product_name": "ADDS Ultra",
  "quantity": 100,
  "personalization": {
    "colors": ["branco", "preto"],
    "custom_color": null,
    "notes": "Texto na embalagem: Clínica Sorriso..."
  }
}
```

### Tabela `attachments` (logo)
```json
{
  "order_id": "uuid-do-pedido",
  "file_url": "https://xxx.supabase.co/storage/.../logo.png",
  "file_name": "logo-clinica.png",
  "file_size": 245000,
  "file_type": "image/png",
  "uploaded_by": "uuid-do-usuario"
}
```

### Observações de personalização → `orders.description`
O texto de personalização vai para `orders.description` (campo já existente).

---

## ALTERAÇÕES NO BANCO

```sql
-- Nova migration: 00003_product_colors.sql

-- Adicionar cores disponíveis ao produto
ALTER TABLE products ADD COLUMN IF NOT EXISTS
  available_colors JSONB DEFAULT '[]'::jsonb;

ALTER TABLE products ADD COLUMN IF NOT EXISTS
  allows_custom_color BOOLEAN DEFAULT true;

-- Atualizar produtos existentes com cores padrão
UPDATE products SET available_colors = '[
  {"key": "branco", "label": "Branco", "hex": "#FFFFFF"},
  {"key": "preto", "label": "Preto", "hex": "#000000"}
]'::jsonb
WHERE available_colors = '[]'::jsonb;

-- Garantir que personalization em order_items suporta cores
COMMENT ON COLUMN order_items.personalization IS
  'JSON: { colors: string[], custom_color: string|null, notes: string }';
```

---

## ESTRUTURA DE ARQUIVOS (o que muda)

```
src/app/(dashboard)/pipeline/_components/
├── order-form.tsx              ← REESCREVER COMPLETAMENTE
├── order-form-step-client.tsx  ← NOVO — Passo 1: busca de cliente
├── order-form-step-products.tsx← NOVO — Passo 2: produtos + cores + logo
├── order-form-step-review.tsx  ← NOVO — Passo 3: revisão + prioridade
├── client-search.tsx           ← NOVO — Combobox com busca Tiny + local
├── product-selector.tsx        ← NOVO — Card de produto com cores e qtd
├── color-picker.tsx            ← NOVO — Seletor de cores disponíveis
└── logo-upload.tsx             ← NOVO — Upload single file com preview
```

---

## RESUMO DAS MUDANÇAS

| Antes | Depois |
|-------|--------|
| Título manual | Automático (nome do cliente) |
| Cliente: select simples | Busca com Tiny + CRM + cadastro rápido |
| Sem produtos no form | Seleção de produtos com cores e quantidade |
| Sem personalização | Textarea para detalhes de personalização |
| Sem logo | Upload de logo (1 arquivo) |
| Tipo: select manual | Automático (PERSONALIZADO) |
| Datas no form | Removidas (automáticas) |
| Responsável no form | Removido (registra created_by) |
| 1 tela estática | Wizard de 3 passos |
