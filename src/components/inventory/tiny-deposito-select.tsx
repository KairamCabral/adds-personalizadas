"use client";

import { useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, RefreshCw, Warehouse } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";

export interface TinyDeposito {
  id: number;
  name: string;
  notes: string | null;
  is_active: boolean;
}

interface TinyDepositoSelectProps {
  value: number | null;
  onChange: (value: number | null) => void;
  placeholder?: string;
  /**
   * Substring usada para auto-sugerir uma opção (e marcá-la como "sugerido").
   * Ex: "personaliz" para o pool PERSONALIZADO, "marketpl" para MARKETPLACE.
   */
  hint?: string;
  /**
   * Se true e `value` é null, seleciona automaticamente o primeiro depósito
   * cujo nome combina com `hint` (case-insensitive) assim que a lista carrega.
   */
  autoSelectByHint?: boolean;
  disabled?: boolean;
}

export function TinyDepositoSelect({
  value,
  onChange,
  placeholder = "Selecione o depósito do Tiny",
  hint,
  autoSelectByHint = false,
  disabled,
}: TinyDepositoSelectProps) {
  const query = useQuery({
    queryKey: ["tiny-depositos-cadastro"],
    queryFn: async (): Promise<TinyDeposito[]> => {
      const res = await fetch("/api/tiny/depositos");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Falha ao carregar.");
      return (json.depositos ?? []) as TinyDeposito[];
    },
    staleTime: 5 * 60 * 1000,
  });

  const depositos = query.data ?? [];

  const sorted = useMemo(() => {
    return [...depositos].sort((a, b) => {
      if (!hint) return a.name.localeCompare(b.name, "pt-BR");
      const hintLc = hint.toLowerCase();
      const aMatch = a.name.toLowerCase().includes(hintLc) ? 0 : 1;
      const bMatch = b.name.toLowerCase().includes(hintLc) ? 0 : 1;
      if (aMatch !== bMatch) return aMatch - bMatch;
      return a.name.localeCompare(b.name, "pt-BR");
    });
  }, [depositos, hint]);

  // Auto-seleção pela hint quando a lista carregar (re-roda quando o cache
  // muda via dataUpdatedAt — primitivo estável, sem risco de loop).
  useEffect(() => {
    if (!autoSelectByHint) return;
    if (value != null) return;
    if (!hint) return;
    if (depositos.length === 0) return;
    const hintLc = hint.toLowerCase();
    const sugg = depositos.find((d) => d.name.toLowerCase().includes(hintLc));
    if (sugg) onChange(sugg.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoSelectByHint, hint, query.dataUpdatedAt]);

  const NONE = "__none__";

  return (
    <div className="flex gap-2">
      <Select
        value={value != null ? String(value) : NONE}
        onValueChange={(v) => onChange(v === NONE ? null : parseInt(v, 10))}
        disabled={disabled || query.isLoading}
      >
        <SelectTrigger className="h-9 flex-1 text-sm">
          {query.isLoading ? (
            <span className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Carregando…
            </span>
          ) : (
            <SelectValue placeholder={placeholder} />
          )}
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={NONE}>
            <span className="text-muted-foreground">Nenhum</span>
          </SelectItem>
          {sorted.length === 0 && !query.isLoading && (
            <div className="px-2 py-3 text-xs text-muted-foreground">
              Nenhum depósito ainda. Clique no ⟳ para sincronizar do Tiny.
            </div>
          )}
          {sorted.map((d) => {
            const isSuggested =
              hint && d.name.toLowerCase().includes(hint.toLowerCase());
            return (
              <SelectItem key={d.id} value={String(d.id)}>
                <div className="flex items-center gap-2">
                  <Warehouse
                    className={`h-3.5 w-3.5 ${
                      isSuggested ? "text-[--adds-blue]" : "text-muted-foreground"
                    }`}
                  />
                  <span>{d.name}</span>
                  {isSuggested && (
                    <span className="text-[10px] font-medium text-[--adds-blue]">
                      sugerido
                    </span>
                  )}
                </div>
              </SelectItem>
            );
          })}
        </SelectContent>
      </Select>
      <Button
        type="button"
        size="icon"
        variant="ghost"
        onClick={() => query.refetch()}
        disabled={query.isFetching}
        title="Sincronizar depósitos do Tiny"
        className="h-9 w-9 shrink-0"
      >
        <RefreshCw
          className={`h-4 w-4 ${query.isFetching ? "animate-spin" : ""}`}
        />
      </Button>
    </div>
  );
}
