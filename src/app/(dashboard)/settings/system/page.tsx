"use client";

import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function SettingsSystemPage() {
  const env = process.env.NODE_ENV ?? "development";
  const version = process.env.NEXT_PUBLIC_APP_VERSION ?? "1.0.0";

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Sistema"
        description="Informações gerais do sistema"
      />

      <Card>
        <CardHeader>
          <CardTitle>Informações gerais</CardTitle>
          <CardDescription>
            Dados básicos da aplicação ADDS CRM
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div>
              <p className="text-muted-foreground text-sm">Nome da aplicação</p>
              <p className="font-medium">ADDS CRM</p>
            </div>
          </div>
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div>
              <p className="text-muted-foreground text-sm">Versão</p>
              <p className="font-medium">{version}</p>
            </div>
          </div>
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div>
              <p className="text-muted-foreground text-sm">Ambiente</p>
              <p className="font-medium capitalize">{env}</p>
            </div>
            <Badge variant={env === "production" ? "default" : "secondary"}>
              {env === "production" ? "Produção" : "Desenvolvimento"}
            </Badge>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Configurações avançadas</CardTitle>
          <CardDescription>
            Opções adicionais serão disponibilizadas em versões futuras.
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}
