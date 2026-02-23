"use client";

import { useRef } from "react";
import { Shield } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DiyCustomization, WizardProductItem } from "../quote-wizard-types";

interface DiyPreviewProps {
  customization: DiyCustomization;
  product: WizardProductItem;
}

const PRINT_COLORS = {
  colorida: {
    textColor: "#21add6",
    bgGradient: "from-white to-gray-50",
    label: "Impressão Colorida",
  },
  branca: {
    textColor: "#FFFFFF",
    bgGradient: "from-gray-800 to-gray-900",
    label: "Impressão Branca",
  },
  preta: {
    textColor: "#1a1a1a",
    bgGradient: "from-white to-gray-50",
    label: "Impressão Preta",
  },
} as const;

export function DiyPreview({ customization, product }: DiyPreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const colorConfig = PRINT_COLORS[customization.print_color];

  const hasLine1 = customization.line1.trim().length > 0;
  const hasLine2 = customization.line2.trim().length > 0;
  const hasLogo = !!customization.logo_preview_url;
  const hasAnyContent = hasLine1 || hasLine2 || hasLogo;
  const hasPrintAreaImage = !!product.print_area_image_url;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-muted-foreground">
          Preview:{" "}
          <span className="text-foreground">{product.product_name}</span>
        </p>
        <span
          className="text-xs px-2 py-0.5 rounded-full border"
          style={{
            color:
              colorConfig.textColor === "#FFFFFF"
                ? "#999"
                : colorConfig.textColor,
          }}
        >
          {colorConfig.label}
        </span>
      </div>

      {/* Container protegido */}
      <div
        ref={containerRef}
        className="relative select-none"
        onContextMenu={(e) => e.preventDefault()}
        onDragStart={(e) => e.preventDefault()}
      >
        <div
          className={cn(
            "relative rounded-2xl overflow-hidden shadow-xl border border-border",
            "aspect-[3/4] max-h-[480px]",
            !hasPrintAreaImage && cn("bg-gradient-to-b", colorConfig.bgGradient),
          )}
        >
          {/* Fundo: imagem da área de personalização do produto (quando disponível) */}
          {hasPrintAreaImage && (
            <img
              src={product.print_area_image_url!}
              alt=""
              className="absolute inset-0 w-full h-full object-cover pointer-events-none"
              draggable={false}
            />
          )}

          {/* Overlay semitransparente quando há imagem de fundo para melhorar legibilidade */}
          {hasPrintAreaImage && (
            <div
              className={cn(
                "absolute inset-0",
                customization.print_color === "branca"
                  ? "bg-gray-900/40"
                  : "bg-white/20",
              )}
            />
          )}

          {/* Área de personalização sobreposta */}
          <div className="absolute inset-0 flex flex-col items-center justify-center p-8">
            <div
              className={cn(
                "w-full max-w-[220px] flex flex-col items-center gap-4 transition-all duration-200",
                !hasAnyContent && "opacity-30",
              )}
            >
              {/* Logo do cliente */}
              {hasLogo ? (
                <div className="w-24 h-24 flex items-center justify-center drop-shadow-lg">
                  <img
                    src={customization.logo_preview_url!}
                    alt="Logo"
                    className="max-w-full max-h-full object-contain pointer-events-none"
                    draggable={false}
                  />
                </div>
              ) : (
                <div className="w-24 h-24 rounded-lg border-2 border-dashed border-muted-foreground/30 flex items-center justify-center">
                  <span className="text-xs text-muted-foreground/50">Logo</span>
                </div>
              )}

              {/* Textos */}
              <div className="text-center space-y-1 w-full">
                <p
                  className={cn(
                    "font-bold text-base leading-tight tracking-wide transition-all duration-150 break-words drop-shadow-sm",
                    !hasLine1 && "text-muted-foreground/30",
                  )}
                  style={{
                    color: hasLine1 ? colorConfig.textColor : undefined,
                    textShadow: hasPrintAreaImage || customization.print_color === "branca"
                      ? "0 1px 4px rgba(0,0,0,0.5)"
                      : "none",
                  }}
                >
                  {customization.line1 || "Linha 1"}
                </p>

                <p
                  className={cn(
                    "text-sm leading-tight tracking-wide transition-all duration-150 break-words drop-shadow-sm",
                    !hasLine2 && "text-muted-foreground/30",
                  )}
                  style={{
                    color: hasLine2 ? colorConfig.textColor : undefined,
                    textShadow: hasPrintAreaImage || customization.print_color === "branca"
                      ? "0 1px 4px rgba(0,0,0,0.5)"
                      : "none",
                  }}
                >
                  {customization.line2 || "Linha 2"}
                </p>
              </div>
            </div>

            {/* Logo ADDS (marca d'água no fundo) */}
            <div className="absolute bottom-6 opacity-25">
              <span
                className="text-xs font-bold tracking-widest"
                style={{
                  color: customization.print_color === "branca" ? "#fff" : "#666",
                  textShadow: hasPrintAreaImage ? "0 1px 3px rgba(0,0,0,0.4)" : "none",
                }}
              >
                ADDS BRASIL
              </span>
            </div>
          </div>

          {/* Camada 3: Overlay de proteção */}
          <div
            className="absolute inset-0 z-10"
            style={{ WebkitUserSelect: "none", userSelect: "none" }}
          />

          {/* Camada 4: Watermark sutil */}
          <div className="absolute inset-0 z-20 pointer-events-none overflow-hidden opacity-[0.03]">
            <div className="absolute inset-0 flex flex-wrap gap-8 rotate-[-30deg] scale-150 translate-x-[-20%] translate-y-[-20%]">
              {Array.from({ length: 20 }).map((_, i) => (
                <span
                  key={i}
                  className="text-xs font-bold whitespace-nowrap text-foreground"
                >
                  ADDS BRASIL · PREVIEW
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Badge de proteção */}
        <div className="absolute bottom-2 right-2 z-30 flex items-center gap-1 bg-background/80 backdrop-blur-sm rounded-full px-2 py-1 text-[10px] text-muted-foreground">
          <Shield className="h-3 w-3" />
          Preview protegido
        </div>
      </div>

      {/* Cores da escova selecionadas */}
      {product.colors.length > 0 && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>Cor da escova:</span>
          <div className="flex gap-1">
            {product.colors.map((color) => (
              <span
                key={color}
                className="px-2 py-0.5 rounded-full bg-muted text-xs capitalize"
              >
                {color}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
