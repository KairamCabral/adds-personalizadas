"use client";

import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { createClient } from "@/lib/supabase/client";
import type {
  RepLeadRule,
  RepresentanteSimple,
  MatchField,
  MatchOperator,
  RouteType,
} from "../page";

interface RuleFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingRule: RepLeadRule | null;
  representantes: RepresentanteSimple[];
  userId: string;
}

const EMPTY_FORM = {
  name: "",
  match_field: "utm_campaign" as MatchField,
  match_operator: "contains" as MatchOperator,
  match_value: "",
  route_type: "territory" as RouteType,
  target_rep_id: "",
};

export function RuleFormDialog({
  open,
  onOpenChange,
  editingRule,
  representantes,
  userId,
}: RuleFormDialogProps) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState(EMPTY_FORM);

  useEffect(() => {
    if (open) {
      if (editingRule) {
        setForm({
          name: editingRule.name,
          match_field: editingRule.match_field,
          match_operator: editingRule.match_operator,
          match_value: editingRule.match_value,
          route_type: editingRule.route_type,
          target_rep_id: editingRule.target_rep_id ?? "",
        });
      } else {
        setForm(EMPTY_FORM);
      }
    }
  }, [open, editingRule]);

  const mutation = useMutation({
    mutationFn: async () => {
      const supabase = createClient();
      const payload = {
        name: form.name.trim(),
        match_field: form.match_field,
        match_operator: form.match_operator,
        match_value: form.match_value.trim(),
        route_type: form.route_type,
        target_rep_id: form.route_type === "specific_rep" && form.target_rep_id
          ? form.target_rep_id
          : null,
      };

      if (editingRule) {
        const { error } = await supabase
          .from("rep_lead_rules" as never)
          .update(payload as never)
          .eq("id", editingRule.id);
        if (error) throw new Error(error.message);
      } else {
        const { error } = await supabase
          .from("rep_lead_rules" as never)
          .insert({ ...payload, created_by: userId, is_active: true } as never);
        if (error) throw new Error(error.message);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rep-lead-rules"] });
      toast.success(editingRule ? "Regra atualizada" : "Regra criada com sucesso");
      onOpenChange(false);
    },
    onError: (err: Error) => {
      toast.error("Erro ao salvar regra", { description: err.message });
    },
  });

  function handleSubmit() {
    if (!form.name.trim()) {
      toast.error("Informe um nome para a regra");
      return;
    }
    if (!form.match_value.trim()) {
      toast.error("Informe o valor para comparar");
      return;
    }
    if (form.route_type === "specific_rep" && !form.target_rep_id) {
      toast.error("Selecione o representante para roteamento direto");
      return;
    }
    mutation.mutate();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {editingRule ? "Editar regra" : "Nova regra de roteamento"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-1">
          {/* Nome */}
          <div className="space-y-1.5">
            <Label>
              Nome da regra <span className="text-destructive">*</span>
            </Label>
            <Input
              placeholder="ex: SC Presencial"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
          </div>

          {/* Campo UTM */}
          <div className="space-y-1.5">
            <Label>
              Campo UTM <span className="text-destructive">*</span>
            </Label>
            <Select
              value={form.match_field}
              onValueChange={(v) => setForm((f) => ({ ...f, match_field: v as MatchField }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="utm_campaign">utm_campaign</SelectItem>
                <SelectItem value="utm_source">utm_source</SelectItem>
                <SelectItem value="utm_medium">utm_medium</SelectItem>
                <SelectItem value="utm_content">utm_content</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Operador */}
          <div className="space-y-1.5">
            <Label>
              Operador <span className="text-destructive">*</span>
            </Label>
            <Select
              value={form.match_operator}
              onValueChange={(v) => setForm((f) => ({ ...f, match_operator: v as MatchOperator }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="equals">Igual a</SelectItem>
                <SelectItem value="contains">Contém</SelectItem>
                <SelectItem value="starts_with">Começa com</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Valor */}
          <div className="space-y-1.5">
            <Label>
              Valor para comparar <span className="text-destructive">*</span>
            </Label>
            <Input
              placeholder="ex: representante_sc"
              value={form.match_value}
              onChange={(e) => setForm((f) => ({ ...f, match_value: e.target.value }))}
            />
            <p className="text-xs text-muted-foreground">
              A comparação não diferencia maiúsculas/minúsculas.
            </p>
          </div>

          {/* Tipo de roteamento */}
          <div className="space-y-2">
            <Label>Tipo de roteamento</Label>
            <RadioGroup
              value={form.route_type}
              onValueChange={(v) => setForm((f) => ({ ...f, route_type: v as RouteType, target_rep_id: "" }))}
              className="space-y-2"
            >
              <div className="flex items-start gap-3 rounded-lg border p-3">
                <RadioGroupItem value="territory" id="territory" className="mt-0.5" />
                <label htmlFor="territory" className="cursor-pointer space-y-0.5">
                  <p className="text-sm font-medium">Por território</p>
                  <p className="text-xs text-muted-foreground">
                    Encaminha para o representante responsável pela cidade do lead.
                  </p>
                </label>
              </div>
              <div className="flex items-start gap-3 rounded-lg border p-3">
                <RadioGroupItem value="specific_rep" id="specific_rep" className="mt-0.5" />
                <label htmlFor="specific_rep" className="cursor-pointer space-y-0.5 flex-1">
                  <p className="text-sm font-medium">Representante específico</p>
                  <p className="text-xs text-muted-foreground">
                    Sempre encaminha para o mesmo representante.
                  </p>
                </label>
              </div>
            </RadioGroup>

            {form.route_type === "specific_rep" && (
              <div className="ml-6 space-y-1.5">
                <Label className="text-sm">
                  Escolher representante <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={form.target_rep_id}
                  onValueChange={(v) => setForm((f) => ({ ...f, target_rep_id: v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecionar..." />
                  </SelectTrigger>
                  <SelectContent>
                    {representantes.map((r) => (
                      <SelectItem key={r.id} value={r.id}>
                        {r.full_name}
                      </SelectItem>
                    ))}
                    {representantes.length === 0 && (
                      <SelectItem value="__empty__" disabled>
                        Nenhum representante disponível
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={mutation.isPending}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={mutation.isPending}>
            {mutation.isPending ? "Salvando..." : editingRule ? "Salvar alterações" : "Criar regra"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
