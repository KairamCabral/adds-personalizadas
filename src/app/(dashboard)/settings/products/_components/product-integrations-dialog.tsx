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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Package,
  Truck,
  DollarSign,
  RefreshCw,
  Search,
  CheckCircle2,
  AlertCircle,
  Loader2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import type { Product } from "@/types/database.types";
import type { Json } from "@/types/database.types";
import type { TinyProductResult } from "@/app/api/tiny/products/route";

interface ColorEntry {
  key: string;
  label: string;
  hex?: string | null;
  image_url?: string | null;
}

interface ColorMapping {
  tiny_id?: number | null;
  sku?: string | null;
  tiny_stock?: number | null;
}

type TinyColorMap = Record<string, ColorMapping>;

interface ProductIntegrationsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: Product;
  onSaved?: (updated: Partial<Product>) => void;
}

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
  return raw as ColorEntry[];
}

function parseTinyColorMap(raw: Json | null): TinyColorMap {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  return raw as TinyColorMap;
}

// ─── Componente de busca de produtos no Tiny ──────────────────────────────────

function TinyProductPicker({
  onSelect,
}: {
  onSelect: (product: TinyProductResult) => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<TinyProductResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const search = useCallback(async (q: string) => {
    setLoading(true);
    setError(null);
    try {
      const url = q.length >= 2
        ? `/api/tiny/products?q=${encodeURIComponent(q)}&limit=30`
        : `/api/tiny/products?limit=30`;
      const res = await fetch(url);
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Erro ao buscar produtos");
        setResults([]);
        return;
      }
      setResults(data.products ?? []);
      setSearched(true);
    } catch {
      setError("Erro ao conectar com o Tiny");
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleQueryChange = (value: string) => {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(value), 500);
  };

  // Carregar lista inicial ao montar
  useEffect(() => {
    search("");
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [search]);

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        <Input
          value={query}
          onChange={(e) => handleQueryChange(e.target.value)}
          placeholder="Buscar produto no Tiny por nome ou SKU…"
          className="pl-9"
        />
        {loading && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
        )}
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          {error}
        </div>
      )}

      {results.length > 0 && (
        <div className="max-h-56 overflow-y-auto rounded-md border divide-y text-sm">
          {results.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => onSelect(p)}
              className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-muted/60 text-left transition-colors"
            >
              <div className="min-w-0">
                <p className="font-medium truncate">{p.name}</p>
                <p className="text-xs text-muted-foreground">
                  {p.sku && <span className="mr-2">SKU: {p.sku}</span>}
                  {p.tipo && <span className="mr-2 capitalize">{p.tipo}</span>}
                  {p.parent_name && (
                    <span className="text-primary/80">→ {p.parent_name}</span>
                  )}
                </p>
              </div>
              <div className="shrink-0 text-right ml-4 space-y-0.5">
                {p.cost_price != null && (
                  <p className="text-xs font-semibold text-green-700 dark:text-green-400">
                    Custo: {formatCurrency(p.cost_price)}
                  </p>
                )}
                {p.price != null && (
                  <p className="text-xs text-muted-foreground">
                    Venda: {formatCurrency(p.price)}
                  </p>
                )}
              </div>
            </button>
          ))}
        </div>
      )}

      {searched && results.length === 0 && !loading && !error && (
        <p className="text-xs text-center text-muted-foreground py-4">
          Nenhum produto encontrado no Tiny
        </p>
      )}
    </div>
  );
}

// ─── Dialog principal ─────────────────────────────────────────────────────────

export function ProductIntegrationsDialog({
  open,
  onOpenChange,
  product,
  onSaved,
}: ProductIntegrationsDialogProps) {
  const supabase = createClient();

  // Tiny
  const [tinyId, setTinyId] = useState<string>("");
  const [tinyCode, setTinyCode] = useState<string>("");
  const [tinyColorMap, setTinyColorMap] = useState<TinyColorMap>({});
  const [savingTiny, setSavingTiny] = useState(false);
  const [syncingStock, setSyncingStock] = useState(false);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [liveStock, setLiveStock] = useState<number | null>(null);

  // Fornecedor
  const [supplierName, setSupplierName] = useState<string>("");
  const [supplierCode, setSupplierCode] = useState<string>("");
  const [costPrice, setCostPrice] = useState<string>("");
  const [minOrderQty, setMinOrderQty] = useState<string>("");
  const [leadTimeDays, setLeadTimeDays] = useState<string>("");
  const [savingSupplier, setSavingSupplier] = useState(false);
  const [showTinyPicker, setShowTinyPicker] = useState(false);

  const colors = parseColors(product.available_colors);
  const liveColorMap = tinyColorMap;

  // Margem calculada em tempo real (usa o custo do form se digitado, senão do banco)
  const currentCostPrice = costPrice ? parseFloat(costPrice) : product.cost_price;
  const currentMargin = calcMargin(product.price, currentCostPrice);
  const marginStyle = getMarginStyle(currentMargin);

  const savedMargin = calcMargin(product.price, product.cost_price);
  const savedMarginStyle = getMarginStyle(savedMargin);

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
    setLastSync(product.last_stock_sync ?? null);
    setLiveStock(product.tiny_stock ?? null);
    setShowTinyPicker(false);
  }, [open, product]);

  const updateColorMapping = useCallback(
    (colorKey: string, field: keyof ColorMapping, value: string) => {
      setTinyColorMap((prev) => ({
        ...prev,
        [colorKey]: {
          ...prev[colorKey],
          [field]:
            field === "tiny_id"
              ? value ? parseInt(value) : null
              : value || null,
        },
      }));
    },
    []
  );

  // Quantas cores estão com tiny_id ou sku mapeados
  const mappedCount = colors.filter(
    (c) => liveColorMap[c.key]?.tiny_id || liveColorMap[c.key]?.sku
  ).length;
  const hasMappedColors = colors.length === 0 ? !!tinyId : mappedCount > 0;

  async function handleSaveTinyMapping() {
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

      // Atualizar estado local com dados retornados
      if (data.color_map) {
        setTinyColorMap(data.color_map);
      }
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
      const { error } = await supabase
        .from("products")
        .update({
          cost_price: costPrice ? parseFloat(costPrice) : null,
          supplier_name: supplierName || null,
          supplier_code: supplierCode || null,
          min_order_qty: minOrderQty ? parseInt(minOrderQty) : null,
          lead_time_days: leadTimeDays ? parseInt(leadTimeDays) : null,
        })
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

  // Preencher dados do fornecedor a partir de um produto do Tiny
  function handleTinyProductSelected(p: TinyProductResult) {
    if (p.sku) setSupplierCode(p.sku);
    if (p.cost_price != null) setCostPrice(String(p.cost_price));
    setShowTinyPicker(false);
    toast.success(`Dados preenchidos: ${p.name}${p.cost_price != null ? ` · Custo: ${formatCurrency(p.cost_price)}` : ""}`);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-3xl flex flex-col overflow-hidden">
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
                    variant={mappedCount === colors.length ? "default" : mappedCount > 0 ? "secondary" : "destructive"}
                    className="ml-1 text-xs px-1.5 py-0"
                  >
                    {mappedCount}/{colors.length}
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

            {/* ═══ ABA TINY ════════════════════════════════════════════════════ */}
            <TabsContent value="tiny" className="mt-0">
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
                  {/* Produto pai */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label>ID do produto pai no Tiny</Label>
                      <Input
                        value={tinyId}
                        onChange={(e) => setTinyId(e.target.value)}
                        placeholder="Ex: 803889813"
                      />
                      <p className="text-xs text-muted-foreground">
                        Clique em &quot;acessar produto pai&quot; no Tiny e copie o número da URL
                      </p>
                    </div>
                    <div className="space-y-1.5">
                      <Label>Código Tiny (SKU pai)</Label>
                      <Input
                        value={tinyCode}
                        onChange={(e) => setTinyCode(e.target.value)}
                        placeholder="Ex: ESC-ADDS-IMPLANT-EM"
                      />
                    </div>
                  </div>

                  {/* Mapeamento de cores */}
                  {colors.length > 0 && (
                    <div className="space-y-2">
                      <div>
                        <Label className="text-sm font-semibold">Mapeamento de Cores / Variações</Label>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Cada cor é uma variação independente no Tiny com ID e SKU próprios.
                          Abra cada variação no Tiny e copie o número da URL.
                        </p>
                      </div>

                      <div className="rounded-md border">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="w-[130px]">Cor (CRM)</TableHead>
                              <TableHead className="w-10">Hex</TableHead>
                              <TableHead>ID Tiny (variação)</TableHead>
                              <TableHead>SKU Tiny</TableHead>
                              <TableHead className="w-20 text-right">Estoque</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {colors.map((color) => {
                              const mapping = liveColorMap[color.key] ?? {};
                              const hasTinyId = !!mapping.tiny_id;
                              return (
                                <TableRow key={color.key}>
                                  <TableCell className="py-2 font-medium">
                                    <span className={hasTinyId ? "" : "text-muted-foreground"}>
                                      {color.label}
                                    </span>
                                  </TableCell>
                                  <TableCell className="py-2">
                                    <div
                                      className="h-5 w-5 rounded-full border border-border"
                                      style={{ backgroundColor: color.hex ?? "transparent" }}
                                    />
                                  </TableCell>
                                  <TableCell className="py-2">
                                    <Input
                                      value={mapping.tiny_id != null ? String(mapping.tiny_id) : ""}
                                      onChange={(e) => updateColorMapping(color.key, "tiny_id", e.target.value)}
                                      placeholder="ID Tiny"
                                      className="h-8 w-32"
                                    />
                                  </TableCell>
                                  <TableCell className="py-2">
                                    <Input
                                      value={mapping.sku ?? ""}
                                      onChange={(e) => updateColorMapping(color.key, "sku", e.target.value)}
                                      placeholder="SKU"
                                      className="h-8 w-28"
                                    />
                                  </TableCell>
                                  <TableCell className="py-2 text-right">
                                    {mapping.tiny_stock != null ? (
                                      <span className="text-sm font-medium">
                                        {mapping.tiny_stock}
                                      </span>
                                    ) : (
                                      <span className="text-sm text-muted-foreground">—</span>
                                    )}
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
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
                    <div className="rounded-md border p-4 text-sm text-muted-foreground">
                      Produto sem variações de cor. Use os campos acima para vincular diretamente.
                    </div>
                  )}

                  {/* Sync */}
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
                      onClick={handleSyncStock}
                      disabled={syncingStock || !hasMappedColors}
                      title={!hasMappedColors ? "Mapeie pelo menos uma cor antes de sincronizar" : undefined}
                    >
                      {syncingStock ? (
                        <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                      ) : (
                        <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                      )}
                      {syncingStock ? "Sincronizando…" : "Sincronizar estoque"}
                    </Button>
                  </div>

                  <Button onClick={handleSaveTinyMapping} disabled={savingTiny} className="w-full">
                    {savingTiny ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                    {savingTiny ? "Salvando…" : "Salvar vinculação Tiny"}
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>

            {/* ═══ ABA FORNECEDOR ══════════════════════════════════════════════ */}
            <TabsContent value="supplier" className="mt-0">
              <Card>
                <CardHeader className="pb-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <CardTitle className="flex items-center gap-2 text-base">
                        <Truck className="h-5 w-5" />
                        Dados do Fornecedor
                      </CardTitle>
                      <CardDescription>
                        Custo, código e condições de compra para cálculo de margem
                      </CardDescription>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setShowTinyPicker((v) => !v)}
                    >
                      {showTinyPicker ? (
                        <X className="h-3.5 w-3.5 mr-1.5" />
                      ) : (
                        <Search className="h-3.5 w-3.5 mr-1.5" />
                      )}
                      {showTinyPicker ? "Fechar busca" : "Buscar no Tiny"}
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Busca inteligente no Tiny */}
                  {showTinyPicker && (
                    <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
                      <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                        <Package className="h-3.5 w-3.5" />
                        Selecione um produto do Tiny para preencher automaticamente o código e custo
                      </p>
                      <TinyProductPicker onSelect={handleTinyProductSelected} />
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label>Nome do fornecedor</Label>
                      <Input
                        value={supplierName}
                        onChange={(e) => setSupplierName(e.target.value)}
                        placeholder="Ex: XYZ Dental"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Código do produto no fornecedor</Label>
                      <Input
                        value={supplierCode}
                        onChange={(e) => setSupplierCode(e.target.value)}
                        placeholder="Ex: ESC-ADDS-IMPLANT-EM-2"
                      />
                      <p className="text-xs text-muted-foreground">
                        Preenchido automaticamente ao buscar no Tiny
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4">
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
                      <p className="text-xs text-muted-foreground">
                        Preenchido do campo &quot;Custo&quot; do Tiny
                      </p>
                    </div>
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

                  {/* Preview de margem ao digitar custo */}
                  {costPrice && product.price && (
                    <div className={`rounded-lg px-4 py-3 ${marginStyle}`}>
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs font-medium">Preview da margem</p>
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

                  <Button onClick={handleSaveSupplier} disabled={savingSupplier} className="w-full">
                    {savingSupplier ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                    {savingSupplier ? "Salvando…" : "Salvar dados do fornecedor"}
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>

            {/* ═══ ABA FINANCEIRO ══════════════════════════════════════════════ */}
            <TabsContent value="financial" className="mt-0">
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
                      <p className="text-xs text-muted-foreground mb-1">Custo unitário</p>
                      <p className="text-xl font-bold">{formatCurrency(product.cost_price)}</p>
                      {!product.cost_price && (
                        <p className="text-xs text-muted-foreground mt-1 opacity-70">
                          ← Aba Fornecedor
                        </p>
                      )}
                    </div>
                    <div className="text-center p-4 rounded-lg bg-muted/50">
                      <p className="text-xs text-muted-foreground mb-1">Preço de venda</p>
                      <p className="text-xl font-bold">{formatCurrency(product.price)}</p>
                    </div>
                    <div className={`text-center p-4 rounded-lg ${savedMarginStyle}`}>
                      <p className="text-xs mb-1">Margem</p>
                      <p className="text-xl font-bold">
                        {savedMargin != null ? `${savedMargin}%` : "—"}
                      </p>
                    </div>
                  </div>

                  {/* Estoque */}
                  {(liveStock != null || product.tiny_stock != null) && (
                    <div className="flex items-center justify-between rounded-lg bg-muted/50 px-4 py-3">
                      <div>
                        <p className="text-xs text-muted-foreground">Estoque Tiny</p>
                        <p className="text-lg font-bold">{liveStock ?? product.tiny_stock} unid.</p>
                      </div>
                      {lastSync && (
                        <p className="text-xs text-muted-foreground text-right">
                          Sync: {formatDate(lastSync)}
                        </p>
                      )}
                    </div>
                  )}

                  {/* Valor do estoque */}
                  {(liveStock != null || product.tiny_stock != null) && product.cost_price && (
                    <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                      <div className="rounded-lg bg-muted/50 p-4">
                        <p className="text-xs text-muted-foreground mb-1">Valor em estoque (custo)</p>
                        <p className="text-lg font-semibold">
                          {formatCurrency(product.cost_price * (liveStock ?? product.tiny_stock ?? 0))}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {liveStock ?? product.tiny_stock} × {formatCurrency(product.cost_price)}
                        </p>
                      </div>
                      <div className="rounded-lg bg-muted/50 p-4">
                        <p className="text-xs text-muted-foreground mb-1">Valor em estoque (venda)</p>
                        <p className="text-lg font-semibold">
                          {formatCurrency(
                            product.price != null
                              ? product.price * (liveStock ?? product.tiny_stock ?? 0)
                              : null
                          )}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {liveStock ?? product.tiny_stock} × {formatCurrency(product.price)}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Dados de compra resumidos */}
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
                      Informe o custo unitário na aba <strong>Fornecedor</strong> para ver o resumo completo.
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
}
