import {
  Clock,
  Pencil,
  Send,
  ThumbsUp,
  Image,
  Factory,
  Package,
  CheckCircle2,
  Truck,
  Receipt,
  Archive,
  Zap,
  Link2,
  type LucideIcon,
} from "lucide-react";

// ============================================
// ORDER STATUS (12 Kanban columns)
// ============================================

export type OrderStatus =
  | "AUTOMATICO"
  | "FAZER"
  | "AJUSTE"
  | "APROVACAO"
  | "LINK_ENVIADO"
  | "CONFIRMACAO"
  | "APROVADO"
  | "PRODUCAO"
  | "EXPEDICAO"
  | "FINALIZADO"
  | "ENTREGUE"
  | "FATURADO"
  | "ARQUIVADO";

export interface StatusConfig {
  key: OrderStatus;
  label: string;
  shortLabel: string;
  icon: LucideIcon;
  color: string;
  bgColor: string;
  borderColor: string;
  dotColor: string;
}

export const ORDER_STATUSES: StatusConfig[] = [
  {
    key: "AUTOMATICO",
    label: "Automático",
    shortLabel: "Auto",
    icon: Zap,
    color: "text-violet-600 dark:text-violet-400",
    bgColor: "bg-violet-50 dark:bg-violet-900/20",
    borderColor: "border-violet-200 dark:border-violet-800",
    dotColor: "bg-violet-500",
  },
  {
    key: "FAZER",
    label: "Fazer",
    shortLabel: "Fazer",
    icon: Clock,
    color: "text-slate-600 dark:text-slate-400",
    bgColor: "bg-slate-100 dark:bg-slate-800/50",
    borderColor: "border-slate-200 dark:border-slate-700",
    dotColor: "bg-slate-400",
  },
  {
    key: "AJUSTE",
    label: "Ajuste",
    shortLabel: "Ajuste",
    icon: Pencil,
    color: "text-amber-600 dark:text-amber-400",
    bgColor: "bg-amber-50 dark:bg-amber-900/20",
    borderColor: "border-amber-200 dark:border-amber-800",
    dotColor: "bg-amber-400",
  },
  {
    key: "APROVACAO",
    label: "Aprovação",
    shortLabel: "Aprovação",
    icon: Send,
    color: "text-sky-600 dark:text-sky-400",
    bgColor: "bg-sky-50 dark:bg-sky-900/20",
    borderColor: "border-sky-200 dark:border-sky-800",
    dotColor: "bg-sky-400",
  },
  {
    key: "LINK_ENVIADO",
    label: "Link enviado",
    shortLabel: "Link enviado",
    icon: Link2,
    color: "text-blue-600 dark:text-blue-400",
    bgColor: "bg-blue-50 dark:bg-blue-900/20",
    borderColor: "border-blue-200 dark:border-blue-800",
    dotColor: "bg-blue-500",
  },
  {
    key: "CONFIRMACAO",
    label: "Confirmação",
    shortLabel: "Confirmação",
    icon: ThumbsUp,
    color: "text-emerald-600 dark:text-emerald-400",
    bgColor: "bg-emerald-50 dark:bg-emerald-900/20",
    borderColor: "border-emerald-200 dark:border-emerald-800",
    dotColor: "bg-emerald-400",
  },
  {
    key: "APROVADO",
    label: "Aprovado",
    shortLabel: "Aprovado",
    icon: Image,
    color: "text-green-600 dark:text-green-400",
    bgColor: "bg-green-50 dark:bg-green-900/20",
    borderColor: "border-green-200 dark:border-green-800",
    dotColor: "bg-green-500",
  },
  {
    key: "PRODUCAO",
    label: "Produção",
    shortLabel: "Produção",
    icon: Factory,
    color: "text-orange-600 dark:text-orange-400",
    bgColor: "bg-orange-50 dark:bg-orange-900/20",
    borderColor: "border-orange-200 dark:border-orange-800",
    dotColor: "bg-orange-400",
  },
  {
    key: "EXPEDICAO",
    label: "Expedição",
    shortLabel: "Expedição",
    icon: Package,
    color: "text-amber-700 dark:text-amber-300",
    bgColor: "bg-amber-50 dark:bg-amber-900/20",
    borderColor: "border-amber-200 dark:border-amber-800",
    dotColor: "bg-amber-500",
  },
  {
    key: "FINALIZADO",
    label: "Finalizado",
    shortLabel: "Finalizado",
    icon: CheckCircle2,
    color: "text-cyan-600 dark:text-cyan-400",
    bgColor: "bg-cyan-50 dark:bg-cyan-900/20",
    borderColor: "border-cyan-200 dark:border-cyan-800",
    dotColor: "bg-cyan-500",
  },
  {
    key: "ENTREGUE",
    label: "Entregue",
    shortLabel: "Entregue",
    icon: Truck,
    color: "text-teal-600 dark:text-teal-400",
    bgColor: "bg-teal-50 dark:bg-teal-900/20",
    borderColor: "border-teal-200 dark:border-teal-800",
    dotColor: "bg-teal-500",
  },
  {
    key: "FATURADO",
    label: "Faturado",
    shortLabel: "Faturado",
    icon: Receipt,
    color: "text-blue-700 dark:text-blue-300",
    bgColor: "bg-blue-50 dark:bg-blue-900/20",
    borderColor: "border-blue-200 dark:border-blue-800",
    dotColor: "bg-blue-500",
  },
  {
    key: "ARQUIVADO",
    label: "Arquivado",
    shortLabel: "Arquivado",
    icon: Archive,
    color: "text-gray-500 dark:text-gray-400",
    bgColor: "bg-gray-100 dark:bg-gray-800/50",
    borderColor: "border-gray-200 dark:border-gray-700",
    dotColor: "bg-gray-400",
  },
];

export const STATUS_MAP = Object.fromEntries(
  ORDER_STATUSES.map((s) => [s.key, s])
) as Record<OrderStatus, StatusConfig>;

/** Colunas exibidas no kanban (exclui ENTREGUE, FATURADO e ARQUIVADO) */
export const KANBAN_COLUMN_STATUSES = ORDER_STATUSES.filter(
  (s) => s.key !== "ENTREGUE" && s.key !== "FATURADO" && s.key !== "ARQUIVADO"
);

/** Etapas no seletor do pedido: fim de fluxo = FINALIZADO; entregue/faturado = etiquetas */
export const ORDER_STATUS_DROPDOWN = ORDER_STATUSES.filter(
  (s) => s.key !== "ENTREGUE" && s.key !== "FATURADO"
);

// ============================================
// LABELS (incl. ENTREGUE = envio concluído, sem coluna de etapa)
// ============================================

export type LabelType =
  | "BOLETO"
  | "AGUARDANDO_PAGAMENTO"
  | "PEDIDO_CANCELADO"
  | "APROV_AGUARDANDO_PAGAMENTO"
  | "AMOSTRAS"
  | "PAGO"
  | "ORCAMENTO_PUBLICO"
  | "LINK_ENVIADO"
  | "ENTREGUE";

export interface LabelConfig {
  key: LabelType;
  label: string;
  color: string;
  bgColor: string;
  textColor: string;
}

export const LABELS: LabelConfig[] = [
  {
    key: "PAGO",
    label: "Pago",
    color: "#16a34a",
    bgColor: "bg-emerald-500",
    textColor: "text-white",
  },
  {
    key: "BOLETO",
    label: "Boleto",
    color: "#3b82f6",
    bgColor: "bg-blue-500",
    textColor: "text-white",
  },
  {
    key: "AGUARDANDO_PAGAMENTO",
    label: "Aguardando Pagamento",
    color: "#f59e0b",
    bgColor: "bg-amber-500",
    textColor: "text-white",
  },
  {
    key: "APROV_AGUARDANDO_PAGAMENTO",
    label: "Aprovado! Aguardando Pagamento",
    color: "#f97316",
    bgColor: "bg-orange-500",
    textColor: "text-white",
  },
  {
    key: "PEDIDO_CANCELADO",
    label: "Pedido Cancelado",
    color: "#ef4444",
    bgColor: "bg-red-500",
    textColor: "text-white",
  },
  {
    key: "AMOSTRAS",
    label: "Amostras",
    color: "#8b5cf6",
    bgColor: "bg-violet-500",
    textColor: "text-white",
  },
  {
    key: "ORCAMENTO_PUBLICO",
    label: "Orçamento Público",
    color: "#21add6",
    bgColor: "bg-[#21add6]",
    textColor: "text-white",
  },
  {
    key: "LINK_ENVIADO",
    label: "Link enviado",
    color: "#1e40af",
    bgColor: "bg-blue-800",
    textColor: "text-white",
  },
  {
    key: "ENTREGUE",
    label: "Entregue",
    color: "#0f766e",
    bgColor: "bg-teal-600",
    textColor: "text-white",
  },
];

export const LABEL_MAP = Object.fromEntries(
  LABELS.map((l) => [l.key, l])
) as Record<LabelType, LabelConfig>;

// ============================================
// ORDER TYPES
// ============================================

export type OrderType =
  | "USUARIO"
  | "PERSONALIZADO"
  | "RUSH"
  | "PROMOCIONAL"
  | "ORCAMENTO_PUBLICO";

export const ORDER_TYPES: { key: OrderType; label: string }[] = [
  { key: "USUARIO", label: "Usuário" },
  { key: "PERSONALIZADO", label: "Personalizado" },
  { key: "RUSH", label: "Rush" },
  { key: "PROMOCIONAL", label: "Promocional" },
  { key: "ORCAMENTO_PUBLICO", label: "Orçamento Público" },
];

// ============================================
// USER ROLES
// ============================================

export type UserRole = "MASTER" | "GESTOR" | "PRESTADOR";

export const USER_ROLES: { key: UserRole; label: string; description: string }[] = [
  {
    key: "MASTER",
    label: "Master",
    description: "Acesso total ao sistema",
  },
  {
    key: "GESTOR",
    label: "Gestor",
    description: "Gerente operacional",
  },
  {
    key: "PRESTADOR",
    label: "Prestador",
    description: "Colaborador com acesso limitado",
  },
];

// ============================================
// PRIORITY
// ============================================

export const PRIORITIES = [
  { key: "NORMAL" as const, label: "Normal", color: "text-muted-foreground" },
  { key: "ALTA" as const, label: "Alta", color: "text-red-500" },
];

// ============================================
// NAVIGATION
// ============================================

export const NAV_ITEMS = [
  {
    label: "Pipeline",
    href: "/pipeline",
    icon: "Columns3" as const,
    highlight: true,
  },
  {
    label: "Dashboard",
    href: "/dashboard",
    icon: "LayoutDashboard" as const,
    highlight: true,
  },
  {
    label: "Contatos",
    href: "/contacts",
    icon: "Users" as const,
    highlight: true,
  },
  {
    label: "Orçamentos",
    href: "/quotes",
    icon: "FileText" as const,
    highlight: true,
  },
  {
    label: "Tiny ERP",
    href: "/tiny",
    icon: "Link" as const,
    highlight: false,
  },
  {
    label: "Configurações",
    href: "/settings",
    icon: "Settings" as const,
    highlight: false,
  },
];
