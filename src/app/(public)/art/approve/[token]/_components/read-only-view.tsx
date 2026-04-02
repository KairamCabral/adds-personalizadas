"use client";

import { CheckCircle2, AlertTriangle, Layers, Check, Pencil } from "lucide-react";
import { ArtViewer } from "./art-viewer";
import { cn } from "@/lib/utils";

interface VariationInfo {
  id: string;
  url: string;
  variationIndex: number;
  label: string | null;
  status: string;
}

interface ReadOnlyViewProps {
  orderTitle: string;
  variations: VariationInfo[];
  artworkStatus: string | null;
  approvedBy: string | null;
  isBundle: boolean;
}

export function ReadOnlyView({
  orderTitle,
  variations,
  artworkStatus,
  approvedBy,
  isBundle,
}: ReadOnlyViewProps) {
  if (isBundle) {
    return <BundleReadOnlyView orderTitle={orderTitle} variations={variations} approvedBy={approvedBy} />;
  }

  const isApproved = artworkStatus === "APROVADA";

  return (
    <div className="animate-in fade-in duration-300 space-y-6">
      <div className="text-center space-y-3">
        <div className={cn(
          "mx-auto flex h-16 w-16 items-center justify-center rounded-full",
          isApproved ? "bg-emerald-500/10" : "bg-amber-500/10"
        )}>
          {isApproved
            ? <CheckCircle2 className="h-8 w-8 text-emerald-500" />
            : <AlertTriangle className="h-8 w-8 text-amber-500" />}
        </div>
        <div>
          <h2 className="text-xl font-bold text-foreground sm:text-2xl">
            {isApproved ? "Arte Aprovada" : "Ajuste Solicitado"}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">{orderTitle}</p>
          {approvedBy && (
            <p className="mt-1 text-xs text-muted-foreground">
              {isApproved ? "Aprovada" : "Ajuste solicitado"} por {approvedBy}
            </p>
          )}
        </div>
        <div className={cn(
          "inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-medium",
          isApproved ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "bg-amber-500/10 text-amber-600 dark:text-amber-400"
        )}>
          {isApproved
            ? <><CheckCircle2 className="h-4 w-4" /> Arte aprovada com sucesso</>
            : <><AlertTriangle className="h-4 w-4" /> Aguardando nova versão</>}
        </div>
      </div>

      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-muted-foreground text-center">
          {variations.length > 1 ? "Artes enviadas" : "Arte enviada"}
        </h3>
        {variations.length === 1 ? (
          <ArtViewer imageUrl={variations[0].url} title="Visualização da arte" />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {variations.map((v) => (
              <ArtViewer
                key={v.id}
                imageUrl={v.url}
                title={`Opção ${v.variationIndex}`}
                variationLabel={`Opção ${v.variationIndex}`}
              />
            ))}
          </div>
        )}
      </div>
      <p className="text-center text-xs text-muted-foreground">
        Este link permanece disponível para visualização por 15 dias.
      </p>
    </div>
  );
}

// Bundle read-only: shows each artwork with its individual status
function BundleReadOnlyView({
  orderTitle,
  variations,
  approvedBy,
}: {
  orderTitle: string;
  variations: VariationInfo[];
  approvedBy: string | null;
}) {
  const approvedCount = variations.filter((v) => v.status === "APROVADA").length;
  const revisionCount = variations.filter((v) => v.status === "AJUSTE_SOLICITADO").length;
  const allApproved = approvedCount === variations.length;

  return (
    <div className="animate-in fade-in duration-300 space-y-6">
      <div className="text-center space-y-3">
        <div className={cn(
          "mx-auto flex h-16 w-16 items-center justify-center rounded-full",
          allApproved ? "bg-emerald-500/10" : "bg-amber-500/10"
        )}>
          {allApproved
            ? <Layers className="h-8 w-8 text-emerald-500" />
            : <Layers className="h-8 w-8 text-amber-500" />}
        </div>
        <div>
          <h2 className="text-xl font-bold text-foreground sm:text-2xl">
            {allApproved ? "Todas as artes aprovadas" : "Lote revisado"}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">{orderTitle}</p>
          {approvedBy && (
            <p className="mt-1 text-xs text-muted-foreground">Revisado por {approvedBy}</p>
          )}
        </div>
        <div className="flex flex-wrap justify-center gap-2">
          {approvedCount > 0 && (
            <span className="flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-1.5 text-sm font-medium text-emerald-600 dark:text-emerald-400">
              <Check className="h-3.5 w-3.5" /> {approvedCount} aprovada{approvedCount !== 1 ? "s" : ""}
            </span>
          )}
          {revisionCount > 0 && (
            <span className="flex items-center gap-1.5 rounded-full bg-amber-500/10 px-3 py-1.5 text-sm font-medium text-amber-600 dark:text-amber-400">
              <Pencil className="h-3.5 w-3.5" /> {revisionCount} com ajuste
            </span>
          )}
        </div>
      </div>

      <div className="space-y-4">
        {variations.map((v, idx) => {
          const isApproved = v.status === "APROVADA";
          const isRevision = v.status === "AJUSTE_SOLICITADO";
          const label = v.label || `Arte ${idx + 1}`;
          return (
            <div key={v.id} className={cn(
              "overflow-hidden rounded-xl border-2",
              isApproved ? "border-emerald-500/30" : isRevision ? "border-amber-500/30" : "border-border"
            )}>
              <div className={cn(
                "flex items-center gap-2 px-4 py-2.5 text-sm font-semibold",
                isApproved ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" :
                isRevision ? "bg-amber-500/10 text-amber-700 dark:text-amber-300" :
                "bg-muted/30 text-muted-foreground"
              )}>
                {isApproved
                  ? <><Check className="h-4 w-4 shrink-0" /> {label} — Aprovada</>
                  : isRevision
                  ? <><Pencil className="h-4 w-4 shrink-0" /> {label} — Ajuste solicitado</>
                  : label}
              </div>
              <div className="p-3">
                <ArtViewer imageUrl={v.url} title={label} variationLabel={label} />
              </div>
            </div>
          );
        })}
      </div>

      <p className="text-center text-xs text-muted-foreground">
        Este link permanece disponível para visualização por 15 dias.
      </p>
    </div>
  );
}
