"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Coins, MoreVertical, Check, Ban } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { usePermissions } from "@/hooks/use-permissions";
import {
  getClientCredits,
  updateCreditStatus,
} from "@/services/congressos-credits.service";
import {
  formatCashbackValue,
  effectiveCreditStatus,
  creditStatusLabel,
} from "@/lib/congressos/cashback-format";
import { formatCurrency, cn } from "@/lib/utils";

const STATUS_CLASS: Record<string, string> = {
  ATIVO:
    "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200",
  EXPIRADO:
    "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200",
  CANCELADO: "text-destructive",
};

function fmtDate(iso: string | null): string {
  if (!iso) return "";
  const [y, m, d] = iso.slice(0, 10).split("-");
  return d && m && y ? `${d}/${m}/${y}` : iso;
}

/**
 * Créditos de cashback de congresso do cliente (Épico 6). Só MASTER/GESTOR
 * (gate próprio — a página de contato não gateia). Renderiza nada quando não há
 * créditos, para não poluir o perfil.
 */
export function CashbackCard({ clientId }: { clientId: string }) {
  const { can, isLoading: permLoading } = usePermissions();
  const allowed = can("congressos.manage");
  const queryClient = useQueryClient();
  const [confirm, setConfirm] = useState<{
    id: string;
    status: "USADO" | "CANCELADO";
  } | null>(null);

  const { data: credits = [], isLoading } = useQuery({
    queryKey: ["client_credits", clientId],
    queryFn: () => getClientCredits(clientId),
    enabled: !permLoading && allowed,
  });

  const mutation = useMutation({
    mutationFn: (v: { id: string; status: "USADO" | "CANCELADO" }) =>
      updateCreditStatus(v.id, { status: v.status }),
    onSuccess: (_d, v) => {
      toast.success(
        v.status === "USADO"
          ? "Crédito marcado como usado."
          : "Crédito cancelado."
      );
      queryClient.invalidateQueries({ queryKey: ["client_credits", clientId] });
    },
    onError: () => toast.error("Erro ao atualizar o crédito."),
  });

  if (permLoading || !allowed || isLoading || credits.length === 0) return null;

  const today = new Date().toISOString().slice(0, 10);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Coins className="h-4 w-4" />
          Cashback de congresso
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2">
          {credits.map((c) => {
            const st = effectiveCreditStatus(c.status, c.valid_until, today);
            return (
              <li
                key={c.id}
                className="flex items-center justify-between gap-2 rounded-lg border p-3"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium">
                    {formatCashbackValue(c.type, c.value)}
                    {c.edition_name && (
                      <span className="text-muted-foreground">
                        {" · "}
                        {c.edition_name}
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {c.valid_until
                      ? `Válido até ${fmtDate(c.valid_until)}`
                      : "Sem validade"}
                    {c.min_order_value
                      ? ` · mín. ${formatCurrency(c.min_order_value)}`
                      : ""}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <Badge
                    variant={st === "USADO" ? "secondary" : "outline"}
                    className={cn("whitespace-nowrap", STATUS_CLASS[st])}
                  >
                    {creditStatusLabel(st)}
                  </Badge>
                  {st === "ATIVO" && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                        >
                          <MoreVertical className="h-4 w-4" />
                          <span className="sr-only">Ações do crédito</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() =>
                            setConfirm({ id: c.id, status: "USADO" })
                          }
                        >
                          <Check className="mr-2 h-4 w-4" />
                          Marcar como usado
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={() =>
                            setConfirm({ id: c.id, status: "CANCELADO" })
                          }
                        >
                          <Ban className="mr-2 h-4 w-4" />
                          Cancelar crédito
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </CardContent>

      <ConfirmDialog
        open={!!confirm}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={
          confirm?.status === "USADO"
            ? "Marcar crédito como usado"
            : "Cancelar crédito"
        }
        description={
          confirm?.status === "USADO"
            ? "Confirma que o cliente já usou este cashback? Registra a data de uso."
            : "O crédito será cancelado e não poderá mais ser usado."
        }
        confirmLabel={
          confirm?.status === "USADO" ? "Marcar usado" : "Cancelar crédito"
        }
        cancelLabel="Voltar"
        variant={confirm?.status === "CANCELADO" ? "destructive" : "default"}
        onConfirm={() => {
          if (confirm) mutation.mutate(confirm);
          setConfirm(null);
        }}
      />
    </Card>
  );
}
