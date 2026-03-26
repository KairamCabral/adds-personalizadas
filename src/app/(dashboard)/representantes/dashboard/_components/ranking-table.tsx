"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { RepSummary } from "@/services/rep-dashboard.service";

type SortKey = "name" | "vendido" | "meta" | "percent" | "visitas" | "conversao";
type SortDir = "asc" | "desc";

function formatCurrency(value: number): string {
  if (value >= 1_000_000) return `R$ ${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `R$ ${(value / 1_000).toFixed(1)}k`;
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function SortIcon({
  column,
  sortKey,
  sortDir,
}: {
  column: SortKey;
  sortKey: SortKey;
  sortDir: SortDir;
}) {
  if (column !== sortKey) return <ArrowUpDown className="h-3.5 w-3.5 opacity-40" />;
  return sortDir === "asc" ? (
    <ArrowUp className="h-3.5 w-3.5" />
  ) : (
    <ArrowDown className="h-3.5 w-3.5" />
  );
}

function getGoalPercent(vendido: number, meta: number): number | null {
  if (!meta) return null;
  return Math.round((vendido / meta) * 100);
}

interface RankingTableProps {
  reps: RepSummary[];
}

export function RankingTable({ reps }: RankingTableProps) {
  const router = useRouter();
  const [sortKey, setSortKey] = useState<SortKey>("vendido");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  function handleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  const sorted = [...reps].sort((a, b) => {
    let aVal: number | string = 0;
    let bVal: number | string = 0;

    switch (sortKey) {
      case "name":
        aVal = a.full_name.toLowerCase();
        bVal = b.full_name.toLowerCase();
        break;
      case "vendido":
        aVal = a.vendidoMes;
        bVal = b.vendidoMes;
        break;
      case "meta":
        aVal = a.metaVendas;
        bVal = b.metaVendas;
        break;
      case "percent":
        aVal = getGoalPercent(a.vendidoMes, a.metaVendas) ?? -1;
        bVal = getGoalPercent(b.vendidoMes, b.metaVendas) ?? -1;
        break;
      case "visitas":
        aVal = a.visitasMes;
        bVal = b.visitasMes;
        break;
      case "conversao":
        aVal = a.conversaoPercent ?? -1;
        bVal = b.conversaoPercent ?? -1;
        break;
    }

    if (typeof aVal === "string") {
      return sortDir === "asc"
        ? aVal.localeCompare(bVal as string)
        : (bVal as string).localeCompare(aVal);
    }
    return sortDir === "asc" ? aVal - (bVal as number) : (bVal as number) - aVal;
  });

  const sorted_with_rank = sorted.map((rep, i) => ({ ...rep, rank: i + 1 }));

  function ThSort({
    col,
    label,
  }: {
    col: SortKey;
    label: string;
  }) {
    return (
      <TableHead
        className="cursor-pointer select-none hover:text-foreground"
        onClick={() => handleSort(col)}
      >
        <div className="flex items-center gap-1.5 font-semibold">
          {label}
          <SortIcon column={col} sortKey={sortKey} sortDir={sortDir} />
        </div>
      </TableHead>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Ranking de Representantes</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-hidden rounded-b-lg">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                <TableHead className="w-10 font-semibold">#</TableHead>
                <ThSort col="name" label="Nome" />
                <ThSort col="vendido" label="Vendido" />
                <ThSort col="meta" label="Meta" />
                <ThSort col="percent" label="%" />
                <ThSort col="visitas" label="Visitas" />
                <ThSort col="conversao" label="Conversão" />
                <TableHead className="font-semibold">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted_with_rank.map((rep) => {
                const percent = getGoalPercent(rep.vendidoMes, rep.metaVendas);
                const isActive = rep.is_active ?? true;
                const rowBg =
                  percent !== null && percent >= 100
                    ? "bg-emerald-50/50 dark:bg-emerald-950/20"
                    : percent !== null && percent < 50
                      ? "bg-red-50/50 dark:bg-red-950/20"
                      : "";

                return (
                  <TableRow
                    key={rep.id}
                    className={cn(
                      "cursor-pointer transition-colors hover:bg-muted/40",
                      rowBg
                    )}
                    onClick={() => router.push(`/representantes/${rep.id}`)}
                  >
                    <TableCell className="font-medium text-muted-foreground">
                      {rep.rank}
                    </TableCell>
                    <TableCell>
                      <span className="font-medium text-foreground">
                        {rep.full_name}
                      </span>
                    </TableCell>
                    <TableCell className="tabular-nums">
                      {formatCurrency(rep.vendidoMes)}
                    </TableCell>
                    <TableCell className="tabular-nums text-muted-foreground">
                      {rep.metaVendas ? formatCurrency(rep.metaVendas) : "—"}
                    </TableCell>
                    <TableCell>
                      {percent !== null ? (
                        <div className="flex items-center gap-2 min-w-[80px]">
                          <Progress
                            value={Math.min(percent, 100)}
                            className="h-1.5 w-16 flex-shrink-0"
                          />
                          <span
                            className={cn(
                              "text-xs font-semibold tabular-nums",
                              percent >= 100
                                ? "text-emerald-600"
                                : percent >= 60
                                  ? "text-amber-600"
                                  : "text-red-600"
                            )}
                          >
                            {percent}%
                          </span>
                        </div>
                      ) : (
                        <span className="text-sm text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="tabular-nums">
                      {rep.visitasMes}
                    </TableCell>
                    <TableCell className="tabular-nums">
                      {rep.conversaoPercent !== null
                        ? `${rep.conversaoPercent}%`
                        : "—"}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={cn(
                          "flex items-center gap-1.5 font-medium w-fit",
                          isActive
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800"
                            : "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-400 dark:border-red-800"
                        )}
                      >
                        <span
                          className={cn(
                            "h-1.5 w-1.5 rounded-full",
                            isActive ? "bg-emerald-500" : "bg-red-500"
                          )}
                        />
                        {isActive ? "Ativo" : "Inativo"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                );
              })}
              {reps.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={8}
                    className="py-8 text-center text-sm text-muted-foreground"
                  >
                    Nenhum representante encontrado
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
