"use client";

import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
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
import {
  createLabelType,
  updateLabelType,
  type LabelTypeRow,
} from "@/services/labels.service";

const TEXT_LIGHT = "#ffffff";
const TEXT_DARK = "#0b1220";

export function LabelFormDialog({
  open,
  onOpenChange,
  initial,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initial: LabelTypeRow | null;
}) {
  const queryClient = useQueryClient();
  const isEdit = !!initial;

  const [name, setName] = useState("");
  const [color, setColor] = useState("#21add6");
  const [textColor, setTextColor] = useState(TEXT_LIGHT);

  useEffect(() => {
    if (open) {
      setName(initial?.name ?? "");
      setColor(initial?.color ?? "#21add6");
      setTextColor(initial?.text_color ?? TEXT_LIGHT);
    }
  }, [open, initial]);

  const mutation = useMutation({
    mutationFn: () => {
      const payload = {
        name: name.trim(),
        color,
        text_color: textColor,
      };
      return isEdit
        ? updateLabelType(initial!.slug, payload)
        : createLabelType(payload);
    },
    onSuccess: () => {
      toast.success(isEdit ? "Etiqueta atualizada." : "Etiqueta criada.");
      queryClient.invalidateQueries({ queryKey: ["order_label_types"] });
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message || "Erro ao salvar a etiqueta."),
  });

  const canSave = name.trim().length >= 2 && !mutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar etiqueta" : "Nova etiqueta"}</DialogTitle>
          <DialogDescription>
            {isEdit && initial?.is_system
              ? "Etiqueta do sistema — você pode ajustar o nome e a cor."
              : "Defina o nome e a cor. A etiqueta fica disponível no pipeline."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="label_name">Nome</Label>
            <Input
              id="label_name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex.: Urgente"
              maxLength={40}
              autoFocus
            />
          </div>

          <div className="flex items-end gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="label_color">Cor</Label>
              <div className="flex items-center gap-2">
                <input
                  id="label_color"
                  type="color"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  className="h-9 w-12 cursor-pointer rounded border bg-transparent p-1"
                />
                <Input
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  className="w-28 font-mono uppercase"
                  maxLength={7}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Texto</Label>
              <div className="flex gap-1">
                <Button
                  type="button"
                  size="sm"
                  variant={textColor === TEXT_LIGHT ? "default" : "outline"}
                  onClick={() => setTextColor(TEXT_LIGHT)}
                >
                  Claro
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={textColor === TEXT_DARK ? "default" : "outline"}
                  onClick={() => setTextColor(TEXT_DARK)}
                >
                  Escuro
                </Button>
              </div>
            </div>
          </div>

          {/* Preview */}
          <div className="space-y-1.5">
            <Label>Prévia</Label>
            <div className="flex items-center gap-3 rounded-lg border p-3">
              <span
                style={{ backgroundColor: color, color: textColor }}
                className="inline-flex items-center rounded-full px-3 py-1.5 text-sm font-semibold"
              >
                {name.trim() || "Etiqueta"}
              </span>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button disabled={!canSave} onClick={() => mutation.mutate()}>
            {mutation.isPending ? "Salvando..." : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
