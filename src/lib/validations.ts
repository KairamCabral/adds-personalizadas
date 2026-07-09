import { z } from "zod";

// ============================================
// AUTH
// ============================================

export const loginSchema = z.object({
  email: z.string().email("E-mail inválido"),
  password: z.string().min(6, "Mínimo de 6 caracteres"),
});

export type LoginFormData = z.infer<typeof loginSchema>;

// ============================================
// CLIENT
// ============================================

export const clientSchema = z.object({
  person_type: z.enum(["FISICA", "JURIDICA"]),
  name: z.string().min(2, "Nome deve ter pelo menos 2 caracteres"),
  email: z
    .preprocess(
      (val) =>
        val === "" || val === null || val === undefined ? undefined : val,
      z.string().email("E-mail inválido").optional()
    )
    .nullable()
    .optional(),
  phone: z.string().nullable().optional(),
  company: z.string().nullable().optional(),
  document: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  zip_code: z.string().nullable().optional(),
  street: z.string().nullable().optional(),
  number: z.string().nullable().optional(),
  complement: z.string().nullable().optional(),
  neighborhood: z.string().nullable().optional(),
  city: z.string().nullable().optional(),
  state: z.string().nullable().optional(),
  sales_channel: z
    .enum(["CONSUMIDOR", "DENTISTA", "DISTRIBUIDORA", "VAREJISTA"])
    .nullable()
    .optional(),
});

export type ClientFormData = z.infer<typeof clientSchema>;

// ============================================
// ORDER
// ============================================

export const orderSchema = z.object({
  title: z.string().min(1, "Título é obrigatório"),
  description: z.string().nullable().optional(),
  client_id: z.string().uuid().nullable().optional(),
  status: z.enum([
    "FAZER", "AJUSTE", "APROVACAO", "CONFIRMACAO", "APROVADO",
    "PRODUCAO", "EXPEDICAO",
    "FINALIZADO", "ENTREGUE", "FATURADO", "ARQUIVADO",
  ]),
  order_type: z.enum([
    "USUARIO", "PERSONALIZADO", "RUSH", "PROMOCIONAL", "ORCAMENTO_PUBLICO",
  ]),
  priority: z.enum(["NORMAL", "ALTA"]),
  start_date: z.string().nullable().optional(),
  due_date: z.string().nullable().optional(),
  assigned_to: z.string().uuid().nullable().optional(),
});

export type OrderFormData = z.infer<typeof orderSchema>;

// ============================================
// COMMENT
// ============================================

export const commentSchema = z.object({
  content: z.string().min(1, "Comentário não pode estar vazio"),
  mentions: z.array(z.string().uuid()).optional(),
});

export type CommentFormData = z.infer<typeof commentSchema>;

// ============================================
// PRODUCT
// ============================================

const colorItemSchema = z.object({
  key: z.string(),
  label: z.string(),
  hex: z.string().nullable(),
  image_url: z.string().nullable().optional(),
});

export const productSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório"),
  description: z.string().nullable().optional(),
  image_url: z.string().nullable().optional(),
  print_area_image_url: z.string().nullable().optional(),
  canvas_width: z.coerce.number().int().nullable().optional(),
  canvas_height: z.coerce.number().int().nullable().optional(),
  available_colors: z.array(colorItemSchema).default([]),
  is_active: z.boolean().default(true),
});

export type ProductFormData = z.infer<typeof productSchema>;

// ============================================
// PRICING (motor de preços — admin)
// ============================================

export const SALES_CHANNELS = [
  "CONSUMIDOR",
  "DENTISTA",
  "DISTRIBUIDORA",
  "VAREJISTA",
] as const;

export const salesChannelSchema = z.enum(SALES_CHANNELS);

/** Edição inline de uma faixa de preço (pricing_tiers). */
export const pricingTierSchema = z.object({
  product_id: z.string().uuid(),
  channel: salesChannelSchema,
  min_qty: z.coerce.number().int().min(1, "Quantidade mínima 1"),
  unit_price: z.coerce.number().min(0, "Preço não pode ser negativo"),
});

export type PricingTierFormData = z.infer<typeof pricingTierSchema>;

/** Desconto por volume (pricing_volume_discounts). */
export const volumeDiscountSchema = z.object({
  channel: salesChannelSchema,
  min_order_value: z.coerce.number().min(0, "Valor não pode ser negativo"),
  discount_pct: z.coerce
    .number()
    .min(0, "Mínimo 0%")
    .max(100, "Máximo 100%"),
  is_active: z.boolean().default(true),
});

export type VolumeDiscountFormData = z.infer<typeof volumeDiscountSchema>;

/** Configurações gerais (pricing_settings — singleton). */
export const pricingSettingsSchema = z.object({
  avista_discount_pct: z.coerce
    .number()
    .min(0, "Mínimo 0%")
    .max(100, "Máximo 100%"),
  min_order_distribuidora: z.coerce.number().min(0, "Valor não pode ser negativo"),
  min_order_varejista: z.coerce.number().min(0, "Valor não pode ser negativo"),
  valid_until: z
    .preprocess(
      (val) => (val === "" || val === null || val === undefined ? null : val),
      z.string().nullable()
    )
    .nullable()
    .optional(),
});

export type PricingSettingsFormData = z.infer<typeof pricingSettingsSchema>;

// ============================================
// NEW ORDER (Wizard 3 passos)
// ============================================

export const newOrderItemSchema = z.object({
  product_id: z.string().uuid(),
  product_name: z.string().min(1),
  quantity: z.number().int().min(1, "Mínimo 1 unidade"),
  colors: z.array(z.string()).min(1, "Selecione pelo menos 1 cor"),
  custom_color: z.string().nullable().optional(),
});

export const newOrderSchema = z.object({
  client_id: z.string().uuid("Selecione um cliente"),
  client_name: z.string().min(1),
  items: z
    .array(newOrderItemSchema)
    .min(1, "Adicione pelo menos 1 produto"),
  personalization_notes: z.string().optional(),
  logo_file: z.any().optional(),
  priority: z.enum(["NORMAL", "ALTA"]).default("NORMAL"),
});

export type NewOrderFormData = z.infer<typeof newOrderSchema>;

// ============================================
// PUBLIC QUOTE (Wizard)
// ============================================

export const quoteRegisterSchema = z.object({
  nome: z.string().min(2, "Nome deve ter pelo menos 2 caracteres"),
  email: z.string().email("E-mail inválido"),
  telefone: z.string().min(10, "Telefone inválido"),
  whatsapp: z.string().optional(),
  cpf_cnpj: z.string().optional(),
  cidade: z.string().min(2, "Cidade é obrigatória"),
  estado: z.string().min(2, "Estado é obrigatório"),
  cep: z.string().min(8, "CEP inválido"),
  rua: z.string().min(2, "Rua é obrigatória"),
  numero: z.string().min(1, "Número é obrigatório"),
  bairro: z.string().min(2, "Bairro é obrigatório"),
});

export type QuoteRegisterFormData = z.infer<typeof quoteRegisterSchema>;

export const quotePersonalizationSchema = z.object({
  cor_impressao: z.string().optional(),
  notas_especiais: z.string().optional(),
  redes_sociais: z.string().optional(),
});

export type QuotePersonalizationFormData = z.infer<typeof quotePersonalizationSchema>;

// ============================================
// CONGRESSOS (edições de evento)
// ============================================

const emptyToNull = (v: unknown) =>
  v === "" || v === null || v === undefined ? null : v;

export const eventEditionSchema = z
  .object({
    name: z.string().min(2, "Nome deve ter pelo menos 2 caracteres"),
    slug: z
      .string()
      .min(2, "Slug deve ter pelo menos 2 caracteres")
      .regex(/^[a-z0-9-]+$/, "Use apenas minúsculas, números e hífen"),
    location: z.string().nullable().optional(),
    starts_at: z
      .preprocess(emptyToNull, z.string().nullable())
      .nullable()
      .optional(),
    ends_at: z
      .preprocess(emptyToNull, z.string().nullable())
      .nullable()
      .optional(),
    is_active: z.boolean().default(false),
    gift_name: z.string().nullable().optional(),
    gift_stock: z
      .preprocess(emptyToNull, z.coerce.number().int().nonnegative().nullable())
      .optional(),
    cashback_enabled: z.boolean().default(false),
    cashback_type: z.enum(["PERCENT", "FIXED"]).nullable().optional(),
    cashback_value: z
      .preprocess(emptyToNull, z.coerce.number().nonnegative().nullable())
      .optional(),
    cashback_min_order_value: z
      .preprocess(emptyToNull, z.coerce.number().nonnegative().nullable())
      .optional(),
    cashback_min_order_qty: z
      .preprocess(emptyToNull, z.coerce.number().int().nonnegative().nullable())
      .optional(),
    cashback_eligibility: z.enum(["ALL", "NEW_ONLY"]).nullable().optional(),
    cashback_valid_days: z
      .preprocess(emptyToNull, z.coerce.number().int().positive().nullable())
      .optional(),
  })
  .superRefine((data, ctx) => {
    if (!data.cashback_enabled) return;
    if (!data.cashback_type) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["cashback_type"],
        message: "Selecione o tipo de cashback",
      });
    }
    if (data.cashback_value === null || data.cashback_value === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["cashback_value"],
        message: "Informe o valor do cashback",
      });
    }
    if (
      data.cashback_type === "PERCENT" &&
      typeof data.cashback_value === "number" &&
      data.cashback_value > 100
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["cashback_value"],
        message: "Percentual não pode passar de 100",
      });
    }
    if (!data.cashback_eligibility) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["cashback_eligibility"],
        message: "Selecione a elegibilidade",
      });
    }
    if (
      data.cashback_valid_days === null ||
      data.cashback_valid_days === undefined
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["cashback_valid_days"],
        message: "Informe a validade (dias)",
      });
    }
  });

export type EventEditionFormData = z.infer<typeof eventEditionSchema>;
