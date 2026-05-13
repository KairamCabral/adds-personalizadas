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
  /** Mostra o componente só após produto ter ID válido. */
  enabled?: boolean;
}

/**
 * Mostra o estoque total no Tiny de cada variante (cor) do produto.
 * Não filtra por depósito — o saldo é o agregado de todos os depósitos
 * daquela variante. A divisão entre pools é feita pelo usuário no
 * inventário mensal.
 */
export function StockPreview({ productId, enabled = true }: StockPreviewProps) {
  const query = useQuery({
    queryKey: ["preview-stock", productId],
    queryFn: async () => {
      if (!productId) return null;
      const res = await fetch(`/api/tiny/preview-stock?product_id=${productId}`);
      const json = await res.json();
      if (!res.ok) {
        return { error: (json.error as string) ?? "Falha ao consultar estoque." };
      }
      return json as {
        product_id: string;
        product_name: string;
        variants: Variant[];
        errors?: string[];
      };
    },
    enabled: enabled && !!productId,
    staleTime: 30 * 1000,
  });

  if (!productId || !enabled) return null;

  return (
    <div className="rounded-lg border border-border bg-muted/30 p-3">
      <p className="mb-2 flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-muted-foreground">
        <Package className="h-3 w-3" />
        Estoque atual no Tiny
        <span className="ml-1 normal-case tracking-normal text-[10px] text-muted-foreground/70">
          (total agregado por variante)
        </span>
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
        <p className="text-xs text-muted-foreground">
          Nenhuma variante mapeada no Tiny ainda.
        </p>
      )}

      {query.data && "variants" in query.data && query.data.variants.length > 0 && (
        <ul className="space-y-1">
          {query.data.variants.map((v) => (
            <li
              key={v.color_key ?? "__none__"}
              className="flex items-center justify-between gap-2 text-sm"
            >
              <span className="flex items-center gap-2">
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
                className={`tabular-nums font-semibold ${
                  v.stock == null ? "text-muted-foreground" : "text-foreground"
                }`}
              >
                {v.stock == null ? "—" : v.stock.toLocaleString("pt-BR")}
              </span>
            </li>
          ))}
        </ul>
      )}

      <p className="mt-2 border-t border-border/50 pt-2 text-[10px] text-muted-foreground">
        No inventário mensal, você divide cada total entre os pools selecionados.
      </p>
    </div>
  );
}
