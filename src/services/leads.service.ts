import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/types/database.types";

export type LeadRow = Database["public"]["Tables"]["leads"]["Row"];
export type LeadStatus = Database["public"]["Enums"]["lead_status"];

/** Lead já cruzado com Contatos. `contact` é null quando ninguém bate. */
export interface LeadWithContact extends LeadRow {
  contact: {
    id: string;
    name: string;
    email: string | null;
    company: string | null;
    city: string | null;
    state: string | null;
    orders_count: number;
  } | null;
}

export type LeadPeriod = "hoje" | "ontem" | "7d" | "30d" | "tudo";

/** Só dígitos — é assim que o telefone é guardado e comparado. */
export function phoneDigits(value: string | null | undefined): string {
  return (value ?? "").replace(/\D/g, "");
}

/** `5548999998888` → `(48) 99999-8888`. Devolve o original se não reconhecer. */
export function formatPhone(value: string): string {
  const d = phoneDigits(value);
  const local = d.startsWith("55") ? d.slice(2) : d;
  if (local.length === 11) return `(${local.slice(0, 2)}) ${local.slice(2, 7)}-${local.slice(7)}`;
  if (local.length === 10) return `(${local.slice(0, 2)}) ${local.slice(2, 6)}-${local.slice(6)}`;
  return value;
}

/** Início do período, em horário local. `null` = sem recorte. */
export function periodStart(period: LeadPeriod, now = new Date()): Date | null {
  const meiaNoite = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  switch (period) {
    case "hoje":
      return meiaNoite;
    case "ontem":
      return new Date(meiaNoite.getTime() - 24 * 60 * 60 * 1000);
    case "7d":
      return new Date(meiaNoite.getTime() - 6 * 24 * 60 * 60 * 1000);
    case "30d":
      return new Date(meiaNoite.getTime() - 29 * 24 * 60 * 60 * 1000);
    default:
      return null;
  }
}

/** "Ontem" é o único período com teto além do piso. */
export function periodEnd(period: LeadPeriod, now = new Date()): Date | null {
  if (period !== "ontem") return null;
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

/**
 * Busca os leads do período e resolve nome/e-mail cruzando com Contatos.
 *
 * O cruzamento acontece NA LEITURA, não na gravação. Isso importa: se o contato
 * for cadastrado depois que o lead entrou, o nome passa a aparecer sozinho na
 * próxima abertura da tela — sem job de sincronização, sem dado velho.
 *
 * Compara pelos últimos 10 dígitos porque o lead chega com DDI (5548…) e o
 * contato pode estar cadastrado sem ele (48…). Comparar a string inteira
 * perderia justamente os casos que mais interessam.
 */
export async function fetchLeads(period: LeadPeriod = "7d"): Promise<LeadWithContact[]> {
  const supabase = createClient();

  let query = supabase.from("leads").select("*").order("created_at", { ascending: false });

  const inicio = periodStart(period);
  if (inicio) query = query.gte("created_at", inicio.toISOString());
  const fim = periodEnd(period);
  if (fim) query = query.lt("created_at", fim.toISOString());

  const { data: leads, error } = await query;
  if (error) throw error;
  if (!leads?.length) return [];

  // Uma consulta para todos os contatos, não uma por lead.
  const sufixos = leads.map((l) => phoneDigits(l.phone).slice(-10)).filter(Boolean);
  const { data: clients } = await supabase
    .from("clients")
    .select("id, name, email, company, city, state, phone")
    .not("phone", "is", null);

  const porSufixo = new Map<string, NonNullable<typeof clients>[number]>();
  for (const c of clients ?? []) {
    const sufixo = phoneDigits(c.phone).slice(-10);
    if (sufixo.length === 10 && sufixos.includes(sufixo)) porSufixo.set(sufixo, c);
  }

  // Quantos pedidos cada contato casado já fez — é o dado que muda a abordagem
  // do atendimento: "lead novo" e "cliente que voltou" pedem conversas diferentes.
  const clientIds = [...porSufixo.values()].map((c) => c.id);
  const pedidosPorCliente = new Map<string, number>();
  if (clientIds.length) {
    const { data: orders } = await supabase
      .from("orders")
      .select("client_id")
      .in("client_id", clientIds)
      .is("deleted_at", null);
    for (const o of orders ?? []) {
      if (!o.client_id) continue;
      pedidosPorCliente.set(o.client_id, (pedidosPorCliente.get(o.client_id) ?? 0) + 1);
    }
  }

  return leads.map((lead) => {
    const c = porSufixo.get(phoneDigits(lead.phone).slice(-10));
    return {
      ...lead,
      contact: c
        ? {
            id: c.id,
            name: c.name,
            email: c.email,
            company: c.company,
            city: c.city,
            state: c.state,
            orders_count: pedidosPorCliente.get(c.id) ?? 0,
          }
        : null,
    };
  });
}

/**
 * Marca contatado / desmarca. Escrever `contacted_at` junto do status mantém os
 * dois sempre coerentes — status sem data impede medir tempo de resposta.
 */
export async function setLeadContacted(id: string, contacted: boolean): Promise<void> {
  const supabase = createClient();
  const { data: sessao } = await supabase.auth.getUser();

  const { error } = await supabase
    .from("leads")
    .update(
      contacted
        ? {
            status: "CONTATADO" as LeadStatus,
            contacted_at: new Date().toISOString(),
            contacted_by: sessao.user?.id ?? null,
          }
        : { status: "NOVO" as LeadStatus, contacted_at: null, contacted_by: null },
    )
    .eq("id", id);

  if (error) throw error;
}

/**
 * Contagem para o badge do menu. Traz só a coluna `status` — o badge precisa de
 * um número, e puxar as linhas inteiras a cada revalidação seria desperdício
 * numa consulta que roda em toda navegação.
 */
export async function getLeadCounts(): Promise<{ NOVO: number; TOTAL: number }> {
  const supabase = createClient();
  const { data, error } = await supabase.from("leads").select("status");
  if (error) throw error;

  return {
    NOVO: (data ?? []).filter((l) => l.status === "NOVO").length,
    TOTAL: data?.length ?? 0,
  };
}

export async function setLeadStatus(id: string, status: LeadStatus): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("leads").update({ status }).eq("id", id);
  if (error) throw error;
}

export async function saveLeadNotes(id: string, notes: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("leads").update({ notes }).eq("id", id);
  if (error) throw error;
}

// ═══════════════════════════════════════════════════════════════════════════
// Métricas
// ═══════════════════════════════════════════════════════════════════════════

export interface LeadMetrics {
  hoje: number;
  ontem: number;
  semContato: number;
  /** Sem contato há mais de 24h — é o número que exige ação. */
  semContatoAtrasados: number;
  taxaContato: number;
  jaSaoClientes: number;
  total: number;
}

export function computeMetrics(leads: LeadWithContact[], now = new Date()): LeadMetrics {
  const meiaNoite = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const ontemInicio = meiaNoite - 24 * 60 * 60 * 1000;
  const limite24h = now.getTime() - 24 * 60 * 60 * 1000;

  let hoje = 0;
  let ontem = 0;
  let semContato = 0;
  let semContatoAtrasados = 0;
  let jaSaoClientes = 0;

  for (const lead of leads) {
    const t = new Date(lead.created_at).getTime();
    if (t >= meiaNoite) hoje++;
    else if (t >= ontemInicio) ontem++;

    if (lead.status === "NOVO") {
      semContato++;
      if (t < limite24h) semContatoAtrasados++;
    }

    if (lead.contact) jaSaoClientes++;
  }

  const trabalhados = leads.filter((l) => l.status !== "NOVO").length;

  return {
    hoje,
    ontem,
    semContato,
    semContatoAtrasados,
    taxaContato: leads.length ? Math.round((trabalhados / leads.length) * 100) : 0,
    jaSaoClientes,
    total: leads.length,
  };
}

export interface DailyPoint {
  dia: string;
  rotulo: string;
  leads: number;
}

/** Série diária contínua — dias sem lead entram como zero, senão a linha mente. */
export function buildDailySeries(leads: LeadWithContact[], dias = 14, now = new Date()): DailyPoint[] {
  const porDia = new Map<string, number>();
  for (const lead of leads) {
    const d = new Date(lead.created_at);
    const chave = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    porDia.set(chave, (porDia.get(chave) ?? 0) + 1);
  }

  const saida: DailyPoint[] = [];
  for (let i = dias - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
    const chave = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    saida.push({
      dia: chave,
      rotulo: `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`,
      leads: porDia.get(chave) ?? 0,
    });
  }
  return saida;
}
