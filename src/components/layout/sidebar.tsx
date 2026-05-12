"use client";

import { useRef } from "react";
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
  UsersRound,
  FileText,
  Link as LinkIcon,
  Settings,
  ChevronsLeft,
  ChevronsRight,
  Pin,
  PinOff,
  BarChart3,
  Route,
  Percent,
  Activity,
  Warehouse,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Logo } from "@/components/brand/logo";

const NAV_SECTIONS = [
  {
    title: "Principal",
    items: [
      {
        label: "Pedidos",
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
        label: "Estoque",
        href: "/estoque",
        icon: Warehouse,
        permission: "supplier_inventory.view" as const,
      },
      {
        label: "Contatos",
        href: "/contacts",
        icon: Users,
        permission: "clients.view" as const,
      },
      {
        label: "Representantes",
        href: "/representantes",
        icon: UsersRound,
        permission: "representantes.view" as const,
      },
      {
        label: "Dashboard Reps",
        href: "/representantes/dashboard",
        icon: BarChart3,
        permission: "representantes.view" as const,
      },
      {
        label: "Regras de Leads",
        href: "/representantes/regras-leads",
        icon: Route,
        permission: "representantes.view" as const,
      },
      {
        label: "Descontos",
        href: "/representantes/descontos",
        icon: Percent,
        permission: "representantes.view" as const,
      },
      {
        label: "Atividade Reps",
        href: "/representantes/atividade",
        icon: Activity,
        permission: "representantes.view" as const,
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

const HOVER_COLLAPSE_DELAY_MS = 150;

export function Sidebar() {
  const pathname = usePathname();
  const {
    sidebarCollapsed,
    sidebarPinned,
    toggleSidebar,
    setSidebarCollapsed,
    setSidebarPinned,
    mobileSidebarOpen,
    setMobileSidebarOpen,
  } = useUIStore();
  const leaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { can, isLoading } = usePermissions();
  const { data: quoteCounts } = useQuery({
    queryKey: ["quote-counts"],
    queryFn: getQuoteCounts,
    staleTime: 60 * 1000,
  });

  const closeMobile = () => setMobileSidebarOpen(false);

  const handleMouseEnter = () => {
    if (leaveTimeoutRef.current) {
      clearTimeout(leaveTimeoutRef.current);
      leaveTimeoutRef.current = null;
    }
    if (typeof window !== "undefined" && window.innerWidth >= 1024) {
      setSidebarCollapsed(false);
    }
  };

  const handleMouseLeave = () => {
    if (typeof window !== "undefined" && window.innerWidth < 1024) return;
    if (sidebarPinned) return;
    leaveTimeoutRef.current = setTimeout(() => {
      setSidebarCollapsed(true);
      leaveTimeoutRef.current = null;
    }, HOVER_COLLAPSE_DELAY_MS);
  };

  const sidebarContent = (
    <aside
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className={cn(
        "flex h-screen flex-col border-r border-border/80 bg-card/95 backdrop-blur-sm shadow-sm transition-all duration-300 ease-in-out overflow-hidden",
        // Desktop: fixed, collapsible
        "fixed left-0 top-0 z-40",
        // Desktop width
        sidebarCollapsed ? "lg:w-[72px]" : "lg:w-[260px]",
        // Mobile: always full width when overlay is open
        "w-[260px]"
      )}
    >
      {/* Header */}
      <div
        className={cn(
          "flex h-[64px] items-center border-b border-border/60 px-4",
          sidebarCollapsed ? "lg:justify-center" : "justify-between"
        )}
      >
        {/* Logo — always visible on mobile, hidden when collapsed on desktop */}
        <Link
          href="/pipeline"
          className={cn(
            "flex items-center gap-2.5 rounded-lg px-2 py-1.5 -ml-2 transition-colors hover:bg-secondary/50",
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

        {/* Desktop: pin e collapse — hidden on mobile */}
        <div className="hidden lg:flex items-center gap-1">
          {!sidebarCollapsed && (
            <button
              onClick={() => setSidebarPinned(!sidebarPinned)}
              aria-label={sidebarPinned ? "Desafixar menu" : "Fixar menu expandido"}
              title={sidebarPinned ? "Desafixar" : "Manter expandido"}
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded-lg transition-all duration-200",
                sidebarPinned
                  ? "text-primary bg-primary/10 hover:bg-primary/15"
                  : "text-muted-foreground hover:bg-secondary/80 hover:text-foreground"
              )}
            >
              {sidebarPinned ? (
                <PinOff className="h-4 w-4" />
              ) : (
                <Pin className="h-4 w-4" />
              )}
            </button>
          )}
          <button
            onClick={toggleSidebar}
            aria-label={sidebarCollapsed ? "Expandir menu" : "Recolher menu"}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-all duration-200 hover:bg-secondary/80 hover:text-foreground"
          >
            {sidebarCollapsed ? (
              <ChevronsRight className="h-4 w-4" />
            ) : (
              <ChevronsLeft className="h-4 w-4" />
            )}
          </button>
        </div>
      </div>

      {/* Navigation */}
      <nav
        className="flex-1 space-y-7 overflow-y-auto px-3 py-5"
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
                    "mb-2.5 px-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/50",
                    sidebarCollapsed && "lg:sr-only"
                  )}
                >
                  {section.title}
                </h3>
                <div className="space-y-0.5">
                  {visibleItems.map((item) => {
                    const isActive =
                      pathname === item.href ||
                      (item.href !== "/pipeline" &&
                        item.href !== "/representantes" &&
                        pathname.startsWith(item.href)) ||
                      (item.href === "/representantes" &&
                        (pathname === "/representantes" ||
                          (pathname.startsWith("/representantes/") &&
                            !pathname.startsWith("/representantes/dashboard") &&
                            !pathname.startsWith("/representantes/regras-leads") &&
                            !pathname.startsWith("/representantes/descontos") &&
                            !pathname.startsWith("/representantes/atividade"))));
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
                          "group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
                          sidebarCollapsed && "lg:justify-center lg:px-0",
                          isActive
                            ? "bg-primary/10 text-primary"
                            : "text-muted-foreground hover:bg-secondary/70 hover:text-foreground"
                        )}
                        title={sidebarCollapsed ? item.label : undefined}
                      >
                        <span
                          className={cn(
                            "absolute left-0 top-1/2 -translate-y-1/2 h-6 w-0.5 rounded-r-full transition-all duration-200",
                            isActive ? "bg-primary" : "bg-transparent",
                            sidebarCollapsed && "lg:hidden"
                          )}
                        />
                        <span
                          className={cn(
                            "flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg transition-colors duration-200",
                            isActive
                              ? "bg-primary/15"
                              : "group-hover:bg-secondary/80"
                          )}
                        >
                          <Icon
                            className={cn(
                              "h-[18px] w-[18px] transition-colors",
                              isActive
                                ? "text-primary"
                                : "text-muted-foreground group-hover:text-foreground"
                            )}
                            aria-hidden="true"
                          />
                        </span>
                        <span
                          className={cn(
                            "flex-1 truncate",
                            sidebarCollapsed && "lg:sr-only"
                          )}
                        >
                          {item.label}
                        </span>

                        {hasPending && (
                          <span
                            className={cn(
                              "ml-auto flex-shrink-0",
                              sidebarCollapsed && "lg:hidden"
                            )}
                          >
                            <span className="relative flex h-5 min-w-[20px] items-center justify-center rounded-full bg-amber-500 px-1.5 text-[10px] font-bold text-white shadow-sm ring-2 ring-amber-400/30 ring-offset-2 ring-offset-card animate-pulse">
                              {pendingCount > 99 ? "99+" : pendingCount}
                            </span>
                          </span>
                        )}

                        {isActive && !hasPending && (
                          <div
                            className={cn(
                              "ml-auto h-1.5 w-1.5 flex-shrink-0 rounded-full bg-primary",
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
          "border-t border-border/60 px-4 py-4",
          sidebarCollapsed && "lg:hidden"
        )}
      >
        <p className="text-[10px] font-medium tracking-wide text-muted-foreground/45">
          ADDS CRM v{process.env.NEXT_PUBLIC_APP_VERSION ?? "1.0.0"}
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
