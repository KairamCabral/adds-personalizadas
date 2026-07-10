"use client";

import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import {
  evaluateQueueAlert,
  type QueueCounts,
} from "@/lib/congressos/queue-health";

/**
 * Banner de saúde da fila (E7 / Story 7.1). Mostra o alerta quando MORTOS/FALHOS
 * (ou retry/backlog) cruzam o limiar de `evaluateQueueAlert`. Quando tudo está
 * saudável, exibe um estado "ok" discreto.
 */
export function QueueAlertBanner({ counts }: { counts: QueueCounts }) {
  const { level, messages } = evaluateQueueAlert(counts);

  if (level === "ok") {
    return (
      <Alert className="border-dashboard-success/40 text-foreground">
        <CheckCircle2 className="h-4 w-4 text-dashboard-success" />
        <AlertTitle>Filas saudáveis</AlertTitle>
        <AlertDescription className="text-muted-foreground">
          Nenhum job morto ou e-mail falho acima do limiar.
        </AlertDescription>
      </Alert>
    );
  }

  const isCritical = level === "critical";

  return (
    <Alert
      variant={isCritical ? "destructive" : "default"}
      className={cn(
        !isCritical &&
          "border-dashboard-warning/50 text-foreground [&>svg]:text-dashboard-warning"
      )}
    >
      <AlertTriangle className="h-4 w-4" />
      <AlertTitle>
        {isCritical
          ? "Ação necessária na fila"
          : "Atenção à saúde da fila"}
      </AlertTitle>
      <AlertDescription>
        <ul className="ml-4 list-disc space-y-0.5">
          {messages.map((m, i) => (
            <li key={i}>{m}</li>
          ))}
        </ul>
      </AlertDescription>
    </Alert>
  );
}
