"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { MapPin, ExternalLink, Navigation } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getRepVisits, type RepVisit } from "@/services/representantes.service";

// -------------------------------------------------------
// Config
// -------------------------------------------------------

const PERIOD_OPTIONS = [
  { value: "7", label: "Última semana" },
  { value: "30", label: "Último mês" },
  { value: "90", label: "Últimos 3 meses" },
];

const VISIT_TYPE_LABELS: Record<string, string> = {
  PROSPECCAO: "Prospecção",
  REPOSICAO: "Reposição",
  COBRANCA: "Cobrança",
  VISITA: "Visita",
  FOLLOWUP: "Follow-up",
};

const RESULT_LABELS: Record<string, string> = {
  VENDA: "Venda realizada",
  RETORNO: "Retorno agendado",
  SEM_INTERESSE: "Sem interesse",
  AUSENTE: "Ausente",
  REPOSICAO: "Reposição",
  PROSPECCAO: "Prospecção feita",
};

// -------------------------------------------------------
// Helpers
// -------------------------------------------------------

function formatDateTime(dateStr: string): string {
  return new Date(dateStr).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// -------------------------------------------------------
// Visit item (timeline entry)
// -------------------------------------------------------

function VisitItem({ visit }: { visit: RepVisit }) {
  const hasLocation = visit.latitude !== null && visit.longitude !== null;
  const mapsUrl = hasLocation
    ? `https://www.google.com/maps?q=${visit.latitude},${visit.longitude}`
    : null;

  const typeLabel = visit.visit_type
    ? (VISIT_TYPE_LABELS[visit.visit_type] ?? visit.visit_type)
    : null;
  const resultLabel = visit.result
    ? (RESULT_LABELS[visit.result] ?? visit.result)
    : null;

  return (
    <div className="relative pl-8 pb-7 last:pb-0 group">
      {/* Vertical line */}
      <span className="absolute left-[11px] top-2.5 bottom-0 w-px bg-border group-last:hidden" />
      {/* Dot */}
      <span className="absolute left-1.5 top-1 h-3.5 w-3.5 rounded-full bg-primary/80 border-2 border-background ring-1 ring-primary/30 shadow-sm" />

      <div className="space-y-0.5">
        <div className="flex items-baseline gap-2 flex-wrap">
          <span className="text-sm font-semibold leading-tight">
            {visit.prospect_name ?? "Prospect"}
          </span>
          <span className="text-xs text-muted-foreground tabular-nums">
            {formatDateTime(visit.checked_in_at)}
          </span>
        </div>

        {(typeLabel || resultLabel) && (
          <p className="text-xs text-muted-foreground">
            {[typeLabel, resultLabel].filter(Boolean).join(" → ")}
          </p>
        )}

        {visit.notes && (
          <p className="text-xs text-foreground/75 italic leading-relaxed">
            &ldquo;{visit.notes}&rdquo;
          </p>
        )}

        {(visit.address_detected || hasLocation) && (
          <div className="flex items-center gap-1.5 flex-wrap">
            <MapPin className="h-3 w-3 text-muted-foreground flex-shrink-0" />
            {visit.address_detected && (
              <span className="text-xs text-muted-foreground">{visit.address_detected}</span>
            )}
            {mapsUrl && (
              <a
                href={mapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-0.5 text-xs text-primary hover:underline font-medium"
              >
                <ExternalLink className="h-3 w-3" />
                Ver no mapa
              </a>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// -------------------------------------------------------
// Main component
// -------------------------------------------------------

interface TabVisitasProps {
  repId: string;
  repName: string;
}

export function TabVisitas({ repId, repName }: TabVisitasProps) {
  const [period, setPeriod] = useState("30");

  const { data: visits = [], isLoading } = useQuery({
    queryKey: ["rep-visits", repId, period],
    queryFn: () => getRepVisits(repId, parseInt(period)),
    staleTime: 2 * 60 * 1000,
  });

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-base font-semibold">Visitas de {repName}</h2>
        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PERIOD_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="space-y-5 pl-8">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="space-y-1.5">
              <Skeleton className="h-4 w-56" />
              <Skeleton className="h-3 w-72" />
              <Skeleton className="h-3 w-40" />
            </div>
          ))}
        </div>
      ) : visits.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed bg-muted/30 py-16 text-center">
          <Navigation className="h-8 w-8 text-muted-foreground mb-2" />
          <p className="text-sm font-medium">Nenhuma visita registrada</p>
          <p className="text-xs text-muted-foreground mt-1">
            As visitas são registradas pelo app do representante.
          </p>
        </div>
      ) : (
        <div className="rounded-lg border bg-card p-5">
          {visits.map((visit) => (
            <VisitItem key={visit.id} visit={visit} />
          ))}
        </div>
      )}

      {!isLoading && visits.length > 0 && (
        <p className="text-xs text-muted-foreground text-right">
          {visits.length} visita{visits.length !== 1 ? "s" : ""} (máx. 20 por consulta)
        </p>
      )}
    </div>
  );
}
