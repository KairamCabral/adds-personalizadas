"use client";

import { useEffect, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ArrowDown, ArrowUp, CircleAlert, Minus, UserCheck } from "lucide-react";

import { Card } from "@/components/ui/card";
import type { DailyPoint, LeadMetrics } from "@/services/leads.service";

/**
 * Cores da série, validadas para cada superfície (não é o mesmo azul invertido).
 * Uma série só, então não há questão de separação entre categorias — o que
 * importa aqui é contraste contra o fundo, e ambos passam 3:1.
 */
const SERIE = { light: "#2a78d6", dark: "#3987e5" } as const;

/** Recharts recebe cor por prop, então o tema precisa ser lido em JS. */
function useIsDark(): boolean {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const raiz = document.documentElement;
    const ler = () => setDark(raiz.classList.contains("dark"));
    ler();
    const obs = new MutationObserver(ler);
    obs.observe(raiz, { attributes: true, attributeFilter: ["class"] });
    return () => obs.disconnect();
  }, []);

  return dark;
}

interface StatProps {
  rotulo: string;
  valor: string | number;
  apoio?: React.ReactNode;
  destaque?: "neutro" | "atencao" | "bom";
}

/**
 * Número único com apoio. Um valor atual não vira gráfico de uma barra só —
 * vira ladrilho.
 */
function Stat({ rotulo, valor, apoio, destaque = "neutro" }: StatProps) {
  return (
    <Card className="p-4">
      <p className="text-xs font-medium text-muted-foreground">{rotulo}</p>
      <p
        className={`mt-1 text-3xl font-semibold leading-none tracking-tight ${
          destaque === "atencao"
            ? "text-amber-600 dark:text-amber-500"
            : destaque === "bom"
              ? "text-emerald-600 dark:text-emerald-500"
              : ""
        }`}
      >
        {valor}
      </p>
      {apoio ? <div className="mt-2 text-xs text-muted-foreground">{apoio}</div> : null}
    </Card>
  );
}

interface Props {
  metrics: LeadMetrics;
  serie: DailyPoint[];
}

export function LeadsOverview({ metrics, serie }: Props) {
  const dark = useIsDark();
  const cor = dark ? SERIE.dark : SERIE.light;

  const delta = metrics.hoje - metrics.ontem;
  const DeltaIcon = delta > 0 ? ArrowUp : delta < 0 ? ArrowDown : Minus;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat
          rotulo="Leads hoje"
          valor={metrics.hoje}
          apoio={
            // Delta acompanhado de ícone e texto: a cor sozinha nunca carrega o
            // significado de "subiu" ou "caiu".
            <span
              className={`inline-flex items-center gap-1 ${
                delta > 0
                  ? "text-emerald-600 dark:text-emerald-500"
                  : delta < 0
                    ? "text-muted-foreground"
                    : "text-muted-foreground"
              }`}
            >
              <DeltaIcon className="size-3" aria-hidden />
              {delta === 0 ? "igual a ontem" : `${Math.abs(delta)} vs. ontem`}
            </span>
          }
        />

        {/* O ladrilho que existe para gerar ação. Tarefa em aberto incomoda até
            ser fechada — por isso ele fica na fileira principal, não escondido. */}
        <Stat
          rotulo="Aguardando contato"
          valor={metrics.semContato}
          destaque={metrics.semContatoAtrasados > 0 ? "atencao" : "neutro"}
          apoio={
            metrics.semContatoAtrasados > 0 ? (
              <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-500">
                <CircleAlert className="size-3" aria-hidden />
                {metrics.semContatoAtrasados} há mais de 24h
              </span>
            ) : (
              "nenhum atrasado"
            )
          }
        />

        <Stat
          rotulo="Taxa de contato"
          valor={`${metrics.taxaContato}%`}
          destaque={metrics.taxaContato >= 80 ? "bom" : "neutro"}
          apoio={`${metrics.total - metrics.semContato} de ${metrics.total} trabalhados`}
        />

        <Stat
          rotulo="Já são contatos"
          valor={metrics.jaSaoClientes}
          apoio={
            <span className="inline-flex items-center gap-1">
              <UserCheck className="size-3" aria-hidden />
              cadastrados no CRM
            </span>
          }
        />
      </div>

      <Card className="p-4">
        <div className="mb-3">
          <h3 className="text-sm font-semibold">Leads por dia</h3>
          <p className="text-xs text-muted-foreground">Últimos 14 dias</p>
        </div>

        {/* Série única: o título já diz o que é, então legenda seria ruído. */}
        <div className="h-[160px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={serie} margin={{ top: 4, right: 4, bottom: 0, left: -24 }}>
              <defs>
                <linearGradient id="grad-leads" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={cor} stopOpacity={0.22} />
                  <stop offset="100%" stopColor={cor} stopOpacity={0} />
                </linearGradient>
              </defs>

              {/* Grade recessiva: apoia a leitura sem competir com os dados. */}
              <CartesianGrid
                strokeDasharray="3 3"
                vertical={false}
                stroke="currentColor"
                className="text-border"
              />
              <XAxis
                dataKey="rotulo"
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 11 }}
                stroke="currentColor"
                className="text-muted-foreground"
                interval="preserveStartEnd"
                minTickGap={16}
              />
              <YAxis
                allowDecimals={false}
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 11 }}
                stroke="currentColor"
                className="text-muted-foreground"
                width={40}
              />
              <Tooltip
                cursor={{ stroke: cor, strokeWidth: 1, strokeOpacity: 0.4 }}
                contentStyle={{
                  borderRadius: 8,
                  border: "1px solid hsl(var(--border))",
                  background: "hsl(var(--popover))",
                  color: "hsl(var(--popover-foreground))",
                  fontSize: 12,
                }}
                labelFormatter={(v) => `Dia ${v}`}
                formatter={(v: number) => [v, v === 1 ? "lead" : "leads"]}
              />
              <Area
                type="monotone"
                dataKey="leads"
                stroke={cor}
                strokeWidth={2}
                fill="url(#grad-leads)"
                // Ponto só no hover: marcar todos os dias polui uma série densa.
                dot={false}
                activeDot={{ r: 4, strokeWidth: 2 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </div>
  );
}
