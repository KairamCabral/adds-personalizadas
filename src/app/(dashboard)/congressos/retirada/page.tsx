"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Gift } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { usePermissions } from "@/hooks/use-permissions";
import { getActiveEditions } from "@/services/congressos-gifts.service";
import { getEditionById } from "@/services/congressos.service";
import { RedeemConsole } from "./_components/redeem-console";

interface EditionOption {
  id: string;
  name: string;
  gift_name: string | null;
  is_active: boolean;
}

function Loading() {
  return (
    <div className="flex min-h-[200px] items-center justify-center p-6">
      <p className="text-sm text-muted-foreground">Carregando...</p>
    </div>
  );
}

function RetiradaContent() {
  const searchParams = useSearchParams();
  const editionParam = searchParams.get("edition");
  const router = useRouter();
  const { can, isLoading: permissionsLoading } = usePermissions();
  const hasPermission = can("congressos.operate");
  const [pickedId, setPickedId] = useState<string | null>(null);

  useEffect(() => {
    if (!permissionsLoading && !hasPermission) router.replace("/pipeline");
  }, [permissionsLoading, hasPermission, router]);

  const { data: active = [], isLoading: activeLoading } = useQuery({
    queryKey: ["active_editions"],
    queryFn: getActiveEditions,
    enabled: !permissionsLoading && hasPermission,
  });

  // Se veio de "Abrir estande" com ?edition=, aceita a edição indicada mesmo
  // que inativa (o gestor escolheu explicitamente).
  const { data: paramEdition } = useQuery({
    queryKey: ["event_edition", editionParam],
    queryFn: () => getEditionById(editionParam as string),
    enabled: !!editionParam && !permissionsLoading && hasPermission,
    retry: false,
  });

  const editions: EditionOption[] = useMemo(() => {
    const list: EditionOption[] = active.map((e) => ({
      id: e.id,
      name: e.name,
      gift_name: e.gift_name,
      is_active: e.is_active,
    }));
    if (paramEdition && !list.some((e) => e.id === paramEdition.id)) {
      list.unshift({
        id: paramEdition.id,
        name: paramEdition.name,
        gift_name: paramEdition.gift_name,
        is_active: paramEdition.is_active,
      });
    }
    return list;
  }, [active, paramEdition]);

  const selectedId =
    pickedId ??
    editionParam ??
    (editions.length === 1 ? editions[0].id : null);
  const selected = editions.find((e) => e.id === selectedId) ?? null;

  if (permissionsLoading) return <Loading />;
  if (!hasPermission) return null;

  return (
    <div className="min-w-0 space-y-6 p-6">
      <PageHeader
        title="Retirada de brindes"
        description="Busque pelo código do brinde, CPF ou nome e confirme a entrega no estande."
      >
        {editions.length > 1 && (
          <Select
            value={selectedId ?? ""}
            onValueChange={(v) => setPickedId(v)}
          >
            <SelectTrigger className="w-[240px]">
              <SelectValue placeholder="Escolha a edição" />
            </SelectTrigger>
            <SelectContent>
              {editions.map((e) => (
                <SelectItem key={e.id} value={e.id}>
                  {e.name}
                  {!e.is_active ? " (inativa)" : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </PageHeader>

      {activeLoading && !selected ? (
        <Loading />
      ) : !selected ? (
        <EmptyState
          icon={Gift}
          title={
            editions.length === 0
              ? "Nenhuma edição ativa"
              : "Escolha uma edição"
          }
          description={
            editions.length === 0
              ? "Ative uma edição em Congressos para liberar a retirada de brindes."
              : "Selecione a edição do evento no seletor acima."
          }
        />
      ) : (
        <RedeemConsole
          editionId={selected.id}
          editionName={selected.name}
          giftName={selected.gift_name}
        />
      )}
    </div>
  );
}

export default function RetiradaPage() {
  return (
    <Suspense fallback={<Loading />}>
      <RetiradaContent />
    </Suspense>
  );
}
