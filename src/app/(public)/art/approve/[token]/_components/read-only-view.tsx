"use client";

import { CheckCircle2, AlertTriangle } from "lucide-react";
import { ArtViewer } from "./art-viewer";

interface ReadOnlyViewProps {
  orderTitle: string;
  variations: { id: string; url: string; variationIndex: number }[];
  artworkStatus: string | null;
  approvedBy: string | null;
}

export function ReadOnlyView({
  orderTitle,
  variations,
  artworkStatus,
  approvedBy,
}: ReadOnlyViewProps) {
  const isApproved = artworkStatus === "APROVADA";

  return (
    <div className="animate-in fade-in duration-300 space-y-6">
      <div className="text-center space-y-3">
        <div
          className={`mx-auto flex h-16 w-16 items-center justify-center rounded-full ${
            isApproved ? "bg-emerald-500/10" : "bg-amber-500/10"
          }`}
        >
          {isApproved ? (
            <CheckCircle2 className="h-8 w-8 text-emerald-500" />
          ) : (
            <AlertTriangle className="h-8 w-8 text-amber-500" />
          )}
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

        <div
          className={`inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-medium ${
            isApproved
              ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
              : "bg-amber-500/10 text-amber-600 dark:text-amber-400"
          }`}
        >
          {isApproved ? (
            <>
              <CheckCircle2 className="h-4 w-4" />
              Arte aprovada com sucesso
            </>
          ) : (
            <>
              <AlertTriangle className="h-4 w-4" />
              Aguardando nova versão
            </>
          )}
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
