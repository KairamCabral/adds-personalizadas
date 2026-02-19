"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from "@/components/ui/sheet";
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
import { Switch } from "@/components/ui/switch";
import { Loader2, ShieldAlert } from "lucide-react";
import { z } from "zod";
import { USER_ROLES } from "@/lib/constants";
import { usePermissions } from "@/hooks/use-permissions";

const editSchema = z.object({
  full_name: z.string().min(1, "Nome é obrigatório"),
  role: z.enum(["MASTER", "GESTOR", "PRESTADOR"]),
  is_active: z.boolean(),
});

type EditFormData = z.infer<typeof editSchema>;

type UserRow = {
  id: string;
  full_name: string | null;
  email: string | null;
  role: string | null;
  is_active: boolean | null;
  last_login_at: string | null;
};

interface UserEditSheetProps {
  user: UserRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function UserEditSheet({
  user,
  open,
  onOpenChange,
}: UserEditSheetProps) {
  const queryClient = useQueryClient();
  const { can } = usePermissions();

  const canEditMaster = can("settings.manage_master");
  const targetIsMaster = user?.role === "MASTER";
  const canEdit = targetIsMaster ? canEditMaster : can("settings.users");

  const form = useForm<EditFormData>({
    resolver: zodResolver(editSchema),
    defaultValues: {
      full_name: "",
      role: "PRESTADOR",
      is_active: true,
    },
    values: user
      ? {
          full_name: user.full_name ?? "",
          role: (user.role as EditFormData["role"]) ?? "PRESTADOR",
          is_active: user.is_active ?? true,
        }
      : undefined,
  });

  const updateMutation = useMutation({
    mutationFn: async (data: EditFormData) => {
      if (!user) throw new Error("Usuário não selecionado.");
      const res = await fetch(`/api/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Erro ao atualizar usuário.");
      return json;
    },
    onSuccess: () => {
      toast.success("Usuário atualizado com sucesso.");
      queryClient.invalidateQueries({ queryKey: ["users"] });
      onOpenChange(false);
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });

  function handleSubmit(data: EditFormData) {
    updateMutation.mutate(data);
  }

  const availableRoles = USER_ROLES.filter(
    (r) => r.key !== "MASTER" || canEditMaster
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Editar usuário</SheetTitle>
        </SheetHeader>

        {!canEdit ? (
          <div className="flex flex-col items-center justify-center gap-4 py-12">
            <ShieldAlert className="h-12 w-12 text-muted-foreground" />
            <p className="text-center text-sm text-muted-foreground">
              Você não tem permissão para editar este usuário.
            </p>
          </div>
        ) : (
          <form
            onSubmit={form.handleSubmit(handleSubmit)}
            className="flex flex-col gap-6 py-6"
          >
            <div className="space-y-2">
              <Label htmlFor="edit_full_name">Nome</Label>
              <Input
                id="edit_full_name"
                {...form.register("full_name")}
              />
              {form.formState.errors.full_name && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.full_name.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label>E-mail</Label>
              <Input
                value={user?.email ?? ""}
                disabled
                className="bg-muted"
              />
              <p className="text-xs text-muted-foreground">
                O e-mail não pode ser alterado.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit_role">Função</Label>
              <Select
                value={form.watch("role")}
                onValueChange={(v) =>
                  form.setValue("role", v as EditFormData["role"])
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {availableRoles.map((r) => (
                    <SelectItem key={r.key} value={r.key}>
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between rounded-lg border p-4">
              <div>
                <Label htmlFor="edit_is_active">Status</Label>
                <p className="text-xs text-muted-foreground">
                  Usuários inativos não podem acessar o sistema.
                </p>
              </div>
              <Switch
                id="edit_is_active"
                checked={form.watch("is_active")}
                onCheckedChange={(v) => form.setValue("is_active", v)}
              />
            </div>

            <SheetFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={updateMutation.isPending}>
                {updateMutation.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                Salvar
              </Button>
            </SheetFooter>
          </form>
        )}
      </SheetContent>
    </Sheet>
  );
}
