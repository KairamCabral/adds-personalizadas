import { createClient } from "@/lib/supabase/client";
import { format, subDays, startOfDay, startOfYear, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

// ============================================
// PERIOD
// ============================================

export type PeriodValue = "hoje" | "7d" | "30d" | "90d" | "ano";
export type PeriodRange = { from: string; to: string };

export function getPeriodRange(period: PeriodValue): PeriodRange {
  const now = new Date();
  const to = now.toISOString();
  let from: Date;

  switch (period) {
    case "hoje":
      from = startOfDay(now);
      break;
    case "7d":
      from = subDays(now, 7);
      break;
    case "90d":
      from = subDays(now, 90);
      break;
    case "ano":
      from = startOfYear(now);
      break;
    case "30d":
    default:
      from = subDays(now, 30);
  }

  return { from: from.toISOString(), to };
}

// ============================================
// TIPOS COMPARTILHADOS
// ============================================

type OrderWithItems = {
  id: string;
  status: string;
  order_type: string;
  created_at: string;
  due_date: string | null;
  assigned_to: string | null;
  client_id: string | null;
  items: {
    product_id: string | null;
    product_name: string;
    quantity: number;
    total_price: number | null;
  }[];
};

const FINISHED_STATUSES = ["FINALIZADO", "ENTREGUE", "FATURADO"] as const;
const ACTIVE_STATUSES = [
  "FAZER",
  "AJUSTE",
  "APROVACAO",
  "AGUARDANDO_APROVACAO",
  "APROVADO",
  "ARTE_APROVADA",
  "PRODUCAO",
  "EXPEDICAO",
] as const;

// ============================================
// VENDAS
// ============================================

export interface VendasData {
  totalOrders: number;
  finishedOrders: number;
  faturamento: number;
  ticketMedio: number;
  timeSeries: { data: string; vendas: number }[];
  topProdutos: { nome: string; quantidade: number; receita: number }[];
  porTipo: { tipo: string; quantidade: number }[];
}

export async function getVendasData(range: PeriodRange): Promise<VendasData> {
  const supabase = createClient();

  const { data: orders, error } = await supabase
    .from("orders")
    .select(
      "id, status, order_type, created_at, items:order_items(product_id, product_name, quantity, total_price)"
    )
    .gte("created_at", range.from)
    .lte("created_at", range.to);

  if (error) throw error;

  const rows = (orders ?? []) as unknown as OrderWithItems[];
  const totalOrders = rows.length;
  const finishedRows = rows.filter((o) =>
    FINISHED_STATUSES.includes(o.status as (typeof FINISHED_STATUSES)[number])
  );
  const finishedOrders = finishedRows.length;

  const faturamento = finishedRows
    .flatMap((o) => o.items)
    .reduce((sum, item) => sum + (item.total_price ?? 0), 0);

  const ticketMedio = finishedOrders > 0 ? faturamento / finishedOrders : 0;

  // Série temporal (receita agrupada por dia)
  const dayMap = new Map<string, number>();
  for (const order of rows) {
    const day = format(parseISO(order.created_at), "dd/MM", { locale: ptBR });
    const receita = FINISHED_STATUSES.includes(
      order.status as (typeof FINISHED_STATUSES)[number]
    )
      ? order.items.reduce((s, i) => s + (i.total_price ?? 0), 0)
      : 0;
    dayMap.set(day, (dayMap.get(day) ?? 0) + receita);
  }
  const timeSeries = Array.from(dayMap.entries())
    .map(([data, vendas]) => ({ data, vendas }))
    .sort((a, b) => {
      const [da, ma] = a.data.split("/").map(Number);
      const [db, mb] = b.data.split("/").map(Number);
      return mb !== ma ? ma - mb : da - db;
    });

  // Top produtos
  const productMap = new Map<
    string,
    { nome: string; quantidade: number; receita: number }
  >();
  for (const order of rows) {
    for (const item of order.items) {
      const key = item.product_id ?? item.product_name;
      const existing = productMap.get(key) ?? {
        nome: item.product_name,
        quantidade: 0,
        receita: 0,
      };
      productMap.set(key, {
        nome: item.product_name,
        quantidade: existing.quantidade + item.quantity,
        receita: existing.receita + (item.total_price ?? 0),
      });
    }
  }
  const topProdutos = Array.from(productMap.values())
    .sort((a, b) => b.quantidade - a.quantidade)
    .slice(0, 5);

  // Por tipo de pedido
  const tipoMap = new Map<string, number>();
  for (const order of rows) {
    tipoMap.set(order.order_type, (tipoMap.get(order.order_type) ?? 0) + 1);
  }
  const porTipo = Array.from(tipoMap.entries()).map(([tipo, quantidade]) => ({
    tipo,
    quantidade,
  }));

  return { totalOrders, finishedOrders, faturamento, ticketMedio, timeSeries, topProdutos, porTipo };
}

// ============================================
// ESTOQUE
// ============================================

export interface EstoqueItem {
  id: string;
  nome: string;
  estoque: number;
  preco: number | null;
  categoria: string | null;
  vendidoNoPeriodo: number;
  updatedAt: string;
}

export interface EstoqueData {
  totalProdutos: number;
  alertasBaixo: number;
  produtos: EstoqueItem[];
}

export async function getEstoqueData(range: PeriodRange): Promise<EstoqueData> {
  const supabase = createClient();

  const [{ data: products }, { data: orderItems }] = await Promise.all([
    supabase
      .from("products")
      .select("id, name, stock, price, category, updated_at")
      .eq("is_active", true)
      .order("name"),
    supabase
      .from("order_items")
      .select("product_id, quantity, order:orders!order_items_order_id_fkey(created_at)")
      .gte("orders.created_at", range.from)
      .lte("orders.created_at", range.to),
  ]);

  // Agrupa vendas por produto no período
  const vendidoMap = new Map<string, number>();
  for (const item of orderItems ?? []) {
    if (!item.product_id) continue;
    const order = (item.order as { created_at: string } | null);
    if (!order) continue;
    if (order.created_at >= range.from && order.created_at <= range.to) {
      vendidoMap.set(
        item.product_id,
        (vendidoMap.get(item.product_id) ?? 0) + item.quantity
      );
    }
  }

  const produtos: EstoqueItem[] = (products ?? []).map((p) => ({
    id: p.id,
    nome: p.name,
    estoque: p.stock ?? 0,
    preco: p.price,
    categoria: p.category,
    vendidoNoPeriodo: vendidoMap.get(p.id) ?? 0,
    updatedAt: p.updated_at,
  }));

  const alertasBaixo = produtos.filter((p) => p.estoque < 50).length;

  return {
    totalProdutos: produtos.length,
    alertasBaixo,
    produtos,
  };
}

// ============================================
// CLIENTES
// ============================================

export interface ClienteTop {
  id: string;
  nome: string;
  empresa: string | null;
  totalPedidos: number;
}

export interface ClientePorEstado {
  estado: string;
  quantidade: number;
}

export interface ClientesData {
  totalClientes: number;
  novosNoPeriodo: number;
  topClientes: ClienteTop[];
  porEstado: ClientePorEstado[];
}

export async function getClientesData(range: PeriodRange): Promise<ClientesData> {
  const supabase = createClient();

  const { data, error } = await supabase.rpc("get_dashboard_clientes_data", {
    p_from: range.from,
    p_to: range.to,
  });

  if (error) throw error;

  const result = data as {
    totalClientes: number;
    novosNoPeriodo: number;
    topClientes: ClienteTop[];
    porEstado: ClientePorEstado[];
  } | null;

  return {
    totalClientes: result?.totalClientes ?? 0,
    novosNoPeriodo: result?.novosNoPeriodo ?? 0,
    topClientes: result?.topClientes ?? [],
    porEstado: result?.porEstado ?? [],
  };
}

// ============================================
// OPERAÇÕES
// ============================================

export interface PorStatusItem {
  status: string;
  label: string;
  quantidade: number;
}

export interface PorResponsavelItem {
  nome: string;
  quantidade: number;
}

export interface ArquivadoPorPeriodoItem {
  periodo: string;
  quantidade: number;
}

export interface OperacoesData {
  totalAtivos: number;
  totalAtrasados: number;
  totalArquivados: number;
  arquivadosPorPeriodo: ArquivadoPorPeriodoItem[];
  porStatus: PorStatusItem[];
  porResponsavel: PorResponsavelItem[];
}

const STATUS_LABELS: Record<string, string> = {
  FAZER: "Fazer",
  AJUSTE: "Ajuste",
  APROVACAO: "Aprovação",
  AGUARDANDO_APROVACAO: "Aguard. Aprov.",
  APROVADO: "Aprovado",
  ARTE_APROVADA: "Arte OK",
  PRODUCAO: "Produção",
  EXPEDICAO: "Expedição",
  FINALIZADO: "Finalizado",
  ENTREGUE: "Entregue",
  FATURADO: "Faturado",
  ARQUIVADO: "Arquivado",
};

export async function getOperacoesData(range: PeriodRange): Promise<OperacoesData> {
  const supabase = createClient();

  const today = new Date().toISOString();

  const [{ data: allOrders }, { data: atrasados }, { data: profiles }, { data: arquivados }] =
    await Promise.all([
      supabase
        .from("orders")
        .select("id, status, assigned_to")
        .gte("created_at", range.from)
        .lte("created_at", range.to)
        .is("archived_at", null),
      supabase
        .from("orders")
        .select("id")
        .lt("due_date", today)
        .not("due_date", "is", null)
        .not("status", "in", "(FINALIZADO,ENTREGUE,FATURADO,ARQUIVADO)")
        .is("archived_at", null),
      supabase
        .from("profiles")
        .select("id, full_name")
        .eq("is_active", true),
      supabase
        .from("orders")
        .select("archived_at")
        .not("archived_at", "is", null)
        .gte("archived_at", range.from)
        .lte("archived_at", range.to),
    ]);

  // Por status
  const statusMap = new Map<string, number>();
  for (const order of allOrders ?? []) {
    statusMap.set(order.status, (statusMap.get(order.status) ?? 0) + 1);
  }

  const porStatus: PorStatusItem[] = Array.from(statusMap.entries())
    .map(([status, quantidade]) => ({
      status,
      label: STATUS_LABELS[status] ?? status,
      quantidade,
    }))
    .sort((a, b) => b.quantidade - a.quantidade);

  // Por responsável
  const profileMap = new Map<string, string>(
    (profiles ?? []).map((p) => [p.id, p.full_name])
  );
  const responsavelMap = new Map<string, number>();
  for (const order of allOrders ?? []) {
    const nome = order.assigned_to
      ? (profileMap.get(order.assigned_to) ?? "Desconhecido")
      : "Sem responsável";
    responsavelMap.set(nome, (responsavelMap.get(nome) ?? 0) + 1);
  }

  const porResponsavel: PorResponsavelItem[] = Array.from(
    responsavelMap.entries()
  )
    .map(([nome, quantidade]) => ({ nome, quantidade }))
    .sort((a, b) => b.quantidade - a.quantidade);

  const totalAtivos = (allOrders ?? []).filter((o) =>
    ACTIVE_STATUSES.includes(o.status as (typeof ACTIVE_STATUSES)[number])
  ).length;

  // Arquivados por período (agrupa por mês)
  const arquivadosPorPeriodoMap = new Map<string, { quantidade: number; sortKey: string }>();
  for (const o of arquivados ?? []) {
    const archivedAt = (o as { archived_at: string }).archived_at;
    if (!archivedAt) continue;
    const d = parseISO(archivedAt);
    const periodo = format(d, "MMM/yyyy", { locale: ptBR });
    const sortKey = format(d, "yyyy-MM");
    const prev = arquivadosPorPeriodoMap.get(periodo);
    if (prev) {
      prev.quantidade++;
    } else {
      arquivadosPorPeriodoMap.set(periodo, { quantidade: 1, sortKey });
    }
  }
  const arquivadosPorPeriodo: ArquivadoPorPeriodoItem[] = Array.from(
    arquivadosPorPeriodoMap.entries()
  )
    .map(([periodo, { quantidade }]) => ({ periodo, quantidade }))
    .sort((a, b) => {
      const sortA = arquivadosPorPeriodoMap.get(a.periodo)?.sortKey ?? "";
      const sortB = arquivadosPorPeriodoMap.get(b.periodo)?.sortKey ?? "";
      return sortB.localeCompare(sortA);
    });

  return {
    totalAtivos,
    totalAtrasados: atrasados?.length ?? 0,
    totalArquivados: arquivados?.length ?? 0,
    arquivadosPorPeriodo,
    porStatus,
    porResponsavel,
  };
}

// ============================================
// OPERAÇÕES - PERSONALIZADAS
// ============================================

export interface OperacoesPersonalizadasData {
  totalPersonalizadas: number;
  personalizadasAtivas: number;
  personalizadasAtrasadas: number;
  personalizadasEntregues: number;
  taxaEntrega: number;
  porStatus: PorStatusItem[];
  porCategoria: { categoria: string; quantidade: number }[];
  porProduto: { nome: string; quantidade: number }[];
  coresMaisUsadas: { cor: string; quantidade: number }[];
  funilPipeline: { etapa: string; quantidade: number }[];
  porResponsavel: PorResponsavelItem[];
  totalArquivados: number;
  arquivadosPorPeriodo: ArquivadoPorPeriodoItem[];
}

const FUNIL_ETAPAS: { statuses: string[]; label: string }[] = [
  { statuses: ["FAZER", "AJUSTE", "APROVACAO", "AGUARDANDO_APROVACAO", "APROVADO", "ARTE_APROVADA"], label: "Fazer / Aprovação" },
  { statuses: ["PRODUCAO"], label: "Produção" },
  { statuses: ["EXPEDICAO"], label: "Expedição" },
  { statuses: ["FINALIZADO", "ENTREGUE", "FATURADO"], label: "Entregue" },
];

export async function getOperacoesPersonalizadasData(
  range: PeriodRange
): Promise<OperacoesPersonalizadasData> {
  const supabase = createClient();
  const today = new Date().toISOString();

  const [
    { data: orders },
    { data: atrasados },
    { data: profiles },
    { data: arquivados },
  ] = await Promise.all([
    supabase
      .from("orders")
      .select("id, status, assigned_to, created_at, due_date")
      .eq("order_type", "PERSONALIZADO")
      .is("tiny_order_id", null)
      .gte("created_at", range.from)
      .lte("created_at", range.to)
      .is("archived_at", null),
    supabase
      .from("orders")
      .select("id")
      .eq("order_type", "PERSONALIZADO")
      .is("tiny_order_id", null)
      .lt("due_date", today)
      .not("due_date", "is", null)
      .not("status", "in", "(FINALIZADO,ENTREGUE,FATURADO,ARQUIVADO)")
      .is("archived_at", null),
    supabase
      .from("profiles")
      .select("id, full_name")
      .eq("is_active", true),
    supabase
      .from("orders")
      .select("archived_at")
      .eq("order_type", "PERSONALIZADO")
      .is("tiny_order_id", null)
      .not("archived_at", "is", null)
      .gte("archived_at", range.from)
      .lte("archived_at", range.to),
  ]);

  const orderIds = (orders ?? []).map((o) => o.id);
  let orderItemsFiltered: { product_id?: string; product_name?: string; personalization?: { colors?: string[]; custom_color?: string | null }; product?: { category?: string | null } | null }[] = [];

  if (orderIds.length > 0) {
    const BATCH_SIZE = 100;
    const batches: string[][] = [];
    for (let i = 0; i < orderIds.length; i += BATCH_SIZE) {
      batches.push(orderIds.slice(i, i + BATCH_SIZE));
    }
    const allItems: typeof orderItemsFiltered = [];
    for (const batch of batches) {
      const { data: batchItems } = await supabase
        .from("order_items")
        .select("product_id, product_name, personalization, product:products(category)")
        .in("order_id", batch);
      allItems.push(...((batchItems ?? []) as typeof orderItemsFiltered));
    }
    orderItemsFiltered = allItems;
  }

  const totalPersonalizadas = orders?.length ?? 0;
  const personalizadasAtivas = (orders ?? []).filter((o) =>
    ACTIVE_STATUSES.includes(o.status as (typeof ACTIVE_STATUSES)[number])
  ).length;
  const personalizadasEntregues = (orders ?? []).filter(
    (o) => o.status === "ENTREGUE"
  ).length;
  const taxaEntrega =
    totalPersonalizadas > 0
      ? (personalizadasEntregues / totalPersonalizadas) * 100
      : 0;

  const statusMap = new Map<string, number>();
  for (const o of orders ?? []) {
    statusMap.set(o.status, (statusMap.get(o.status) ?? 0) + 1);
  }
  const porStatus: PorStatusItem[] = Array.from(statusMap.entries())
    .map(([status, quantidade]) => ({
      status,
      label: STATUS_LABELS[status] ?? status,
      quantidade,
    }))
    .sort((a, b) => b.quantidade - a.quantidade);

  const profileMap = new Map<string, string>(
    (profiles ?? []).map((p) => [p.id, p.full_name])
  );
  const responsavelMap = new Map<string, number>();
  for (const o of orders ?? []) {
    const nome = o.assigned_to
      ? (profileMap.get(o.assigned_to) ?? "Desconhecido")
      : "Sem responsável";
    responsavelMap.set(nome, (responsavelMap.get(nome) ?? 0) + 1);
  }
  const porResponsavel: PorResponsavelItem[] = Array.from(
    responsavelMap.entries()
  )
    .map(([nome, quantidade]) => ({ nome, quantidade }))
    .sort((a, b) => b.quantidade - a.quantidade);

  const categoriaMap = new Map<string, number>();
  const produtoMap = new Map<string, number>();
  const coresMap = new Map<string, number>();

  for (const oi of orderItemsFiltered) {
    const item = oi as {
      product_id?: string;
      product_name?: string;
      personalization?: { colors?: string[]; custom_color?: string | null };
      product?: { category?: string | null } | null;
    };
    const cat = item.product?.category ?? "Sem categoria";
    categoriaMap.set(cat, (categoriaMap.get(cat) ?? 0) + 1);
    const prod = item.product_name ?? "Item";
    produtoMap.set(prod, (produtoMap.get(prod) ?? 0) + 1);

    const pers = item.personalization;
    if (pers) {
      const colors = pers.colors ?? [];
      for (const c of colors) {
        const cor = String(c).trim() || "Sem cor";
        coresMap.set(cor, (coresMap.get(cor) ?? 0) + 1);
      }
      if (pers.custom_color) {
        coresMap.set("Cor customizada", (coresMap.get("Cor customizada") ?? 0) + 1);
      }
    }
  }

  const porCategoria = Array.from(categoriaMap.entries())
    .map(([categoria, quantidade]) => ({ categoria, quantidade }))
    .sort((a, b) => b.quantidade - a.quantidade)
    .slice(0, 10);

  const porProduto = Array.from(produtoMap.entries())
    .map(([nome, quantidade]) => ({ nome, quantidade }))
    .sort((a, b) => b.quantidade - a.quantidade)
    .slice(0, 5);

  const coresMaisUsadas = Array.from(coresMap.entries())
    .map(([cor, quantidade]) => ({ cor, quantidade }))
    .sort((a, b) => b.quantidade - a.quantidade)
    .slice(0, 10);

  const funilMap = new Map<string, number>();
  for (const etapa of FUNIL_ETAPAS) {
    const qtd = (orders ?? []).filter((o) =>
      etapa.statuses.includes(o.status)
    ).length;
    funilMap.set(etapa.label, qtd);
  }
  const funilPipeline = FUNIL_ETAPAS.map((e) => ({
    etapa: e.label,
    quantidade: funilMap.get(e.label) ?? 0,
  }));

  const arquivadosPorPeriodoMap = new Map<string, { quantidade: number; sortKey: string }>();
  for (const o of arquivados ?? []) {
    const archivedAt = (o as { archived_at: string }).archived_at;
    if (!archivedAt) continue;
    const d = parseISO(archivedAt);
    const periodo = format(d, "MMM/yyyy", { locale: ptBR });
    const sortKey = format(d, "yyyy-MM");
    const prev = arquivadosPorPeriodoMap.get(periodo);
    if (prev) {
      prev.quantidade++;
    } else {
      arquivadosPorPeriodoMap.set(periodo, { quantidade: 1, sortKey });
    }
  }
  const arquivadosPorPeriodo: ArquivadoPorPeriodoItem[] = Array.from(
    arquivadosPorPeriodoMap.entries()
  )
    .map(([periodo, { quantidade }]) => ({ periodo, quantidade }))
    .sort((a, b) => {
      const sortA = arquivadosPorPeriodoMap.get(a.periodo)?.sortKey ?? "";
      const sortB = arquivadosPorPeriodoMap.get(b.periodo)?.sortKey ?? "";
      return sortB.localeCompare(sortA);
    });

  return {
    totalPersonalizadas,
    personalizadasAtivas,
    personalizadasAtrasadas: atrasados?.length ?? 0,
    personalizadasEntregues,
    taxaEntrega,
    porStatus,
    porCategoria,
    porProduto,
    coresMaisUsadas,
    funilPipeline,
    porResponsavel,
    totalArquivados: arquivados?.length ?? 0,
    arquivadosPorPeriodo,
  };
}

// ============================================
// MARKETING
// ============================================

export interface MarketingData {
  pedidosPromocionais: number;
  orcamentosRecebidos: number;
  orcamentosAprovados: number;
  taxaConversao: number;
  orcamentosPorStatus: { status: string; quantidade: number }[];
}

export async function getMarketingData(range: PeriodRange): Promise<MarketingData> {
  const supabase = createClient();

  const [{ data: promo }, { data: quotes }] = await Promise.all([
    supabase
      .from("orders")
      .select("id")
      .eq("order_type", "PROMOCIONAL")
      .gte("created_at", range.from)
      .lte("created_at", range.to),
    supabase
      .from("public_quotes")
      .select("id, status")
      .gte("created_at", range.from)
      .lte("created_at", range.to),
  ]);

  const orcamentosRecebidos = quotes?.length ?? 0;
  const orcamentosAprovados = (quotes ?? []).filter(
    (q) => q.status === "APROVADO"
  ).length;
  const taxaConversao =
    orcamentosRecebidos > 0
      ? (orcamentosAprovados / orcamentosRecebidos) * 100
      : 0;

  // Por status dos orçamentos
  const statusMap = new Map<string, number>();
  const STATUS_LABELS_QUOTE: Record<string, string> = {
    PENDENTE: "Pendente",
    CONTACTADO: "Contactado",
    APROVADO: "Aprovado",
    REJEITADO: "Rejeitado",
    CONCLUIDO: "Concluído",
  };
  for (const q of quotes ?? []) {
    const label = STATUS_LABELS_QUOTE[q.status] ?? q.status;
    statusMap.set(label, (statusMap.get(label) ?? 0) + 1);
  }
  const orcamentosPorStatus = Array.from(statusMap.entries()).map(
    ([status, quantidade]) => ({ status, quantidade })
  );

  return {
    pedidosPromocionais: promo?.length ?? 0,
    orcamentosRecebidos,
    orcamentosAprovados,
    taxaConversao,
    orcamentosPorStatus,
  };
}

// ============================================
// FINANCEIRO
// ============================================

export interface FinanceiroData {
  receitaFaturada: number;
  pedidosPagos: number;
  pedidosAguardandoPagamento: number;
  orcamentosPendentesValor: number;
  timeSeries: { data: string; receita: number }[];
}

export async function getFinanceiroData(range: PeriodRange): Promise<FinanceiroData> {
  const supabase = createClient();

  const [
    { data: faturadoOrders },
    { data: labels },
    { data: pendingQuotes },
  ] = await Promise.all([
    supabase
      .from("orders")
      .select("id, created_at, items:order_items(total_price)")
      .eq("status", "FATURADO")
      .gte("created_at", range.from)
      .lte("created_at", range.to),
    supabase
      .from("order_labels")
      .select("label, order_id")
      .in("label", ["PAGO", "AGUARDANDO_PAGAMENTO"])
      .gte("created_at", range.from)
      .lte("created_at", range.to),
    supabase
      .from("public_quotes")
      .select("estimated_value")
      .eq("status", "PENDENTE"),
  ]);

  type FaturadoOrder = {
    id: string;
    created_at: string;
    items: { total_price: number | null }[];
  };

  const faturadoRows = (faturadoOrders ?? []) as unknown as FaturadoOrder[];

  const receitaFaturada = faturadoRows
    .flatMap((o) => o.items)
    .reduce((sum, i) => sum + (i.total_price ?? 0), 0);

  // Série temporal (receita por dia)
  const dayMap = new Map<string, number>();
  for (const order of faturadoRows) {
    const day = format(parseISO(order.created_at), "dd/MM", { locale: ptBR });
    const receita = order.items.reduce((s, i) => s + (i.total_price ?? 0), 0);
    dayMap.set(day, (dayMap.get(day) ?? 0) + receita);
  }
  const timeSeries = Array.from(dayMap.entries())
    .map(([data, receita]) => ({ data, receita }))
    .sort((a, b) => {
      const [da, ma] = a.data.split("/").map(Number);
      const [db, mb] = b.data.split("/").map(Number);
      return mb !== ma ? ma - mb : da - db;
    });

  const pedidosPagos = (labels ?? []).filter((l) => l.label === "PAGO").length;
  const pedidosAguardandoPagamento = (labels ?? []).filter(
    (l) => l.label === "AGUARDANDO_PAGAMENTO"
  ).length;

  const orcamentosPendentesValor = (pendingQuotes ?? []).reduce(
    (sum, q) => sum + (q.estimated_value ?? 0),
    0
  );

  return {
    receitaFaturada,
    pedidosPagos,
    pedidosAguardandoPagamento,
    orcamentosPendentesValor,
    timeSeries,
  };
}
