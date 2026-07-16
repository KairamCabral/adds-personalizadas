"use client";

import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LabelBadge } from "@/components/shared/label-badge";
import { LABELS } from "@/lib/constants";
import type { LabelType } from "@/lib/constants";

export default function SettingsLabelsPage() {
  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Etiquetas"
        description="Etiquetas disponíveis para pedidos"
      />

      <Card>
        <CardHeader>
          <CardTitle>Tipos de etiqueta</CardTitle>
          <CardDescription>
            As {LABELS.length} etiquetas abaixo podem ser aplicadas aos pedidos
            no pipeline. A personalização será disponibilizada em versões
            futuras.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            {LABELS.map((config) => (
              <div
                key={config.key}
                className="flex items-center gap-3 rounded-lg border p-4"
              >
                <div
                  className="h-8 w-8 rounded-md"
                  style={{ backgroundColor: config.color }}
                />
                <div>
                  <p className="font-medium">{config.label}</p>
                  <p className="text-muted-foreground text-sm">{config.key}</p>
                </div>
                <LabelBadge label={config.key as LabelType} size="md" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
