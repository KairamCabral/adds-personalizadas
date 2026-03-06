"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Bell, Loader2 } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { createClient } from "@/lib/supabase/client";

const NOTIFICATION_TYPES = [
  {
    key: "order_created",
    label: "Novo pedido criado",
    description: "Quando um pedido é criado no Pipeline",
  },
  {
    key: "status_changed",
    label: "Status alterado",
    description: "Quando um pedido muda de etapa",
  },
  {
    key: "comment_added",
    label: "Novo comentário",
    description: "Quando alguém comenta em um pedido seu",
  },
  {
    key: "artwork_approved",
    label: "Arte aprovada",
    description: "Quando a arte de um pedido é aprovada",
  },
  {
    key: "artwork_adjustment",
    label: "Ajuste de arte",
    description: "Quando um ajuste é solicitado na arte",
  },
  {
    key: "quote_received",
    label: "Orçamento recebido",
    description: "Quando um orçamento público é enviado",
  },
  {
    key: "mention",
    label: "Menções",
    description: "Quando você é mencionado em um comentário",
  },
];

type NotificationPrefs = Record<
  string,
  { in_app?: boolean; email?: boolean }
> | null;

interface NotificationPreferencesProps {
  profile: {
    id: string;
    notification_preferences: NotificationPrefs;
  };
  onProfileUpdated?: () => void;
}

export function NotificationPreferences({
  profile,
  onProfileUpdated,
}: NotificationPreferencesProps) {
  const queryClient = useQueryClient();
  const defaultPrefs = profile.notification_preferences ?? {};

  const [prefs, setPrefs] = useState<
    Record<string, { in_app: boolean; email: boolean }>
  >(
    Object.fromEntries(
      NOTIFICATION_TYPES.map((t) => [
        t.key,
        {
          in_app: defaultPrefs[t.key]?.in_app ?? true,
          email: defaultPrefs[t.key]?.email ?? false,
        },
      ])
    )
  );

  const [isDirty, setIsDirty] = useState(false);

  const togglePref = (key: string, channel: "in_app" | "email") => {
    setPrefs((prev) => ({
      ...prev,
      [key]: { ...prev[key], [channel]: !prev[key][channel] },
    }));
    setIsDirty(true);
  };

  const mutation = useMutation({
    mutationFn: async () => {
      const supabase = createClient();
      const merged = {
        ...(profile.notification_preferences ?? {}),
        ...prefs,
      };
      const { error } = await supabase
        .from("profiles")
        .update({
          notification_preferences: merged,
          updated_at: new Date().toISOString(),
        })
        .eq("id", profile.id);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Preferências salvas!");
      setIsDirty(false);
      queryClient.invalidateQueries({ queryKey: ["user"] });
      onProfileUpdated?.();
    },
    onError: () => {
      toast.error("Erro ao salvar preferências");
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Bell className="h-4 w-4" />
          Preferências de Notificação
        </CardTitle>
        <CardDescription>
          Escolha quais notificações deseja receber
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-1">
          <div className="grid grid-cols-[1fr,80px,80px] gap-2 px-3 py-2 text-xs font-medium text-muted-foreground">
            <span>Tipo</span>
            <span className="text-center">No app</span>
            <span className="text-center">E-mail</span>
          </div>

          {NOTIFICATION_TYPES.map((type) => (
            <div
              key={type.key}
              className="grid grid-cols-[1fr,80px,80px] gap-2 items-center px-3 py-2.5 rounded-lg hover:bg-muted/50 transition-colors"
            >
              <div>
                <p className="text-sm font-medium">{type.label}</p>
                <p className="text-xs text-muted-foreground">
                  {type.description}
                </p>
              </div>
              <div className="flex justify-center">
                <Switch
                  checked={prefs[type.key]?.in_app ?? true}
                  onCheckedChange={() => togglePref(type.key, "in_app")}
                />
              </div>
              <div className="flex justify-center">
                <Switch
                  checked={prefs[type.key]?.email ?? false}
                  onCheckedChange={() => togglePref(type.key, "email")}
                  disabled
                />
              </div>
            </div>
          ))}
        </div>

        <div className="flex justify-end mt-4">
          <Button
            onClick={() => mutation.mutate()}
            disabled={!isDirty || mutation.isPending}
            className="gap-2"
          >
            {mutation.isPending && (
              <Loader2 className="h-4 w-4 animate-spin" />
            )}
            Salvar preferências
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
