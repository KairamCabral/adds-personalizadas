"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/shared/page-header";
import { usePermissions } from "@/hooks/use-permissions";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getAuditLogs } from "@/services/audit.service";
import { formatDateTime } from "@/lib/utils";
import { AlertCircle } from "lucide-react";

const ACTION_LABELS: Record<string, string> = {
  LOGIN: "Login",
  LOGOUT: "Logout",
  CREATE: "Criação",
  UPDATE: "Atualização",
  DELETE: "Exclusão",
  STATUS_CHANGE: "Alteração de status",
  LABEL_CHANGE: "Alteração de etiqueta",
  ARTWORK_UPLOAD: "Upload de arte",
  ARTWORK_APPROVE: "Aprovação de arte",
  ARTWORK_REJECT: "Rejeição de arte",
  SYNC_TINY: "Sincronização Tiny",
  EXPORT: "Exportação",
};

export default function SettingsSecurityPage() {
  const router = useRouter();
  const { can, isLoading: permissionsLoading } = usePermissions();
  const { data, isLoading } = useQuery({
    queryKey: ["audit-logs"],
    queryFn: () => getAuditLogs({}, 1),
  });

  useEffect(() => {
    if (!permissionsLoading && !can("settings.security")) {
      router.replace("/settings");
    }
  }, [permissionsLoading, router]);

  if (permissionsLoading) {
    return (
      <div className="flex min-h-[200px] items-center justify-center p-6">
        <p className="text-sm text-muted-foreground">Carregando...</p>
      </div>
    );
  }

  if (!can("settings.security")) {
    return null;
  }

  const logs = data?.logs ?? [];
  const total = data?.total ?? 0;

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Segurança"
        description="Sessões e registro de auditoria"
      />

      <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950/30">
        <AlertCircle className="h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
        <div>
          <p className="font-medium text-amber-800 dark:text-amber-200">
            Acesso restrito
          </p>
          <p className="text-amber-700 text-sm dark:text-amber-300">
            Esta página e o registro de auditoria são visíveis apenas para
            usuários com perfil MASTER.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Gerenciamento de sessões</CardTitle>
          <CardDescription>
            Informações sobre sessões ativas. O gerenciamento detalhado será
            disponibilizado em versões futuras.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">
            Sua sessão atual está ativa. Para encerrar, utilize a opção Sair no
            menu do usuário.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Registro de auditoria</CardTitle>
          <CardDescription>
            Histórico das ações realizadas no sistema
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="py-8 text-center text-muted-foreground">
              Carregando registro...
            </div>
          ) : logs.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              Nenhum registro de auditoria encontrado.
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data/Hora</TableHead>
                    <TableHead>Ação</TableHead>
                    <TableHead>Entidade</TableHead>
                    <TableHead>Usuário</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="text-muted-foreground text-sm">
                        {formatDateTime(log.created_at)}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {ACTION_LABELS[log.action] ?? log.action}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {log.entity_type}
                        {log.entity_id ? ` #${log.entity_id.slice(0, 8)}` : ""}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {log.user?.full_name ?? "Sistema"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <p className="mt-4 text-muted-foreground text-sm">
                Exibindo os registros mais recentes. Total: {total} registro(s).
              </p>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
