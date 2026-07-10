"use client";

import { useMemo } from "react";
import type { LucideIcon } from "lucide-react";
import {
  Users,
  BadgeCheck,
  Gift,
  Clock,
  RefreshCw,
  PackageOpen,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import type { RegistrationWithGift } from "@/services/congressos-gifts.service";
import type { EventEdition } from "@/types/database.types";

type Tone = "primary" | "accent" | "success" | "warning" | "muted";

// Tokens dark-mode-aware (mesmos do MetricCard do dashboard).
const TONE: Record<Tone, string> = {
  primary: "bg-dashboard-primary/15 text-dashboard-primary",
  accent: "bg-dashboard-accent/15 text-dashboard-accent",
  success: "bg-dashboard-success/15 text-dashboard-success",
  warning: "bg-dashboard-warning/15 text-dashboard-warning",
  muted: "bg-muted text-muted-foreground",
};

function StatCard({
  label,
  value,
  icon: Icon,
  tone = "primary",
  hint,
  children,
}: {
  label: string;
  value: string;
  icon: LucideIcon;
  tone?: Tone;
  hint?: string;
  children?: React.ReactNode;
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
              {value}
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
        {children}
      </CardContent>
    </Card>
  );
}

export function GiftStats({
  registrations,
  edition,
}: {
  registrations: RegistrationWithGift[];
  edition: EventEdition;
}) {
  const s = useMemo(() => {
    const total = registrations.length;
    const qualified = registrations.filter((r) => r.qualified).length;
    const withGift = registrations.filter((r) => r.gift_status != null);
    const retirados = withGift.filter(
      (r) => r.gift_status === "RETIRADO"
    ).length;
    const pendentes = withGift.filter(
      (r) => r.gift_status === "PENDENTE"
    ).length;
    const synced = registrations.filter((r) => r.sync_status === "DONE").length;
    const totalGifts = withGift.length;
    const pct = totalGifts > 0 ? Math.round((retirados / totalGifts) * 100) : 0;
    const estoque =
      edition.gift_stock != null
        ? Math.max(edition.gift_stock - retirados, 0)
        : null;
    return { total, qualified, retirados, pendentes, synced, pct, estoque };
  }, [registrations, edition]);

  const nf = (n: number) => n.toLocaleString("pt-BR");

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
      <StatCard label="Inscritos" value={nf(s.total)} icon={Users} tone="primary" />
      <StatCard
        label="Qualificados"
        value={nf(s.qualified)}
        icon={BadgeCheck}
        tone="accent"
        hint="Dentistas / distribuidoras"
      />
      <StatCard
        label="Brindes retirados"
        value={nf(s.retirados)}
        icon={Gift}
        tone="success"
      >
        <div className="mt-3">
          <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
            <span>{s.pct}% dos brindes</span>
          </div>
          <Progress value={s.pct} className="h-1.5" />
        </div>
      </StatCard>
      <StatCard
        label="Pendentes"
        value={nf(s.pendentes)}
        icon={Clock}
        tone="warning"
      />
      <StatCard
        label="Sincronizados"
        value={nf(s.synced)}
        icon={RefreshCw}
        tone="muted"
        hint={`de ${nf(s.total)} no Tiny`}
      />
      <StatCard
        label="Estoque restante"
        value={s.estoque != null ? nf(s.estoque) : "—"}
        icon={PackageOpen}
        tone="primary"
        hint={edition.gift_stock == null ? "Ilimitado" : undefined}
      />
    </div>
  );
}
