"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { TooltipProvider } from "@/components/ui/tooltip";
import {
  buildDailySeries,
  computeMetrics,
  fetchLeads,
  setLeadContacted,
  type LeadPeriod,
  type LeadWithContact,
} from "@/services/leads.service";

import { LeadDetailSheet } from "./_components/lead-detail-sheet";
import { LeadsOverview } from "./_components/leads-overview";
import { LeadsTable } from "./_components/leads-table";

/**
 * Filtro por presets em vez de calendário. Um seletor de datas exige três
 * decisões (início, fim, confirmar) para responder a pergunta que o time faz
 * dez vezes por dia: "o que chegou hoje?". Preset resolve em um toque.
 */
const PERIODOS: { valor: LeadPeriod; rotulo: string }[] = [
  { valor: "hoje", rotulo: "Hoje" },
  { valor: "ontem", rotulo: "Ontem" },
  { valor: "7d", rotulo: "7 dias" },
  { valor: "30d", rotulo: "30 dias" },
  { valor: "tudo", rotulo: "Tudo" },
];

type Aba = "pendentes" | "todos";

export default function LeadsPage() {
  const [leads, setLeads] = useState<LeadWithContact[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [periodo, setPeriodo] = useState<LeadPeriod>("7d");
  const [aba, setAba] = useState<Aba>("pendentes");
  const [aberto, setAberto] = useState<LeadWithContact | null>(null);

  const carregar = useCallback(async (p: LeadPeriod) => {
    setCarregando(true);
    try {
      setLeads(await fetchLeads(p));
    } catch (err) {
      console.error("[leads] falha ao carregar", err);
      toast.error("Não foi possível carregar os leads");
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    void carregar(periodo);
  }, [carregar, periodo]);

  // O gráfico sempre mostra 14 dias, independente do filtro da lista: ele
  // responde "como está a captação", não "o que preciso trabalhar agora".
  const [serie, setSerie] = useState(() => buildDailySeries([]));
  useEffect(() => {
    fetchLeads("30d")
      .then((todos) => setSerie(buildDailySeries(todos)))
      .catch(() => {
        /* o gráfico é contexto; falhar nele não pode travar a tela */
      });
  }, [leads.length]);

  const metrics = useMemo(() => computeMetrics(leads), [leads]);

  const visiveis = useMemo(
    () => (aba === "pendentes" ? leads.filter((l) => l.status === "NOVO") : leads),
    [leads, aba],
  );

  const alternarContato = async (lead: LeadWithContact, contatado: boolean) => {
    // Atualização otimista: o check responde na hora. Marcar contato é a ação
    // mais repetida do dia e esperar o servidor a cada clique trava o ritmo.
    const anterior = leads;
    setLeads((atual) =>
      atual.map((l) =>
        l.id === lead.id
          ? { ...l, status: contatado ? "CONTATADO" : "NOVO", contacted_at: contatado ? new Date().toISOString() : null }
          : l,
      ),
    );

    try {
      await setLeadContacted(lead.id, contatado);
    } catch (err) {
      console.error("[leads] falha ao marcar contato", err);
      setLeads(anterior);
      toast.error("Não foi possível salvar. Tente de novo.");
    }
  };

  return (
    <TooltipProvider delayDuration={300}>
      <div className="space-y-5 p-4 md:p-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Leads</h1>
          <p className="text-sm text-muted-foreground">
            Quem deixou o WhatsApp no quiz e ainda não virou pedido
          </p>
        </div>

        {/* Filtros numa linha só, acima do conteúdo que eles controlam. */}
        <div className="flex flex-wrap items-center gap-2">
          {PERIODOS.map((p) => (
            <Button
              key={p.valor}
              size="sm"
              variant={periodo === p.valor ? "default" : "outline"}
              onClick={() => setPeriodo(p.valor)}
            >
              {p.rotulo}
            </Button>
          ))}
        </div>

        {carregando ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-[92px]" />
              ))}
            </div>
            <Skeleton className="h-[220px]" />
            <Skeleton className="h-[260px]" />
          </div>
        ) : (
          <>
            <LeadsOverview metrics={metrics} serie={serie} />

            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant={aba === "pendentes" ? "secondary" : "ghost"}
                onClick={() => setAba("pendentes")}
              >
                Aguardando contato
                <span className="ml-1.5 rounded bg-background/70 px-1.5 text-xs tabular-nums">
                  {metrics.semContato}
                </span>
              </Button>
              <Button
                size="sm"
                variant={aba === "todos" ? "secondary" : "ghost"}
                onClick={() => setAba("todos")}
              >
                Todos
                <span className="ml-1.5 rounded bg-background/70 px-1.5 text-xs tabular-nums">
                  {metrics.total}
                </span>
              </Button>
            </div>

            <LeadsTable
              leads={visiveis}
              onToggleContacted={alternarContato}
              onOpen={setAberto}
            />

            <LeadDetailSheet
              lead={aberto}
              onClose={() => setAberto(null)}
              onChanged={() => void carregar(periodo)}
            />
          </>
        )}
      </div>
    </TooltipProvider>
  );
}
