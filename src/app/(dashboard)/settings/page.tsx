"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { usePermissions } from "@/hooks/use-permissions";

const SETTINGS_NAV = [
  { href: "/settings/products", permission: "products.manage" as const },
  { href: "/settings/kanban", permission: "labels.manage" as const },
  { href: "/settings/users", permission: "settings.users" as const },
  { href: "/settings/labels", permission: "labels.manage" as const },
  { href: "/settings/notifications", permission: "notifications.manage" as const },
  { href: "/settings/system", permission: "settings.view" as const },
  { href: "/settings/security", permission: "settings.security" as const },
  { href: "/settings/integrations", permission: "integrations.manage" as const },
  { href: "/settings/suppliers", permission: "suppliers.manage" as const },
  { href: "/settings/backup", permission: "backup.manage" as const },
];

export default function SettingsPage() {
  const router = useRouter();
  const { can, isLoading } = usePermissions();

  useEffect(() => {
    if (isLoading) return;
    const firstAllowed = SETTINGS_NAV.find((item) => can(item.permission));
    if (firstAllowed) {
      router.replace(firstAllowed.href);
    } else {
      router.replace("/pipeline");
    }
  }, [isLoading, router]);

  return (
    <div className="flex min-h-[200px] items-center justify-center p-6">
      <p className="text-sm text-muted-foreground">Carregando...</p>
    </div>
  );
}
