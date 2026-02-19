"use client";

import { useState, useMemo } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { usePermissions } from "@/hooks/use-permissions";
import { PeriodSelector } from "./_components/period-selector";
import { TabVendas } from "./_components/tab-vendas";
import { TabClientes } from "./_components/tab-clientes";
import { TabOperacoes } from "./_components/tab-operacoes";
import { TabMarketing } from "./_components/tab-marketing";
import { TabFinanceiro } from "./_components/tab-financeiro";
import type { PeriodValue } from "@/services/dashboard.service";

const DASHBOARD_TABS = [
  { value: "vendas", label: "Vendas", permission: "dashboard.view_vendas" as const, Component: TabVendas },
  { value: "clientes", label: "Clientes", permission: "dashboard.view_clientes" as const, Component: TabClientes },
  { value: "operacoes", label: "Operações", permission: "dashboard.view_operacoes" as const, Component: TabOperacoes },
  { value: "marketing", label: "Marketing", permission: "dashboard.view_marketing" as const, Component: TabMarketing },
  { value: "financeiro", label: "Financeiro", permission: "dashboard.view_financeiro" as const, Component: TabFinanceiro },
] as const;

export default function DashboardPage() {
  const { can } = usePermissions();
  const [period, setPeriod] = useState<PeriodValue>("30d");

  const visibleTabs = useMemo(
    () => DASHBOARD_TABS.filter((tab) => can(tab.permission)),
    [can]
  );
  const defaultTab = visibleTabs[0]?.value ?? "clientes";

  return (
    <div className="p-6">
      <PageHeader
        title="Dashboard"
        description="Visão geral do seu negócio"
        className="mb-6"
      >
        <PeriodSelector value={period} onChange={setPeriod} />
      </PageHeader>

      <Tabs defaultValue={defaultTab} className="space-y-4">
        <TabsList
          className={cn(
            "grid w-full",
            visibleTabs.length === 2 && "grid-cols-2",
            visibleTabs.length === 3 && "grid-cols-3",
            visibleTabs.length === 4 && "grid-cols-2 sm:grid-cols-4",
            visibleTabs.length === 5 && "grid-cols-2 sm:grid-cols-3 lg:grid-cols-5"
          )}
        >
          {visibleTabs.map((tab) => (
            <TabsTrigger key={tab.value} value={tab.value}>
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {visibleTabs.map((tab) => {
          const TabComponent = tab.Component;
          return (
            <TabsContent key={tab.value} value={tab.value} className="mt-0">
              <TabComponent period={period} />
            </TabsContent>
          );
        })}
      </Tabs>
    </div>
  );
}
