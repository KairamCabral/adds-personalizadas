"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ScanLine, TicketX } from "lucide-react";
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
import { getEditionById } from "@/services/congressos.service";
import { getEditionRegistrations } from "@/services/congressos-gifts.service";
import { GiftStats } from "./_components/gift-stats";
import { RegistrationsTable } from "./_components/registrations-table";
import { CreditsTable } from "./_components/credits-table";
import { RafflePanel } from "./_components/raffle-panel";

export default function EditionDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const router = useRouter();
  const { can, isLoading: permissionsLoading } = usePermissions();
  const hasPermission = can("congressos.manage");

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
          className="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
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
              <Badge variant={edition.is_active ? "default" : "outline"}>
                {edition.is_active ? "Ativa" : "Inativa"}
              </Badge>
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
