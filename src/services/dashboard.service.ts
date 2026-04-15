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

export function formatPeriodLabel(range: PeriodRange): string {
  const fromDate = parseISO(range.from);
  const toDate = parseISO(range.to);
  const sameYear = fromDate.getFullYear() === toDate.getFullYear();
  const sameDay = range.from === range.to;
  if (sameDay) {
    return format(fromDate, "dd/MM/yyyy", { locale: ptBR });
  }
  if (sameYear) {
    return `${format(fromDate, "dd/MM", { locale: ptBR })} - ${format(toDate, "dd/MM/yyyy", { locale: ptBR })}`;
  }
  return `${format(fromDate, "dd/MM/yyyy", { locale: ptBR })} - ${format(toDate, "dd/MM/yyyy", { locale: ptBR })}`;
}

/** Converte range de datas para PeriodRange (ISO strings) */
export function formatRangeFromDates(from: Date, to: Date): PeriodRange {
  return {
    from: from.toISOString(),
    to: to.toISOString(),
  };
}

// ============================================
// DASHBOARD CRM UNIFICADO
// ============================================

export interface TempoPorEtapa {
  etapa: string;
  mediaHoras: number;
  medianaHoras?: number;
  minHoras?: number;
  maxHoras?: number;
  pedidos: number;
  isBottleneck: boolean;
}

export interface TopCliente {
  id: string;
  nome: string;
  empresa: string | null;
  totalPedidos: number;
}

export interface PorStatusItem {
  status: string;
  quantidade: number;
}

export interface PorResponsavelItem {
  nome: string;
  quantidade: number;
}

export interface FunilItem {
  etapa: string;
  quantidade: number;
  ordem: number;
}

export interface TendenciaItem {
  mes: string;
  mesLabel: string;
  criados: number;
  finalizados: number;
}

export interface PedidoParado {
  id: string;
  title: string;
  status: string;
  diasParado: number;
}

/** Resposta bruta do RPC (campos opcionais para compat com versões antigas) */
type DashboardRpcRow = Partial<DashboardCrmData> & {
  pedidosConcluidos?: number;
  pedidosConcluidosPrev?: number;
  pedidosCancelados?: number;
  pedidosCanceladosPrev?: number;
  pedidosParadosAtrasados?: PedidoParado[];
  pedidosParadosNoPrazo?: PedidoParado[];
  pedidosCanceladosRecentes?: PedidoParado[];
};

export interface DashboardCrmData {
  totalClientes: number;
  novosClientes: number;
  novosClientesPrev?: number;
  pedidosAtivos: number;
  pedidosAtrasados: number;
  pedidosCriados: number;
  pedidosCriadosPrev?: number;

  pedidosConcluidos: number;
  pedidosConcluidosPrev?: number;

  pedidosCancelados: number;
  pedidosCanceladosPrev?: number;

  /** Alias de pedidosConcluidos (retrocompat) */
  pedidosFinalizados: number;
  pedidosFinalizadosPrev?: number;

  pedidosArquivados: number;
  taxaConclusao: number;
  tempoMedioTotal: { mediaHoras: number; pedidos: number };
  tempoPorEtapa: TempoPorEtapa[];
  funil: FunilItem[];
  porStatus: PorStatusItem[];
  porResponsavel: PorResponsavelItem[];
  topClientes: TopCliente[];
  tendencia?: TendenciaItem[];

  pedidosParados?: PedidoParado[];
  pedidosParadosAtrasados?: PedidoParado[];
  pedidosParadosNoPrazo?: PedidoParado[];
  pedidosCanceladosRecentes?: PedidoParado[];
}

export async function getDashboardCrmData(
  range: PeriodRange
): Promise<DashboardCrmData> {
  const supabase = createClient();

  const { data, error } = await supabase.rpc("get_dashboard_crm", {
    p_from: range.from,
    p_to: range.to,
  });

  if (error) throw error;

  const r = data as DashboardRpcRow | null;

  const pedidosConcluidos =
    r?.pedidosConcluidos ?? r?.pedidosFinalizados ?? 0;
  const pedidosConcluidosPrev =
    r?.pedidosConcluidosPrev ?? r?.pedidosFinalizadosPrev ?? 0;

  return {
    totalClientes: r?.totalClientes ?? 0,
    novosClientes: r?.novosClientes ?? 0,
    novosClientesPrev: r?.novosClientesPrev ?? 0,
    pedidosAtivos: r?.pedidosAtivos ?? 0,
    pedidosAtrasados: r?.pedidosAtrasados ?? 0,
    pedidosCriados: r?.pedidosCriados ?? 0,
    pedidosCriadosPrev: r?.pedidosCriadosPrev ?? 0,
    pedidosConcluidos,
    pedidosConcluidosPrev,
    pedidosCancelados: r?.pedidosCancelados ?? 0,
    pedidosCanceladosPrev: r?.pedidosCanceladosPrev ?? 0,
    pedidosFinalizados: r?.pedidosFinalizados ?? pedidosConcluidos,
    pedidosFinalizadosPrev: r?.pedidosFinalizadosPrev ?? pedidosConcluidosPrev,
    pedidosArquivados: r?.pedidosArquivados ?? 0,
    taxaConclusao: Number(r?.taxaConclusao ?? 0),
    tempoMedioTotal: r?.tempoMedioTotal ?? { mediaHoras: 0, pedidos: 0 },
    tempoPorEtapa: r?.tempoPorEtapa ?? [],
    funil: r?.funil ?? [],
    porStatus: r?.porStatus ?? [],
    porResponsavel: r?.porResponsavel ?? [],
    topClientes: r?.topClientes ?? [],
    tendencia: r?.tendencia ?? [],
    pedidosParados: r?.pedidosParados ?? [],
    pedidosParadosAtrasados: r?.pedidosParadosAtrasados ?? [],
    pedidosParadosNoPrazo: r?.pedidosParadosNoPrazo ?? [],
    pedidosCanceladosRecentes: r?.pedidosCanceladosRecentes ?? [],
  };
}
