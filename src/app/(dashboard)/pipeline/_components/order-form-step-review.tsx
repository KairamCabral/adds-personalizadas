"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createOrderWithItems, deleteOrder } from "@/services/orders.service";
import { createClient } from "@/lib/supabase/client";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Check, Paperclip } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { SelectedClient } from "./client-search";
import type { OrderFormItem } from "./order-form-step-products";
import type { ColorOption } from "./color-picker";

interface OrderFormStepReviewProps {
  currentStep: number;
  selectedClient: SelectedClient | null;
  items: OrderFormItem[];
  personalizationNotes: string;
  logoFile: File | null;
  logoPreviewUrl: string | null;
  priority: "NORMAL" | "ALTA";
  onPriorityChange: (p: "NORMAL" | "ALTA") => void;
  onBack: () => void;
  onCreateSuccess: (orderId: string) => void;
}

const STEPS = [
  { key: 1, label: "Cliente" },
  { key: 2, label: "Produtos" },
  { key: 3, label: "Revisão" },
];

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getColorLabel(
  key: string,
  items: OrderFormItem[],
  productId: string
): string {
  const item = items.find((i) => i.product_id === productId);
  if (!item) return key;
  if (key === "custom" && item.custom_color) return item.custom_color;
  const product = item.product as any;
  const colors = (product?.available_colors ?? []) as ColorOption[];
  const found = colors.find((c) => c.key === key);
  return found?.label ?? key;
}

/** Expande colorQuantities em itens (um por cor) para a API */
function expandItemsToApiFormat(
  items: OrderFormItem[]
): { product_id: string; product_name: string; quantity: number; personalization: { colors: string[]; custom_color: string | null } }[] {
  const result: { product_id: string; product_name: string; quantity: number; personalization: { colors: string[]; custom_color: string | null } }[] = [];
  for (const item of items) {
    for (const [colorKey, qty] of Object.entries(item.colorQuantities)) {
      if (qty < 1) continue;
      result.push({
        product_id: item.product_id,
        product_name: item.product_name,
        quantity: qty,
        personalization: {
          colors: [colorKey],
          custom_color: colorKey === "custom" ? item.custom_color : null,
        },
      });
    }
  }
  return result;
}

export function OrderFormStepReview({
  currentStep,
  selectedClient,
  items,
  personalizationNotes,
  logoFile,
  logoPreviewUrl,
  priority,
  onPriorityChange,
  onBack,
  onCreateSuccess,
}: OrderFormStepReviewProps) {
  const queryClient = useQueryClient();

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!selectedClient) throw new Error("Cliente não selecionado");
      if (items.length === 0) throw new Error("Adicione pelo menos 1 produto");

      const order = await createOrderWithItems({
        title: selectedClient.name,
        description: personalizationNotes.trim() || null,
        client_id: selectedClient.id,
        status: "FAZER",
        order_type: "PERSONALIZADO",
        priority,
        created_by: null,
        items: expandItemsToApiFormat(items),
      });

      if (logoFile) {
        try {
          const formData = new FormData();
          formData.append("file", logoFile);
          formData.append("order_id", order.id);

          const supabase = createClient();
          const { data: { session } } = await supabase.auth.getSession();
          const token = session?.access_token;

          const res = await fetch("/api/orders/upload-logo", {
            method: "POST",
            headers: token ? { Authorization: `Bearer ${token}` } : {},
            body: formData,
          });

          if (!res.ok) {
            const err = await res.json();
            throw new Error(err.error || "Erro ao enviar logo");
          }
        } catch (err) {
          await deleteOrder(order.id);
          throw err;
        }
      }

      return order;
    },
    onSuccess: (order) => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      toast.success("Pedido criado com sucesso!");
      onCreateSuccess(order.id);
    },
    onError: (err: Error) => {
      const msg = err.message || "";
      const isPermission =
        msg.includes("row-level security") ||
        msg.includes("policy") ||
        msg.includes("permission");
      toast.error(
        isPermission
          ? "Você não tem permissão para criar pedidos. Entre em contato com o gestor."
          : msg || "Erro ao criar pedido"
      );
    },
  });

  const creating = createMutation.isPending;

  const handleCreate = () => {
    createMutation.mutate(undefined);
  };

  return (
    <div className="space-y-6">
      {/* Stepper */}
      <div className="flex items-center gap-2">
        {STEPS.map((step, i) => (
          <div key={step.key} className="flex items-center gap-2">
            <div
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold transition-colors",
                step.key < currentStep &&
                  "bg-green-500/20 text-green-600 dark:text-green-400",
                step.key === currentStep &&
                  "bg-primary text-primary-foreground",
                step.key > currentStep &&
                  "border border-border bg-muted/50 text-muted-foreground"
              )}
            >
              {step.key < currentStep ? (
                <Check className="h-4 w-4" />
              ) : (
                step.key
              )}
            </div>
            <span
              className={cn(
                "text-sm font-medium",
                step.key === currentStep
                  ? "text-foreground"
                  : "text-muted-foreground"
              )}
            >
              {step.label}
            </span>
            {i < STEPS.length - 1 && (
              <div className="mx-1 h-px w-6 bg-border" aria-hidden="true" />
            )}
          </div>
        ))}
      </div>

      {/* Summary card */}
      <div className="rounded-xl border border-border bg-card p-4 space-y-4">
        <h3 className="font-semibold text-foreground">Resumo do Pedido</h3>

        {selectedClient && (
          <div>
            <p className="text-xs font-medium text-muted-foreground">Cliente</p>
            <p className="font-medium text-foreground">{selectedClient.name}</p>
            {(selectedClient.phone || selectedClient.document) && (
              <p className="text-sm text-muted-foreground">
                {selectedClient.phone}
                {selectedClient.phone && selectedClient.document && " · "}
                {selectedClient.document}
              </p>
            )}
          </div>
        )}

        <div>
          <p className="text-xs font-medium text-muted-foreground">Produtos</p>
          <ul className="mt-1 space-y-1">
            {items.map((item) => (
              <li
                key={item.product_id}
                className="flex flex-wrap items-center gap-x-2 text-sm"
              >
                <span className="font-medium">{item.product_name}</span>
                <span className="text-muted-foreground">
                  —
                  {Object.entries(item.colorQuantities)
                    .map(
                      ([key, qty]) =>
                        `${getColorLabel(key, items, item.product_id)}: ${qty}`
                    )
                    .join(" · ")}
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <p className="text-xs font-medium text-muted-foreground">
            Personalização
          </p>
          <p className="text-sm text-foreground">
            {personalizationNotes.trim() || (
              <span className="text-muted-foreground">
                Nenhuma observação
              </span>
            )}
          </p>
        </div>

        <div>
          <p className="text-xs font-medium text-muted-foreground">Logo</p>
          {logoFile ? (
            <div className="mt-1 flex items-center gap-2">
              {logoPreviewUrl && logoFile.type.startsWith("image/") ? (
                <img
                  src={logoPreviewUrl}
                  alt=""
                  className="h-10 w-10 rounded object-cover"
                />
              ) : (
                <Paperclip className="h-4 w-4 text-muted-foreground" />
              )}
              <span className="text-sm">
                {logoFile.name} ({formatSize(logoFile.size)})
              </span>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Nenhuma logo anexada
            </p>
          )}
        </div>

        <div>
          <p className="mb-1.5 text-xs font-medium text-muted-foreground">
            Prioridade
          </p>
          <Select
            value={priority}
            onValueChange={(v) => onPriorityChange(v as "NORMAL" | "ALTA")}
          >
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="NORMAL">Normal</SelectItem>
              <SelectItem value="ALTA">Alta</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onBack}
          disabled={creating}
          className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground disabled:opacity-50"
        >
          ← Voltar
        </button>
        <button
          type="button"
          onClick={handleCreate}
          disabled={creating}
          className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {creating ? (
            <>
              <span className="h-3 w-3 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
              Criando...
            </>
          ) : (
            <>
              <Check className="h-4 w-4" />
              Criar Pedido
            </>
          )}
        </button>
      </div>
    </div>
  );
}
