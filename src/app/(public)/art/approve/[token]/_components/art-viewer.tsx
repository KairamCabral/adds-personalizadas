"use client";

import { useState, useEffect } from "react";
import { FileText, ZoomIn, X, ExternalLink, CheckCircle2 } from "lucide-react";

interface ArtViewerProps {
  imageUrl: string;
  title: string;
  variationLabel?: string;
}

function isPdfUrl(url: string): boolean {
  const lower = url.toLowerCase();
  return lower.endsWith(".pdf") || lower.includes(".pdf?");
}

export function ArtViewer({ imageUrl, title, variationLabel }: ArtViewerProps) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [pdfOpened, setPdfOpened] = useState(false);
  const isPdf = isPdfUrl(imageUrl);

  useEffect(() => {
    if (!isFullscreen) return;
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsFullscreen(false);
    };
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.body.style.overflow = "";
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isFullscreen]);

  if (isPdf) {
    return (
      <div className="space-y-2">
        {variationLabel && (
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-foreground">{variationLabel}</h3>
            {pdfOpened && (
              <span className="flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Visualizado
              </span>
            )}
          </div>
        )}

        {/* Preview inline para desktop via iframe */}
        <div className="hidden lg:block">
          <div className="overflow-hidden rounded-xl border border-border bg-muted/20">
            <div className="relative w-full" style={{ height: 340 }}>
              <iframe
                src={`${imageUrl}#toolbar=0&navpanes=0&scrollbar=0`}
                className="h-full w-full"
                title={variationLabel ?? title}
                onLoad={() => setPdfOpened(true)}
              />
            </div>
            <div className="flex items-center justify-center border-t border-border bg-muted/30 px-4 py-3">
              <a
                href={imageUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setPdfOpened(true)}
                className="flex items-center gap-2 rounded-lg border border-border bg-card px-5 py-2.5 text-sm font-medium text-foreground shadow-sm transition-all hover:border-primary/40 hover:bg-muted hover:shadow-md active:scale-[0.98]"
              >
                <ExternalLink className="h-4 w-4 text-primary" />
                Abrir em tela cheia
              </a>
            </div>
          </div>
        </div>

        {/* Card clicável para mobile */}
        <a
          href={imageUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => setPdfOpened(true)}
          className="flex items-center gap-4 rounded-xl border border-border bg-muted/30 p-4 transition-all hover:bg-muted/50 lg:hidden"
        >
          <div className="relative shrink-0">
            <FileText className="h-10 w-10 text-primary" />
            {pdfOpened && (
              <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500">
                <CheckCircle2 className="h-2.5 w-2.5 text-white" />
              </span>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-foreground">
              {variationLabel ?? "Arquivo PDF"}
            </p>
            <p className="text-xs text-muted-foreground">
              {pdfOpened ? "Aberto — toque para ver novamente" : "Toque para abrir o PDF"}
            </p>
          </div>
          <ExternalLink className="h-4 w-4 shrink-0 text-primary" />
        </a>

        {!pdfOpened && (
          <p className="text-center text-xs text-amber-600 dark:text-amber-400 lg:hidden">
            Abra o PDF antes de tomar sua decisão
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col space-y-2">
      {variationLabel && (
        <h3 className="shrink-0 text-sm font-semibold text-foreground">{variationLabel}</h3>
      )}
      {!variationLabel && (
        <h3 className="shrink-0 text-sm font-medium text-foreground">{title}</h3>
      )}
      <div className="overflow-hidden rounded-xl border border-border bg-muted/30">
        <div
          role="button"
          tabIndex={0}
          onClick={() => setIsFullscreen(true)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              setIsFullscreen(true);
            }
          }}
          className="group relative flex min-h-0 flex-1 cursor-zoom-in transition-all"
        >
          <div className="relative flex min-h-[180px] flex-1 items-center justify-center sm:min-h-[220px] lg:aspect-video lg:min-h-0">
            <img
              src={imageUrl}
              alt={variationLabel ?? title}
              className="max-h-[35vh] w-full object-contain transition-transform duration-300 group-hover:scale-[1.01] sm:max-h-[40vh] lg:max-h-none lg:h-full"
            />
          </div>
        </div>
        <div className="flex items-center justify-center border-t border-border bg-muted/30 px-4 py-3">
          <button
            type="button"
            onClick={() => setIsFullscreen(true)}
            className="flex items-center gap-2 rounded-lg border border-border bg-card px-5 py-2.5 text-sm font-medium text-foreground shadow-sm transition-all hover:border-primary/40 hover:bg-muted hover:shadow-md active:scale-[0.98]"
          >
            <ZoomIn className="h-4 w-4 text-primary" />
            Ver em tela cheia
          </button>
        </div>
      </div>

      {isFullscreen && (
        <div
          className="fixed inset-0 z-[9999] flex h-dvh w-dvw touch-none flex-col items-center justify-center overflow-hidden bg-black pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)] pt-[env(safe-area-inset-top)]"
          onClick={() => setIsFullscreen(false)}
        >
          <button
            aria-label="Fechar"
            className="absolute right-4 top-4 z-10 flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white/15 text-white transition-colors active:bg-white/25 focus:outline-none focus:ring-2 focus:ring-white/50"
            onClick={(e) => {
              e.stopPropagation();
              setIsFullscreen(false);
            }}
          >
            <X className="h-6 w-6" />
          </button>
          <div className="flex min-h-0 min-w-0 flex-1 items-center justify-center p-2">
            <img
              src={imageUrl}
              alt={variationLabel ?? title}
              className="max-h-full max-w-full select-none object-contain"
              draggable={false}
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </div>
      )}
    </div>
  );
}
