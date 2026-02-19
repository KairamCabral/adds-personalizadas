"use client";

import { useQuery } from "@tanstack/react-query";
import { MetricCard } from "./metric-card";
import { Users, UserPlus, Trophy, MapPin } from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  getClientesData,
  getPeriodRange,
  type PeriodValue,
} from "@/services/dashboard.service";

interface TabClientesProps {
  period: PeriodValue;
}

function TabClientesSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 2 }).map((_, i) => (
          <Skeleton key={i} className="h-28 rounded-lg" />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Skeleton className="h-72 rounded-lg" />
        <Skeleton className="h-72 rounded-lg" />
      </div>
    </div>
  );
}

export function TabClientes({ period }: TabClientesProps) {
  const range = getPeriodRange(period);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["dashboard", "clientes", period],
    queryFn: () => getClientesData(range),
    staleTime: 5 * 60 * 1000,
  });

  if (isLoading) return <TabClientesSkeleton />;

  if (isError) {
    return (
      <div className="flex items-center justify-center rounded-xl border border-dashed p-16 text-center">
        <p className="text-sm text-destructive">Erro ao carregar dados de clientes.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Novos Clientes"
          value={String(data?.novosNoPeriodo ?? 0)}
          icon={UserPlus}
          trend="neutral"
        />
        <MetricCard
          title="Total de Clientes"
          value={String(data?.totalClientes ?? 0)}
          icon={Users}
          trend="neutral"
        />
      </div>

      {(!data || (data.topClientes.length === 0 && data.porEstado.length === 0)) ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed p-16 text-center">
          <p className="text-sm font-medium text-muted-foreground">
            Nenhum cliente com pedidos no período e sem dados de localização.
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            Sincronize clientes do Tiny ERP em{" "}
            <a href="/tiny" className="underline hover:text-primary">
              Sistema &gt; Tiny ERP
            </a>
            {" "}ou cadastre em{" "}
            <a href="/contacts" className="underline hover:text-primary">
              Contatos
            </a>
            .
          </p>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {/* Top clientes por pedidos */}
          <div className="rounded-lg border bg-card p-6">
            <h3 className="mb-4 flex items-center gap-2 text-base font-semibold">
              <Trophy className="h-4 w-4" />
              Top Clientes (por pedidos)
            </h3>
            {data.topClientes.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sem dados.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>#</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead className="text-right">Pedidos</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.topClientes.map((cliente, idx) => (
                    <TableRow key={cliente.id}>
                      <TableCell className="text-muted-foreground text-xs">
                        {idx + 1}
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{cliente.nome}</p>
                          {cliente.empresa && (
                            <p className="text-xs text-muted-foreground">
                              {cliente.empresa}
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        {cliente.totalPedidos}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>

          {/* Distribuição por estado */}
          <div className="rounded-lg border bg-card p-6">
            <h3 className="mb-4 flex items-center gap-2 text-base font-semibold">
              <MapPin className="h-4 w-4" />
              Distribuição por estado
            </h3>
            {data.porEstado.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sem dados de localização.</p>
            ) : (
              <div className="h-[220px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={data.porEstado}
                    layout="vertical"
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      className="stroke-muted"
                      horizontal={false}
                    />
                    <XAxis
                      type="number"
                      tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                    />
                    <YAxis
                      type="category"
                      dataKey="estado"
                      width={100}
                      tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                      }}
                      formatter={(v: number) => [v, "Clientes"]}
                    />
                    <Bar
                      dataKey="quantidade"
                      fill="hsl(var(--primary))"
                      radius={[0, 4, 4, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
