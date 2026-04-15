"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Upload } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { SearchInput } from "@/components/shared/search-input";
import { Button } from "@/components/ui/button";
import { getClients, deleteClient } from "@/services/clients.service";
import { ContactsTable } from "./_components/contacts-table";
import { ContactForm } from "./_components/contact-form";
import { ImportDialog } from "./_components/import-dialog";
import type { Client } from "@/types/database.types";
import { toast } from "sonner";

const PAGE_SIZE = 50;

export default function ContactsPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [formOpen, setFormOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);

  useEffect(() => setPage(1), [search]);

  const { data, isLoading } = useQuery({
    queryKey: ["clients", search, page],
    queryFn: () =>
      getClients({
        search: search || undefined,
        page,
        limit: PAGE_SIZE,
      }),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteClient,
    onSuccess: () => {
      toast.success("Contato excluído com sucesso.");
      queryClient.invalidateQueries({ queryKey: ["clients"] });
    },
    onError: () => {
      toast.error("Erro ao excluir contato.");
    },
  });

  const syncFromTinyMutation = useMutation({
    mutationFn: async (clientId: string) => {
      const res = await fetch(`/api/clients/${clientId}/sync-from-tiny`, {
        method: "POST",
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error ?? "Erro ao sincronizar com Tiny");
      }
      return json as { fieldsUpdated?: string[] };
    },
    onSuccess: (data) => {
      const n = data.fieldsUpdated?.length ?? 0;
      if (n > 0) {
        toast.success("Atualizado do Tiny", {
          description: `${n} campo(s) de endereço/dados atualizados.`,
        });
      } else {
        toast.success("Já estava atualizado");
      }
      queryClient.invalidateQueries({ queryKey: ["clients"] });
    },
    onError: (err: Error) => {
      toast.error("Erro ao sincronizar do Tiny", { description: err.message });
    },
  });

  const clients = data?.data ?? [];

  const handleEdit = (client: Client) => {
    setEditingClient(client);
    setFormOpen(true);
  };

  const handleFormOpenChange = (open: boolean) => {
    setFormOpen(open);
    if (!open) setEditingClient(null);
  };

  const handleDelete = (id: string) => {
    deleteMutation.mutate(id);
  };

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Contatos"
        description="Gerencie seus clientes e contatos"
        children={
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => setImportOpen(true)}>
              <Upload className="mr-2 h-4 w-4" />
              Importar
            </Button>
            <Button onClick={() => setFormOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Novo Contato
            </Button>
          </div>
        }
      />

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Buscar por nome ou empresa..."
          className="max-w-sm"
        />
      </div>

      <ContactsTable
        data={clients}
        isLoading={isLoading}
        onEdit={handleEdit}
        onDelete={handleDelete}
        total={data?.total ?? 0}
        page={data?.page ?? 1}
        totalPages={data?.totalPages ?? 1}
        onPageChange={setPage}
        onSyncFromTiny={(c) => syncFromTinyMutation.mutate(c.id)}
        syncingClientId={
          syncFromTinyMutation.isPending
            ? (syncFromTinyMutation.variables as string)
            : null
        }
      />

      <ContactForm
        open={formOpen}
        onOpenChange={handleFormOpenChange}
        initialData={editingClient ?? undefined}
      />

      <ImportDialog open={importOpen} onOpenChange={setImportOpen} />
    </div>
  );
}
