"use client";

import { useQuery } from "@tanstack/react-query";
import { Loader2, Package, AlertCircle, Warehouse } from "lucide-react";

type Deposito = {
  id: number;
  nome: string;
  desconsiderar: boolean;
  saldo: number;
  reservado: number;
  disponivel: number;
};

type Variant = {
  color_key: string | null;
  color_label: string | null;
  tiny_id: number | null;
  total_saldo: number | null;
  total_reservado: number | null;
  total_disponivel: number | null;
  depositos: Deposito[];
};

interface StockPreviewProps {
  productId: string | null;
  /** ID do depósito a destacar como "Personalizado" */
  personalizadoDepositoId?: number | null;
  /** ID do depósito a destacar como "Marketplace" */
  marketplaceDepositoId?: number | null;
  enabled?: boolean;
}

export function StockPreview({
  productId,
  personalizadoDepositoId,
  marketplaceDepositoId,
  enabled = true,
}: StockPreviewProps) {
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
          (por depósito)
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
        <div className="space-y-3">
          {query.data.variants.map((v) => (
            <VariantStock
              key={v.color_key ?? "__none__"}
              variant={v}
              personalizadoDepositoId={personalizadoDepositoId}
              marketplaceDepositoId={marketplaceDepositoId}
            />
          ))}
        </div>
      )}

      {query.data && "errors" in query.data && query.data.errors && query.data.errors.length > 0 && (
        <details className="mt-2 rounded border border-amber-200 bg-amber-50 p-2 dark:border-amber-900 dark:bg-amber-950/40">
          <summary className="cursor-pointer text-[10px] font-medium text-amber-700 dark:text-amber-400">
            ⚠ Diagnóstico ({query.data.errors.length})
          </summary>
          <ul className="mt-1 space-y-1 text-[10px] text-amber-700/80 dark:text-amber-400/80">
            {query.data.errors.map((e, i) => (
              <li key={i} className="break-all">{e}</li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

function VariantStock({
  variant,
  personalizadoDepositoId,
  marketplaceDepositoId,
}: {
  variant: Variant;
  personalizadoDepositoId?: number | null;
  marketplaceDepositoId?: number | null;
}) {
  const hasAnyPool = personalizadoDepositoId != null || marketplaceDepositoId != null;

  return (
    <div className="rounded-md border border-border/50 bg-background/60 p-2">
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-sm">
          <span className="font-medium">{variant.color_label ?? "—"}</span>
          {variant.tiny_id != null && (
            <span className="text-[10px] text-muted-foreground">
              #{variant.tiny_id}
            </span>
          )}
        </span>
        <span className="flex items-baseline gap-1 text-xs">
          <span className="text-muted-foreground">total</span>
          <span className="font-semibold tabular-nums">
            {variant.total_saldo?.toLocaleString("pt-BR") ?? "—"}
          </span>
          {variant.total_reservado != null && variant.total_reservado > 0 && (
            <span className="ml-1 text-[10px] text-muted-foreground">
              ({variant.total_reservado} reservado)
            </span>
          )}
        </span>
      </div>

      {variant.depositos.length === 0 ? (
        <p className="text-[10px] text-muted-foreground">
          Sem depósitos retornados pelo Tiny.
        </p>
      ) : (
        <ul className="space-y-0.5">
          {variant.depositos.map((d) => {
            const isPers = personalizadoDepositoId != null && d.id === personalizadoDepositoId;
            const isMkt = marketplaceDepositoId != null && d.id === marketplaceDepositoId;
            const isLinked = isPers || isMkt;
            return (
              <li
                key={d.id}
                className={`flex items-center justify-between gap-2 rounded px-1.5 py-0.5 text-[11px] ${
                  isPers
                    ? "bg-[--adds-blue]/10"
                    : isMkt
                      ? "bg-[--adds-orange]/10"
                      : ""
                }`}
              >
                <span className="flex items-center gap-1.5">
                  <Warehouse
                    className={`h-3 w-3 ${
                      isPers
                        ? "text-[--adds-blue]"
                        : isMkt
                          ? "text-[--adds-orange]"
                          : "text-muted-foreground"
                    }`}
                  />
                  <span className={isLinked ? "font-medium" : "text-muted-foreground"}>
                    {d.nome}
                  </span>
                  {isPers && (
                    <span className="text-[9px] font-semibold uppercase text-[--adds-blue]">
                      Personalizado
                    </span>
                  )}
                  {isMkt && (
                    <span className="text-[9px] font-semibold uppercase text-[--adds-orange]">
                      Marketplace
                    </span>
                  )}
                </span>
                <span className="flex items-baseline gap-1 tabular-nums">
                  <span className={isLinked ? "font-semibold" : "text-muted-foreground"}>
                    {d.saldo.toLocaleString("pt-BR")}
                  </span>
                  {d.reservado > 0 && (
                    <span className="text-[9px] text-muted-foreground">
                      ({d.reservado} res.)
                    </span>
                  )}
                </span>
              </li>
            );
          })}
        </ul>
      )}

      {!hasAnyPool && (
        <p className="mt-1 text-[10px] text-muted-foreground">
          Configure os depósitos abaixo para marcar quais alimentam cada pool.
        </p>
      )}
    </div>
  );
}
