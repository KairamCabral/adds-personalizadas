"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { useUIStore } from "@/stores/ui.store";
import { useUser } from "@/hooks/use-user";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/brand/logo";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { sidebarCollapsed } = useUIStore();
  const { user, isLoading } = useUser();
  const router = useRouter();

  // Guard client-side: redireciona para /login se não houver sessão
  useEffect(() => {
    if (!isLoading && !user) {
      router.replace("/login");
    }
  }, [isLoading, user, router]);

  // Enquanto verifica a sessão, não renderiza nada (evita flash de conteúdo)
  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <Logo size="sm" className="h-10 w-10" priority />
          <p className="text-sm text-muted-foreground">Carregando...</p>
        </div>
      </div>
    );
  }

  // Não autenticado: não renderiza o layout (o useEffect já redirecionou)
  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <Header />

      <main
        className={cn(
          "pt-[60px] transition-all duration-300",
          // Mobile: no left padding (sidebar is an overlay)
          "pl-0",
          // Desktop: offset by sidebar width
          sidebarCollapsed ? "lg:pl-[68px]" : "lg:pl-[260px]"
        )}
      >
        <div className="min-h-[calc(100vh-60px)]">{children}</div>
      </main>
    </div>
  );
}
