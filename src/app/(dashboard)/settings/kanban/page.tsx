"use client";

import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ORDER_STATUSES } from "@/lib/constants";
import { cn } from "@/lib/utils";

export default function SettingsKanbanPage() {
  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Kanban"
        description="Configuração das colunas do pipeline"
      />

      <Card>
        <CardHeader>
          <CardTitle>Colunas do pipeline</CardTitle>
          <CardDescription>
            As 12 colunas do Kanban estão definidas na ordem abaixo. A
            personalização da ordem e nomes será disponibilizada em versões
            futuras.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {ORDER_STATUSES.map((status, index) => {
              const Icon = status.icon;
              return (
                <div
                  key={status.key}
                  className={cn(
                    "flex items-center gap-2 rounded-lg border px-4 py-2",
                    status.borderColor,
                    status.bgColor
                  )}
                >
                  <span className="text-muted-foreground text-sm font-medium">
                    {index + 1}.
                  </span>
                  <Icon className={cn("h-4 w-4", status.color)} />
                  <span className={cn("font-medium", status.color)}>
                    {status.label}
                  </span>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
