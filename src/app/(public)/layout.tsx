import type { Metadata } from "next";
import { Logo } from "@/components/brand/logo";

export const metadata: Metadata = {
  title: "Orçamento | ADDS Brasil",
  description: "Solicite um orçamento de escovas personalizadas",
};

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-background via-background to-primary/5 overflow-x-hidden">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-40 -top-40 h-[500px] w-[500px] rounded-full bg-adds-blue/5 blur-[120px]" />
        <div className="absolute -bottom-40 -right-40 h-[500px] w-[500px] rounded-full bg-adds-orange/5 blur-[120px]" />
      </div>

      <header className="border-b border-border/40 bg-card/90 backdrop-blur-xl sticky top-0 z-50 relative shadow-sm min-w-0">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center gap-4 min-w-0">
          <a href="/quote" className="flex items-center gap-4 transition-opacity hover:opacity-90">
            <Logo size="md" className="h-10 w-10" priority />
            <span className="font-bold text-xl tracking-tight">ADDS Brasil</span>
          </a>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-10 w-full max-w-full min-w-0 flex-1 relative">
        {children}
      </main>

      <footer className="border-t border-border/40 mt-auto relative bg-card/30 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-4 py-6 text-center min-w-0">
          <p className="text-sm font-medium text-muted-foreground">
            © {new Date().getFullYear()} ADDS Brasil
          </p>
          <p className="text-xs text-muted-foreground/80 mt-0.5">
            Escovas Personalizadas
          </p>
        </div>
      </footer>
    </div>
  );
}
