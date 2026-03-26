"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { MapPin, Clock, TrendingUp, ShoppingBag, Eye } from "lucide-react";
import {
  type RepresentanteData,
  getActivityStatus,
  calcGoalPercent,
} from "@/services/representantes.service";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface RepresentantesListProps {
  data: RepresentanteData[];
  isLoading: boolean;
  search: string;
  statusFilter: "todos" | "ativo" | "alerta" | "inativo";
}

function StatusBadge({ isActive }: { isActive: boolean }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "flex items-center gap-1.5 font-medium",
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
  );
}

function GoalCell({
  ordersCount,
  goalTarget,
}: {
  ordersCount: number;
  goalTarget: number;
}) {
  const percent = calcGoalPercent(ordersCount, goalTarget);

  if (percent === null) {
    return <span className="text-sm text-muted-foreground">—</span>;
  }

  const color =
    percent >= 100
      ? "text-emerald-600"
      : percent >= 60
        ? "text-amber-600"
        : "text-red-600";

  return (
    <div className="flex flex-col gap-1.5 min-w-[80px]">
      <div className="flex items-center justify-between gap-2">
        <span className={cn("text-sm font-semibold tabular-nums", color)}>
          {percent}%
        </span>
        <span className="text-xs text-muted-foreground">
          {ordersCount}/{goalTarget}
        </span>
      </div>
      <Progress
        value={Math.min(percent, 100)}
        className="h-1.5"
      />
    </div>
  );
}

function LastActivityCell({ lastActivityAt }: { lastActivityAt: string | null }) {
  if (!lastActivityAt) {
    return <span className="text-sm text-muted-foreground">Nunca</span>;
  }

  return (
    <span className="text-sm text-muted-foreground">
      {formatDistanceToNow(new Date(lastActivityAt), {
        addSuffix: true,
        locale: ptBR,
      })}
    </span>
  );
}

function SkeletonRow() {
  return (
    <TableRow>
      {Array.from({ length: 8 }).map((_, i) => (
        <TableCell key={i}>
          <Skeleton className="h-4 w-full" />
        </TableCell>
      ))}
    </TableRow>
  );
}

export function RepresentantesList({
  data,
  isLoading,
  search,
  statusFilter,
}: RepresentantesListProps) {
  const router = useRouter();

  const filtered = useMemo(() => {
    return data.filter((rep) => {
      const matchSearch =
        !search ||
        rep.full_name.toLowerCase().includes(search.toLowerCase()) ||
        rep.email.toLowerCase().includes(search.toLowerCase());

      const status = getActivityStatus(rep.lastActivityAt);
      const matchStatus = statusFilter === "todos" || status === statusFilter;

      return matchSearch && matchStatus;
    });
  }, [data, search, statusFilter]);

  if (!isLoading && filtered.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed bg-muted/30 py-16 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
          <Eye className="h-5 w-5 text-muted-foreground" />
        </div>
        <p className="mt-4 text-sm font-medium text-foreground">
          {search || statusFilter !== "todos"
            ? "Nenhum representante encontrado"
            : "Nenhum representante cadastrado"}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          {search || statusFilter !== "todos"
            ? "Tente ajustar os filtros de busca."
            : "Representantes aparecerão aqui após serem criados no Supabase."}
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border bg-card overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/40 hover:bg-muted/40">
            <TableHead className="font-semibold">Nome</TableHead>
            <TableHead className="font-semibold">Email</TableHead>
            <TableHead className="font-semibold">
              <div className="flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5" />
                Território
              </div>
            </TableHead>
            <TableHead className="font-semibold">
              <div className="flex items-center gap-1.5">
                <TrendingUp className="h-3.5 w-3.5" />
                Meta (mês)
              </div>
            </TableHead>
            <TableHead className="font-semibold">
              <div className="flex items-center gap-1.5">
                <ShoppingBag className="h-3.5 w-3.5" />
                Pedidos
              </div>
            </TableHead>
            <TableHead className="font-semibold">Visitas</TableHead>
            <TableHead className="font-semibold">
              <div className="flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5" />
                Última Ação
              </div>
            </TableHead>
            <TableHead className="font-semibold">Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading
            ? Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)
            : filtered.map((rep) => (
                <TableRow
                  key={rep.id}
                  className="cursor-pointer transition-colors hover:bg-muted/40"
                  onClick={() => router.push(`/representantes/${rep.id}`)}
                >
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-medium text-foreground">
                        {rep.full_name}
                      </span>
                      {rep.phone && (
                        <span className="text-xs text-muted-foreground">
                          {rep.phone}
                        </span>
                      )}
                    </div>
                  </TableCell>

                  <TableCell>
                    <span className="text-sm text-muted-foreground">
                      {rep.email}
                    </span>
                  </TableCell>

                  <TableCell>
                    {rep.territories.length > 0 ? (
                      <div className="flex flex-wrap gap-1 max-w-[200px]">
                        {rep.territories.slice(0, 3).map((city) => (
                          <Badge
                            key={city}
                            variant="secondary"
                            className="text-xs font-normal"
                          >
                            {city}
                          </Badge>
                        ))}
                        {rep.territories.length > 3 && (
                          <Badge
                            variant="outline"
                            className="text-xs font-normal text-muted-foreground"
                          >
                            +{rep.territories.length - 3}
                          </Badge>
                        )}
                      </div>
                    ) : (
                      <span className="text-sm text-muted-foreground">—</span>
                    )}
                  </TableCell>

                  <TableCell>
                    <GoalCell
                      ordersCount={rep.ordersCount}
                      goalTarget={rep.goalTarget}
                    />
                  </TableCell>

                  <TableCell>
                    <span className="text-sm font-medium tabular-nums">
                      {rep.ordersCount}
                    </span>
                  </TableCell>

                  <TableCell>
                    <span className="text-sm font-medium tabular-nums">
                      {rep.visitasCount}
                    </span>
                  </TableCell>

                  <TableCell>
                    <LastActivityCell lastActivityAt={rep.lastActivityAt} />
                  </TableCell>

                  <TableCell>
                    <StatusBadge isActive={rep.is_active} />
                  </TableCell>
                </TableRow>
              ))}
        </TableBody>
      </Table>
    </div>
  );
}
