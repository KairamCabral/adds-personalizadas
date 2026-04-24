import { createClient } from "@/lib/supabase/client";
import {
  endOfDay,
  endOfMonth,
  endOfYear,
  format,
  isSameDay,
  parseISO,
  startOfDay,
  startOfMonth,
  startOfYear,
  subDays,
} from "date-fns";
import { fromZonedTime, toZonedTime } from "date-fns-tz";
import { ptBR } from "date-fns/locale";

const TIMEZONE = "America/Sao_Paulo";

// ============================================
// PERIOD
// ============================================

export type PeriodValue = "hoje" | "7d" | "30d" | "90d" | "ano";
export type PeriodRange = { from: string; to: string };

/**
 * Limites de período no fuso de São Paulo, serializados em ISO (UTC) para a RPC.
 */
export function getPeriodRange(period: PeriodValue): PeriodRange {
  const now = new Date();
  const nowInZone = toZonedTime(now, TIMEZONE);

  let fromLocal: Date;
  let toLocal: Date;

  switch (period) {
    case "hoje":
      fromLocal = startOfDay(nowInZone);
      toLocal = endOfDay(nowInZone);
      break;
    case "7d":
      fromLocal = startOfDay(subDays(nowInZone, 6));
      toLocal = endOfDay(nowInZone);
      break;
    case "90d":
      fromLocal = startOfDay(subDays(nowInZone, 89));
      toLocal = endOfDay(nowInZone);
      break;
    case "ano":
      fromLocal = startOfYear(nowInZone);
      toLocal = endOfYear(nowInZone);
      break;
    case "30d":
    default:
      fromLocal = startOfDay(subDays(nowInZone, 29));
      toLocal = endOfDay(nowInZone);
      break;
  }

  return {
    from: fromZonedTime(fromLocal, TIMEZONE).toISOString(),
    to: fromZonedTime(toLocal, TIMEZONE).toISOString(),
  };
}

export function formatPeriodLabel(range: PeriodRange): string {
  const fromZ = toZonedTime(parseISO(range.from), TIMEZONE);
  const toZ = toZonedTime(parseISO(range.to), TIMEZONE);
  if (isSameDay(fromZ, toZ)) {
    return format(fromZ, "dd/MM/yyyy", { locale: ptBR });
  }
  const sameYear = fromZ.getFullYear() === toZ.getFullYear();
  if (sameYear) {
    return `${format(fromZ, "dd/MM", { locale: ptBR })} - ${format(toZ, "dd/MM/yyyy", { locale: ptBR })}`;
  }
  return `${format(fromZ, "dd/MM/yyyy", { locale: ptBR })} - ${format(toZ, "dd/MM/yyyy", { locale: ptBR })}`;
}

/** Intervalo de datas (ex.: mês / personalizado) ancorado em 00:00 e 23:59:59 no fuso de São Paulo. */
export function formatRangeFromDates(from: Date, to: Date): PeriodRange {
  const fromZ = toZonedTime(from, TIMEZONE);
  const toZ = toZonedTime(to, TIMEZONE);
  return {
    from: fromZonedTime(startOfDay(fromZ), TIMEZONE).toISOString(),
    to: fromZonedTime(endOfDay(toZ), TIMEZONE).toISOString(),
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
  /** ISO ou null quando ausente (RPC pedidos parados atrasados / no prazo) */
  dueDate?: string | null;
}

export interface PedidoCanceladoRecente {
  id: string;
  title: string;
  status: string;
  canceladoEm: string;
  diasDesdeCancelamento: number;
}

/** Resposta bruta do RPC (campos opcionais para compat com versões antigas) */
type DashboardRpcRow = Partial<DashboardCrmData> & {
  pedidosConcluidos?: number;
  pedidosConcluidosPrev?: number;
  pedidosCancelados?: number;
  pedidosCanceladosPrev?: number;
  pedidosParadosAtrasados?: PedidoParado[];
  pedidosParadosNoPrazo?: PedidoParado[];
  pedidosCanceladosRecentes?: PedidoCanceladoRecente[];
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
  pedidosExcluidos: number;
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
  pedidosCanceladosRecentes?: PedidoCanceladoRecente[];
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
    pedidosExcluidos: r?.pedidosExcluidos ?? 0,
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
