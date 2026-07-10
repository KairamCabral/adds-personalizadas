"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Activity } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { usePermissions } from "@/hooks/use-permissions";
import { getEditions, deleteEdition } from "@/services/congressos.service";
import type { EventEdition } from "@/types/database.types";
import { EditionsTable } from "./_components/editions-table";
import { EditionForm } from "./_components/edition-form";
import { EditionQrDialog } from "./_components/edition-qr-dialog";

export default function CongressosPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { can, isLoading: permissionsLoading } = usePermissions();
  const hasPermission = can("congressos.manage");

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<EventEdition | null>(null);
  const [qrEdition, setQrEdition] = useState<EventEdition | null>(null);
  const [qrOpen, setQrOpen] = useState(false);

  const { data: editions = [], isLoading } = useQuery({
    queryKey: ["event_editions"],
    queryFn: getEditions,
    enabled: !permissionsLoading && hasPermission,
  });

  const deleteMutation = useMutation({
    mutationFn: deleteEdition,
    onSuccess: () => {
      toast.success("Edição excluída.");
      queryClient.invalidateQueries({ queryKey: ["event_editions"] });
    },
    onError: () => toast.error("Erro ao excluir edição."),
  });

  useEffect(() => {
    if (!permissionsLoading && !hasPermission) router.replace("/pipeline");
  }, [permissionsLoading, hasPermission, router]);

  if (permissionsLoading) {
    return (
      <div className="flex min-h-[200px] items-center justify-center p-6">
        <p className="text-sm text-muted-foreground">Carregando...</p>
      </div>
    );
  }
  if (!hasPermission) return null;

  const handleNew = () => {
    setEditing(null);
    setFormOpen(true);
  };
  const handleEdit = (edition: EventEdition) => {
    setEditing(edition);
    setFormOpen(true);
  };
  const handleFormOpenChange = (open: boolean) => {
    setFormOpen(open);
    if (!open) setEditing(null);
  };
  const handleShowLink = (edition: EventEdition) => {
    setQrEdition(edition);
    setQrOpen(true);
  };

  return (
    <div className="min-w-0 space-y-6 p-6">
      <PageHeader
        title="Congressos"
        description="Gerencie as edições de congresso, o brinde e o cashback de cada evento."
      >
        <Button variant="outline" asChild>
          <Link href="/congressos/saude">
            <Activity className="mr-2 h-4 w-4" />
            Saúde da fila
          </Link>
        </Button>
        <Button onClick={handleNew}>
          <Plus className="mr-2 h-4 w-4" />
          Nova edição
        </Button>
      </PageHeader>

      <EditionsTable
        data={editions}
        isLoading={isLoading}
        onEdit={handleEdit}
        onShowLink={handleShowLink}
        onDelete={(id) => deleteMutation.mutate(id)}
      />

      <EditionForm
        open={formOpen}
        onOpenChange={handleFormOpenChange}
        initialData={editing ?? undefined}
      />
      <EditionQrDialog
        edition={qrEdition}
        open={qrOpen}
        onOpenChange={setQrOpen}
      />
    </div>
  );
}
