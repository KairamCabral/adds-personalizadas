# ADDS Brasil — Lógica de Cotação para Dentistas

> **Este documento é o prompt/referência para o Cursor AI implementar o sistema de cotações/orçamentos para dentistas no Next.js.**
> Contém TODA a lógica de preços, regras de negócio e políticas comerciais.
> Última atualização: Fevereiro 2026.

---

## 1. Visão Geral do Sistema

O sistema gera cotações para **dentistas e clínicas odontológicas**. O dentista monta um pedido escolhendo produtos e quantidades, e o sistema calcula automaticamente:

- Preço unitário de cada produto (baseado no **total de unidades do pedido inteiro**)
- Se a personalização está disponível
- Se o frete é grátis
- Total com desconto PIX/Boleto e parcelamento no cartão

### Princípio-chave da precificação

> **O preço unitário de TODOS os produtos depende da QUANTIDADE TOTAL do pedido (soma de todas as unidades de todos os produtos), e NÃO da quantidade individual de cada produto.**

Exemplo: se o dentista pede 20 un. de Implant + 16 un. de Ultra = 36 unidades totais. O preço de AMBOS os produtos será calculado pela faixa de 36 unidades.

---

## 2. Catálogo de Produtos

```typescript
interface Product {
  code: string;          // Código interno
  name: string;          // Nome do produto
  description: string;   // Descrição curta
  msrp: number;          // Preço consumidor final (referência)
  basePriceDentist: number; // Preço dentista padrão (sem personalização, sem escalonamento)
  category: "Escova" | "Acessório" | "Equipamento";
  customizable: boolean; // Se pode ser personalizado
  minOrderQty: number;   // Quantidade mínima por produto
}
```

| code | name | description | msrp | basePriceDentist | category | customizable | minOrderQty |
|------|------|-------------|------|------------------|----------|-------------|-------------|
| P01 | ADDS Implant | Escova protocolo | 34.90 | 24.00 | Escova | true | 24 |
| P02 | ADDS Ultra | Escova uso diário | 34.90 | 20.90 | Escova | true | 24 |
| P03 | ADDS OrthoGuard | Cera Ortodôntica (5 bastões) | 7.60 | 5.32 | Acessório | false | 24 |
| P04 | ADDS Expanding | Fio dental | 19.90 | 13.93 | Acessório | false | 24 |
| P05 | Interdental | Escova interdental (6 un.) | 14.80 | 10.36 | Escova | false | 24 |
| P06 | ADDS TechJet | Irrigador Oral | 897.00 | 616.85 | Equipamento | true | 6 |
| P07 | ADDS PassClean | Passa-fio | 9.90 | 6.93 | Acessório | false | 24 |
| P08 | ADDS PróClean | Escova de prótese/aparelhos | 19.90 | 13.68 | Escova | true | 24 |
| P09 | ADDS TonClean | Raspador de língua | 9.90 | 6.81 | Acessório | true | 24 |

---

## 3. Lógica de Preços — Descontos Progressivos por Volume

### 3.1 A tabela-mestre: ADDS Implant

O ADDS Implant é o **produto-referência**. Sua tabela de preço por faixa de quantidade define o percentual de desconto que é aplicado proporcionalmente a TODOS os outros produtos.

```typescript
const IMPLANT_PRICE_TABLE = [
  { minQty: 24,  unitPrice: 24.00 },  // desconto ~31.2% sobre MSRP
  { minQty: 36,  unitPrice: 22.90 },  // desconto ~34.4%
  { minQty: 72,  unitPrice: 21.90 },  // desconto ~37.2%
  { minQty: 120, unitPrice: 19.90 },  // desconto ~43.0%
  { minQty: 240, unitPrice: 19.10 },  // desconto ~45.3%
];
```

### 3.2 O ADDS Ultra tem sua própria tabela

```typescript
const ULTRA_PRICE_TABLE = [
  { minQty: 24,  unitPrice: 20.90 },  // desconto ~40.1%
  { minQty: 36,  unitPrice: 19.90 },  // desconto ~43.0%
  { minQty: 72,  unitPrice: 18.90 },  // desconto ~45.8%
  { minQty: 120, unitPrice: 16.90 },  // desconto ~51.6%
  { minQty: 240, unitPrice: 16.40 },  // desconto ~53.0%
];
```

### 3.3 Produtos personalizáveis com tabela própria derivada do Implant

Estes produtos usam o **mesmo percentual de desconto** do Implant, aplicado ao seu próprio MSRP:

**ADDS TechJet (Irrigador) — pedido mínimo 6 unidades:**

```typescript
const TECHJET_PRICE_TABLE = [
  { minQty: 6,   unitPrice: 616.85 },
  { minQty: 8,   unitPrice: 588.58 },
  { minQty: 12,  unitPrice: 562.87 },
  { minQty: 16,  unitPrice: 511.47 },
  { minQty: 24,  unitPrice: 490.91 },
];
```

**ADDS PróClean:**

```typescript
const PROCLEAN_PRICE_TABLE = [
  { minQty: 24,  unitPrice: 13.68 },
  { minQty: 36,  unitPrice: 13.06 },
  { minQty: 72,  unitPrice: 12.49 },
  { minQty: 120, unitPrice: 11.35 },
  { minQty: 240, unitPrice: 10.89 },
];
```

**ADDS TonClean:**

```typescript
const TONCLEAN_PRICE_TABLE = [
  { minQty: 24,  unitPrice: 6.81 },
  { minQty: 36,  unitPrice: 6.50 },
  { minQty: 72,  unitPrice: 6.21 },
  { minQty: 120, unitPrice: 5.64 },
  { minQty: 240, unitPrice: 5.42 },
];
```

### 3.4 Produtos SEM tabela própria — fórmula de cálculo

Os produtos que NÃO têm tabela própria (OrthoGuard, Expanding, Interdental, PassClean) usam esta fórmula:

```typescript
// Fórmula: preço = MSRP_do_produto × (preço_implant_na_faixa / MSRP_implant)
// Onde preço_implant_na_faixa = VLOOKUP na tabela do Implant pela quantidade TOTAL do pedido

function calculateDerivedPrice(
  productMsrp: number,
  totalOrderQty: number
): number {
  const IMPLANT_MSRP = 34.90;
  const implantPriceAtQty = lookupImplantPrice(totalOrderQty);
  const ratio = implantPriceAtQty / IMPLANT_MSRP;
  return Math.round(productMsrp * ratio * 100) / 100; // arredonda 2 casas
}

// Exemplo: OrthoGuard (MSRP 7.60) com 36 unidades totais no pedido:
// Implant na faixa 36 = R$ 22.90
// Ratio = 22.90 / 34.90 = 0.6562
// Preço OrthoGuard = 7.60 × 0.6562 = R$ 4.99
```

### 3.5 Algoritmo completo de lookup de preço

```typescript
function lookupImplantPrice(totalQty: number): number {
  // VLOOKUP com TRUE (intervalo) — pega a maior faixa que não excede totalQty
  const table = IMPLANT_PRICE_TABLE;
  let price = table[0].unitPrice; // default: menor faixa

  for (const tier of table) {
    if (totalQty >= tier.minQty) {
      price = tier.unitPrice;
    } else {
      break;
    }
  }
  return price;
}

function getUnitPrice(
  product: Product,
  totalOrderQty: number,   // SOMA de todos os produtos no pedido
  isCustomized: boolean     // se o dentista quer personalizar este produto
): number {
  // Se quantidade do pedido é 0, retorna MSRP (preço cheio)
  if (totalOrderQty === 0) return product.msrp;

  // Se o produto não está sendo personalizado E não faz parte de um pedido
  // com volume suficiente, retorna o preço base dentista
  // NOTA: Na planilha atual, o preço escalonado se aplica SEMPRE que há volume,
  // independente de personalização. A personalização é um serviço adicional gratuito.

  // Produtos com tabela própria
  switch (product.code) {
    case "P01": // Implant
      return lookupFromTable(IMPLANT_PRICE_TABLE, totalOrderQty);
    case "P02": // Ultra
      return lookupFromTable(ULTRA_PRICE_TABLE, totalOrderQty);
    case "P06": // TechJet
      return lookupFromTable(TECHJET_PRICE_TABLE, totalOrderQty);
    case "P08": // PróClean
      return lookupFromTable(PROCLEAN_PRICE_TABLE, totalOrderQty);
    case "P09": // TonClean
      return lookupFromTable(TONCLEAN_PRICE_TABLE, totalOrderQty);

    // Produtos derivados (usam ratio do Implant)
    default:
      return calculateDerivedPrice(product.msrp, totalOrderQty);
  }
}

function lookupFromTable(
  table: { minQty: number; unitPrice: number }[],
  qty: number
): number {
  let price = table[0].unitPrice;
  for (const tier of table) {
    if (qty >= tier.minQty) {
      price = tier.unitPrice;
    } else {
      break;
    }
  }
  return price;
}
```

---

## 4. Personalização

### 4.1 Regras

- **Disponível APENAS para dentistas** nos produtos: Implant, Ultra, TechJet, PróClean e TonClean.
- **Quantidade mínima para personalizar:** 24 unidades totais no pedido OU R$ 480 em compras.
- **Custo:** Gratuito quando atinge o mínimo.
- **Processo:** O dentista envia a arte (logo, nome, etc.) para aprovação antes da produção.
- **Prazo:** Até 12 dias úteis após aprovação da arte.

### 4.2 Lógica no sistema

```typescript
interface QuoteLineItem {
  product: Product;
  quantity: number;
  customize: boolean; // Dentista quer personalizar?
  unitPrice: number;  // Calculado automaticamente
  subtotal: number;   // quantity × unitPrice
}

function isCustomizationAvailable(totalQty: number, subtotal: number): boolean {
  return totalQty >= 24 || subtotal >= 480;
}

function canCustomize(product: Product, totalQty: number, subtotal: number): boolean {
  return product.customizable && isCustomizationAvailable(totalQty, subtotal);
}
```

### 4.3 UI — Campo "Personalizar?"

- Se o produto é personalizável: exibir toggle "Sim/Não"
- Se o produto NÃO é personalizável: exibir "—" (desabilitado)
- Se a quantidade total ainda não atingiu o mínimo: exibir tooltip "Mín. 24 unidades ou R$ 480 para personalizar"

---

## 5. Frete

### 5.1 Regras para dentistas

```typescript
function isFreteGratis(totalQty: number, subtotal: number): boolean {
  return totalQty >= 12 || subtotal >= 200;
}
```

- **Frete grátis:** a partir de 12 unidades totais OU R$ 200 em compras
- **Abaixo do mínimo:** frete por conta do cliente (valor calculado separadamente, não faz parte da cotação)

### 5.2 UI

Exibir indicador visual no topo da cotação:
- ✓ `FRETE GRÁTIS` (verde) — quando atingiu o mínimo
- ✗ `Frete: mín 12 un ou R$200` (vermelho) — quando NÃO atingiu

---

## 6. Pagamento e Descontos

### 6.1 Formas de pagamento

| Forma | Condição | Desconto |
|-------|----------|----------|
| PIX | À vista | **5% sobre o total** |
| Boleto | À vista | **5% sobre o total** |
| Cartão de crédito | Até 4x sem juros | Sem desconto |

### 6.2 Cálculo

```typescript
function calculateTotals(lineItems: QuoteLineItem[]) {
  const subtotal = lineItems.reduce((sum, item) => sum + item.subtotal, 0);
  const pixDiscount = 0.05;

  return {
    subtotal,                                    // Soma dos subtotais
    pixDiscountValue: subtotal * pixDiscount,     // Valor do desconto PIX
    totalPix: subtotal * (1 - pixDiscount),       // Total com PIX/Boleto
    totalCard: subtotal,                          // Total no cartão (sem desconto)
    installment4x: subtotal / 4,                  // Valor da parcela 4x
  };
}
```

---

## 7. Fluxo Completo de Cálculo

Quando o dentista adiciona/altera qualquer item no pedido, o sistema deve recalcular TUDO:

```typescript
function recalculateQuote(items: QuoteLineItem[]): Quote {
  // PASSO 1: Calcular total de unidades do pedido inteiro
  const totalQty = items.reduce((sum, item) => sum + item.quantity, 0);

  // PASSO 2: Recalcular preço unitário de CADA produto
  // (todos dependem do totalQty, não da quantidade individual)
  for (const item of items) {
    if (item.quantity > 0) {
      item.unitPrice = getUnitPrice(item.product, totalQty, item.customize);
    } else {
      item.unitPrice = item.product.msrp; // Mostra MSRP quando qty = 0
    }
    item.subtotal = item.quantity * item.unitPrice;
  }

  // PASSO 3: Calcular subtotal
  const subtotal = items
    .filter(i => i.quantity > 0)
    .reduce((sum, i) => sum + i.subtotal, 0);

  // PASSO 4: Verificar elegibilidades
  const freteGratis = isFreteGratis(totalQty, subtotal);
  const personalizacaoDisponivel = isCustomizationAvailable(totalQty, subtotal);

  // PASSO 5: Calcular totais finais
  const PIX_DISCOUNT = 0.05;

  return {
    items,
    totalQty,
    totalItems: items.filter(i => i.quantity > 0).length, // Qtd de produtos diferentes
    subtotal,
    pixDiscountRate: PIX_DISCOUNT,
    pixDiscountValue: subtotal * PIX_DISCOUNT,
    totalPix: subtotal * (1 - PIX_DISCOUNT),
    totalCard: subtotal,
    installment4x: subtotal / 4,
    freteGratis,
    personalizacaoDisponivel,
  };
}
```

---

## 8. Exemplo Completo

**Cenário:** Dentista pede 24 Implant + 12 Ultra + 12 OrthoGuard

```
Total de unidades = 24 + 12 + 12 = 48
Faixa de preço = 36 (maior faixa ≤ 48)

ADDS Implant:
  Tabela própria, faixa 36 → R$ 22,90/un
  Subtotal: 24 × 22,90 = R$ 549,60

ADDS Ultra:
  Tabela própria, faixa 36 → R$ 19,90/un
  Subtotal: 12 × 19,90 = R$ 238,80

ADDS OrthoGuard:
  Sem tabela própria → fórmula derivada
  Implant na faixa 36 = R$ 22,90
  Ratio = 22,90 / 34,90 = 0,6562
  Preço = 7,60 × 0,6562 = R$ 4,99
  Subtotal: 12 × 4,99 = R$ 59,88

SUBTOTAL = R$ 848,28
Desc. PIX (5%) = R$ 42,41
TOTAL PIX = R$ 805,87
TOTAL CARTÃO = R$ 848,28
  4x de R$ 212,07

Frete: ✓ GRÁTIS (48 un ≥ 12)
Personalização: ✓ DISPONÍVEL (48 un ≥ 24)
```

---

## 9. Regras de Validação

```typescript
const VALIDATION_RULES = {
  // Quantidade deve ser 0 ou ≥ minOrderQty do produto
  quantityValid: (qty: number, minOrderQty: number) =>
    qty === 0 || qty >= minOrderQty,

  // Mensagem de erro por produto
  quantityError: (product: Product) =>
    `Mínimo de ${product.minOrderQty} unidades para ${product.name}`,

  // Personalização só se atingiu o mínimo
  customizationValid: (customize: boolean, totalQty: number, subtotal: number) =>
    !customize || isCustomizationAvailable(totalQty, subtotal),

  // Pedido dentista não tem valor mínimo
  // (diferente de distribuidoras/varejistas que têm mín R$ 756)
  orderMinimum: null, // Sem mínimo para dentistas
};
```

---

## 10. Condições Comerciais (texto a exibir na cotação)

Estas condições devem aparecer no rodapé da cotação gerada:

```
✦ Personalização gratuita a partir de 24 unidades ou R$ 480 em compras (produtos elegíveis).
✦ Frete grátis a partir de 12 unidades ou R$ 200 em compras.
✦ Descontos progressivos: quanto maior a quantidade total, menor o preço unitário de todos os produtos.
✦ Cartão de crédito: até 4x sem juros | PIX / Boleto à vista: 5% de desconto.
✦ Prazo de entrega: até 12 dias úteis após aprovação da arte (produtos personalizados).
✦ Arte enviada para revisão e aprovação antes da produção.
```

**Validade da cotação:** 15 dias a partir da data de emissão.
**Validade da tabela de preços:** até 31/03/2026.

---

## 11. Dados para Seed / Database

### 11.1 Produtos

```typescript
const PRODUCTS: Product[] = [
  { code: "P01", name: "ADDS Implant", description: "Escova protocolo", msrp: 34.90, basePriceDentist: 24.00, category: "Escova", customizable: true, minOrderQty: 24 },
  { code: "P02", name: "ADDS Ultra", description: "Escova uso diário", msrp: 34.90, basePriceDentist: 20.90, category: "Escova", customizable: true, minOrderQty: 24 },
  { code: "P03", name: "ADDS OrthoGuard", description: "Cera Ortodôntica (5 bastões)", msrp: 7.60, basePriceDentist: 5.32, category: "Acessório", customizable: false, minOrderQty: 24 },
  { code: "P04", name: "ADDS Expanding", description: "Fio dental", msrp: 19.90, basePriceDentist: 13.93, category: "Acessório", customizable: false, minOrderQty: 24 },
  { code: "P05", name: "Interdental", description: "Escova interdental (6 un.)", msrp: 14.80, basePriceDentist: 10.36, category: "Escova", customizable: false, minOrderQty: 24 },
  { code: "P06", name: "ADDS TechJet", description: "Irrigador Oral", msrp: 897.00, basePriceDentist: 616.85, category: "Equipamento", customizable: true, minOrderQty: 6 },
  { code: "P07", name: "ADDS PassClean", description: "Passa-fio", msrp: 9.90, basePriceDentist: 6.93, category: "Acessório", customizable: false, minOrderQty: 24 },
  { code: "P08", name: "ADDS PróClean", description: "Escova de prótese e aparelhos", msrp: 19.90, basePriceDentist: 13.68, category: "Escova", customizable: true, minOrderQty: 24 },
  { code: "P09", name: "ADDS TonClean", description: "Raspador de língua", msrp: 9.90, basePriceDentist: 6.81, category: "Acessório", customizable: true, minOrderQty: 24 },
];
```

### 11.2 Tabelas de preço por volume

```typescript
const PRICE_TABLES: Record<string, { minQty: number; unitPrice: number }[]> = {
  P01: [ // ADDS Implant — tabela-mestre
    { minQty: 24, unitPrice: 24.00 },
    { minQty: 36, unitPrice: 22.90 },
    { minQty: 72, unitPrice: 21.90 },
    { minQty: 120, unitPrice: 19.90 },
    { minQty: 240, unitPrice: 19.10 },
  ],
  P02: [ // ADDS Ultra
    { minQty: 24, unitPrice: 20.90 },
    { minQty: 36, unitPrice: 19.90 },
    { minQty: 72, unitPrice: 18.90 },
    { minQty: 120, unitPrice: 16.90 },
    { minQty: 240, unitPrice: 16.40 },
  ],
  P06: [ // ADDS TechJet (faixas menores por ser equipamento caro)
    { minQty: 6, unitPrice: 616.85 },
    { minQty: 8, unitPrice: 588.58 },
    { minQty: 12, unitPrice: 562.87 },
    { minQty: 16, unitPrice: 511.47 },
    { minQty: 24, unitPrice: 490.91 },
  ],
  P08: [ // ADDS PróClean
    { minQty: 24, unitPrice: 13.68 },
    { minQty: 36, unitPrice: 13.06 },
    { minQty: 72, unitPrice: 12.49 },
    { minQty: 120, unitPrice: 11.35 },
    { minQty: 240, unitPrice: 10.89 },
  ],
  P09: [ // ADDS TonClean
    { minQty: 24, unitPrice: 6.81 },
    { minQty: 36, unitPrice: 6.50 },
    { minQty: 72, unitPrice: 6.21 },
    { minQty: 120, unitPrice: 5.64 },
    { minQty: 240, unitPrice: 5.42 },
  ],
  // P03, P04, P05, P07 NÃO têm tabela própria → usam fórmula derivada do Implant
};
```

### 11.3 Constantes do sistema

```typescript
const PRICING_CONSTANTS = {
  PIX_DISCOUNT: 0.05,              // 5% desconto PIX/Boleto
  MAX_INSTALLMENTS: 4,              // 4x sem juros no cartão
  FREE_SHIPPING_MIN_QTY: 12,       // Frete grátis: mín 12 unidades
  FREE_SHIPPING_MIN_VALUE: 200,     // Frete grátis: mín R$ 200
  CUSTOMIZATION_MIN_QTY: 24,        // Personalização: mín 24 unidades
  CUSTOMIZATION_MIN_VALUE: 480,     // Personalização: mín R$ 480
  QUOTE_VALIDITY_DAYS: 15,          // Validade da cotação
  TABLE_VALID_UNTIL: "2026-03-31",  // Validade da tabela de preços
  DELIVERY_DAYS_CUSTOM: 12,         // Prazo entrega personalizado (dias úteis)

  // Referência para fórmula de produtos derivados
  IMPLANT_MSRP: 34.90,             // MSRP do Implant (base do ratio)
  IMPLANT_TABLE_KEY: "P01",         // Chave da tabela do Implant
};
```

---

## 12. Regra Especial — TechJet usa faixas diferentes

O TechJet é um equipamento caro (R$ 897) e tem faixas de quantidade menores (6, 8, 12, 16, 24) em vez das faixas padrão (24, 36, 72, 120, 240).

**IMPORTANTE para a lógica:** O TechJet usa sua PRÓPRIA tabela de lookup, não o `totalOrderQty` geral. O lookup do TechJet é feito pela **quantidade de TechJets no pedido**, não pelo total geral.

> Na planilha Excel, o TechJet usa `VLOOKUP($D$6,...)` que é o total geral. Porém, como as faixas do TechJet são 6/8/12/16/24 e o total geral facilmente supera isso, na prática funciona. **Para o sistema Next.js, mantenha o mesmo comportamento: use totalOrderQty para o lookup do TechJet também.** Se totalOrderQty >= 24, o TechJet pega o preço da maior faixa (R$ 490,91).

---

## 13. Estrutura da Cotação (output)

```typescript
interface Quote {
  id: string;
  date: Date;
  validUntil: Date;                    // date + 15 dias
  customer: {
    name: string;
    clinic?: string;                   // Nome da clínica (opcional)
    phone?: string;
    email?: string;
  };
  items: QuoteLineItem[];
  summary: {
    totalItems: number;                // Qtd de produtos diferentes
    totalQty: number;                  // Soma de todas as unidades
    subtotal: number;                  // Soma dos subtotais
    pixDiscountRate: number;           // 0.05
    pixDiscountValue: number;          // subtotal × 0.05
    totalPix: number;                  // subtotal - desconto PIX
    totalCard: number;                 // subtotal (sem desconto)
    installment4x: number;            // subtotal / 4
    freteGratis: boolean;
    personalizacaoDisponivel: boolean;
  };
}

interface QuoteLineItem {
  product: Product;
  quantity: number;                    // 0 = não incluído
  customize: boolean;                  // false se não personalizável
  unitPrice: number;                   // Calculado pelo sistema
  discountFromMsrp: number;           // 1 - (unitPrice / msrp)
  subtotal: number;                    // quantity × unitPrice
}
```

---

## 14. Informações da Empresa (rodapé da cotação)

```
ADDS Brasil | Canal de Vendas: (48) 3643-0676
addsbrasil.com.br
```

---

## 15. Resumo das Regras de Negócio (checklist para implementação)

- [ ] Preço unitário depende do **total de unidades do pedido inteiro** (não individual)
- [ ] Produtos com tabela própria (P01, P02, P06, P08, P09): lookup direto
- [ ] Produtos sem tabela (P03, P04, P05, P07): fórmula `MSRP × (preço_implant_faixa / 34.90)`
- [ ] Ao alterar quantidade de qualquer produto, recalcular TODOS os preços
- [ ] Personalização: só produtos marcados, mínimo 24 un ou R$ 480
- [ ] Frete grátis: mínimo 12 un ou R$ 200
- [ ] PIX/Boleto: 5% desconto sobre total
- [ ] Cartão: até 4x sem juros, sem desconto
- [ ] Dentistas: sem pedido mínimo em valor
- [ ] Quantidade mínima por produto: 24 un (TechJet: 6 un)
- [ ] Validade da cotação: 15 dias
- [ ] Arredondar preços derivados para 2 casas decimais
