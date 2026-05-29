"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { usePermissions } from "@/hooks/use-permissions";
import { PageHeader } from "@/components/shared/page-header";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ChannelPricesSection } from "./_components/channel-prices-section";
import { VolumeDiscountsSection } from "./_components/volume-discounts-section";
import { PricingSettingsSection } from "./_components/pricing-settings-section";

export default function SettingsPricingPage() {
  const router = useRouter();
  const { can, isLoading } = usePermissions();
  const hasPermission = can("pricing.manage");

  useEffect(() => {
    if (!isLoading && !hasPermission) {
      router.replace("/pipeline");
    }
  }, [isLoading, hasPermission, router]);

  if (isLoading) {
    return (
      <div className="flex min-h-[200px] items-center justify-center p-6">
        <p className="text-sm text-muted-foreground">Carregando...</p>
      </div>
    );
  }

  if (!hasPermission) {
    return null;
  }

  return (
    <div className="min-w-0 space-y-6 p-6">
      <PageHeader
        title="Preços"
        description="Gerencie preços por canal, descontos por volume e regras gerais"
      />

      <Tabs defaultValue="channels" className="w-full">
        <TabsList>
          <TabsTrigger value="channels">Preço por canal</TabsTrigger>
          <TabsTrigger value="volume">Descontos por volume</TabsTrigger>
          <TabsTrigger value="settings">Configurações gerais</TabsTrigger>
        </TabsList>

        <TabsContent value="channels" className="mt-6">
          <ChannelPricesSection />
        </TabsContent>
        <TabsContent value="volume" className="mt-6">
          <VolumeDiscountsSection />
        </TabsContent>
        <TabsContent value="settings" className="mt-6">
          <PricingSettingsSection />
        </TabsContent>
      </Tabs>
    </div>
  );
}
