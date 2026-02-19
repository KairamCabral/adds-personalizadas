"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { UserPlus, MoreHorizontal, Pencil } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { DataTable } from "@/components/shared/data-table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { getUsers } from "@/services/users.service";
import { formatDateTime } from "@/lib/utils";
import { USER_ROLES } from "@/lib/constants";
import { usePermissions } from "@/hooks/use-permissions";
import { UserInviteForm } from "./_components/user-invite-form";
import { UserEditSheet } from "./_components/user-edit-sheet";

type UserRow = {
  id: string;
  full_name: string | null;
  email: string | null;
  role: string | null;
  is_active: boolean | null;
  last_login_at: string | null;
};

export default function SettingsUsersPage() {
  const router = useRouter();
  const { can, isLoading: permissionsLoading } = usePermissions();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserRow | null>(null);
  const [editSheetOpen, setEditSheetOpen] = useState(false);

  const { data: usersData = [], isLoading } = useQuery({
    queryKey: ["users"],
    queryFn: getUsers,
  });
  const users = usersData as UserRow[];

  useEffect(() => {
    if (!permissionsLoading && !can("settings.users")) {
      router.replace("/settings");
    }
  }, [permissionsLoading, router]);

  if (permissionsLoading) {
    return (
      <div className="flex min-h-[200px] items-center justify-center p-6">
        <p className="text-sm text-muted-foreground">Carregando...</p>
      </div>
    );
  }

  if (!can("settings.users")) {
    return null;
  }

  const roleLabel = (role: string) =>
    USER_ROLES.find((r) => r.key === role)?.label ?? role;

  function openEdit(user: UserRow) {
    setEditingUser(user);
    setEditSheetOpen(true);
  }

  const columns: ColumnDef<UserRow>[] = [
    {
      accessorKey: "full_name",
      header: "Nome",
      cell: ({ row }) => (
        <span className="font-medium">{row.getValue("full_name")}</span>
      ),
    },
    {
      accessorKey: "email",
      header: "E-mail",
      cell: ({ row }) => (
        <span className="text-muted-foreground">{row.getValue("email")}</span>
      ),
    },
    {
      accessorKey: "role",
      header: "Função",
      cell: ({ row }) => {
        const role = row.getValue("role") as string;
        return (
          <Badge variant={role === "MASTER" ? "default" : "secondary"}>
            {roleLabel(role)}
          </Badge>
        );
      },
    },
    {
      accessorKey: "is_active",
      header: "Status",
      cell: ({ row }) => {
        const active = row.getValue("is_active") as boolean;
        return (
          <Badge variant={active ? "default" : "outline"}>
            {active ? "Ativo" : "Inativo"}
          </Badge>
        );
      },
    },
    {
      accessorKey: "last_login_at",
      header: "Último acesso",
      cell: ({ row }) => {
        const date = row.getValue("last_login_at") as string | null;
        return (
          <span className="text-muted-foreground text-sm">
            {date ? formatDateTime(date) : "—"}
          </span>
        );
      },
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <MoreHorizontal className="h-4 w-4" />
              <span className="sr-only">Abrir menu</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => openEdit(row.original)}>
              <Pencil className="mr-2 h-4 w-4" />
              Editar
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Usuários"
        description="Gerencie os usuários do sistema"
        children={
          <Button onClick={() => setInviteOpen(true)}>
            <UserPlus className="mr-2 h-4 w-4" />
            Convidar usuário
          </Button>
        }
      />

      {isLoading ? (
        <div className="rounded-md border p-8 text-center text-muted-foreground">
          Carregando usuários...
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={users}
          emptyMessage="Nenhum usuário encontrado"
        />
      )}

      <UserInviteForm open={inviteOpen} onOpenChange={setInviteOpen} />
      <UserEditSheet
        user={editingUser}
        open={editSheetOpen}
        onOpenChange={(open) => {
          setEditSheetOpen(open);
          if (!open) setEditingUser(null);
        }}
      />
    </div>
  );
}
