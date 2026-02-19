"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/shared/page-header";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Link2,
  Mail,
  CheckCircle2,
  XCircle,
  ExternalLink,
  Unlink,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import {
  getIntegrationsStatus,
  disconnectTiny,
} from "@/services/tiny.service";

export default function SettingsIntegrationsPage() {
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();

  // ── Feedback do OAuth callback ────────────────────────────
  useEffect(() => {
    const tinyParam = searchParams.get("tiny");
    const errorParam = searchParams.get("error");

    if (tinyParam === "connected") {
      toast.success("Tiny ERP conectado com sucesso!");
      // limpa o param da URL sem recarregar a página
      window.history.replaceState({}, "", window.location.pathname);
    } else if (errorParam === "oauth_failed") {
      toast.error("Falha na autorização com o Tiny ERP. Tente novamente.");
      window.history.replaceState({}, "", window.location.pathname);
    } else if (errorParam === "no_code") {
      toast.error("Autorização cancelada ou código inválido.");
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, [searchParams]);

  // ── Status das integrações ────────────────────────────────
  const { data: status, isLoading } = useQuery({
    queryKey: ["integrations-status"],
    queryFn: getIntegrationsStatus,
    refetchOnWindowFocus: true,
  });

  const tinyConnected = status?.tiny ?? false;
  const resendConfigured = status?.resend ?? false;

  // ── Desconectar Tiny ──────────────────────────────────────
  const disconnectMutation = useMutation({
    mutationFn: disconnectTiny,
    onSuccess: (result) => {
      if (result.success) {
        toast.success("Tiny ERP desconectado.");
        queryClient.invalidateQueries({ queryKey: ["integrations-status"] });
      } else {
        toast.error(result.error ?? "Erro ao desconectar.");
      }
    },
    onError: () => toast.error("Erro ao desconectar o Tiny ERP."),
  });

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Integrações"
        description="Conexões com serviços externos"
      />

      <div className="grid gap-4 md:grid-cols-2">
        {/* ── Tiny ERP ── */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <Link2 className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle>Tiny ERP</CardTitle>
                <CardDescription>
                  Sincronização de clientes e produtos
                </CardDescription>
              </div>
            </div>

            {isLoading ? (
              <Skeleton className="h-6 w-28 rounded-full" />
            ) : (
              <Badge
                variant={tinyConnected ? "default" : "secondary"}
                className={
                  tinyConnected
                    ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                    : ""
                }
              >
                {tinyConnected ? (
                  <>
                    <CheckCircle2 className="mr-1 h-3 w-3" />
                    Conectado
                  </>
                ) : (
                  <>
                    <XCircle className="mr-1 h-3 w-3" />
                    Não conectado
                  </>
                )}
              </Badge>
            )}
          </CardHeader>

          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Integre o ADDS CRM com o Tiny ERP para sincronizar clientes e
              produtos automaticamente via OAuth2.
            </p>

            <div className="flex flex-wrap gap-2">
              {isLoading ? (
                <Skeleton className="h-9 w-44 rounded-md" />
              ) : tinyConnected ? (
                <>
                  <Link href="/tiny">
                    <Button variant="outline" size="sm">
                      <ExternalLink className="mr-2 h-4 w-4" />
                      Gerenciar sincronizações
                    </Button>
                  </Link>

                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                      >
                        <Unlink className="mr-2 h-4 w-4" />
                        Desconectar
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>
                          Desconectar Tiny ERP?
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                          Os tokens de acesso serão removidos. Você precisará
                          autorizar novamente para retomar as sincronizações.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          onClick={() => disconnectMutation.mutate()}
                        >
                          Desconectar
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </>
              ) : (
                <Button asChild size="sm">
                  <a href="/api/tiny/auth">
                    <Link2 className="mr-2 h-4 w-4" />
                    Conectar com Tiny ERP
                    <ExternalLink className="ml-2 h-3 w-3 opacity-60" />
                  </a>
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* ── Resend ── */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <Mail className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle>Resend (E-mail)</CardTitle>
                <CardDescription>
                  Envio de notificações por e-mail
                </CardDescription>
              </div>
            </div>

            {isLoading ? (
              <Skeleton className="h-6 w-28 rounded-full" />
            ) : (
              <Badge
                variant={resendConfigured ? "default" : "secondary"}
                className={
                  resendConfigured
                    ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                    : ""
                }
              >
                {resendConfigured ? (
                  <>
                    <CheckCircle2 className="mr-1 h-3 w-3" />
                    Configurado
                  </>
                ) : (
                  <>
                    <XCircle className="mr-1 h-3 w-3" />
                    Não configurado
                  </>
                )}
              </Badge>
            )}
          </CardHeader>

          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Configure a chave da API Resend nas variáveis de ambiente para
              habilitar o envio de e-mails (aprovações de arte, mudanças de
              status, orçamentos, etc.).
            </p>

            {!isLoading && !resendConfigured && (
              <p className="text-xs text-muted-foreground rounded-md bg-muted px-3 py-2">
                Defina a variável{" "}
                <code className="font-mono">RESEND_API_KEY</code> e{" "}
                <code className="font-mono">RESEND_FROM_EMAIL</code> no
                servidor para ativar.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Futuras integrações ── */}
      <Card>
        <CardHeader>
          <CardTitle>Outras integrações</CardTitle>
          <CardDescription>
            Novas integrações serão disponibilizadas em versões futuras.
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}
