"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { useUIStore } from "@/stores/ui.store";
import { usePermissions } from "@/hooks/use-permissions";
import { getQuoteCounts } from "@/services/quotes.service";
import {
  Columns3,
  LayoutDashboard,
  Users,
  FileText,
  Link as LinkIcon,
  Settings,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Logo } from "@/components/brand/logo";

const NAV_SECTIONS = [
  {
    title: "Principal",
    items: [
      {
        label: "Pipeline",
        href: "/pipeline",
        icon: Columns3,
        permission: "kanban.view" as const,
      },
      {
        label: "Orçamentos",
        href: "/quotes",
        icon: FileText,
        permission: "quotes.view" as const,
        showPendingBadge: true,
      },
      {
        label: "Dashboard",
        href: "/dashboard",
        icon: LayoutDashboard,
        permission: "dashboard.view_ops" as const,
      },
      {
        label: "Contatos",
        href: "/contacts",
        icon: Users,
        permission: "clients.view" as const,
      },
    ],
  },
  {
    title: "Sistema",
    items: [
      {
        label: "Tiny ERP",
        href: "/tiny",
        icon: LinkIcon,
        permission: "integrations.manage" as const,
      },
      {
        label: "Configurações",
        href: "/settings",
        icon: Settings,
        permission: "settings.view" as const,
      },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const { sidebarCollapsed, toggleSidebar, mobileSidebarOpen, setMobileSidebarOpen } =
    useUIStore();
  const { can, isLoading } = usePermissions();
  const { data: quoteCounts } = useQuery({
    queryKey: ["quote-counts"],
    queryFn: getQuoteCounts,
    staleTime: 60 * 1000,
  });

  const closeMobile = () => setMobileSidebarOpen(false);

  const sidebarContent = (
    <aside
      className={cn(
        "flex h-screen flex-col border-r border-border bg-card transition-all duration-300 ease-in-out",
        // Desktop: fixed, collapsible
        "fixed left-0 top-0 z-40",
        // Desktop width
        sidebarCollapsed ? "lg:w-[68px]" : "lg:w-[260px]",
        // Mobile: always full width when overlay is open
        "w-[260px]"
      )}
    >
      {/* Header */}
      <div
        className={cn(
          "flex h-[60px] items-center border-b border-border px-4",
          sidebarCollapsed ? "lg:justify-center" : "justify-between"
        )}
      >
        {/* Logo — always visible on mobile, hidden when collapsed on desktop */}
        <Link
          href="/pipeline"
          className={cn(
            "flex items-center gap-2.5",
            sidebarCollapsed && "lg:hidden"
          )}
          onClick={closeMobile}
        >
          <Logo size="sm" className="h-8 w-8 flex-shrink-0" priority />
          <div>
            <span className="text-sm font-bold tracking-tight text-foreground">
              ADDS
            </span>
            <span className="ml-1 text-sm font-light text-muted-foreground">
              CRM
            </span>
          </div>
        </Link>

        {/* Desktop collapse toggle — hidden on mobile */}
        <button
          onClick={toggleSidebar}
          aria-label={sidebarCollapsed ? "Expandir menu" : "Recolher menu"}
          className="hidden lg:flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
        >
          {sidebarCollapsed ? (
            <ChevronsRight className="h-4 w-4" />
          ) : (
            <ChevronsLeft className="h-4 w-4" />
          )}
        </button>
      </div>

      {/* Navigation */}
      <nav
        className="flex-1 space-y-6 overflow-y-auto px-3 py-4"
        aria-label="Navegação principal"
      >
        {isLoading ? (
          <div className="space-y-6">
            {NAV_SECTIONS.map((section) => (
              <div key={section.title}>
                {!(sidebarCollapsed) && (
                  <Skeleton className="mb-2 mx-3 h-3 w-16 rounded" />
                )}
                <div className="space-y-1">
                  {section.items.map((item) => (
                    <div
                      key={item.href}
                      className={cn(
                        "flex items-center gap-3 rounded-lg px-3 py-2.5",
                        sidebarCollapsed && "lg:justify-center lg:px-0"
                      )}
                    >
                      <Skeleton className="h-[18px] w-[18px] flex-shrink-0 rounded" />
                      <Skeleton className="h-4 w-24 rounded" />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          NAV_SECTIONS.map((section) => {
            const visibleItems = section.items.filter((item) =>
              can(item.permission)
            );
            if (visibleItems.length === 0) return null;

            return (
              <div key={section.title}>
                <h3
                  className={cn(
                    "mb-2 px-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60",
                    sidebarCollapsed && "lg:sr-only"
                  )}
                >
                  {section.title}
                </h3>
                <div className="space-y-1">
                  {visibleItems.map((item) => {
                    const isActive =
                      pathname === item.href ||
                      (item.href !== "/pipeline" &&
                        pathname.startsWith(item.href));
                    const Icon = item.icon;
                    const pendingCount =
                      "showPendingBadge" in item && item.showPendingBadge
                        ? quoteCounts?.PENDENTE ?? 0
                        : 0;
                    const hasPending = pendingCount > 0;

                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={closeMobile}
                        aria-current={isActive ? "page" : undefined}
                        className={cn(
                          "group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all",
                          sidebarCollapsed && "lg:justify-center lg:px-0",
                          isActive
                            ? "bg-primary/10 text-primary"
                            : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                        )}
                        title={sidebarCollapsed ? item.label : undefined}
                      >
                        <Icon
                          className={cn(
                            "h-[18px] w-[18px] flex-shrink-0 transition-colors",
                            isActive
                              ? "text-primary"
                              : "text-muted-foreground group-hover:text-foreground"
                          )}
                          aria-hidden="true"
                        />
                        <span className={cn(sidebarCollapsed && "lg:sr-only")}>
                          {item.label}
                        </span>

                        {hasPending && (
                          <span
                            className={cn(
                              "ml-auto",
                              sidebarCollapsed && "lg:hidden"
                            )}
                          >
                            <span className="relative flex h-5 min-w-[20px] items-center justify-center rounded-full bg-amber-500 px-1.5 text-[10px] font-bold text-white ring-2 ring-amber-400/50 ring-offset-2 ring-offset-card animate-pulse">
                              {pendingCount > 99 ? "99+" : pendingCount}
                            </span>
                          </span>
                        )}

                        {isActive && !hasPending && (
                          <div
                            className={cn(
                              "ml-auto h-1.5 w-1.5 rounded-full bg-primary",
                              sidebarCollapsed && "lg:hidden"
                            )}
                          />
                        )}
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })
        )}
      </nav>

      {/* Footer */}
      <div
        className={cn(
          "border-t border-border px-4 py-3",
          sidebarCollapsed && "lg:hidden"
        )}
      >
        <p className="text-[10px] text-muted-foreground/40">
          ADDS CRM v1.0.0
        </p>
      </div>
    </aside>
  );

  return (
    <>
      {/* Desktop sidebar — always visible on lg+ */}
      <div className="hidden lg:block">{sidebarContent}</div>

      {/* Mobile sidebar — overlay */}
      {mobileSidebarOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40 bg-black/50 lg:hidden"
            onClick={closeMobile}
            aria-hidden="true"
          />
          {/* Drawer */}
          <div className="fixed inset-y-0 left-0 z-50 lg:hidden">
            {sidebarContent}
          </div>
        </>
      )}
    </>
  );
}
