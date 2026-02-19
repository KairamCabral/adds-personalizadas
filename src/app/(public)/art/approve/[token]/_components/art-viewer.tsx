"use client";

import { useState, useEffect } from "react";
import { FileText, ZoomIn, X } from "lucide-react";

interface ArtViewerProps {
  imageUrl: string;
  title: string;
}

function isPdfUrl(url: string): boolean {
  const lower = url.toLowerCase();
  return lower.endsWith(".pdf") || lower.includes(".pdf?");
}

export function ArtViewer({ imageUrl, title }: ArtViewerProps) {
  const [isFullscreen, setIsFullscreen] = useState(false);
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
      <div className="space-y-3">
        <h3 className="text-sm font-medium text-foreground">{title}</h3>
        <a
          href={imageUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-4 rounded-xl border border-border bg-muted/30 p-4 transition-all hover:bg-muted/50 sm:p-6"
        >
          <FileText className="h-10 w-10 shrink-0 text-primary sm:h-12 sm:w-12" />
          <div className="flex-1">
            <p className="font-medium text-foreground">Arquivo PDF</p>
            <p className="text-xs text-muted-foreground">
              Clique para abrir em nova aba
            </p>
          </div>
          <span className="text-sm font-medium text-primary">Abrir PDF →</span>
        </a>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col space-y-2">
      <h3 className="shrink-0 text-sm font-medium text-foreground">{title}</h3>
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
        className="group relative flex min-h-0 flex-1 overflow-hidden rounded-lg border border-border bg-muted/30 transition-all hover:border-primary/30 hover:shadow-md"
      >
        <div className="relative flex min-h-[180px] flex-1 items-center justify-center sm:min-h-[220px] lg:aspect-video lg:min-h-0">
          <img
            src={imageUrl}
            alt={title}
            className="max-h-[35vh] w-full object-contain transition-transform duration-300 group-hover:scale-[1.02] sm:max-h-[40vh] lg:max-h-none lg:h-full"
          />
        </div>
        <div className="absolute bottom-2 right-2 flex items-center gap-1.5 rounded-lg bg-black/60 px-3 py-2 text-xs text-white backdrop-blur-sm transition-opacity group-hover:bg-black/70">
          <ZoomIn className="h-3.5 w-3.5" />
          Clique para ampliar
        </div>
      </div>

      {/* Fullscreen overlay - tela inteira otimizada para mobile */}
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
              alt={title}
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
