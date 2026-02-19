"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useUIStore } from "@/stores/ui.store";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Pencil,
  Trash2,
  Mail,
  Phone,
  MapPin,
  FileText,
  Package,
} from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import {
  maskPhone,
  maskCPF,
  maskCNPJ,
  getInitials,
  generateAvatarColor,
  formatDate,
} from "@/lib/utils";
import { deleteClient } from "@/services/clients.service";
import { STATUS_MAP } from "@/lib/constants";
import type { Client } from "@/types/database.types";
import { ContactForm } from "./contact-form";
import { toast } from "sonner";

interface OrderRow {
  id: string;
  order_number: number;
  title: string;
  status: string;
  due_date: string | null;
  created_at: string;
}

interface ContactDetailViewProps {
  client: Client;
  orders: OrderRow[];
}

export function ContactDetailView({ client, orders }: ContactDetailViewProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { setSelectedOrderId } = useUIStore();
  const [editFormOpen, setEditFormOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const deleteMutation = useMutation({
    mutationFn: () => deleteClient(client.id),
    onSuccess: () => {
      toast.success("Contato excluído com sucesso.");
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      router.push("/contacts");
    },
    onError: () => {
      toast.error("Erro ao excluir contato.");
    },
  });

  const hasAddress =
    client.street ||
    client.number ||
    client.neighborhood ||
    client.city ||
    client.state ||
    client.zip_code;

  const addressParts = [
    [client.street, client.number].filter(Boolean).join(", "),
    client.complement,
    client.neighborhood,
    [client.city, client.state].filter(Boolean).join(" - "),
    client.zip_code,
  ].filter(Boolean);

  const handleOrderClick = (orderId: string) => {
    setSelectedOrderId(orderId);
    router.push("/pipeline");
  };

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title={client.name}
        description={client.company ?? "Detalhes do contato"}
        children={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link href="/contacts">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Voltar
              </Link>
            </Button>
            <Button variant="outline" size="sm" onClick={() => setEditFormOpen(true)}>
              <Pencil className="mr-2 h-4 w-4" />
              Editar
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="text-destructive hover:text-destructive"
              onClick={() => setDeleteDialogOpen(true)}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Excluir
            </Button>
          </div>
        }
      />

      <div className="flex flex-col gap-6 lg:flex-row">
        <div className="flex-1 space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-start gap-4">
                <Avatar className="h-16 w-16">
                  <AvatarImage src={client.logo_url ?? undefined} />
                  <AvatarFallback
                    className={`text-lg ${generateAvatarColor(client.name)} text-white`}
                  >
                    {getInitials(client.name)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <CardTitle className="text-xl">{client.name}</CardTitle>
                  <Badge
                    variant={client.person_type === "JURIDICA" ? "secondary" : "outline"}
                    className="mt-1"
                  >
                    {client.person_type === "FISICA"
                      ? "Pessoa Física"
                      : "Pessoa Jurídica"}
                  </Badge>
                  {client.company && (
                    <p className="mt-2 text-sm text-muted-foreground">
                      {client.company}
                    </p>
                  )}
                </div>
              </div>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Mail className="h-4 w-4" />
                Contato
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {client.email && (
                <div className="flex items-center gap-2 text-sm">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <a
                    href={`mailto:${client.email}`}
                    className="text-primary hover:underline"
                  >
                    {client.email}
                  </a>
                </div>
              )}
              {client.phone && (
                <div className="flex items-center gap-2 text-sm">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <a
                    href={`tel:${client.phone.replace(/\D/g, "")}`}
                    className="text-primary hover:underline"
                  >
                    {maskPhone(client.phone)}
                  </a>
                </div>
              )}
              {!client.email && !client.phone && (
                <p className="text-sm text-muted-foreground">
                  Nenhuma informação de contato
                </p>
              )}
            </CardContent>
          </Card>

          {hasAddress && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <MapPin className="h-4 w-4" />
                  Endereço
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground whitespace-pre-line">
                  {addressParts.join("\n")}
                </p>
              </CardContent>
            </Card>
          )}

          {client.document && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <FileText className="h-4 w-4" />
                  Documento
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm font-mono">
                  {(() => {
                    const digits = client.document.replace(/\D/g, "");
                    return client.person_type === "FISICA" && digits.length === 11
                      ? maskCPF(digits)
                      : digits.length === 14
                        ? maskCNPJ(digits)
                        : client.document;
                  })()}
                </p>
              </CardContent>
            </Card>
          )}

          {client.notes && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <FileText className="h-4 w-4" />
                  Observações
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                  {client.notes}
                </p>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="w-full lg:w-96">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Package className="h-4 w-4" />
                Pedidos vinculados
              </CardTitle>
            </CardHeader>
            <CardContent>
              {orders.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Nenhum pedido vinculado a este contato
                </p>
              ) : (
                <ul className="space-y-2">
                  {orders.map((order) => {
                    const status = STATUS_MAP[order.status as keyof typeof STATUS_MAP];
                    return (
                      <li key={order.id}>
                        <button
                          type="button"
                          onClick={() => handleOrderClick(order.id)}
                          className="flex w-full items-center justify-between rounded-lg border p-3 text-left transition-colors hover:bg-muted/50"
                        >
                          <div>
                            <p className="font-medium text-sm">
                              #{order.order_number} — {order.title}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {formatDate(order.created_at)}
                              {order.due_date &&
                                ` • Entrega: ${formatDate(order.due_date)}`}
                            </p>
                          </div>
                          {status && (
                            <Badge
                              variant="outline"
                              className={status.bgColor}
                            >
                              {status.shortLabel}
                            </Badge>
                          )}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <ContactForm
        open={editFormOpen}
        onOpenChange={setEditFormOpen}
        initialData={client}
      />

      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Excluir contato"
        description="Tem certeza que deseja excluir este contato? Esta ação não pode ser desfeita."
        confirmLabel="Excluir"
        cancelLabel="Cancelar"
        variant="destructive"
        onConfirm={() => deleteMutation.mutate()}
        loading={deleteMutation.isPending}
      />
    </div>
  );
}
