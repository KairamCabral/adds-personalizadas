"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus, Send } from "lucide-react";
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
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  createSurvey,
  enqueueRelationalWave,
  getNpsSurveys,
  previewRelationalWave,
  setSurveyActive,
  type CreateSurveyInput,
  type NpsSurvey,
} from "@/services/nps-admin.service";

const CHANNEL_LABELS: Record<string, string> = { EMAIL: "E-mail", WHATSAPP: "WhatsApp" };
const SALES_LABELS: Record<string, string> = {
  CONSUMIDOR: "Consumidor",
  DENTISTA: "Dentista",
  DISTRIBUIDORA: "Distribuidora",
  VAREJISTA: "Varejista",
};
const TRIGGER_OPTIONS = ["ENTREGUE", "FATURADO", "FINALIZADO"];

export function NpsCampaignsSection() {
  const qc = useQueryClient();
  const [activateTarget, setActivateTarget] = useState<NpsSurvey | null>(null);
  const [waveTarget, setWaveTarget] = useState<NpsSurvey | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const { data: surveys = [], isLoading, isError } = useQuery({
    queryKey: ["nps", "surveys"],
    queryFn: getNpsSurveys,
  });
  const { data: wavePreview, isFetching: previewing } = useQuery({
    queryKey: ["nps", "wave-preview", waveTarget?.id],
    queryFn: () => previewRelationalWave(waveTarget!.id),
    enabled: !!waveTarget,
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["nps", "surveys"] });

  const toggleMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) => setSurveyActive(id, isActive),
    onSuccess: (_d, vars) => {
      toast.success(vars.isActive ? "Campanha ativada." : "Campanha pausada.");
      invalidate();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro ao atualizar campanha."),
  });

  const waveMutation = useMutation({
    mutationFn: (id: string) => enqueueRelationalWave(id),
    onSuccess: (r) => {
      toast.success(`Onda disparada: ${r.enqueued} pesquisa(s) enfileirada(s) por e-mail.`);
      qc.invalidateQueries({ queryKey: ["nps", "dispatch-counts"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro ao disparar onda."),
  });

  function onToggle(survey: NpsSurvey, next: boolean) {
    if (next) setActivateTarget(survey);
    else toggleMutation.mutate({ id: survey.id, isActive: false });
  }

  if (isLoading) return <p className="text-sm text-muted-foreground">Carregando campanhas…</p>;
  if (isError)
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-destructive">
          Não foi possível carregar as campanhas. Atualize a página e tente novamente.
        </CardContent>
      </Card>
    );

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <Plus className="mr-2 h-4 w-4" /> Nova campanha
        </Button>
      </div>

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
              <span className="text-xs text-muted-foreground">{s.is_active ? "Ativa" : "Pausada"}</span>
              <Switch
                checked={s.is_active}
                disabled={toggleMutation.isPending}
                onCheckedChange={(v) => onToggle(s, v === true)}
              />
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm text-muted-foreground sm:grid-cols-4">
              <Detail label="Canal" value={CHANNEL_LABELS[s.primary_channel] ?? s.primary_channel} />
              <Detail
                label="Fallback"
                value={s.fallback_channel ? (CHANNEL_LABELS[s.fallback_channel] ?? s.fallback_channel) : "—"}
              />
              <Detail label="Atraso" value={`${s.delay_hours}h`} />
              <Detail label="Cooldown" value={`${s.cooldown_days}d`} />
              <Detail label="Expira em" value={`${s.expires_after_days}d`} />
              <Detail label="Lembretes" value={`${s.max_reminders} (a cada ${s.reminder_after_hours}h)`} />
            </div>
            {s.type === "RELACIONAL" && s.is_active && (
              <div className="border-t pt-3">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={waveMutation.isPending}
                  onClick={() => setWaveTarget(s)}
                >
                  {waveMutation.isPending && waveMutation.variables === s.id ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Disparando…
                    </>
                  ) : (
                    <>
                      <Send className="mr-2 h-4 w-4" /> Disparar onda
                    </>
                  )}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      ))}

      {surveys.length === 0 && (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Nenhuma campanha cadastrada. Crie a primeira em “Nova campanha”.
          </CardContent>
        </Card>
      )}

      {/* Confirmar ativação */}
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
                if (activateTarget) toggleMutation.mutate({ id: activateTarget.id, isActive: true });
                setActivateTarget(null);
              }}
            >
              Ativar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirmar onda relacional */}
      <AlertDialog open={!!waveTarget} onOpenChange={(o) => !o && setWaveTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Disparar onda relacional?</AlertDialogTitle>
            <AlertDialogDescription>
              {previewing ? (
                "Calculando quantos clientes serão contatados…"
              ) : (
                <>
                  Vai enfileirar pesquisas por <strong>e-mail</strong> para{" "}
                  <strong>{wavePreview ?? 0} cliente(s)</strong> elegíveis de “{waveTarget?.name}” (com
                  e-mail e fora do cooldown de {waveTarget?.cooldown_days} dias). O envio acontece pelo
                  processo automático nas próximas horas.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (waveTarget) waveMutation.mutate(waveTarget.id);
                setWaveTarget(null);
              }}
            >
              Disparar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <CreateCampaignDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={() => {
          invalidate();
          setCreateOpen(false);
        }}
      />
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

const DEFAULT_QUESTIONS = {
  question_main:
    "Em uma escala de 0 a 10, o quanto você recomendaria a ADDS Brasil a um amigo ou colega?",
  question_detractor: "O que faltou para essa experiência ser melhor? Seu retorno é muito importante para nós.",
  question_passive: "O que poderíamos ter feito para essa experiência virar um 10?",
  question_promoter: "Que ótimo! O que você mais gostou na sua experiência com a ADDS?",
};

function CreateCampaignDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onCreated: () => void;
}) {
  const [form, setForm] = useState({
    name: "",
    type: "RELACIONAL" as CreateSurveyInput["type"],
    sales_channel: "" as "" | NonNullable<CreateSurveyInput["sales_channel"]>,
    trigger_status: "ENTREGUE" as NonNullable<CreateSurveyInput["trigger_status"]>,
    primary_channel: "EMAIL" as CreateSurveyInput["primary_channel"],
    fallback_channel: "" as "" | NonNullable<CreateSurveyInput["fallback_channel"]>,
    delay_hours: 48,
    expires_after_days: 30,
    cooldown_days: 90,
    max_reminders: 1,
    reminder_after_hours: 72,
    ...DEFAULT_QUESTIONS,
  });

  function set<K extends keyof typeof form>(k: K, v: (typeof form)[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  const mutation = useMutation({
    mutationFn: () => {
      const input: CreateSurveyInput = {
        name: form.name.trim(),
        type: form.type,
        sales_channel: form.sales_channel || null,
        trigger_status: form.type === "TRANSACIONAL" ? form.trigger_status : null,
        primary_channel: form.primary_channel,
        fallback_channel: form.fallback_channel || null,
        delay_hours: form.delay_hours,
        expires_after_days: form.expires_after_days,
        cooldown_days: form.cooldown_days,
        max_reminders: form.max_reminders,
        reminder_after_hours: form.reminder_after_hours,
        question_main: form.question_main,
        question_detractor: form.question_detractor,
        question_passive: form.question_passive,
        question_promoter: form.question_promoter,
      };
      return createSurvey(input);
    },
    onSuccess: () => {
      toast.success("Campanha criada (pausada). Ative quando quiser.");
      onCreated();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro ao criar campanha."),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Nova campanha de NPS</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label htmlFor="c-name">Nome</Label>
            <Input
              id="c-name"
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder="Ex.: NPS Relacional — Dentistas"
              className="mt-1"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Tipo">
              <Sel value={form.type} onChange={(v) => set("type", v as CreateSurveyInput["type"])}>
                <option value="RELACIONAL">Relacional (periódica)</option>
                <option value="TRANSACIONAL">Transacional (por pedido)</option>
              </Sel>
            </Field>
            <Field label="Canal de venda">
              <Sel value={form.sales_channel} onChange={(v) => set("sales_channel", v as typeof form.sales_channel)}>
                <option value="">Todos os canais</option>
                <option value="DENTISTA">Dentista</option>
                <option value="CONSUMIDOR">Consumidor</option>
                <option value="DISTRIBUIDORA">Distribuidora</option>
                <option value="VAREJISTA">Varejista</option>
              </Sel>
            </Field>
          </div>

          {form.type === "TRANSACIONAL" && (
            <Field label="Gatilho (status do pedido)">
              <Sel
                value={form.trigger_status}
                onChange={(v) => set("trigger_status", v as typeof form.trigger_status)}
              >
                {TRIGGER_OPTIONS.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </Sel>
            </Field>
          )}

          <div className="grid grid-cols-2 gap-3">
            <Field label="Canal principal">
              <Sel
                value={form.primary_channel}
                onChange={(v) => set("primary_channel", v as CreateSurveyInput["primary_channel"])}
              >
                <option value="EMAIL">E-mail</option>
                <option value="WHATSAPP">WhatsApp</option>
              </Sel>
            </Field>
            <Field label="Fallback">
              <Sel value={form.fallback_channel} onChange={(v) => set("fallback_channel", v as typeof form.fallback_channel)}>
                <option value="">Nenhum</option>
                <option value="EMAIL">E-mail</option>
                <option value="WHATSAPP">WhatsApp</option>
              </Sel>
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Num label="Atraso (h)" value={form.delay_hours} onChange={(v) => set("delay_hours", v)} />
            <Num label="Expira (d)" value={form.expires_after_days} onChange={(v) => set("expires_after_days", v)} />
            <Num label="Cooldown (d)" value={form.cooldown_days} onChange={(v) => set("cooldown_days", v)} />
            <Num label="Lembretes" value={form.max_reminders} onChange={(v) => set("max_reminders", v)} />
            <Num label="Lembrete (h)" value={form.reminder_after_hours} onChange={(v) => set("reminder_after_hours", v)} />
          </div>

          <details className="rounded-md border p-3">
            <summary className="cursor-pointer text-sm font-medium text-[#0b4269]">
              Perguntas (opcional — já vêm preenchidas)
            </summary>
            <div className="mt-3 space-y-3">
              <QA label="Pergunta principal" value={form.question_main} onChange={(v) => set("question_main", v)} />
              <QA label="Follow-up — detrator" value={form.question_detractor} onChange={(v) => set("question_detractor", v)} />
              <QA label="Follow-up — passivo" value={form.question_passive} onChange={(v) => set("question_passive", v)} />
              <QA label="Follow-up — promotor" value={form.question_promoter} onChange={(v) => set("question_promoter", v)} />
            </div>
          </details>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            disabled={form.name.trim().length < 3 || mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Criando…
              </>
            ) : (
              "Criar campanha"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <Label className="text-xs">{label}</Label>
      <div className="mt-1">{children}</div>
    </div>
  );
}

function Sel({
  value,
  onChange,
  children,
}: {
  value: string;
  onChange: (v: string) => void;
  children: React.ReactNode;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
    >
      {children}
    </select>
  );
}

function Num({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <Field label={label}>
      <Input
        type="number"
        min={0}
        value={value}
        onChange={(e) => onChange(Math.max(0, Number(e.target.value) || 0))}
        className="h-9"
      />
    </Field>
  );
}

function QA({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <Label className="text-xs">{label}</Label>
      <Textarea value={value} onChange={(e) => onChange(e.target.value)} rows={2} className="mt-1" />
    </div>
  );
}
