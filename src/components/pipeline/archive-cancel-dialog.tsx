"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Archive, XCircle, Loader2 } from "lucide-react";

interface ArchiveCancelDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderTitle?: string;
  onArchive: () => void;
  onCancel: () => void;
  loading?: boolean;
}

export function ArchiveCancelDialog({
  open,
  onOpenChange,
  orderTitle,
  onArchive,
  onCancel,
  loading = false,
}: ArchiveCancelDialogProps) {
  const [pendingAction, setPendingAction] = useState<"archive" | "cancel" | null>(null);

  const handleArchive = () => {
    setPendingAction("archive");
    onArchive();
  };

  const handleCancel = () => {
    setPendingAction("cancel");
    onCancel();
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o && !loading) {
          setPendingAction(null);
        }
        onOpenChange(o);
      }}
    >
      <DialogContent className="z-[120] sm:max-w-md">
        <DialogHeader>
          <DialogTitle>O que deseja fazer com este pedido?</DialogTitle>
          <DialogDescription>
            {orderTitle ? (
              <>
                Pedido: <span className="font-medium">{orderTitle}</span>
              </>
            ) : (
              "Escolha uma das opções abaixo."
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-4">
          <button
            type="button"
            onClick={handleArchive}
            disabled={loading}
            className="flex w-full items-start gap-3 rounded-lg border border-border p-4 text-left transition-colors hover:bg-secondary/50 disabled:opacity-50"
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-slate-100 dark:bg-slate-800">
              {pendingAction === "archive" && loading ? (
                <Loader2 className="h-4 w-4 animate-spin text-slate-600" />
              ) : (
                <Archive className="h-4 w-4 text-slate-600" />
              )}
            </div>
            <div className="flex-1">
              <p className="font-medium text-foreground">Arquivar</p>
              <p className="text-xs text-muted-foreground">
                O pedido sai do pipeline mas permanece acessível em &quot;Ver arquivados&quot;. Pode ser
                desarquivado depois.
              </p>
            </div>
          </button>

          <button
            type="button"
            onClick={handleCancel}
            disabled={loading}
            className="flex w-full items-start gap-3 rounded-lg border border-border p-4 text-left transition-colors hover:bg-red-50 dark:hover:bg-red-950/20 disabled:opacity-50"
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-red-100 dark:bg-red-900/30">
              {pendingAction === "cancel" && loading ? (
                <Loader2 className="h-4 w-4 animate-spin text-red-600" />
              ) : (
                <XCircle className="h-4 w-4 text-red-600" />
              )}
            </div>
            <div className="flex-1">
              <p className="font-medium text-foreground">Cancelar pedido</p>
              <p className="text-xs text-muted-foreground">
                O pedido é arquivado e marcado com a tag{" "}
                <span className="font-semibold text-red-700 dark:text-red-400">Pedido Cancelado</span>.
              </p>
            </div>
          </button>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Voltar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
