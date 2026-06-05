"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Save } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getActiveProducts } from "@/services/products.service";
import {
  getPricingTiers,
  upsertPricingTier,
  type SalesChannel,
} from "@/services/pricing.service";

// CONSUMIDOR/DISTRIBUIDORA/VAREJISTA usam faixa única (min_qty=1).
// DENTISTA usa faixas lidas do banco (dinâmicas por produto).
const FIXED_CHANNEL_TIERS: {
  channel: SalesChannel;
  label: string;
  minQtys: number[];
}[] = [
  { channel: "CONSUMIDOR", label: "Consumidor", minQtys: [1] },
  { channel: "DISTRIBUIDORA", label: "Distribuidora", minQtys: [1] },
  { channel: "VAREJISTA", label: "Varejista", minQtys: [1] },
];

const DENTISTA_FALLBACK_MIN_QTYS = [24, 36, 72, 120, 240];

function rowKey(channel: string, minQty: number) {
  return `${channel}:${minQty}`;
}

function parsePrice(raw: string): number | null {
  const normalized = raw.trim().replace(/\s/g, "").replace(",", ".");
  if (normalized === "") return null;
  const n = Number(normalized);
  if (Number.isNaN(n) || n < 0) return null;
  return n;
}

export function ChannelPricesSection() {
  const queryClient = useQueryClient();
  const [productId, setProductId] = useState<string>("");
  const [edits, setEdits] = useState<Record<string, string>>({});

  const { data: products = [], isLoading: productsLoading } = useQuery({
    queryKey: ["products", "active"],
    queryFn: getActiveProducts,
  });

  const { data: tiers = [], isLoading: tiersLoading } = useQuery({
    queryKey: ["pricing-tiers", productId],
    queryFn: () => getPricingTiers(productId),
    enabled: !!productId,
  });

  // Seleciona o primeiro produto automaticamente
  useEffect(() => {
    if (!productId && products.length > 0) {
      setProductId(products[0].id);
    }
  }, [products, productId]);

  // Reinicia o rascunho ao trocar de produto. (Após salvar, o onSuccess da
  // mutation já limpa os edits; não depender de `tiers` aqui evita loop de
  // re-render, pois o default `= []` cria nova referência a cada render.)
  useEffect(() => {
    setEdits({});
  }, [productId]);

  const original = useMemo(() => {
    const map: Record<string, string> = {};
    for (const t of tiers) {
      map[rowKey(t.channel, t.min_qty)] = String(t.unit_price);
    }
    return map;
  }, [tiers]);

  // Faixas DENTISTA extraídas dos tiers já carregados do banco.
  // Fallback para faixas padrão se o banco ainda não tiver dados para este produto.
  const dentistMinQtys = useMemo(() => {
    const dentistaTiers = tiers.filter((t) => t.channel === "DENTISTA");
    if (dentistaTiers.length > 0) {
      return dentistaTiers.map((t) => t.min_qty).sort((a, b) => a - b);
    }
    return DENTISTA_FALLBACK_MIN_QTYS;
  }, [tiers]);

  // Lista de canais para renderização — DENTISTA usa faixas dinâmicas.
  const channelTiers = useMemo(() => [
    ...FIXED_CHANNEL_TIERS,
    { channel: "DENTISTA" as SalesChannel, label: "Dentista", minQtys: dentistMinQtys },
  ], [dentistMinQtys]);

  const valueFor = (key: string) => edits[key] ?? original[key] ?? "";

  const isDirty = useMemo(
    () =>
      Object.keys(edits).some(
        (key) => (edits[key] ?? "") !== (original[key] ?? "")
      ),
    [edits, original]
  );

  const saveMutation = useMutation({
    mutationFn: async () => {
      const ops: Promise<unknown>[] = [];
      for (const ct of channelTiers) {
        for (const minQty of ct.minQtys) {
          const key = rowKey(ct.channel, minQty);
          if (edits[key] === undefined) continue;
          if ((edits[key] ?? "") === (original[key] ?? "")) continue;
          const price = parsePrice(edits[key]);
          if (price === null) {
            throw new Error(
              `Preço inválido para ${ct.label} (qtd ${minQty}).`
            );
          }
          ops.push(
            upsertPricingTier({
              product_id: productId,
              channel: ct.channel,
              min_qty: minQty,
              unit_price: price,
            })
          );
        }
      }
      await Promise.all(ops);
      return ops.length;
    },
    onSuccess: (count) => {
      toast.success(`${count} preço(s) atualizado(s).`);
      queryClient.invalidateQueries({ queryKey: ["pricing-tiers", productId] });
      setEdits({});
    },
    onError: (err) =>
      toast.error(err instanceof Error ? err.message : "Erro ao salvar preços."),
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="w-full max-w-sm space-y-2">
          <Label htmlFor="product-filter">Produto</Label>
          <Select
            value={productId}
            onValueChange={(v) => setProductId(v)}
            disabled={productsLoading || products.length === 0}
          >
            <SelectTrigger id="product-filter">
              <SelectValue
                placeholder={
                  productsLoading ? "Carregando..." : "Selecione um produto"
                }
              />
            </SelectTrigger>
            <SelectContent>
              {products.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Button
          onClick={() => saveMutation.mutate()}
          disabled={!isDirty || saveMutation.isPending || !productId}
        >
          <Save className="mr-2 h-4 w-4" />
          {saveMutation.isPending ? "Salvando..." : "Salvar alterações"}
        </Button>
      </div>

      {!productId ? (
        <div className="rounded-md border p-8 text-center text-muted-foreground">
          Selecione um produto para editar os preços.
        </div>
      ) : tiersLoading ? (
        <div className="rounded-md border p-8 text-center text-muted-foreground">
          Carregando preços...
        </div>
      ) : (
        <div className="space-y-6">
          {channelTiers.map((ct) => (
            <div key={ct.channel} className="rounded-lg border border-border">
              <div className="border-b border-border bg-muted/40 px-4 py-2.5">
                <h3 className="text-sm font-semibold text-foreground">
                  {ct.label}
                </h3>
              </div>
              <div className="divide-y divide-border">
                {ct.minQtys.map((minQty) => {
                  const key = rowKey(ct.channel, minQty);
                  return (
                    <div
                      key={key}
                      className="flex items-center justify-between gap-4 px-4 py-3"
                    >
                      <span className="text-sm text-muted-foreground">
                        {minQty === 1
                          ? "Preço unitário"
                          : `A partir de ${minQty} un.`}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">R$</span>
                        <Input
                          inputMode="decimal"
                          value={valueFor(key)}
                          placeholder="0,00"
                          onChange={(e) =>
                            setEdits((prev) => ({
                              ...prev,
                              [key]: e.target.value,
                            }))
                          }
                          className="w-32 text-right"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
