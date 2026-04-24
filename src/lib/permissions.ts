import type { UserRole } from "./constants";

export const PERMISSIONS = {
  // Kanban
  "kanban.view": ["MASTER", "GESTOR", "PRESTADOR"],
  "kanban.manage": ["MASTER", "GESTOR"],

  // Pedidos
  "orders.create": ["MASTER", "GESTOR"],
  "orders.view_all": ["MASTER", "GESTOR"],
  "orders.view_own": ["MASTER", "GESTOR", "PRESTADOR"],
  "orders.edit": ["MASTER", "GESTOR"],
  "orders.delete": ["MASTER", "GESTOR"],
  "orders.change_status": ["MASTER", "GESTOR", "PRESTADOR"],
  "orders.archive": ["MASTER", "GESTOR"],
  "orders.assign": ["MASTER", "GESTOR"],
  "orders.trash": ["MASTER", "GESTOR"],
  "orders.restore": ["MASTER", "GESTOR"],
  "orders.trash_view": ["MASTER", "GESTOR"],
  "orders.purge": ["MASTER"],

  // Clientes
  "clients.view": ["MASTER", "GESTOR"],
  "clients.create": ["MASTER", "GESTOR"],
  "clients.edit": ["MASTER", "GESTOR"],
  "clients.delete": ["MASTER"],
  "clients.import": ["MASTER", "GESTOR"],
  "clients.sync_tiny": ["MASTER", "GESTOR"],

  // Produtos
  "products.view": ["MASTER", "GESTOR"],
  "products.manage": ["MASTER", "GESTOR"],

  // Artes
  "artworks.upload": ["MASTER", "GESTOR", "PRESTADOR"],
  "artworks.approve": ["MASTER", "GESTOR"],
  "artworks.generate_token": ["MASTER", "GESTOR"],
  /** Reabrir aprovação pública; pedido volta à coluna Ajuste (ex.: cliente mudou de ideia). */
  "artworks.reset_approval": ["MASTER", "GESTOR"],

  // Dashboard
  "dashboard.view_full": ["MASTER"],
  "dashboard.view_ops": ["MASTER", "GESTOR", "PRESTADOR"],
  "dashboard.view_vendas": ["MASTER"],
  "dashboard.view_clientes": ["MASTER", "GESTOR", "PRESTADOR"],
  "dashboard.view_operacoes": ["MASTER", "GESTOR", "PRESTADOR"],
  "dashboard.view_marketing": ["MASTER"],
  "dashboard.view_financeiro": ["MASTER"],

  // Configurações
  "settings.view": ["MASTER", "GESTOR"],
  "settings.security": ["MASTER"],
  "settings.users": ["MASTER", "GESTOR"],
  "settings.manage_master": ["MASTER"],

  // Relatórios
  "reports.view": ["MASTER", "GESTOR"],
  "reports.export": ["MASTER", "GESTOR"],

  // Auditoria
  "audit.view": ["MASTER"],
  "audit.export": ["MASTER"],

  // Integrações
  "integrations.manage": ["MASTER", "GESTOR"],

  // Fornecedores (Bling)
  "suppliers.view": ["MASTER", "GESTOR"],
  "suppliers.manage": ["MASTER"],
  "suppliers.send_data": ["MASTER", "GESTOR"],
  "suppliers.revoke": ["MASTER"],

  // Notificações
  "notifications.manage": ["MASTER", "GESTOR"],

  // Orçamentos
  "quotes.view": ["MASTER", "GESTOR"],
  "quotes.manage": ["MASTER", "GESTOR"],

  // Representantes
  "representantes.view": ["MASTER", "GESTOR"],

  // Backup
  "backup.manage": ["MASTER"],

  // Etiquetas
  "labels.manage": ["MASTER", "GESTOR"],
  "labels.add_to_order": ["MASTER", "GESTOR"],

  // Uploads
  "files.upload": ["MASTER", "GESTOR", "PRESTADOR"],
  "files.download": ["MASTER", "GESTOR", "PRESTADOR"],
} as const;

export type Permission = keyof typeof PERMISSIONS;

export function hasPermission(role: UserRole, permission: Permission): boolean {
  const allowed: readonly string[] = PERMISSIONS[permission];
  return allowed?.includes(role) ?? false;
}

export function filterPermissions(role: UserRole): Permission[] {
  return (Object.keys(PERMISSIONS) as Permission[]).filter((p) =>
    hasPermission(role, p)
  );
}
