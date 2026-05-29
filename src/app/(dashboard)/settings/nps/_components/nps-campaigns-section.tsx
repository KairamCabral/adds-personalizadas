"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import {
  getNpsSurveys,
  setSurveyActive,
  type NpsSurvey,
} from "@/services/nps-admin.service";

const CHANNEL_LABELS: Record<string, string> = {
  EMAIL: "E-mail",
  WHATSAPP: "WhatsApp",
};
const SALES_LABELS: Record<string, string> = {
  CONSUMIDOR: "Consumidor",
  DENTISTA: "Dentista",
  DISTRIBUIDORA: "Distribuidora",
  VAREJISTA: "Varejista",
};

export function NpsCampaignsSection() {
  const qc = useQueryClient();
  const [activateTarget, setActivateTarget] = useState<NpsSurvey | null>(null);

  const { data: surveys = [], isLoading } = useQuery({
    queryKey: ["nps", "surveys"],
    queryFn: getNpsSurveys,
  });

  const mutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      setSurveyActive(id, isActive),
    onSuccess: (_d, vars) => {
      toast.success(vars.isActive ? "Campanha ativada." : "Campanha pausada.");
      qc.invalidateQueries({ queryKey: ["nps", "surveys"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro ao atualizar campanha."),
  });

  function onToggle(survey: NpsSurvey, next: boolean) {
    if (next) {
      setActivateTarget(survey); // confirmar antes de ir ao ar
    } else {
      mutation.mutate({ id: survey.id, isActive: false });
    }
  }

  if (isLoading) return <p className="text-sm text-muted-foreground">Carregando campanhas…</p>;

  return (
    <div className="space-y-4">
      {surveys.map((s) => (
        <Card key={s.id}>
          <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
            <div className="space-y-1">
              <CardTitle className="text-base text-[#0b4269]">{s.name}</CardTitle>
              <div className="flex flex-wrap gap-2 text-xs">
                <Badge variant="secondary">
                  {s.type === "TRANSACIONAL" ? "Transacional" : "Relacional"}
                </Badge>
                <Badge variant="outline">
                  {s.sales_channel ? (SALES_LABELS[s.sales_channel] ?? s.sales_channel) : "Todos os canais"}
                </Badge>
                {s.trigger_status && <Badge variant="outline">Gatilho: {s.trigger_status}</Badge>}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">
                {s.is_active ? "Ativa" : "Pausada"}
              </span>
              <Switch
                checked={s.is_active}
                disabled={mutation.isPending}
                onCheckedChange={(v) => onToggle(s, v === true)}
              />
            </div>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm text-muted-foreground sm:grid-cols-4">
            <Detail label="Canal" value={CHANNEL_LABELS[s.primary_channel] ?? s.primary_channel} />
            <Detail
              label="Fallback"
              value={s.fallback_channel ? (CHANNEL_LABELS[s.fallback_channel] ?? s.fallback_channel) : "—"}
            />
            <Detail label="Atraso" value={`${s.delay_hours}h`} />
            <Detail label="Cooldown" value={`${s.cooldown_days}d`} />
            <Detail label="Expira em" value={`${s.expires_after_days}d`} />
            <Detail label="Lembretes" value={`${s.max_reminders} (a cada ${s.reminder_after_hours}h)`} />
          </CardContent>
        </Card>
      ))}

      {surveys.length === 0 && (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Nenhuma campanha cadastrada.
          </CardContent>
        </Card>
      )}

      <AlertDialog open={!!activateTarget} onOpenChange={(o) => !o && setActivateTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Ativar campanha de NPS?</AlertDialogTitle>
            <AlertDialogDescription>
              A partir de agora, “{activateTarget?.name}” passará a <strong>enviar pesquisas reais</strong>{" "}
              aos clientes quando o gatilho ocorrer. Você pode pausar quando quiser.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (activateTarget) mutation.mutate({ id: activateTarget.id, isActive: true });
                setActivateTarget(null);
              }}
            >
              Ativar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="block text-xs uppercase tracking-wide text-muted-foreground/70">{label}</span>
      <span className="text-foreground">{value}</span>
    </div>
  );
}
