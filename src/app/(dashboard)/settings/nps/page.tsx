"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { PageHeader } from "@/components/shared/page-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { usePermissions } from "@/hooks/use-permissions";

import { NpsCampaignsSection } from "./_components/nps-campaigns-section";
import { NpsFollowupsSection } from "./_components/nps-followups-section";
import { NpsManualSection } from "./_components/nps-manual-section";
import { NpsMetricsSection } from "./_components/nps-metrics-section";

export default function SettingsNpsPage() {
  const router = useRouter();
  const { can, isLoading } = usePermissions();
  const hasPermission = can("nps.manage");

  useEffect(() => {
    if (!isLoading && !hasPermission) router.replace("/pipeline");
  }, [isLoading, hasPermission, router]);

  if (isLoading) {
    return (
      <div className="flex min-h-[200px] items-center justify-center p-6">
        <p className="text-sm text-muted-foreground">Carregando...</p>
      </div>
    );
  }
  if (!hasPermission) return null;

  return (
    <div className="min-w-0 space-y-6 p-6">
      <PageHeader
        title="NPS"
        description="Acompanhe a satisfação, trate detratores e gerencie as campanhas de pesquisa"
      />
      <Tabs defaultValue="metrics" className="w-full">
        <TabsList>
          <TabsTrigger value="metrics">Métricas</TabsTrigger>
          <TabsTrigger value="followups">Detratores</TabsTrigger>
          <TabsTrigger value="manual">Envio manual</TabsTrigger>
          <TabsTrigger value="campaigns">Campanhas</TabsTrigger>
        </TabsList>
        <TabsContent value="metrics" className="mt-6">
          <NpsMetricsSection />
        </TabsContent>
        <TabsContent value="followups" className="mt-6">
          <NpsFollowupsSection />
        </TabsContent>
        <TabsContent value="manual" className="mt-6">
          <NpsManualSection />
        </TabsContent>
        <TabsContent value="campaigns" className="mt-6">
          <NpsCampaignsSection />
        </TabsContent>
      </Tabs>
    </div>
  );
}
