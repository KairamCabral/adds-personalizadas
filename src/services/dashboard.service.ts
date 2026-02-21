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

// ============================================
// DASHBOARD CRM UNIFICADO
// ============================================

export interface TempoPorEtapa {
  etapa: string;
  mediaHoras: number;
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

export interface DashboardCrmData {
  totalClientes: number;
  novosClientes: number;
  pedidosAtivos: number;
  pedidosAtrasados: number;
  pedidosCriados: number;
  pedidosFinalizados: number;
  pedidosArquivados: number;
  taxaConclusao: number;
  tempoMedioTotal: { mediaHoras: number; pedidos: number };
  tempoPorEtapa: TempoPorEtapa[];
  funil: {
    fazerAprovacao: number;
    producao: number;
    expedicao: number;
    finalizado: number;
  };
  porStatus: PorStatusItem[];
  porResponsavel: PorResponsavelItem[];
  topClientes: TopCliente[];
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

  const r = data as DashboardCrmData | null;

  return {
    totalClientes: r?.totalClientes ?? 0,
    novosClientes: r?.novosClientes ?? 0,
    pedidosAtivos: r?.pedidosAtivos ?? 0,
    pedidosAtrasados: r?.pedidosAtrasados ?? 0,
    pedidosCriados: r?.pedidosCriados ?? 0,
    pedidosFinalizados: r?.pedidosFinalizados ?? 0,
    pedidosArquivados: r?.pedidosArquivados ?? 0,
    taxaConclusao: Number(r?.taxaConclusao ?? 0),
    tempoMedioTotal: r?.tempoMedioTotal ?? { mediaHoras: 0, pedidos: 0 },
    tempoPorEtapa: r?.tempoPorEtapa ?? [],
    funil: r?.funil ?? {
      fazerAprovacao: 0,
      producao: 0,
      expedicao: 0,
      finalizado: 0,
    },
    porStatus: r?.porStatus ?? [],
    porResponsavel: r?.porResponsavel ?? [],
    topClientes: r?.topClientes ?? [],
  };
}
