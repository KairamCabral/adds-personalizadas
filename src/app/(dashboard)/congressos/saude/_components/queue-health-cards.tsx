"use client";

import type { LucideIcon } from "lucide-react";
import { Clock, RefreshCw, Skull, Mail, MailX } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { QueueCounts } from "@/lib/congressos/queue-health";

type Tone = "primary" | "warning" | "danger" | "muted";

// Tokens dark-mode-aware (mesmos do StatCard de gift-stats + um tom `danger`).
const TONE: Record<Tone, string> = {
  primary: "bg-dashboard-primary/15 text-dashboard-primary",
  warning: "bg-dashboard-warning/15 text-dashboard-warning",
  danger: "bg-destructive/10 text-destructive",
  muted: "bg-muted text-muted-foreground",
};

function StatCard({
  label,
  value,
  icon: Icon,
  tone = "primary",
  hint,
}: {
  label: string;
  value: number;
  icon: LucideIcon;
  tone?: Tone;
  hint?: string;
}) {
  return (
    <Card className="border-border/50 shadow-sm">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              {label}
            </p>
            <p className="mt-1.5 text-2xl font-bold tracking-tight tabular-nums text-foreground">
              {value.toLocaleString("pt-BR")}
            </p>
            {hint && (
              <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>
            )}
          </div>
          <div
            className={cn(
              "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
              TONE[tone]
            )}
          >
            <Icon className="h-4 w-4" strokeWidth={2.5} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function QueueHealthCards({ counts }: { counts: QueueCounts }) {
  const { sync, dispatch } = counts;
  return (
    <div className="space-y-4">
      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-foreground">
          Sincronização com o Tiny
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Pendentes"
            value={sync.pending + sync.processing}
            icon={Clock}
            tone="muted"
            hint="Aguardando processamento"
          />
          <StatCard
            label="Em retry"
            value={sync.failed}
            icon={RefreshCw}
            tone="warning"
            hint="Falha transitória"
          />
          <StatCard
            label="Mortos"
            value={sync.dead}
            icon={Skull}
            tone="danger"
            hint="Esgotaram o retry"
          />
          <StatCard
            label="Sincronizados"
            value={sync.done}
            icon={RefreshCw}
            tone="primary"
          />
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-foreground">
          E-mails de confirmação
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Pendentes"
            value={dispatch.pendente}
            icon={Clock}
            tone="muted"
            hint="Na fila de envio"
          />
          <StatCard
            label="Falharam"
            value={dispatch.falhou}
            icon={MailX}
            tone="danger"
            hint="Esgotaram o retry"
          />
          <StatCard
            label="Enviados"
            value={dispatch.enviado}
            icon={Mail}
            tone="primary"
          />
          <StatCard
            label="Cancelados"
            value={dispatch.cancelado}
            icon={MailX}
            tone="muted"
          />
        </div>
      </section>
    </div>
  );
}
