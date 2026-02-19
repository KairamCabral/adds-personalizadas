"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { usePermissions } from "@/hooks/use-permissions";
import {
  Package,
  Columns3,
  Users,
  Tag,
  Bell,
  Settings,
  Shield,
  Link2,
  Database,
  Truck,
} from "lucide-react";

const navItems = [
  {
    href: "/settings/products",
    label: "Produtos",
    icon: Package,
    permission: "products.manage" as const,
  },
  {
    href: "/settings/kanban",
    label: "Kanban",
    icon: Columns3,
    permission: "labels.manage" as const,
  },
  {
    href: "/settings/users",
    label: "Usuários",
    icon: Users,
    permission: "settings.users" as const,
  },
  {
    href: "/settings/labels",
    label: "Etiquetas",
    icon: Tag,
    permission: "labels.manage" as const,
  },
  {
    href: "/settings/notifications",
    label: "Notificações",
    icon: Bell,
    permission: "notifications.manage" as const,
  },
  {
    href: "/settings/system",
    label: "Sistema",
    icon: Settings,
    permission: "settings.view" as const,
  },
  {
    href: "/settings/security",
    label: "Segurança",
    icon: Shield,
    permission: "settings.security" as const,
  },
  {
    href: "/settings/integrations",
    label: "Integrações",
    icon: Link2,
    permission: "integrations.manage" as const,
  },
  {
    href: "/settings/suppliers",
    label: "Fornecedores",
    icon: Truck,
    permission: "suppliers.manage" as const,
  },
  {
    href: "/settings/backup",
    label: "Backup",
    icon: Database,
    permission: "backup.manage" as const,
  },
];

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { can } = usePermissions();

  const visibleItems = navItems.filter((item) => {
    if ("permission" in item && item.permission) {
      return can(item.permission);
    }
    return true;
  });

  return (
    <div className="flex min-h-[calc(100vh-60px)]">
      <aside className="w-56 shrink-0 border-r border-border bg-muted/30 p-4">
        <nav className="flex flex-col gap-1">
          {visibleItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  );
}
