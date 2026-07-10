"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Ticket, PackageCheck, Activity, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { usePermissions } from "@/hooks/use-permissions";
import type { Permission } from "@/lib/permissions";

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  permission: Permission;
  /** Ativo quando o pathname atual bate com esta aba. */
  isActive: (pathname: string) => boolean;
}

const ITEMS: NavItem[] = [
  {
    href: "/congressos",
    label: "Edições",
    icon: Ticket,
    permission: "congressos.manage",
    // Cobre a lista e o detalhe (/congressos/[id]), sem acender em retirada/saúde.
    isActive: (p) =>
      p === "/congressos" ||
      (p.startsWith("/congressos/") &&
        !p.startsWith("/congressos/retirada") &&
        !p.startsWith("/congressos/saude")),
  },
  {
    href: "/congressos/retirada",
    label: "Retirada de brindes",
    icon: PackageCheck,
    permission: "congressos.operate",
    isActive: (p) => p.startsWith("/congressos/retirada"),
  },
  {
    href: "/congressos/saude",
    label: "Saúde da fila",
    icon: Activity,
    permission: "congressos.manage",
    isActive: (p) => p.startsWith("/congressos/saude"),
  },
];

/**
 * Abas de navegação do módulo Congressos (Edições · Retirada · Saúde da fila),
 * renderizadas pelo layout no topo de todas as telas. Filtradas por permissão;
 * some quando há menos de 2 abas visíveis (ex.: PRESTADOR só tem `operate`).
 */
export function CongressosNav() {
  const pathname = usePathname();
  const { can } = usePermissions();

  const visible = ITEMS.filter((i) => can(i.permission));
  if (visible.length < 2) return null;

  return (
    <nav className="flex gap-1 border-b border-border">
      {visible.map((item) => {
        const Icon = item.icon;
        const active = item.isActive(pathname);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "-mb-px flex items-center gap-2 border-b-2 px-3 py-2.5 text-sm font-medium transition-colors",
              active
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            <Icon className="h-4 w-4" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
