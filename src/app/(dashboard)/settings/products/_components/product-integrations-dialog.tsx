"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Package,
  Truck,
  DollarSign,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Link2,
  Link2Off,
  Pencil,
} from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import type { Product } from "@/types/database.types";
import type { Json } from "@/types/database.types";
import type { TinyProductResult } from "@/app/api/tiny/products/route";
import type { BlingProductResult } from "@/app/api/bling/products/route";
import type { TinyVariationResult } from "@/app/api/tiny/product-variations/route";

// ─────────────────────────────────────────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────────────────────────────────────────

interface ColorEntry {
  key: string;
  label: string;
  hex?: string | null;
  image_url?: string | null;
}

interface TinyColorEntry {
  tiny_id?: number | null;
  sku?: string | null;
  tiny_stock?: number | null;
  name?: string | null;
}

interface SupplierColorEntry {
  sku?: string | null;
  cost?: number | null;
}

type TinyColorMap = Record<string, TinyColorEntry>;
type SupplierColorMap = Record<string, SupplierColorEntry>;

interface ProductIntegrationsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: Product;
  onSaved?: (updated: Partial<Product>) => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function formatCurrency(value: number | null | undefined): string {
  if (value == null) return "—";
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function calcMargin(price: number | null, cost: number | null): number | null {
  if (!price || !cost || price === 0) return null;
  return Math.round(((price - cost) / price) * 100);
}

function getMarginStyle(margin: number | null): string {
  if (margin == null) return "bg-muted/50";
  if (margin >= 50) return "bg-green-500/10 text-green-700 dark:text-green-400";
  if (margin >= 30) return "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400";
  return "bg-red-500/10 text-red-700 dark:text-red-400";
}

function parseColors(raw: Json | null): ColorEntry[] {
  if (!Array.isArray(raw)) return [];
  return raw as unknown as ColorEntry[];
}

function parseTinyColorMap(raw: Json | null): TinyColorMap {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  return raw as TinyColorMap;
}

function parseSupplierColorMap(raw: Json | null): SupplierColorMap {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  return raw as SupplierColorMap;
}

// ─────────────────────────────────────────────────────────────────────────────
// Hook de busca no Tiny (com debounce e cache por sessão)
// ─────────────────────────────────────────────────────────────────────────────

function useTinySearch(defaultQuery = "") {
  const [query, setQuery] = useState(defaultQuery);
  const [results, setResults] = useState<TinyProductResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cacheRef = useRef<Map<string, TinyProductResult[]>>(new Map());

  const search = useCallback(async (q: string) => {
    const cacheKey = q.trim().toLowerCase();
    if (cacheRef.current.has(cacheKey)) {
      setResults(cacheRef.current.get(cacheKey)!);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const url = q.length >= 2
        ? `/api/tiny/products?q=${encodeURIComponent(q)}&limit=40`
        : `/api/tiny/products?limit=40`;
      const res = await fetch(url);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Erro ao buscar produtos");
        setResults([]);
        return;
      }
      const list: TinyProductResult[] = data.products ?? [];
      cacheRef.current.set(cacheKey, list);
      setResults(list);
    } catch {
      setError("Erro ao conectar com o Tiny");
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleQuery = useCallback((value: string) => {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(value), 400);
  }, [search]);

  useEffect(() => {
    search(defaultQuery);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  return { query, handleQuery, results, loading, error };
}

// ─────────────────────────────────────────────────────────────────────────────
// Hook para buscar variações de um produto pai no Tiny
// ─────────────────────────────────────────────────────────────────────────────

function useTinyVariations(parentTinyId: string | null) {
  const [variations, setVariations] = useState<TinyVariationResult[]>([]);
  const [parentName, setParentName] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fetchedRef = useRef<string | null>(null);

  useEffect(() => {
    if (!parentTinyId || fetchedRef.current === parentTinyId) return;
    fetchedRef.current = parentTinyId;
    setLoading(true);
    setError(null);
    fetch(`/api/tiny/product-variations?parent_id=${encodeURIComponent(parentTinyId)}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) { setError(data.error); return; }
        setVariations(data.variations ?? []);
        setParentName(data.parentName ?? null);
      })
      .catch(() => setError("Erro ao buscar variações do Tiny"))
      .finally(() => setLoading(false));
  }, [parentTinyId]);

  const filtered = useCallback(
    (q: string) => {
      if (!q.trim()) return variations;
      const lq = q.toLowerCase();
      return variations.filter(
        (v) =>
          v.gradeLabel?.toLowerCase().includes(lq) ||
          v.sku?.toLowerCase().includes(lq) ||
          v.name.toLowerCase().includes(lq)
      );
    },
    [variations]
  );

  return { variations, parentName, loading, error, filtered };
}

// ─────────────────────────────────────────────────────────────────────────────
// TinySearchPopover — popover de busca reutilizável por linha/variação
// ─────────────────────────────────────────────────────────────────────────────

function TinySearchPopover({
  onSelect,
  triggerLabel = "Conectar no Tiny",
  triggerVariant = "outline",
  triggerContent,
  defaultQuery = "",
  parentTinyId,
  open,
  onOpenChange,
}: {
  onSelect: (product: TinyProductResult) => void;
  triggerLabel?: string;
  triggerVariant?: "outline" | "ghost";
  triggerContent?: React.ReactNode;
  defaultQuery?: string;
  parentTinyId?: string | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  // Modo variações: usa o pai para listar sub-produtos
  const useVariationsMode = !!parentTinyId;
  const { variations, parentName, loading: vLoading, error: vError, filtered } =
    useTinyVariations(useVariationsMode ? parentTinyId : null);

  // Modo busca geral (sem pai ou pai não definido)
  const { query, handleQuery, results, loading: sLoading, error: sError } =
    useTinySearch(useVariationsMode ? "" : defaultQuery);

  const [localQuery, setLocalQuery] = useState(defaultQuery);
  const handleLocalQuery = (v: string) => {
    setLocalQuery(v);
    if (!useVariationsMode) handleQuery(v);
  };

  const loading = useVariationsMode ? vLoading : sLoading;
  const error = useVariationsMode ? vError : sError;

  // Em modo variações: filtrar client-side pela query local
  const displayVariations = useVariationsMode ? filtered(localQuery) : [];
  const displayResults = useVariationsMode ? [] : results;

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      {triggerContent ? (
        <PopoverTrigger asChild>{triggerContent as React.ReactElement}</PopoverTrigger>
      ) : (
        <PopoverTrigger asChild>
          <Button type="button" variant={triggerVariant} size="sm" className="gap-1.5 h-8 text-xs">
            <Link2 className="h-3.5 w-3.5" />
            {triggerLabel}
          </Button>
        </PopoverTrigger>
      )}
      <PopoverContent className="w-80 p-0" align="start" side="bottom">
        <Command shouldFilter={false}>
          {useVariationsMode && parentName && (
            <div className="px-3 pt-2 pb-1 text-[11px] text-muted-foreground border-b border-border">
              Variações de: <span className="font-medium text-foreground">{parentName}</span>
            </div>
          )}
          <CommandInput
            placeholder={useVariationsMode ? "Filtrar variações…" : "Buscar por nome ou SKU…"}
            value={useVariationsMode ? localQuery : query}
            onValueChange={handleLocalQuery}
          />
          <CommandList className="max-h-64">
            {loading && (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            )}
            {error && (
              <div className="flex items-center gap-2 px-3 py-2 text-xs text-destructive">
                <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                {error}
              </div>
            )}
            {/* Modo variações */}
            {useVariationsMode && !loading && !error && (
              <>
                {displayVariations.length === 0 && variations.length === 0 && (
                  <CommandEmpty>Nenhuma variação encontrada. Conecte o produto pai primeiro.</CommandEmpty>
                )}
                {displayVariations.length === 0 && variations.length > 0 && (
                  <CommandEmpty>Nenhuma variação corresponde à busca.</CommandEmpty>
                )}
                {displayVariations.length > 0 && (
                  <CommandGroup>
                    {displayVariations.map((v) => (
                      <CommandItem
                        key={v.id}
                        value={`${v.id}-${v.gradeLabel ?? v.sku ?? v.name}`}
                        onSelect={() => {
                          onSelect({ id: v.id, name: v.name, sku: v.sku, price: null, cost_price: null, stock: null, tipo: null, parent_id: null, parent_name: parentName ?? null });
                          onOpenChange(false);
                        }}
                        className="flex flex-col items-start gap-0.5 py-2"
                      >
                        <span className="font-medium text-sm leading-tight">
                          {v.gradeLabel ?? v.name}
                        </span>
                        {v.sku && (
                          <span className="text-[11px] text-muted-foreground leading-tight">
                            SKU: {v.sku}
                          </span>
                        )}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                )}
              </>
            )}
            {/* Modo busca geral */}
            {!useVariationsMode && !loading && !error && displayResults.length === 0 && (
              <CommandEmpty>Nenhum produto encontrado no Tiny.</CommandEmpty>
            )}
            {!useVariationsMode && !loading && displayResults.length > 0 && (
              <CommandGroup>
                {displayResults.map((p) => (
                  <CommandItem
                    key={p.id}
                    value={`${p.id}-${p.name}`}
                    onSelect={() => { onSelect(p); onOpenChange(false); }}
                    className="flex flex-col items-start gap-0.5 py-2"
                  >
                    <span className="font-medium text-sm leading-tight">{p.name}</span>
                    <span className="text-[11px] text-muted-foreground leading-tight">
                      {p.sku && <span className="mr-2">SKU: {p.sku}</span>}
                      {p.parent_name && <span className="text-primary/70">→ {p.parent_name}</span>}
                      {p.cost_price != null && (
                        <span className="ml-2 text-green-700 dark:text-green-400 font-medium">
                          {formatCurrency(p.cost_price)}
                        </span>
                      )}
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Hook de busca no Bling (com debounce e cache por sessão)
// ─────────────────────────────────────────────────────────────────────────────

function useBlingSearch(supplierId: string | null, open = false, initialCode = "") {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<BlingProductResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cacheRef = useRef<Map<string, BlingProductResult[]>>(new Map());
  const initializedRef = useRef(false);

  const search = useCallback(
    async (q: string, pg = 1) => {
      if (!supplierId) return;
      const cacheKey = `${q.trim().toLowerCase()}::${pg}`;
      if (cacheRef.current.has(cacheKey)) {
        setResults(cacheRef.current.get(cacheKey)!);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const base = `/api/bling/products?supplier_id=${supplierId}`;
        const url = q.length >= 1
          ? `${base}&q=${encodeURIComponent(q)}`
          : `${base}&page=${pg}`;
        const res = await fetch(url);
        const data = await res.json();
        if (!res.ok) {
          setError(data.error ?? "Erro ao buscar produtos do Bling");
          setResults([]);
          return;
        }
        const list: BlingProductResult[] = data.products ?? [];
        setHasMore(data.hasMore ?? false);
        cacheRef.current.set(cacheKey, list);
        setResults(list);
      } catch {
        setError("Erro ao conectar com o Bling");
        setResults([]);
      } finally {
        setLoading(false);
      }
    },
    [supplierId]
  );

  const handleQuery = useCallback(
    (value: string) => {
      setQuery(value);
      setPage(1);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => search(value, 1), 500);
    },
    [search]
  );

  const goToPage = useCallback(
    (pg: number) => {
      setPage(pg);
      search(query, pg);
    },
    [search, query]
  );

  // Dispara a busca inicial quando o popover ABRE pela primeira vez
  // Se há um código inicial (SKU já vinculado), busca por ele imediatamente
  useEffect(() => {
    if (!open || !supplierId) return;
    if (!initializedRef.current) {
      initializedRef.current = true;
      if (initialCode) {
        setQuery(initialCode);
        search(initialCode, 1);
      } else {
        search("", 1);
      }
    }
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, supplierId]);

  return { query, handleQuery, results, loading, error, page, hasMore, goToPage };
}

// ─────────────────────────────────────────────────────────────────────────────
// BlingSearchPopover — popover de busca de produtos no Bling por variação
// ─────────────────────────────────────────────────────────────────────────────

function BlingSearchPopover({
  supplierId,
  onSelect,
  open,
  onOpenChange,
  triggerContent,
  triggerLabel = "Buscar no Bling",
  initialCode = "",
}: {
  supplierId: string | null;
  onSelect: (product: BlingProductResult) => void;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  triggerContent?: React.ReactNode;
  triggerLabel?: string;
  initialCode?: string;
}) {
  const { query, handleQuery, results, loading, error, page, hasMore, goToPage } = useBlingSearch(supplierId, open, initialCode);

  const trigger = triggerContent ?? (
    <Button type="button" variant="outline" size="sm" className="gap-1.5 h-8 text-xs shrink-0"
      disabled={!supplierId}
      title={!supplierId ? "Nenhum fornecedor com Bling conectado" : undefined}
    >
      <Link2 className="h-3.5 w-3.5" />
      {triggerLabel}
    </Button>
  );

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>{trigger as React.ReactElement}</PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="start" side="bottom">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Código do produto (ex: PRD00011A)…"
            value={query}
            onValueChange={handleQuery}
          />
          {!query && (
            <p className="px-3 pt-2 pb-1 text-[11px] text-muted-foreground">
              Digite o código exato do produto, ou navegue pela lista abaixo.
            </p>
          )}
          <CommandList className="max-h-64">
            {loading && (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            )}
            {error && (
              <div className="flex items-center gap-2 px-3 py-2 text-xs text-destructive">
                <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                {error}
              </div>
            )}
            {!loading && !error && results.length === 0 && (
              <CommandEmpty>
                {query
                  ? `Código "${query}" não encontrado no Bling.`
                  : "Nenhum produto encontrado."}
              </CommandEmpty>
            )}
            {!loading && results.length > 0 && (
              <CommandGroup>
                {results.map((p) => (
                  <CommandItem
                    key={p.id}
                    value={`${p.id}-${p.name}`}
                    onSelect={() => {
                      onSelect(p);
                      onOpenChange(false);
                    }}
                    className="flex flex-col items-start gap-0.5 py-2"
                  >
                    <span className="font-medium text-sm leading-tight">{p.name}</span>
                    {p.sku && (
                      <span className="text-[11px] text-muted-foreground leading-tight">
                        Cód: {p.sku}
                      </span>
                    )}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
          {!query && (page > 1 || hasMore) && (
            <div className="flex items-center justify-between border-t px-3 py-2">
              <button
                type="button"
                onClick={() => goToPage(page - 1)}
                disabled={page <= 1 || loading}
                className="text-xs text-muted-foreground hover:text-foreground disabled:opacity-40 disabled:cursor-not-allowed"
              >
                ← Anterior
              </button>
              <span className="text-xs text-muted-foreground">Pág. {page}</span>
              <button
                type="button"
                onClick={() => goToPage(page + 1)}
                disabled={!hasMore || loading}
                className="text-xs text-muted-foreground hover:text-foreground disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Próxima →
              </button>
            </div>
          )}
        </Command>
      </PopoverContent>
    </Popover>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Tab Tiny ERP
// ─────────────────────────────────────────────────────────────────────────────

function TinyTab({
  product,
  tinyColorMap,
  setTinyColorMap,
  tinyId,
  setTinyId,
  tinyCode,
  setTinyCode,
  onSave,
  saving,
  onSyncStock,
  syncing,
  lastSync,
  liveStock,
}: {
  product: Product;
  tinyColorMap: TinyColorMap;
  setTinyColorMap: React.Dispatch<React.SetStateAction<TinyColorMap>>;
  tinyId: string;
  setTinyId: (v: string) => void;
  tinyCode: string;
  setTinyCode: (v: string) => void;
  onSave: () => void;
  saving: boolean;
  onSyncStock: () => void;
  syncing: boolean;
  lastSync: string | null;
  liveStock: number | null;
}) {
  const colors = parseColors(product.available_colors);
  const [parentPickerOpen, setParentPickerOpen] = useState(false);
  // Track which color row has its picker open
  const [openPickerKey, setOpenPickerKey] = useState<string | null>(null);

  const mappedCount = colors.filter(
    (c) => tinyColorMap[c.key]?.tiny_id
  ).length;
  const hasMappedColors = colors.length === 0 ? !!tinyId : mappedCount > 0;

  function connectColor(colorKey: string, p: TinyProductResult) {
    setTinyColorMap((prev) => ({
      ...prev,
      [colorKey]: {
        ...prev[colorKey],
        tiny_id: p.id,
        sku: p.sku ?? null,
        name: p.name,
      },
    }));
  }

  function disconnectColor(colorKey: string) {
    setTinyColorMap((prev) => ({
      ...prev,
      [colorKey]: { tiny_id: null, sku: null, name: null, tiny_stock: prev[colorKey]?.tiny_stock ?? null },
    }));
  }

  function connectParent(p: TinyProductResult) {
    setTinyId(String(p.id));
    setTinyCode(p.sku ?? "");
  }

  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2 text-base">
          <Package className="h-5 w-5" />
          Vinculação Tiny ERP
        </CardTitle>
        <CardDescription>
          Conecte este produto ao Tiny para sincronizar estoque e faturamento
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">

        {/* ── Produto pai ── */}
        <div className="rounded-lg border border-border p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold">Produto pai no Tiny</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                O produto principal do qual as variações derivam
              </p>
            </div>
            <TinySearchPopover
              open={parentPickerOpen}
              onOpenChange={setParentPickerOpen}
              onSelect={connectParent}
              triggerLabel={tinyId ? "Alterar" : "Buscar no Tiny"}
            />
          </div>

          {tinyId ? (
            <div className="flex items-center gap-2 rounded-md bg-green-500/10 border border-green-500/20 px-3 py-2">
              <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-green-800 dark:text-green-300">Conectado</p>
                <p className="text-xs text-green-700 dark:text-green-400">
                  ID: {tinyId}{tinyCode && <span className="ml-2">· SKU: {tinyCode}</span>}
                </p>
              </div>
              <button
                type="button"
                onClick={() => { setTinyId(""); setTinyCode(""); }}
                className="text-muted-foreground hover:text-destructive transition-colors"
                aria-label="Desconectar produto pai"
              >
                <Link2Off className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground italic">
              Nenhum produto pai conectado — use o botão acima para buscar.
            </p>
          )}

          {/* Campos manuais como fallback / edição fina */}
          {tinyId && (
            <div className="grid grid-cols-2 gap-3 pt-1">
              <div className="space-y-1">
                <Label className="text-xs">ID Tiny (manual)</Label>
                <Input
                  value={tinyId}
                  onChange={(e) => setTinyId(e.target.value)}
                  placeholder="Ex: 803889813"
                  className="h-8 text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">SKU pai (manual)</Label>
                <Input
                  value={tinyCode}
                  onChange={(e) => setTinyCode(e.target.value)}
                  placeholder="Ex: ESC-ADDS-IMPLANT-EM"
                  className="h-8 text-sm"
                />
              </div>
            </div>
          )}
        </div>

        {/* ── Variações por cor ── */}
        {colors.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold">Variações por cor</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Cada cor é uma variação independente no Tiny com ID e SKU próprios
                </p>
              </div>
              <Badge
                variant={mappedCount === colors.length ? "default" : mappedCount > 0 ? "secondary" : "outline"}
                className="text-xs"
              >
                {mappedCount}/{colors.length} conectadas
              </Badge>
            </div>

            <div className="rounded-lg border border-border divide-y divide-border overflow-hidden">
              {colors.map((color) => {
                const mapping = tinyColorMap[color.key] ?? {};
                const isConnected = !!mapping.tiny_id;
                const isOpen = openPickerKey === color.key;

                return (
                  <div key={color.key} className="flex items-center gap-3 px-4 py-3">
                    {/* Swatch + nome */}
                    <div
                      className="h-5 w-5 shrink-0 rounded-full border border-border/60 ring-1 ring-black/5"
                      style={{ backgroundColor: color.hex ?? "transparent" }}
                    />
                    <span className="flex-1 min-w-0 text-sm font-medium truncate">{color.label}</span>

                    {/* Status + ações */}
                    {isConnected ? (
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="text-right min-w-0">
                          <p className="text-xs font-medium text-green-700 dark:text-green-400 leading-tight">
                            {mapping.name ?? "Conectado"}
                          </p>
                          <p className="text-[11px] text-muted-foreground leading-tight">
                            ID: {mapping.tiny_id}
                            {mapping.sku && <span className="ml-1">· {mapping.sku}</span>}
                            {mapping.tiny_stock != null && (
                              <span className="ml-1 text-foreground font-medium">· {mapping.tiny_stock} un.</span>
                            )}
                          </p>
                        </div>
                        <div className="flex gap-1">
                          {/* Lápis é o único trigger do picker */}
                          <TinySearchPopover
                            open={isOpen}
                            onOpenChange={(v) => setOpenPickerKey(v ? color.key : null)}
                            onSelect={(p) => connectColor(color.key, p)}
                            parentTinyId={tinyId || null}
                            triggerContent={
                              <button
                                type="button"
                                className="h-8 w-8 flex items-center justify-center rounded-md border border-border text-muted-foreground hover:bg-muted transition-colors"
                                aria-label="Alterar conexão"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </button>
                            }
                          />
                          <button
                            type="button"
                            onClick={() => disconnectColor(color.key)}
                            className="h-8 w-8 flex items-center justify-center rounded-md border border-border text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
                            aria-label="Desconectar"
                          >
                            <Link2Off className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <TinySearchPopover
                        open={isOpen}
                        onOpenChange={(v) => setOpenPickerKey(v ? color.key : null)}
                        onSelect={(p) => connectColor(color.key, p)}
                        parentTinyId={tinyId || null}
                        triggerLabel="Conectar"
                      />
                    )}
                  </div>
                );
              })}
            </div>

            {/* Totalizador */}
            {liveStock != null && (
              <div className="flex items-center justify-between rounded-md bg-muted/50 px-3 py-2">
                <span className="text-sm text-muted-foreground">Estoque total sincronizado</span>
                <span className="text-sm font-bold">{liveStock} unid.</span>
              </div>
            )}
          </div>
        )}

        {colors.length === 0 && (
          <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
            Produto sem variações de cor. Use a seção do produto pai acima para vincular diretamente.
          </div>
        )}

        {/* ── Sync + Salvar ── */}
        <div className="flex items-center justify-between pt-2 border-t">
          <div className="text-xs text-muted-foreground">
            {lastSync ? (
              <span className="flex items-center gap-1">
                <CheckCircle2 className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />
                Última sync: {formatDate(lastSync)}
              </span>
            ) : (
              "Nunca sincronizado"
            )}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={onSyncStock}
            disabled={syncing || !hasMappedColors}
            title={!hasMappedColors ? "Conecte pelo menos uma variação antes de sincronizar" : undefined}
          >
            {syncing ? (
              <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
            )}
            {syncing ? "Sincronizando…" : "Sincronizar estoque"}
          </Button>
        </div>

        <Button onClick={onSave} disabled={saving} className="w-full">
          {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          {saving ? "Salvando…" : "Salvar vinculação Tiny"}
        </Button>
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Tab Fornecedor
// ─────────────────────────────────────────────────────────────────────────────

function SupplierTab({
  product,
  supplierName,
  setSupplierName,
  supplierCode,
  setSupplierCode,
  costPrice,
  setCostPrice,
  minOrderQty,
  setMinOrderQty,
  leadTimeDays,
  setLeadTimeDays,
  supplierColorMap,
  setSupplierColorMap,
  blingColorSkuMap,
  setBlingColorSkuMap,
  supplierId,
  setSupplierId,
  blingSuppliers,
  onSave,
  saving,
}: {
  product: Product;
  supplierName: string;
  setSupplierName: (v: string) => void;
  supplierCode: string;
  setSupplierCode: (v: string) => void;
  costPrice: string;
  setCostPrice: (v: string) => void;
  minOrderQty: string;
  setMinOrderQty: (v: string) => void;
  leadTimeDays: string;
  setLeadTimeDays: (v: string) => void;
  supplierColorMap: SupplierColorMap;
  setSupplierColorMap: React.Dispatch<React.SetStateAction<SupplierColorMap>>;
  blingColorSkuMap: Record<string, string | null>;
  setBlingColorSkuMap: React.Dispatch<React.SetStateAction<Record<string, string | null>>>;
  supplierId: string | null;
  setSupplierId: (id: string) => void;
  blingSuppliers: { id: string; name: string }[];
  onSave: () => void;
  saving: boolean;
}) {
  const colors = parseColors(product.available_colors);
  const hasVariations = colors.length > 0;
  const [openPickerKey, setOpenPickerKey] = useState<string | null>(null);
  const [globalPickerOpen, setGlobalPickerOpen] = useState(false);

  function connectColorFromBling(colorKey: string, p: BlingProductResult) {
    if (p.sku) {
      setBlingColorSkuMap((prev) => ({ ...prev, [colorKey]: p.sku }));
      setSupplierColorMap((prev) => ({
        ...prev,
        [colorKey]: { ...prev[colorKey], sku: p.sku ?? prev[colorKey]?.sku ?? null },
      }));
    }
  }

  function disconnectColorBling(colorKey: string) {
    setBlingColorSkuMap((prev) => ({ ...prev, [colorKey]: null }));
  }

  function updateColorField(colorKey: string, field: "sku" | "cost", value: string) {
    setSupplierColorMap((prev) => ({
      ...prev,
      [colorKey]: {
        ...prev[colorKey],
        [field]: field === "cost" ? (value ? parseFloat(value) : null) : (value || null),
      },
    }));
  }

  const currentCostPrice = costPrice ? parseFloat(costPrice) : product.cost_price;
  const currentMargin = calcMargin(product.price, currentCostPrice);
  const marginStyle = getMarginStyle(currentMargin);

  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2 text-base">
          <Truck className="h-5 w-5" />
          Dados do Fornecedor
        </CardTitle>
        <CardDescription>
          Custo, código Bling e condições de compra para cálculo de margem
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">

        {/* ── Informações globais ── */}
        <div className="space-y-3">
          <p className="text-sm font-semibold">Informações gerais</p>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Nome do fornecedor</Label>
              <Input
                value={supplierName}
                onChange={(e) => setSupplierName(e.target.value)}
                placeholder="Ex: XYZ Dental"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Código geral no fornecedor</Label>
              <div className="flex gap-2">
                <Input
                  value={supplierCode}
                  onChange={(e) => setSupplierCode(e.target.value)}
                  placeholder="Ex: ESC-ADDS-001"
                  className="flex-1"
                />
                {!hasVariations && (
                  <BlingSearchPopover
                    supplierId={supplierId}
                    open={globalPickerOpen}
                    onOpenChange={setGlobalPickerOpen}
                    onSelect={(p) => {
                      if (p.sku) setSupplierCode(p.sku);
                    }}
                    triggerLabel=""
                  />
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            {!hasVariations && (
              <div className="space-y-1.5">
                <Label>Custo unitário (R$)</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={costPrice}
                  onChange={(e) => setCostPrice(e.target.value)}
                  placeholder="0,00"
                />
              </div>
            )}
            <div className="space-y-1.5">
              <Label>Qtd. mínima (MOQ)</Label>
              <Input
                type="number"
                min="0"
                value={minOrderQty}
                onChange={(e) => setMinOrderQty(e.target.value)}
                placeholder="Ex: 1000"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Prazo de entrega (dias)</Label>
              <Input
                type="number"
                min="0"
                value={leadTimeDays}
                onChange={(e) => setLeadTimeDays(e.target.value)}
                placeholder="Ex: 45"
              />
            </div>
          </div>

          {!hasVariations && costPrice && product.price && (
            <div className={`rounded-lg px-4 py-3 ${marginStyle}`}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium">Margem</p>
                  <p className="text-xs mt-0.5 opacity-80">
                    {formatCurrency(parseFloat(costPrice))} custo × {formatCurrency(product.price)} venda
                  </p>
                </div>
                <p className="text-2xl font-bold">
                  {currentMargin != null ? `${currentMargin}%` : "—"}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* ── Variações por cor — vinculação ao Bling ── */}
        {hasVariations && (
          <div className="space-y-2">
            <div>
              <p className="text-sm font-semibold">Custo e SKU por variação</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Use "Buscar no Bling" para vincular cada cor ao produto correto do fornecedor.
                O código Bling é usado ao enviar pedidos automaticamente.
              </p>
            </div>

            {blingSuppliers.length > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground shrink-0">Buscar no Bling de:</span>
                <Select value={supplierId ?? ""} onValueChange={setSupplierId}>
                  <SelectTrigger className="h-7 text-xs flex-1">
                    <SelectValue placeholder="Selecionar fornecedor..." />
                  </SelectTrigger>
                  <SelectContent>
                    {blingSuppliers.map((s) => (
                      <SelectItem key={s.id} value={s.id} className="text-xs">
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="rounded-lg border border-border divide-y divide-border overflow-hidden">
              {colors.map((color) => {
                const entry = supplierColorMap[color.key] ?? {};
                const isOpen = openPickerKey === color.key;
                const costVal = entry.cost != null ? String(entry.cost) : "";
                const colorMargin = calcMargin(product.price, entry.cost ?? null);
                const colorMarginStyle = getMarginStyle(colorMargin);
                const linkedBlingSku = blingColorSkuMap[color.key];

                return (
                  <div key={color.key} className="px-4 py-3 space-y-2">
                    <div className="flex items-center gap-3">
                      <div
                        className="h-5 w-5 shrink-0 rounded-full border border-border/60 ring-1 ring-black/5"
                        style={{ backgroundColor: color.hex ?? "transparent" }}
                      />
                      <span className="text-sm font-medium flex-1">{color.label}</span>

                      {/* Bling SKU vinculado ou botão para buscar */}
                      {linkedBlingSku ? (
                        <div className="flex items-center gap-1.5">
                          <Badge variant="secondary" className="text-xs font-mono gap-1">
                            <CheckCircle2 className="h-3 w-3 text-green-600 dark:text-green-400" />
                            {linkedBlingSku}
                          </Badge>
                          <BlingSearchPopover
                            supplierId={supplierId}
                            open={isOpen}
                            onOpenChange={(v) => setOpenPickerKey(v ? color.key : null)}
                            onSelect={(p) => connectColorFromBling(color.key, p)}
                            initialCode={linkedBlingSku ?? ""}
                            triggerContent={
                              <button
                                type="button"
                                className="h-7 w-7 flex items-center justify-center rounded-md border border-border text-muted-foreground hover:bg-muted transition-colors"
                                aria-label="Alterar produto Bling"
                              >
                                <Pencil className="h-3 w-3" />
                              </button>
                            }
                          />
                          <button
                            type="button"
                            onClick={() => disconnectColorBling(color.key)}
                            className="h-7 w-7 flex items-center justify-center rounded-md border border-border text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
                            aria-label="Desconectar Bling"
                          >
                            <Link2Off className="h-3 w-3" />
                          </button>
                        </div>
                      ) : (
                        <BlingSearchPopover
                          supplierId={supplierId}
                          open={isOpen}
                          onOpenChange={(v) => setOpenPickerKey(v ? color.key : null)}
                          onSelect={(p) => connectColorFromBling(color.key, p)}
                          triggerLabel="Buscar no Bling"
                        />
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-2 pl-8">
                      <div className="space-y-1">
                        <Label className="text-xs">SKU no fornecedor</Label>
                        <Input
                          value={entry.sku ?? ""}
                          onChange={(e) => updateColorField(color.key, "sku", e.target.value)}
                          placeholder="Ex: PRD00011A"
                          className="h-8 text-sm"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Custo unitário (R$)</Label>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          value={costVal}
                          onChange={(e) => updateColorField(color.key, "cost", e.target.value)}
                          placeholder="0,00"
                          className="h-8 text-sm"
                        />
                      </div>
                    </div>

                    {entry.cost != null && product.price && (
                      <div className={`ml-8 rounded px-3 py-1.5 text-xs ${colorMarginStyle}`}>
                        <span className="font-medium">Margem: {colorMargin != null ? `${colorMargin}%` : "—"}</span>
                        <span className="opacity-70 ml-2">
                          {formatCurrency(entry.cost)} custo × {formatCurrency(product.price)} venda
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="space-y-1.5 pt-1">
              <Label className="text-xs text-muted-foreground">
                Custo padrão (usado quando a variação não tem custo definido)
              </Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={costPrice}
                onChange={(e) => setCostPrice(e.target.value)}
                placeholder="0,00"
                className="h-8 text-sm"
              />
            </div>
          </div>
        )}

        <Button onClick={onSave} disabled={saving} className="w-full">
          {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          {saving ? "Salvando…" : "Salvar dados do fornecedor"}
        </Button>
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Tab Financeiro (read-only)
// ─────────────────────────────────────────────────────────────────────────────

function FinancialTab({
  product,
  liveStock,
  lastSync,
  supplierColorMap,
}: {
  product: Product;
  liveStock: number | null;
  lastSync: string | null;
  supplierColorMap: SupplierColorMap;
}) {
  const colors = parseColors(product.available_colors);
  const savedMargin = calcMargin(product.price, product.cost_price);
  const savedMarginStyle = getMarginStyle(savedMargin);
  const stockTotal = liveStock ?? product.tiny_stock ?? null;

  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2 text-base">
          <DollarSign className="h-5 w-5" />
          Resumo Financeiro
        </CardTitle>
        <CardDescription>Análise de margem e valor do estoque</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center p-4 rounded-lg bg-muted/50">
            <p className="text-xs text-muted-foreground mb-1">Custo base</p>
            <p className="text-xl font-bold">{formatCurrency(product.cost_price)}</p>
            {!product.cost_price && (
              <p className="text-xs text-muted-foreground mt-1 opacity-70">← Aba Fornecedor</p>
            )}
          </div>
          <div className="text-center p-4 rounded-lg bg-muted/50">
            <p className="text-xs text-muted-foreground mb-1">Preço de venda</p>
            <p className="text-xl font-bold">{formatCurrency(product.price)}</p>
          </div>
          <div className={`text-center p-4 rounded-lg ${savedMarginStyle}`}>
            <p className="text-xs mb-1">Margem base</p>
            <p className="text-xl font-bold">
              {savedMargin != null ? `${savedMargin}%` : "—"}
            </p>
          </div>
        </div>

        {/* Margens por variação */}
        {colors.length > 0 && Object.keys(supplierColorMap).length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-semibold">Margem por variação</p>
            <div className="rounded-lg border border-border divide-y divide-border overflow-hidden">
              {colors.map((color) => {
                const entry = supplierColorMap[color.key];
                const margin = entry?.cost != null ? calcMargin(product.price, entry.cost) : null;
                const ms = getMarginStyle(margin);
                return (
                  <div key={color.key} className="flex items-center gap-3 px-4 py-2.5">
                    <div
                      className="h-4 w-4 shrink-0 rounded-full border border-border/60"
                      style={{ backgroundColor: color.hex ?? "transparent" }}
                    />
                    <span className="flex-1 text-sm">{color.label}</span>
                    {entry?.sku && (
                      <span className="text-xs text-muted-foreground">{entry.sku}</span>
                    )}
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded ${ms}`}>
                      {entry?.cost != null ? (margin != null ? `${margin}%` : "—") : "Sem custo"}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Estoque */}
        {stockTotal != null && (
          <div className="flex items-center justify-between rounded-lg bg-muted/50 px-4 py-3">
            <div>
              <p className="text-xs text-muted-foreground">Estoque Tiny</p>
              <p className="text-lg font-bold">{stockTotal} unid.</p>
            </div>
            {lastSync && (
              <p className="text-xs text-muted-foreground text-right">
                Sync: {formatDate(lastSync)}
              </p>
            )}
          </div>
        )}

        {/* Valor do estoque */}
        {stockTotal != null && product.cost_price && (
          <div className="grid grid-cols-2 gap-4 pt-4 border-t">
            <div className="rounded-lg bg-muted/50 p-4">
              <p className="text-xs text-muted-foreground mb-1">Valor em estoque (custo)</p>
              <p className="text-lg font-semibold">
                {formatCurrency(product.cost_price * stockTotal)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {stockTotal} × {formatCurrency(product.cost_price)}
              </p>
            </div>
            <div className="rounded-lg bg-muted/50 p-4">
              <p className="text-xs text-muted-foreground mb-1">Valor em estoque (venda)</p>
              <p className="text-lg font-semibold">
                {formatCurrency(product.price != null ? product.price * stockTotal : null)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {stockTotal} × {formatCurrency(product.price)}
              </p>
            </div>
          </div>
        )}

        {(product.supplier_name || product.min_order_qty || product.lead_time_days) && (
          <div className="pt-4 border-t space-y-3">
            <p className="text-sm font-medium">Condições de compra</p>
            <div className="grid grid-cols-3 gap-4">
              {product.supplier_name && (
                <div>
                  <p className="text-xs text-muted-foreground">Fornecedor</p>
                  <p className="text-sm font-medium">{product.supplier_name}</p>
                </div>
              )}
              {product.min_order_qty != null && (
                <div>
                  <p className="text-xs text-muted-foreground">MOQ</p>
                  <p className="text-sm font-medium">{product.min_order_qty} unid.</p>
                </div>
              )}
              {product.lead_time_days != null && (
                <div>
                  <p className="text-xs text-muted-foreground">Prazo</p>
                  <p className="text-sm font-medium">{product.lead_time_days} dias</p>
                </div>
              )}
            </div>
          </div>
        )}

        {!product.cost_price && (
          <div className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
            Informe o custo na aba <strong>Fornecedor</strong> para ver o resumo completo.
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Dialog principal
// ─────────────────────────────────────────────────────────────────────────────

export function ProductIntegrationsDialog({
  open,
  onOpenChange,
  product,
  onSaved,
}: ProductIntegrationsDialogProps) {
  const supabase = createClient();

  // Tiny state
  const [tinyId, setTinyId] = useState("");
  const [tinyCode, setTinyCode] = useState("");
  const [tinyColorMap, setTinyColorMap] = useState<TinyColorMap>({});
  const [savingTiny, setSavingTiny] = useState(false);
  const [syncingStock, setSyncingStock] = useState(false);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [liveStock, setLiveStock] = useState<number | null>(null);

  // Supplier state
  const [supplierName, setSupplierName] = useState("");
  const [supplierCode, setSupplierCode] = useState("");
  const [costPrice, setCostPrice] = useState("");
  const [minOrderQty, setMinOrderQty] = useState("");
  const [leadTimeDays, setLeadTimeDays] = useState("");
  const [supplierColorMap, setSupplierColorMap] = useState<SupplierColorMap>({});
  const [blingColorSkuMap, setBlingColorSkuMap] = useState<Record<string, string | null>>({});
  const [supplierId, setSupplierId] = useState<string | null>(null);
  const [blingSuppliers, setBlingSuppliers] = useState<{ id: string; name: string }[]>([]);
  const [savingSupplier, setSavingSupplier] = useState(false);

  const colors = parseColors(product.available_colors);
  const mappedTinyCount = colors.filter((c) => tinyColorMap[c.key]?.tiny_id).length;

  useEffect(() => {
    if (!open) return;
    setTinyId(product.tiny_id ? String(product.tiny_id) : "");
    setTinyCode(product.tiny_code ?? "");
    setTinyColorMap(parseTinyColorMap(product.tiny_color_map));
    setSupplierName(product.supplier_name ?? "");
    setSupplierCode(product.supplier_code ?? "");
    setCostPrice(product.cost_price != null ? String(product.cost_price) : "");
    setMinOrderQty(product.min_order_qty != null ? String(product.min_order_qty) : "");
    setLeadTimeDays(product.lead_time_days != null ? String(product.lead_time_days) : "");
    setSupplierColorMap(parseSupplierColorMap((product as any).supplier_color_map));
    // Carrega bling_color_sku_map do produto (Record<colorKey, blingSku>)
    const rawBling = product.bling_color_sku_map;
    if (rawBling && typeof rawBling === "object" && !Array.isArray(rawBling)) {
      setBlingColorSkuMap(rawBling as Record<string, string | null>);
    } else {
      setBlingColorSkuMap({});
    }
    setLastSync(product.last_stock_sync ?? null);
    setLiveStock(product.tiny_stock ?? null);

    // Busca todos os fornecedores com Bling conectado para o seletor
    supabase
      .from("suppliers")
      .select("id, name")
      .or("bling_access_token.not.is.null,bling_api_token.not.is.null")
      .eq("is_active", true)
      .order("name")
      .then(({ data }) => {
        const list = (data ?? []) as { id: string; name: string }[];
        setBlingSuppliers(list);
        if (list.length > 0) {
          // Auto-seleciona pelo supplier_name do produto (busca parcial case-insensitive)
          const pName = (product.supplier_name ?? "").toLowerCase();
          const match = pName
            ? list.find(
                (s) =>
                  s.name.toLowerCase().includes(pName) ||
                  pName.includes(s.name.toLowerCase())
              )
            : null;
          setSupplierId(match?.id ?? list[0].id);
        }
      });
  }, [open, product]);

  async function handleSaveTiny() {
    setSavingTiny(true);
    try {
      const { error } = await supabase
        .from("products")
        .update({
          tiny_id: tinyId ? parseInt(tinyId) : null,
          tiny_code: tinyCode || null,
          tiny_color_map: tinyColorMap as Json,
        })
        .eq("id", product.id);
      if (error) throw error;
      toast.success("Vinculação Tiny salva com sucesso.");
      onSaved?.({
        tiny_id: tinyId ? parseInt(tinyId) : null,
        tiny_code: tinyCode || null,
        tiny_color_map: tinyColorMap as Json,
      });
    } catch {
      toast.error("Erro ao salvar vinculação Tiny.");
    } finally {
      setSavingTiny(false);
    }
  }

  async function handleSyncStock() {
    setSyncingStock(true);
    try {
      const res = await fetch("/api/tiny/product-stock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ product_id: product.id }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 422) {
          toast.info(data.error ?? "Configure o Tiny ERP em Configurações > Integrações.");
          return;
        }
        if (res.status === 401 && data.code === "TINY_RECONNECT") {
          toast.error("Sessão Tiny expirada. Reconecte em Configurações > Integrações.");
          return;
        }
        throw new Error(data.error ?? "Erro ao sincronizar estoque");
      }
      if (data.color_map) setTinyColorMap(data.color_map);
      setLiveStock(data.total_stock ?? null);
      setLastSync(new Date().toISOString());
      const syncedMsg = data.synced > 0
        ? `${data.synced} variante(s) · Estoque total: ${data.total_stock ?? 0}`
        : "Nenhuma variante com ID Tiny mapeado";
      if (data.errors?.length) {
        toast.warning(`Sync parcial: ${syncedMsg}. ${data.errors.length} erro(s).`);
      } else {
        toast.success(`Estoque sincronizado! ${syncedMsg}`);
      }
      onSaved?.({
        tiny_stock: data.total_stock,
        last_stock_sync: new Date().toISOString(),
        tiny_color_map: data.color_map as Json,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro desconhecido";
      toast.error(`Erro ao sincronizar: ${msg}`);
    } finally {
      setSyncingStock(false);
    }
  }

  async function handleSaveSupplier() {
    setSavingSupplier(true);
    try {
      // Filtra blingColorSkuMap: remove entradas nulas para manter o objeto limpo
      const cleanBlingMap = Object.fromEntries(
        Object.entries(blingColorSkuMap).filter(([, v]) => v != null && v !== "")
      );

      const { error } = await supabase
        .from("products")
        .update({
          cost_price: costPrice ? parseFloat(costPrice) : null,
          supplier_name: supplierName || null,
          supplier_code: supplierCode || null,
          min_order_qty: minOrderQty ? parseInt(minOrderQty) : null,
          lead_time_days: leadTimeDays ? parseInt(leadTimeDays) : null,
          // supplier_color_map omitted: migration 20260327100000 pending — apply via Supabase Dashboard SQL:
          // ALTER TABLE products ADD COLUMN IF NOT EXISTS supplier_color_map JSONB DEFAULT NULL;
          bling_color_sku_map: Object.keys(cleanBlingMap).length > 0
            ? cleanBlingMap as Json
            : null,
        } as any)
        .eq("id", product.id);
      if (error) throw error;
      toast.success("Dados do fornecedor salvos com sucesso.");
      onSaved?.({
        cost_price: costPrice ? parseFloat(costPrice) : null,
        supplier_name: supplierName || null,
        supplier_code: supplierCode || null,
        min_order_qty: minOrderQty ? parseInt(minOrderQty) : null,
        lead_time_days: leadTimeDays ? parseInt(leadTimeDays) : null,
      });
    } catch {
      toast.error("Erro ao salvar dados do fornecedor.");
    } finally {
      setSavingSupplier(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl flex flex-col overflow-hidden">
        <DialogHeader className="shrink-0">
          <DialogTitle className="flex items-center gap-2">
            {product.image_url && (
              <img src={product.image_url} alt="" className="h-6 w-6 rounded object-cover" />
            )}
            <span>{product.name}</span>
            <Badge variant="outline" className="ml-1 text-xs font-normal">Integrações</Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto pr-1">
          <Tabs defaultValue="tiny" className="space-y-4">
            <TabsList className="w-full">
              <TabsTrigger value="tiny" className="flex-1 gap-1.5">
                <Package className="h-4 w-4" />
                Tiny ERP
                {colors.length > 0 && (
                  <Badge
                    variant={mappedTinyCount === colors.length ? "default" : mappedTinyCount > 0 ? "secondary" : "destructive"}
                    className="ml-1 text-xs px-1.5 py-0"
                  >
                    {mappedTinyCount}/{colors.length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="supplier" className="flex-1 gap-1.5">
                <Truck className="h-4 w-4" />
                Fornecedor
                {product.cost_price != null && (
                  <CheckCircle2 className="h-3.5 w-3.5 text-green-600 dark:text-green-400 ml-1" />
                )}
              </TabsTrigger>
              <TabsTrigger value="financial" className="flex-1 gap-1.5">
                <DollarSign className="h-4 w-4" />
                Financeiro
              </TabsTrigger>
            </TabsList>

            <TabsContent value="tiny" className="mt-0">
              <TinyTab
                product={product}
                tinyColorMap={tinyColorMap}
                setTinyColorMap={setTinyColorMap}
                tinyId={tinyId}
                setTinyId={setTinyId}
                tinyCode={tinyCode}
                setTinyCode={setTinyCode}
                onSave={handleSaveTiny}
                saving={savingTiny}
                onSyncStock={handleSyncStock}
                syncing={syncingStock}
                lastSync={lastSync}
                liveStock={liveStock}
              />
            </TabsContent>

            <TabsContent value="supplier" className="mt-0">
              <SupplierTab
                product={product}
                supplierName={supplierName}
                setSupplierName={setSupplierName}
                supplierCode={supplierCode}
                setSupplierCode={setSupplierCode}
                costPrice={costPrice}
                setCostPrice={setCostPrice}
                minOrderQty={minOrderQty}
                setMinOrderQty={setMinOrderQty}
                leadTimeDays={leadTimeDays}
                setLeadTimeDays={setLeadTimeDays}
                supplierColorMap={supplierColorMap}
                setSupplierColorMap={setSupplierColorMap}
                blingColorSkuMap={blingColorSkuMap}
                setBlingColorSkuMap={setBlingColorSkuMap}
                supplierId={supplierId}
                setSupplierId={setSupplierId}
                blingSuppliers={blingSuppliers}
                onSave={handleSaveSupplier}
                saving={savingSupplier}
              />
            </TabsContent>

            <TabsContent value="financial" className="mt-0">
              <FinancialTab
                product={product}
                liveStock={liveStock}
                lastSync={lastSync}
                supplierColorMap={supplierColorMap}
              />
            </TabsContent>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
}
