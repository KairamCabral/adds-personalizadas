"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Plus, UserX } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { SearchInput } from "@/components/shared/search-input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { usePermissions } from "@/hooks/use-permissions";
import { getRepresentantes } from "@/services/representantes.service";
import { RepresentantesList } from "./_components/representantes-list";

type StatusFilter = "todos" | "ativo" | "alerta" | "inativo";

export default function RepresentantesPage() {
  const router = useRouter();
  const { can, isLoading: permissionsLoading } = usePermissions();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("todos");

  useEffect(() => {
    if (!permissionsLoading && !can("representantes.view")) {
      router.replace("/pipeline");
    }
  }, [permissionsLoading, can, router]);

  const { data = [], isLoading } = useQuery({
    queryKey: ["representantes"],
    queryFn: getRepresentantes,
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

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Representantes"
        description="Gerencie territórios, metas e performance"
      >
        <Button
          onClick={() =>
            toast.info("Criar pelo Supabase Dashboard", {
              description:
                "A criação de representantes é feita diretamente no Supabase Dashboard.",
            })
          }
        >
          <Plus className="mr-2 h-4 w-4" />
          Criar representante
        </Button>
      </PageHeader>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Buscar por nome ou email..."
          className="max-w-sm"
        />
        <Select
          value={statusFilter}
          onValueChange={(v) => setStatusFilter(v as StatusFilter)}
        >
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Filtrar status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos</SelectItem>
            <SelectItem value="ativo">Ativos</SelectItem>
            <SelectItem value="alerta">Em alerta</SelectItem>
            <SelectItem value="inativo">Inativos</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <RepresentantesList
        data={data}
        isLoading={isLoading}
        search={search}
        statusFilter={statusFilter}
      />
    </div>
  );
}
