"use client";

import { useQuery } from "@tanstack/react-query";
import { Calendar, Users } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { getRepProspects, type RepProspect, type ProspectStatus } from "@/services/representantes.service";
import { cn } from "@/lib/utils";

// -------------------------------------------------------
// Config
// -------------------------------------------------------

const PIPELINE_COLUMNS: Array<{ status: ProspectStatus; label: string }> = [
  { status: "VISITAR", label: "Visitar" },
  { status: "RETORNO", label: "Retorno" },
  { status: "VISITADO", label: "Visitado" },
];

const COLUMN_STYLES: Record<ProspectStatus, { bg: string; header: string }> = {
  VISITAR: {
    bg: "bg-slate-50 border-slate-200 dark:bg-slate-800/40 dark:border-slate-700",
    header: "text-slate-700 dark:text-slate-300",
  },
  RETORNO: {
    bg: "bg-amber-50 border-amber-200 dark:bg-amber-900/20 dark:border-amber-800",
    header: "text-amber-700 dark:text-amber-300",
  },
  VISITADO: {
    bg: "bg-emerald-50 border-emerald-200 dark:bg-emerald-900/20 dark:border-emerald-800",
    header: "text-emerald-700 dark:text-emerald-300",
  },
};

// -------------------------------------------------------
// Helpers
// -------------------------------------------------------

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
  });
}

// -------------------------------------------------------
// Prospect card
// -------------------------------------------------------

function ProspectCard({ prospect }: { prospect: RepProspect }) {
  const location = [prospect.city, prospect.state].filter(Boolean).join("/");

  return (
    <div className="rounded-lg border bg-card p-3 shadow-sm space-y-1">
      <p className="text-sm font-medium leading-snug line-clamp-2">{prospect.name}</p>
      {prospect.segment && (
        <p className="text-xs text-muted-foreground">{prospect.segment}</p>
      )}
      {location && (
        <p className="text-xs text-muted-foreground">{location}</p>
      )}
      {prospect.status === "RETORNO" && prospect.return_date && (
        <div className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400 font-medium">
          <Calendar className="h-3 w-3 flex-shrink-0" />
          <span>Ret: {formatDate(prospect.return_date)}</span>
        </div>
      )}
    </div>
  );
}

// -------------------------------------------------------
// Main component
// -------------------------------------------------------

interface TabProspectsProps {
  repId: string;
  repName: string;
}

export function TabProspects({ repId, repName }: TabProspectsProps) {
  const { data: prospects = [], isLoading } = useQuery({
    queryKey: ["rep-prospects", repId],
    queryFn: () => getRepProspects(repId),
    staleTime: 2 * 60 * 1000,
  });

  const grouped = Object.fromEntries(
    PIPELINE_COLUMNS.map((col) => [
      col.status,
      prospects.filter((p) => p.status === col.status),
    ])
  ) as Record<ProspectStatus, RepProspect[]>;

  return (
    <div className="space-y-4">
      <h2 className="text-base font-semibold">Pipeline de {repName}</h2>

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {PIPELINE_COLUMNS.map((col) => (
            <div key={col.status} className="space-y-3">
              <Skeleton className="h-5 w-20" />
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-[72px] w-full rounded-lg" />
              ))}
            </div>
          ))}
        </div>
      ) : prospects.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed bg-muted/30 py-16 text-center">
          <Users className="h-8 w-8 text-muted-foreground mb-2" />
          <p className="text-sm font-medium">Nenhum prospect ativo</p>
          <p className="text-xs text-muted-foreground mt-1">
            Os prospects são cadastrados pelo app do representante.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {PIPELINE_COLUMNS.map((col) => {
            const items = grouped[col.status] ?? [];
            const styles = COLUMN_STYLES[col.status];

            return (
              <div key={col.status} className="space-y-2">
                <div className="flex items-center gap-2">
                  <h3 className={cn("text-xs font-bold uppercase tracking-wider", styles.header)}>
                    {col.label}
                  </h3>
                  <Badge variant="secondary" className="text-xs h-5 px-1.5">
                    {items.length}
                  </Badge>
                </div>
                <div
                  className={cn(
                    "min-h-[80px] rounded-lg border p-2 space-y-2",
                    styles.bg
                  )}
                >
                  {items.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center pt-4 pb-2">
                      Vazio
                    </p>
                  ) : (
                    items.map((p) => <ProspectCard key={p.id} prospect={p} />)
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {!isLoading && prospects.length > 0 && (
        <p className="text-xs text-muted-foreground text-right">
          {prospects.length} prospect{prospects.length !== 1 ? "s" : ""} ativo{prospects.length !== 1 ? "s" : ""}
          {" · "}visualização somente leitura
        </p>
      )}
    </div>
  );
}
