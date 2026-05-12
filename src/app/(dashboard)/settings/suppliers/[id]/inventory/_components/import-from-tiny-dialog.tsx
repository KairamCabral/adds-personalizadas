"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Loader2, Search, Download, CheckCircle2, Package } from "lucide-react";
import { toast } from "sonner";
import { TinyDepositoSelect } from "@/components/inventory/tiny-deposito-select";

type Pool = "PERSONALIZADO" | "MARKETPLACE";

type TinyProduct = {
  id: number;
  name: string;
  sku: string | null;
  price: number | null;
  cost_price: number | null;
  stock: number | null;
  tipo: string | null;
};

interface ImportFromTinyDialogProps {
  supplierId: string;
  open: boolean;
  onClose: () => void;
  onImported: () => void;
}

export function ImportFromTinyDialog({
  supplierId,
  open,
  onClose,
  onImported,
}: ImportFromTinyDialogProps) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [results, setResults] = useState<TinyProduct[]>([]);
  const [loadingSearch, setLoadingSearch] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [pools, setPools] = useState<Pool[]>(["PERSONALIZADO", "MARKETPLACE"]);
  const [personalDeposito, setPersonalDeposito] = useState<number | null>(null);
  const [marketDeposito, setMarketDeposito] = useState<number | null>(null);

  useEffect(() => {
    if (!open) {
      setQuery("");
      setResults([]);
      setSelectedIds(new Set());
      setPools(["PERSONALIZADO", "MARKETPLACE"]);
      setPersonalDeposito(null);
      setMarketDeposito(null);
    }
  }, [open]);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query.trim()), 350);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    if (!open) return;
    if (debouncedQuery.length < 2 && debouncedQuery.length !== 0) return;

    const controller = new AbortController();
    setLoadingSearch(true);
    (async () => {
      try {
        const url = debouncedQuery
          ? `/api/tiny/products?q=${encodeURIComponent(debouncedQuery)}&limit=50`
          : `/api/tiny/products?limit=50`;
        const res = await fetch(url, { signal: controller.signal });
        const json = await res.json();
        if (res.status === 401 && json.code === "TINY_RECONNECT") {
          toast.error(json.error ?? "Sessão Tiny expirada.", {
            action: {
              label: "Reconectar",
              onClick: () => router.push("/settings/integrations"),
            },
          });
          return;
        }
        if (!res.ok) {
          toast.error(json.error ?? "Falha ao buscar no Tiny.");
          return;
        }
        setResults((json.products ?? []) as TinyProduct[]);
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        toast.error(err instanceof Error ? err.message : "Erro ao buscar.");
      } finally {
        setLoadingSearch(false);
      }
    })();

    return () => controller.abort();
  }, [debouncedQuery, open, router]);

  const importMutation = useMutation({
    mutationFn: async () => {
      const body = {
        tiny_ids: Array.from(selectedIds),
        pools,
        tiny_deposito_personalizado_id: personalDeposito,
        tiny_deposito_marketplace_id: marketDeposito,
      };
      const res = await fetch(`/api/suppliers/${supplierId}/import-products-from-tiny`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
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
      if (!res.ok) {
        throw new Error(json.error ?? "Falha ao importar.");
      }
      return json as {
        created: number;
        linked: number;
        errors?: string[];
      };
    },
    onSuccess: (data) => {
      const parts: string[] = [];
      if (data.created > 0) parts.push(`${data.created} criado(s)`);
      if (data.linked > 0) parts.push(`${data.linked} vinculado(s)`);
      toast.success(parts.length > 0 ? parts.join(" · ") : "Nenhuma mudança.");
      if (data.errors?.length) {
        toast.warning(`${data.errors.length} aviso(s).`);
      }
      onImported();
      onClose();
    },
    onError: (e: Error) => {
      if (e.message !== "TINY_RECONNECT") toast.error(e.message);
    },
  });

  const toggle = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const togglePool = (pool: Pool, checked: boolean) => {
    setPools((prev) => {
      if (checked) return prev.includes(pool) ? prev : [...prev, pool];
      return prev.filter((p) => p !== pool);
    });
  };

  const canImport = selectedIds.size > 0 && pools.length > 0;
  const filteredResults = useMemo(() => results, [results]);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="h-5 w-5 text-[--adds-blue]" />
            Importar produtos do Tiny
          </DialogTitle>
          <DialogDescription>
            Busque produtos no Tiny ERP e adicione ao CRM já vinculados ao fornecedor.
            Produtos existentes recebem apenas o vínculo + pools.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Search */}
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              autoFocus
              placeholder="Buscar por nome (ex: Implant, Interdental, Cera)..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* Pools + depósitos */}
          <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-3">
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                Pools de estoque
              </Label>
              <div className="flex gap-3">
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={pools.includes("PERSONALIZADO")}
                    onCheckedChange={(c) => togglePool("PERSONALIZADO", c === true)}
                  />
                  Personalizados
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={pools.includes("MARKETPLACE")}
                    onCheckedChange={(c) => togglePool("MARKETPLACE", c === true)}
                  />
                  Marketplace
                </label>
              </div>
            </div>
            <div className="space-y-3">
              {pools.includes("PERSONALIZADO") && (
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">
                    Depósito Tiny — Personalizado
                  </Label>
                  <TinyDepositoSelect
                    value={personalDeposito}
                    onChange={setPersonalDeposito}
                    hint="personaliz"
                  />
                </div>
              )}
              {pools.includes("MARKETPLACE") && (
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">
                    Depósito Tiny — Marketplace
                  </Label>
                  <TinyDepositoSelect
                    value={marketDeposito}
                    onChange={setMarketDeposito}
                    hint="marketpl"
                  />
                </div>
              )}
            </div>
          </div>

          {/* Results */}
          <div className="rounded-lg border border-border">
            <div className="flex items-center justify-between border-b border-border bg-muted/30 px-3 py-2">
              <p className="text-xs text-muted-foreground">
                {loadingSearch
                  ? "Buscando..."
                  : filteredResults.length === 0
                    ? "Nenhum resultado"
                    : `${filteredResults.length} resultado(s)`}
              </p>
              {selectedIds.size > 0 && (
                <Badge variant="secondary" className="gap-1">
                  <CheckCircle2 className="h-3 w-3" />
                  {selectedIds.size} selecionado(s)
                </Badge>
              )}
            </div>
            <div className="max-h-80 overflow-y-auto divide-y divide-border">
              {loadingSearch && filteredResults.length === 0 ? (
                <div className="flex h-32 items-center justify-center">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : filteredResults.length === 0 ? (
                <div className="flex h-32 flex-col items-center justify-center gap-2 text-muted-foreground">
                  <Package className="h-6 w-6" />
                  <p className="text-sm">Digite um nome para buscar no Tiny.</p>
                </div>
              ) : (
                filteredResults.map((p) => (
                  <label
                    key={p.id}
                    className="flex cursor-pointer items-center gap-3 px-3 py-2.5 hover:bg-muted/40"
                  >
                    <Checkbox
                      checked={selectedIds.has(p.id)}
                      onCheckedChange={() => toggle(p.id)}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{p.name}</p>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span>ID {p.id}</span>
                        {p.sku && <span>SKU {p.sku}</span>}
                        {p.stock != null && <span>{p.stock} em estoque</span>}
                      </div>
                    </div>
                    {p.tipo && (
                      <Badge variant="outline" className="text-[10px]">
                        {p.tipo}
                      </Badge>
                    )}
                  </label>
                ))
              )}
            </div>
          </div>
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-between">
          <p className="text-xs text-muted-foreground">
            Produtos que já existem no CRM serão apenas vinculados ao fornecedor.
          </p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button
              onClick={() => importMutation.mutate()}
              disabled={!canImport || importMutation.isPending}
              className="bg-[--adds-blue] hover:bg-[--adds-blue]/90"
            >
              {importMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Download className="mr-2 h-4 w-4" />
              )}
              Importar {selectedIds.size > 0 ? `(${selectedIds.size})` : ""}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
