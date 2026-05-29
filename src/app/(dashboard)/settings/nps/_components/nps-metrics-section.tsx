"use client";

import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { computeNps, NPS_THEME_LABELS, type NpsTheme } from "@/lib/nps/scoring";
import {
  getDispatchCounts,
  getNpsResponses,
  getNpsThemeCounts,
} from "@/services/nps-admin.service";

const CHANNEL_LABELS: Record<string, string> = {
  CONSUMIDOR: "Consumidor",
  DENTISTA: "Dentista",
  DISTRIBUIDORA: "Distribuidora",
  VAREJISTA: "Varejista",
  "—": "Sem canal",
};

const PERIODS = [
  { days: 30, label: "30 dias" },
  { days: 90, label: "90 dias" },
  { days: 365, label: "12 meses" },
  { days: 0, label: "Tudo" },
];

function npsColor(nps: number): string {
  if (nps >= 50) return "#2ecc71";
  if (nps >= 0) return "#f5a623";
  return "#e2574c";
}

export function NpsMetricsSection() {
  const [periodDays, setPeriodDays] = useState(90);
  const fromIso = useMemo(
    () => (periodDays > 0 ? new Date(Date.now() - periodDays * 86_400_000).toISOString() : undefined),
    [periodDays],
  );

  const { data: responses = [], isLoading } = useQuery({
    queryKey: ["nps", "responses", periodDays],
    queryFn: () => getNpsResponses(fromIso),
  });
  const { data: themes = [] } = useQuery({
    queryKey: ["nps", "themes"],
    queryFn: getNpsThemeCounts,
  });
  const { data: dispatch } = useQuery({
    queryKey: ["nps", "dispatch-counts", periodDays],
    queryFn: () => getDispatchCounts(fromIso),
  });

  const overall = useMemo(() => computeNps(responses.map((r) => r.score)), [responses]);

  const byChannel = useMemo(() => {
    const m = new Map<string, number[]>();
    for (const r of responses) {
      const k = r.sales_channel ?? "—";
      const arr = m.get(k) ?? [];
      arr.push(r.score);
      m.set(k, arr);
    }
    return [...m.entries()]
      .map(([channel, scores]) => ({ channel, ...computeNps(scores) }))
      .sort((a, b) => b.total - a.total);
  }, [responses]);

  const responseRate =
    dispatch && dispatch.sent > 0 ? Math.round((dispatch.responded / dispatch.sent) * 100) : null;
  const pct = (n: number) => (overall.total ? Math.round((n / overall.total) * 100) : 0);

  return (
    <div className="space-y-6">
      {/* Seletor de período */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-muted-foreground">Período:</span>
        {PERIODS.map((p) => (
          <Button
            key={p.days}
            size="sm"
            variant={periodDays === p.days ? "default" : "outline"}
            onClick={() => setPeriodDays(p.days)}
          >
            {p.label}
          </Button>
        ))}
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando métricas…</p>
      ) : responses.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Nenhuma resposta de NPS neste período. Ative uma campanha na aba “Campanhas” para começar a coletar.
          </CardContent>
        </Card>
      ) : (
        <>
          {/* NPS global + breakdown */}
          <div className="grid gap-4 sm:grid-cols-3">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">NPS</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-4xl font-bold" style={{ color: npsColor(overall.nps) }}>
                  {overall.nps}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{overall.total} resposta(s)</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Taxa de resposta
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-4xl font-bold text-[#0b4269]">
                  {responseRate == null ? "—" : `${responseRate}%`}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {dispatch ? `${dispatch.responded}/${dispatch.sent} enviados` : ""}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Composição
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1.5 pt-1">
                <Bar label="Promotores" value={overall.promoters} pct={pct(overall.promoters)} color="#2ecc71" />
                <Bar label="Passivos" value={overall.passives} pct={pct(overall.passives)} color="#f5a623" />
                <Bar label="Detratores" value={overall.detractors} pct={pct(overall.detractors)} color="#e2574c" />
              </CardContent>
            </Card>
          </div>

          {/* Por canal */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base text-[#0b4269]">NPS por canal</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {byChannel.map((c) => (
                <div key={c.channel} className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">
                    {CHANNEL_LABELS[c.channel] ?? c.channel}
                  </span>
                  <span className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground">{c.total} resp.</span>
                    <span className="font-bold" style={{ color: npsColor(c.nps) }}>
                      {c.nps}
                    </span>
                  </span>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Temas (causa-raiz) */}
          {themes.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base text-[#0b4269]">Temas mais citados</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                {themes.map((t) => (
                  <span
                    key={t.theme}
                    className="rounded-full border border-input px-3 py-1 text-xs text-muted-foreground"
                  >
                    {NPS_THEME_LABELS[t.theme as NpsTheme]} · <strong>{t.count}</strong>
                  </span>
                ))}
              </CardContent>
            </Card>
          )}

          {responses.length === 2000 && (
            <p className="text-center text-xs text-muted-foreground">
              Mostrando as 2000 respostas mais recentes do período.
            </p>
          )}
        </>
      )}
    </div>
  );
}

function Bar({
  label,
  value,
  pct,
  color,
}: {
  label: string;
  value: number;
  pct: number;
  color: string;
}) {
  return (
    <div>
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{label}</span>
        <span>
          {value} · {pct}%
        </span>
      </div>
      <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
    </div>
  );
}
