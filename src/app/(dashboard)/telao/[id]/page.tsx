"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { usePermissions } from "@/hooks/use-permissions";
import { getEditionById } from "@/services/congressos.service";
import { getRafflePool } from "@/services/congressos-raffle.service";
import { TelaoStage } from "./_components/telao-stage";

function Fullscreen({ children }: { children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-[9999] flex h-dvh w-dvw items-center justify-center bg-[#06121f] text-center text-white/70">
      {children}
    </div>
  );
}

export default function TelaoPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const router = useRouter();
  const { can, isLoading: permsLoading } = usePermissions();
  const hasPermission = can("congressos.manage");

  const { data: edition, isLoading: edLoading } = useQuery({
    queryKey: ["event_edition", id],
    queryFn: () => getEditionById(id),
    enabled: !permsLoading && hasPermission && !!id,
    retry: false,
  });

  const { data: pool = [] } = useQuery({
    queryKey: ["raffle_pool", id],
    queryFn: () => getRafflePool(id),
    enabled: !permsLoading && hasPermission && !!id,
  });

  useEffect(() => {
    if (!permsLoading && !hasPermission) router.replace("/pipeline");
  }, [permsLoading, hasPermission, router]);

  if (permsLoading || (hasPermission && edLoading)) {
    return <Fullscreen>Carregando o telão…</Fullscreen>;
  }
  if (!hasPermission) return null;
  if (!edition) {
    return <Fullscreen>Edição não encontrada.</Fullscreen>;
  }
  if (!edition.raffle_enabled) {
    return <Fullscreen>O sorteio não está habilitado nesta edição.</Fullscreen>;
  }

  return <TelaoStage editionId={id} edition={edition} pool={pool} />;
}
