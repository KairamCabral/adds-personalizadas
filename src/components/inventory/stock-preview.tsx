"use client";

import { useQuery } from "@tanstack/react-query";
import { Loader2, Package, AlertCircle } from "lucide-react";

type Variant = {
  color_key: string | null;
  color_label: string | null;
  tiny_id: number | null;
  stock: number | null;
};

interface StockPreviewProps {
  productId: string | null;
  depositoId: number | null;
  /** Cor de fundo, usado para diferenciar PERSONALIZADO/MARKETPLACE */
  accent?: "blue" | "orange";
}

/**
 * Mostra o estoque atual de cada variante do produto no depósito Tiny escolhido.
 * Roda só quando productId + depositoId estão preenchidos.
 */
export function StockPreview({ productId, depositoId, accent = "blue" }: StockPreviewProps) {
  const query = useQuery({
    queryKey: ["preview-stock", productId, depositoId],
    queryFn: async () => {
      if (!productId || depositoId == null) return null;
      const res = await fetch(
        `/api/tiny/preview-stock?product_id=${productId}&deposito_id=${depositoId}`
      );
      const json = await res.json();
      if (!res.ok) {
        return { error: (json.error as string) ?? "Falha ao consultar estoque." };
      }
      return json as {
        product_id: string;
        product_name: string;
        deposito_id: number;
        variants: Variant[];
        errors?: string[];
      };
    },
    enabled: !!productId && depositoId != null,
    staleTime: 30 * 1000,
  });

  if (!productId || depositoId == null) return null;

  const accentBg =
    accent === "orange"
      ? "border-[--adds-orange]/30 bg-[--adds-orange]/5"
      : "border-[--adds-blue]/30 bg-[--adds-blue]/5";

  return (
    <div className={`mt-2 rounded-md border ${accentBg} p-2`}>
      <p className="mb-1.5 text-[10px] uppercase tracking-wide text-muted-foreground">
        Estoque atual no depósito (Tiny)
      </p>

      {query.isLoading && (
        <div className="flex items-center gap-2 py-1 text-xs text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" />
          Consultando Tiny…
        </div>
      )}

      {query.data && "error" in query.data && (
        <div className="flex items-start gap-1.5 py-1 text-xs text-amber-700 dark:text-amber-400">
          <AlertCircle className="mt-0.5 h-3 w-3 shrink-0" />
          <span>{query.data.error}</span>
        </div>
      )}

      {query.data && "variants" in query.data && query.data.variants.length === 0 && (
        <p className="text-xs text-muted-foreground">Nenhuma variante mapeada no Tiny.</p>
      )}

      {query.data && "variants" in query.data && query.data.variants.length > 0 && (
        <ul className="space-y-1">
          {query.data.variants.map((v) => (
            <li
              key={v.color_key ?? "__none__"}
              className="flex items-center justify-between gap-2 text-xs"
            >
              <span className="flex items-center gap-1.5">
                <Package className="h-3 w-3 text-muted-foreground" />
                <span className="font-medium">{v.color_label ?? "—"}</span>
                {v.tiny_id != null ? (
                  <span className="text-[10px] text-muted-foreground">
                    #{v.tiny_id}
                  </span>
                ) : (
                  <span className="text-[10px] text-amber-600">sem tiny_id</span>
                )}
              </span>
              <span
                className={`tabular-nums font-medium ${
                  v.stock == null ? "text-muted-foreground" : ""
                }`}
              >
                {v.stock == null ? "—" : v.stock.toLocaleString("pt-BR")}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
