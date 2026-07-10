"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { usePermissions } from "@/hooks/use-permissions";
import { getQueueHealth } from "@/services/congressos-queue-health.service";
import { QueueAlertBanner } from "./_components/queue-alert-banner";
import { QueueHealthCards } from "./_components/queue-health-cards";
import { DeadJobsTable } from "./_components/dead-jobs-table";
import { FailedDispatchesTable } from "./_components/failed-dispatches-table";

export default function QueueHealthPage() {
  const router = useRouter();
  const { can, isLoading: permissionsLoading } = usePermissions();
  const hasPermission = can("congressos.manage");

  const {
    data: health,
    isLoading,
    isFetching,
    refetch,
  } = useQuery({
    queryKey: ["congress_queue_health"],
    queryFn: getQueueHealth,
    enabled: !permissionsLoading && hasPermission,
    // Near-live durante o evento; o TanStack pausa quando a aba perde foco.
    refetchInterval: 30000,
  });

  useEffect(() => {
    if (!permissionsLoading && !hasPermission) router.replace("/pipeline");
  }, [permissionsLoading, hasPermission, router]);

  if (permissionsLoading) {
    return (
      <div className="flex min-h-[200px] items-center justify-center p-6">
        <p className="text-sm text-muted-foreground">Carregando...</p>
      </div>
    );
  }
  if (!hasPermission) return null;

  return (
    <div className="min-w-0 space-y-6 p-6">
      <div>
        <PageHeader
          title="Saúde da fila"
          description="Jobs de sincronização com o Tiny e e-mails de confirmação — contagens, problemas e reprocessamento."
        >
          <Button
            variant="outline"
            onClick={() => refetch()}
            disabled={isFetching}
          >
            <RefreshCw
              className={`mr-2 h-4 w-4 ${isFetching ? "animate-spin" : ""}`}
            />
            Atualizar
          </Button>
        </PageHeader>
      </div>

      {isLoading || !health ? (
        <>
          <Skeleton className="h-16 rounded-lg" />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-24 rounded-xl" />
            ))}
          </div>
        </>
      ) : (
        <>
          <QueueAlertBanner counts={health} />
          <QueueHealthCards counts={health} />

          <section className="space-y-2">
            <h2 className="text-sm font-semibold text-foreground">
              Jobs de sync mortos
            </h2>
            <DeadJobsTable jobs={health.deadJobs} />
          </section>

          <section className="space-y-2">
            <h2 className="text-sm font-semibold text-foreground">
              E-mails de confirmação falhos
            </h2>
            <FailedDispatchesTable dispatches={health.failedDispatches} />
          </section>
        </>
      )}
    </div>
  );
}
