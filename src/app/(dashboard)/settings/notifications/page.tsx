"use client";

import { useState } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const NOTIFICATION_TYPES = [
  { key: "mention", label: "Menções em comentários", defaultEmail: true, defaultInApp: true },
  { key: "system_alert", label: "Alertas do sistema", defaultEmail: true, defaultInApp: true },
  { key: "comment_added", label: "Novo comentário", defaultEmail: false, defaultInApp: true },
  { key: "label_changed", label: "Etiqueta alterada", defaultEmail: false, defaultInApp: true },
  { key: "order_created", label: "Pedido criado", defaultEmail: true, defaultInApp: true },
  { key: "quote_received", label: "Orçamento recebido", defaultEmail: true, defaultInApp: true },
  { key: "status_changed", label: "Status alterado", defaultEmail: true, defaultInApp: true },
  { key: "artwork_approved", label: "Arte aprovada", defaultEmail: true, defaultInApp: true },
  { key: "attachment_added", label: "Anexo adicionado", defaultEmail: false, defaultInApp: true },
  { key: "artwork_adjustment", label: "Ajuste de arte solicitado", defaultEmail: true, defaultInApp: true },
];

export default function SettingsNotificationsPage() {
  const [prefs, setPrefs] = useState<Record<string, { email: boolean; in_app: boolean }>>(
    Object.fromEntries(
      NOTIFICATION_TYPES.map((t) => [
        t.key,
        { email: t.defaultEmail, in_app: t.defaultInApp },
      ])
    )
  );

  const toggle = (key: string, field: "email" | "in_app") => {
    setPrefs((prev) => ({
      ...prev,
      [key]: {
        ...prev[key],
        [field]: !prev[key]?.[field],
      },
    }));
  };

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Notificações"
        description="Configure como deseja receber notificações"
      />

      <Card>
        <CardHeader>
          <CardTitle>Preferências de notificação</CardTitle>
          <CardDescription>
            Escolha se deseja receber cada tipo de notificação por e-mail e/ou
            no aplicativo.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tipo</TableHead>
                <TableHead className="w-32 text-center">No app</TableHead>
                <TableHead className="w-32 text-center">E-mail</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {NOTIFICATION_TYPES.map((type) => (
                <TableRow key={type.key}>
                  <TableCell className="font-medium">{type.label}</TableCell>
                  <TableCell className="text-center">
                    <div className="flex justify-center">
                      <Switch
                        checked={prefs[type.key]?.in_app ?? type.defaultInApp}
                        onCheckedChange={() => toggle(type.key, "in_app")}
                      />
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="flex justify-center">
                      <Switch
                        checked={prefs[type.key]?.email ?? type.defaultEmail}
                        onCheckedChange={() => toggle(type.key, "email")}
                      />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          </div>
          <p className="mt-4 text-muted-foreground text-sm">
            As alterações serão salvas automaticamente quando a integração com o
            perfil do usuário estiver concluída.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
