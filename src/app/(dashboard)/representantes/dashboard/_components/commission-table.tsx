"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { CommissionRow } from "@/services/rep-dashboard.service";

function formatCurrency(value: number): string {
  if (value >= 1_000_000) return `R$ ${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `R$ ${(value / 1_000).toFixed(1)}k`;
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function getNextMonthLabel(): string {
  const next = new Date();
  next.setMonth(next.getMonth() + 1);
  return next.toLocaleString("pt-BR", { month: "long" });
}

interface CommissionTableProps {
  rows: CommissionRow[];
}

export function CommissionTable({ rows }: CommissionTableProps) {
  const totalVendido = rows.reduce((s, r) => s + r.vendido, 0);
  const totalCommission = rows.reduce(
    (s, r) => s + (r.commission ?? 0),
    0
  );
  const nextMonth = getNextMonthLabel();

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Comissões Estimadas</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-hidden rounded-none">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                <TableHead className="font-semibold">Representante</TableHead>
                <TableHead className="font-semibold text-right">Faturado</TableHead>
                <TableHead className="font-semibold text-right">Taxa</TableHead>
                <TableHead className="font-semibold text-right">Comissão</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.repId} className="hover:bg-muted/30">
                  <TableCell className="font-medium">{row.repName}</TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    {formatCurrency(row.vendido)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    {row.commissionRate !== null && row.commissionRate > 0 ? (
                      `${row.commissionRate}%`
                    ) : (
                      <span className="italic text-muted-foreground/60">
                        Não config.
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {row.commission !== null ? (
                      <span className="font-semibold text-emerald-700 dark:text-emerald-400">
                        {formatCurrency(row.commission)}
                      </span>
                    ) : (
                      <span className="italic text-muted-foreground/60 text-sm">
                        Não configurada
                      </span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {rows.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={4}
                    className="py-6 text-center text-sm text-muted-foreground"
                  >
                    Nenhum representante no período
                  </TableCell>
                </TableRow>
              )}

              {/* Linha de total */}
              {rows.length > 0 && (
                <TableRow
                  className={cn(
                    "border-t-2 border-border bg-muted/20 font-bold hover:bg-muted/30"
                  )}
                >
                  <TableCell className="font-bold">TOTAL</TableCell>
                  <TableCell className="text-right tabular-nums font-bold">
                    {formatCurrency(totalVendido)}
                  </TableCell>
                  <TableCell />
                  <TableCell className="text-right tabular-nums font-bold text-emerald-700 dark:text-emerald-400">
                    {formatCurrency(totalCommission)}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
      {rows.length > 0 && (
        <CardFooter className="pt-3">
          <p className="text-xs text-muted-foreground">
            * Comissões estimadas. Pagamento previsto até o dia{" "}
            <span className="font-medium">15 de {nextMonth}</span>.
          </p>
        </CardFooter>
      )}
    </Card>
  );
}
