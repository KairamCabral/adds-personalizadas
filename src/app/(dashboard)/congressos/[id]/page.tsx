"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ScanLine, TicketX, Pencil, QrCode } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs";
import { usePermissions } from "@/hooks/use-permissions";
import {
  getEditionById,
  toggleEditionActive,
} from "@/services/congressos.service";
import { getEditionRegistrations } from "@/services/congressos-gifts.service";
import type { EventEdition } from "@/types/database.types";
import { EditionForm } from "../_components/edition-form";
import { EditionQrDialog } from "../_components/edition-qr-dialog";
import { GiftStats } from "./_components/gift-stats";
import { RegistrationsTable } from "./_components/registrations-table";
import { CreditsTable } from "./_components/credits-table";
import { RafflePanel } from "./_components/raffle-panel";

export default function EditionDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const router = useRouter();
  const queryClient = useQueryClient();
  const { can, isLoading: permissionsLoading } = usePermissions();
  const hasPermission = can("congressos.manage");

  const [formOpen, setFormOpen] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);

  useEffect(() => {
    if (!permissionsLoading && !hasPermission) router.replace("/pipeline");
  }, [permissionsLoading, hasPermission, router]);

  const {
    data: edition,
    isLoading: editionLoading,
    isError: editionError,
  } = useQuery({
    queryKey: ["event_edition", id],
    queryFn: () => getEditionById(id),
    enabled: !permissionsLoading && hasPermission && !!id,
    retry: false,
  });

  const { data: registrations = [], isLoading: regLoading } = useQuery({
    queryKey: ["event_registrations", id],
    queryFn: () => getEditionRegistrations(id),
    enabled: !permissionsLoading && hasPermission && !!id,
    // Near-live durante o evento; o TanStack pausa quando a aba perde foco.
    refetchInterval: 30000,
  });

  const toggleActiveMutation = useMutation({
    mutationFn: (e: EventEdition) => toggleEditionActive(e.id, !e.is_active),
    onSuccess: (updated) => {
      toast.success(updated.is_active ? "Edição ativada." : "Edição desativada.");
      queryClient.invalidateQueries({ queryKey: ["event_edition", id] });
      queryClient.invalidateQueries({ queryKey: ["event_editions"] });
    },
    onError: () => toast.error("Erro ao alterar status da edição."),
  });

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
        <Link
          href="/congressos"
          className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Congressos
        </Link>
        <PageHeader
          title={edition?.name ?? "Edição"}
          description={
            edition
              ? `Inscritos e brindes${
                  edition.gift_name ? ` · ${edition.gift_name}` : ""
                }`
              : "Acompanhe os inscritos e a retirada dos brindes."
          }
        >
          {edition && (
            <>
              <Badge
                variant={edition.is_active ? "default" : "outline"}
                className="cursor-pointer select-none"
                onClick={() => toggleActiveMutation.mutate(edition)}
                title={edition.is_active ? "Clique para desativar" : "Clique para ativar"}
              >
                {toggleActiveMutation.isPending
                  ? "Salvando..."
                  : edition.is_active
                    ? "Ativa"
                    : "Inativa"}
              </Badge>
              <Button variant="outline" size="sm" onClick={() => setQrOpen(true)}>
                <QrCode className="mr-2 h-4 w-4" />
                Link e QR
              </Button>
              <Button variant="outline" size="sm" onClick={() => setFormOpen(true)}>
                <Pencil className="mr-2 h-4 w-4" />
                Editar
              </Button>
              <Button asChild>
                <Link href={`/congressos/retirada?edition=${edition.id}`}>
                  <ScanLine className="mr-2 h-4 w-4" />
                  Abrir estande
                </Link>
              </Button>
            </>
          )}
        </PageHeader>
      </div>

      <EditionForm
        open={formOpen}
        onOpenChange={setFormOpen}
        initialData={edition ?? undefined}
      />
      <EditionQrDialog
        edition={edition ?? null}
        open={qrOpen}
        onOpenChange={setQrOpen}
      />

      {editionError ? (
        <EmptyState
          icon={TicketX}
          title="Edição não encontrada"
          description="Ela pode ter sido removida. Volte para a lista de congressos."
          actionLabel="Voltar"
          onAction={() => router.replace("/congressos")}
        />
      ) : editionLoading || !edition ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-24 rounded-xl" />
            ))}
          </div>
          <RegistrationsTable
            registrations={registrations}
            editionName="congresso"
            isLoading
          />
        </>
      ) : edition.cashback_enabled || edition.raffle_enabled ? (
        <Tabs defaultValue="inscritos" className="space-y-4">
          <TabsList>
            <TabsTrigger value="inscritos">Inscritos & brindes</TabsTrigger>
            {edition.cashback_enabled && (
              <TabsTrigger value="cashback">Cashback</TabsTrigger>
            )}
            {edition.raffle_enabled && (
              <TabsTrigger value="sorteio">Sorteio</TabsTrigger>
            )}
          </TabsList>
          <TabsContent value="inscritos" className="space-y-6">
            <GiftStats registrations={registrations} edition={edition} />
            <RegistrationsTable
              registrations={registrations}
              editionName={edition.name}
              isLoading={regLoading}
            />
          </TabsContent>
          {edition.cashback_enabled && (
            <TabsContent value="cashback">
              <CreditsTable editionId={id} />
            </TabsContent>
          )}
          {edition.raffle_enabled && (
            <TabsContent value="sorteio">
              <RafflePanel editionId={id} edition={edition} />
            </TabsContent>
          )}
        </Tabs>
      ) : (
        <>
          <GiftStats registrations={registrations} edition={edition} />
          <RegistrationsTable
            registrations={registrations}
            editionName={edition.name}
            isLoading={regLoading}
          />
        </>
      )}
    </div>
  );
}
