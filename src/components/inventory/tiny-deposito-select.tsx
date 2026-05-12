"use client";

import { useRouter } from "next/navigation";
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
import { toast } from "sonner";

export interface TinyDeposito {
  id: number;
  nome: string;
  situacao: string | null;
}

interface TinyDepositoSelectProps {
  value: number | null;
  onChange: (value: number | null) => void;
  placeholder?: string;
  /** Sugere depósitos cujo nome contenha esse texto (case-insensitive) — usado para destacar opções relevantes. */
  hint?: string;
  disabled?: boolean;
}

export function TinyDepositoSelect({
  value,
  onChange,
  placeholder = "Selecione o depósito do Tiny",
  hint,
  disabled,
}: TinyDepositoSelectProps) {
  const router = useRouter();
  const query = useQuery({
    queryKey: ["tiny-depositos"],
    queryFn: async (): Promise<{
      depositos: TinyDeposito[];
      attempts?: Array<{ endpoint: string; ok: boolean; hint?: string }>;
    }> => {
      const res = await fetch("/api/tiny/depositos");
      const json = await res.json();
      if (res.status === 401 && json.code === "TINY_RECONNECT") {
        toast.error(json.error, {
          action: {
            label: "Reconectar",
            onClick: () => router.push("/settings/integrations"),
          },
        });
        throw new Error("TINY_RECONNECT");
      }
      if (res.status === 422 && json.code === "TINY_NOT_CONNECTED") {
        return { depositos: [] };
      }
      if (!res.ok) throw new Error(json.error ?? "Falha ao carregar depósitos.");
      return {
        depositos: (json.depositos ?? []) as TinyDeposito[],
        attempts: json.attempts,
      };
    },
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  const depositos = query.data?.depositos ?? [];
  const attempts = query.data?.attempts;

  // Ordena: sugeridos (que batem com o hint) primeiro
  const sorted = [...depositos].sort((a, b) => {
    if (!hint) return a.nome.localeCompare(b.nome, "pt-BR");
    const hintLc = hint.toLowerCase();
    const aMatch = a.nome.toLowerCase().includes(hintLc) ? 0 : 1;
    const bMatch = b.nome.toLowerCase().includes(hintLc) ? 0 : 1;
    if (aMatch !== bMatch) return aMatch - bMatch;
    return a.nome.localeCompare(b.nome, "pt-BR");
  });

  const NONE = "__none__";

  return (
    <div className="flex gap-2">
      <Select
        value={value != null ? String(value) : NONE}
        onValueChange={(v) => onChange(v === NONE ? null : parseInt(v, 10))}
        disabled={disabled || query.isLoading}
      >
        <SelectTrigger className="flex-1">
          {query.isLoading ? (
            <span className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Carregando depósitos…
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
            <div className="space-y-2 px-2 py-3 text-xs text-muted-foreground">
              <p className="font-medium">Nenhum depósito encontrado no Tiny.</p>
              {attempts && attempts.length > 0 && (
                <details className="rounded border border-border bg-muted/40 p-2">
                  <summary className="cursor-pointer text-[10px] font-medium">
                    Ver diagnóstico ({attempts.length} tentativa
                    {attempts.length > 1 ? "s" : ""})
                  </summary>
                  <ul className="mt-1.5 space-y-1 text-[10px]">
                    {attempts.map((a, idx) => (
                      <li key={idx} className="break-all">
                        <span
                          className={
                            a.ok
                              ? "text-emerald-600 dark:text-emerald-400"
                              : "text-destructive"
                          }
                        >
                          {a.ok ? "✓" : "✗"}
                        </span>{" "}
                        <code className="text-[10px]">{a.endpoint}</code>{" "}
                        <span className="text-muted-foreground">{a.hint}</span>
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </div>
          )}
          {sorted.map((d) => {
            const isSuggested =
              hint && d.nome.toLowerCase().includes(hint.toLowerCase());
            return (
              <SelectItem key={d.id} value={String(d.id)}>
                <div className="flex items-center gap-2">
                  <Warehouse
                    className={`h-3.5 w-3.5 ${
                      isSuggested ? "text-[--adds-blue]" : "text-muted-foreground"
                    }`}
                  />
                  <span>{d.nome}</span>
                  <span className="text-[10px] text-muted-foreground">
                    #{d.id}
                  </span>
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
        title="Recarregar depósitos do Tiny"
        className="h-9 w-9 shrink-0"
      >
        <RefreshCw
          className={`h-4 w-4 ${query.isFetching ? "animate-spin" : ""}`}
        />
      </Button>
    </div>
  );
}
