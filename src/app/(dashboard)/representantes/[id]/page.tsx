"use client";

import { use } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  UserX,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { usePermissions } from "@/hooks/use-permissions";
import {
  getRepresentanteById,
  getRepresentanteKpis,
  getRepresentanteTerritories,
} from "@/services/representantes.service";
import { TabVisaoGeral } from "./_components/tab-visao-geral";
import { TabTerritorios } from "./_components/tab-territorios";
import { TabMetas } from "./_components/tab-metas";
import { TabProspects } from "./_components/tab-prospects";
import { TabVisitas } from "./_components/tab-visitas";
import { TabPedidos } from "./_components/tab-pedidos";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function RepresentanteDetailPage({ params }: PageProps) {
  const { id: repId } = use(params);
  const router = useRouter();
  const { can, isLoading: permissionsLoading } = usePermissions();

  const { data: rep, isLoading: repLoading } = useQuery({
    queryKey: ["representante", repId],
    queryFn: () => getRepresentanteById(repId),
    enabled: !permissionsLoading && can("representantes.view"),
    staleTime: 2 * 60 * 1000,
  });

  const { data: kpis, isLoading: kpisLoading } = useQuery({
    queryKey: ["representante-kpis", repId],
    queryFn: () => getRepresentanteKpis(repId, new Date()),
    enabled: !permissionsLoading && can("representantes.view"),
    staleTime: 2 * 60 * 1000,
  });

  const { data: territories = [], isLoading: territoriesLoading } = useQuery({
    queryKey: ["representante-territories", repId],
    queryFn: () => getRepresentanteTerritories(repId),
    enabled: !permissionsLoading && can("representantes.view"),
    staleTime: 2 * 60 * 1000,
  });

  if (permissionsLoading) {
    return (
      <div className="flex min-h-[200px] items-center justify-center p-6">
        <p className="text-sm text-muted-foreground">Carregando...</p>
      </div>
    );
  }

  if (!can("representantes.view")) {
    return (
      <div className="flex min-h-[200px] flex-col items-center justify-center gap-2 p-6 text-center">
        <UserX className="h-8 w-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          Você não tem permissão para acessar esta página.
        </p>
      </div>
    );
  }

  if (!repLoading && !rep) {
    return (
      <div className="flex min-h-[200px] flex-col items-center justify-center gap-2 p-6 text-center">
        <UserX className="h-8 w-8 text-muted-foreground" />
        <p className="text-sm font-medium">Representante não encontrado</p>
        <Button variant="outline" onClick={() => router.push("/representantes")}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Voltar para lista
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push("/representantes")}
            className="mt-0.5 shrink-0"
          >
            <ArrowLeft className="mr-1.5 h-4 w-4" />
            Voltar
          </Button>

          <div>
            {repLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-7 w-48" />
                <Skeleton className="h-4 w-64" />
              </div>
            ) : rep ? (
              <>
                <div className="flex items-center gap-2.5">
                  <h1 className="text-2xl font-bold tracking-tight text-foreground">
                    {rep.full_name}
                  </h1>
                  <Badge
                    variant="outline"
                    className={
                      rep.is_active
                        ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800"
                        : "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-400 dark:border-red-800"
                    }
                  >
                    <span
                      className={`mr-1.5 inline-block h-1.5 w-1.5 rounded-full ${
                        rep.is_active ? "bg-emerald-500" : "bg-red-500"
                      }`}
                    />
                    {rep.is_active ? "Ativo" : "Inativo"}
                  </Badge>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{rep.email}</p>
              </>
            ) : null}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="visao-geral">
        <TabsList className="w-full justify-start border-b rounded-none bg-transparent p-0 h-auto gap-0">
          {[
            { value: "visao-geral", label: "Visão Geral" },
            { value: "territorios", label: "Territórios" },
            { value: "metas", label: "Metas" },
            { value: "prospects", label: "Prospects" },
            { value: "visitas", label: "Visitas" },
            { value: "pedidos", label: "Pedidos" },
          ].map((tab) => (
            <TabsTrigger
              key={tab.value}
              value={tab.value}
              className="rounded-none border-b-2 border-transparent px-4 py-2.5 text-sm font-medium text-muted-foreground transition-none data-[state=active]:border-primary data-[state=active]:text-foreground data-[state=active]:bg-transparent data-[state=active]:shadow-none"
            >
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <div className="mt-6">
          <TabsContent value="visao-geral" className="mt-0">
            {rep && (
              <TabVisaoGeral
                rep={rep}
                kpis={kpis}
                kpisLoading={kpisLoading}
                repId={repId}
              />
            )}
            {repLoading && (
              <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="rounded-lg border p-4 space-y-3">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-8 w-16" />
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="territorios" className="mt-0">
            <TabTerritorios
              repId={repId}
              repName={rep?.full_name ?? ""}
              territories={territories}
              loading={territoriesLoading}
            />
          </TabsContent>

          <TabsContent value="metas" className="mt-0">
            <TabMetas repId={repId} repName={rep?.full_name ?? ""} />
          </TabsContent>

          <TabsContent value="prospects" className="mt-0">
            <TabProspects repId={repId} repName={rep?.full_name ?? ""} />
          </TabsContent>

          <TabsContent value="visitas" className="mt-0">
            <TabVisitas repId={repId} repName={rep?.full_name ?? ""} />
          </TabsContent>

          <TabsContent value="pedidos" className="mt-0">
            <TabPedidos repId={repId} repName={rep?.full_name ?? ""} />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
