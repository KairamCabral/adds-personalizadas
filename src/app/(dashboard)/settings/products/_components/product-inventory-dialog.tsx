"use client";

import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { getSuppliers } from "@/services/suppliers.service";
import { updateProduct } from "@/services/products.service";
import { TinyDepositoSelect } from "@/components/inventory/tiny-deposito-select";
import { StockPreview } from "@/components/inventory/stock-preview";
import type { Product } from "@/types/database.types";

type Pool = "PERSONALIZADO" | "MARKETPLACE";

interface ProductInventoryDialogProps {
  product: Product | null;
  onClose: () => void;
}

export function ProductInventoryDialog({ product, onClose }: ProductInventoryDialogProps) {
  const queryClient = useQueryClient();
  const [supplierId, setSupplierId] = useState<string | null>(null);
  const [pools, setPools] = useState<Pool[]>([]);
  const [personalDeposito, setPersonalDeposito] = useState<number | null>(null);
  const [marketDeposito, setMarketDeposito] = useState<number | null>(null);

  const suppliersQuery = useQuery({
    queryKey: ["suppliers"],
    queryFn: getSuppliers,
    enabled: !!product,
  });

  useEffect(() => {
    if (!product) return;
    const p = product as Product & {
      inventory_supplier_id?: string | null;
      inventory_pools?: Pool[] | null;
      tiny_deposito_personalizado_id?: number | null;
      tiny_deposito_marketplace_id?: number | null;
    };
    setSupplierId(p.inventory_supplier_id ?? null);
    setPools(p.inventory_pools ?? []);
    setPersonalDeposito(p.tiny_deposito_personalizado_id ?? null);
    setMarketDeposito(p.tiny_deposito_marketplace_id ?? null);
  }, [product]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!product) throw new Error("Sem produto.");
      await updateProduct(product.id, {
        inventory_supplier_id: supplierId,
        inventory_pools: pools,
        tiny_deposito_personalizado_id: personalDeposito,
        tiny_deposito_marketplace_id: marketDeposito,
      } as never);
    },
    onSuccess: () => {
      toast.success("Configuração de inventário salva.");
      queryClient.invalidateQueries({ queryKey: ["products"] });
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const togglePool = (pool: Pool, checked: boolean) => {
    setPools((prev) => {
      if (checked) return prev.includes(pool) ? prev : [...prev, pool];
      return prev.filter((p) => p !== pool);
    });
  };

  return (
    <Dialog open={!!product} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Inventário no fornecedor</DialogTitle>
          <DialogDescription>
            {product?.name} — vincule o fornecedor, escolha os pools de estoque e
            informe os IDs de depósito no Tiny.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Fornecedor</Label>
            <Select
              value={supplierId ?? "__none__"}
              onValueChange={(v) => setSupplierId(v === "__none__" ? null : v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Nenhum" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Nenhum</SelectItem>
                {suppliersQuery.data?.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Pools de estoque</Label>
            <div className="space-y-2 rounded-md border border-border p-3">
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={pools.includes("PERSONALIZADO")}
                  onCheckedChange={(c) => togglePool("PERSONALIZADO", c === true)}
                />
                Personalizados (consome carteira do CRM)
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={pools.includes("MARKETPLACE")}
                  onCheckedChange={(c) => togglePool("MARKETPLACE", c === true)}
                />
                Marketplace (apenas cruzamento com Tiny)
              </label>
            </div>
          </div>

          {pools.includes("PERSONALIZADO") && (
            <div className="space-y-2">
              <Label>Depósito Tiny — Personalizado</Label>
              <TinyDepositoSelect
                value={personalDeposito}
                onChange={setPersonalDeposito}
                hint="personaliz"
                placeholder="Escolha o depósito do Tiny"
              />
              <StockPreview
                productId={product?.id ?? null}
                depositoId={personalDeposito}
                accent="blue"
              />
            </div>
          )}

          {pools.includes("MARKETPLACE") && (
            <div className="space-y-2">
              <Label>Depósito Tiny — Marketplace</Label>
              <TinyDepositoSelect
                value={marketDeposito}
                onChange={setMarketDeposito}
                hint="marketpl"
                placeholder="Escolha o depósito do Tiny"
              />
              <StockPreview
                productId={product?.id ?? null}
                depositoId={marketDeposito}
                accent="orange"
              />
            </div>
          )}

          {pools.length === 0 && (
            <p className="text-xs text-muted-foreground">
              Sem pools selecionados, o produto não aparece em nenhum inventário.
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending}
          >
            {saveMutation.isPending && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
