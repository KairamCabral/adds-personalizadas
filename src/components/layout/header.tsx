"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useUser } from "@/hooks/use-user";
import { useUIStore } from "@/stores/ui.store";
import { useTheme } from "@/providers/theme-provider";
import { cn, getInitials, generateAvatarColor } from "@/lib/utils";
import {
  Sun,
  Moon,
  Monitor,
  LogOut,
  User,
  ChevronDown,
  Menu,
} from "lucide-react";
import { NotificationPopover } from "./notification-popover";
import { toast } from "sonner";
import { useState, useRef, useEffect } from "react";

export function Header() {
  const { profile } = useUser();
  const { sidebarCollapsed, toggleMobileSidebar } = useUIStore();
  const { theme, setTheme, resolvedTheme } = useTheme();
  const router = useRouter();
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu on click outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Close user menu on Escape
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setUserMenuOpen(false);
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    toast.success("Logout realizado");
    router.push("/login");
    router.refresh();
  }

  const initials = profile?.full_name ? getInitials(profile.full_name) : "??";
  const avatarColor = profile?.full_name
    ? generateAvatarColor(profile.full_name)
    : "bg-gray-400";

  const themeLabel =
    theme === "light" ? "Mudar para modo escuro" :
    theme === "dark" ? "Mudar para modo sistema" :
    "Mudar para modo claro";

  return (
    <header
      className={cn(
        "fixed right-0 top-0 z-30 flex h-[60px] items-center gap-4 border-b border-border bg-card/80 dark:bg-card/80 px-4 backdrop-blur-xl transition-all duration-300",
        // Mobile: full width
        "left-0",
        // Desktop: offset by sidebar width
        sidebarCollapsed ? "lg:left-[68px]" : "lg:left-[260px]"
      )}
    >
      {/* Mobile hamburger */}
      <button
        onClick={toggleMobileSidebar}
        aria-label="Abrir menu lateral"
        className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-muted-foreground dark:hover:bg-secondary dark:hover:text-foreground lg:hidden"
      >
        <Menu className="h-5 w-5" />
      </button>

      <div className="flex-1" aria-hidden="true" />

      <div className="flex items-center gap-2">
        {/* Theme toggle */}
        <button
          onClick={() => {
            const next =
              theme === "light" ? "dark" : theme === "dark" ? "system" : "light";
            setTheme(next);
          }}
          aria-label={themeLabel}
          className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-muted-foreground dark:hover:bg-secondary dark:hover:text-foreground"
        >
          {resolvedTheme === "dark" ? (
            <Moon className="h-4 w-4" aria-hidden="true" />
          ) : theme === "system" ? (
            <Monitor className="h-4 w-4" aria-hidden="true" />
          ) : (
            <Sun className="h-4 w-4" aria-hidden="true" />
          )}
        </button>

        <NotificationPopover />

        {/* User menu */}
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setUserMenuOpen(!userMenuOpen)}
            aria-label="Menu do usuário"
            aria-expanded={userMenuOpen}
            aria-haspopup="true"
            className="flex items-center gap-2 rounded-lg px-2 py-1.5 transition-colors hover:bg-slate-100 dark:hover:bg-secondary"
          >
            <div
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold text-white",
                avatarColor
              )}
              aria-hidden="true"
            >
              {initials}
            </div>
            {profile && (
              <div className="hidden text-left sm:block">
                <p className="text-xs font-medium text-foreground leading-tight">
                  {profile.full_name}
                </p>
                <p className="text-[10px] text-slate-600 dark:text-muted-foreground">
                  {profile.role}
                </p>
              </div>
            )}
            <ChevronDown className="h-3 w-3 text-slate-500 dark:text-muted-foreground" aria-hidden="true" />
          </button>

          {/* Dropdown */}
          {userMenuOpen && (
            <div
              role="menu"
              className="absolute right-0 top-full mt-2 w-56 animate-scale-in overflow-hidden rounded-xl border border-border bg-card shadow-xl"
            >
              <div className="border-b border-border px-4 py-3">
                <p className="text-sm font-medium text-foreground">
                  {profile?.full_name}
                </p>
                <p className="text-xs text-muted-foreground">
                  {profile?.email}
                </p>
              </div>
              <div className="p-1.5">
                <button
                  role="menuitem"
                  onClick={() => {
                    setUserMenuOpen(false);
                    router.push("/profile");
                  }}
                  className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                >
                  <User className="h-4 w-4" aria-hidden="true" />
                  Meu perfil
                </button>
                <button
                  role="menuitem"
                  onClick={() => {
                    setUserMenuOpen(false);
                    handleLogout();
                  }}
                  className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-destructive transition-colors hover:bg-destructive/10"
                >
                  <LogOut className="h-4 w-4" aria-hidden="true" />
                  Sair
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
