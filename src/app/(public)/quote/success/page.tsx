import { CheckCircle2, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { cn } from "@/lib/utils";

export default function QuoteSuccessPage() {
  return (
    <div className="text-center py-16 sm:py-20 space-y-8 max-w-lg mx-auto px-1">
      <div
        className={cn(
          "mx-auto flex h-20 w-20 items-center justify-center rounded-2xl",
          "bg-primary/[0.08] ring-1 ring-primary/15 shadow-sm",
        )}
      >
        <CheckCircle2 className="h-11 w-11 text-primary" strokeWidth={1.75} />
      </div>

      <div className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary/90">
          Tudo certo
        </p>
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-balance">
          Orçamento enviado
        </h1>
        <p className="text-muted-foreground text-base sm:text-lg leading-relaxed max-w-md mx-auto">
          Recebemos sua solicitação. Nossa equipe vai analisar e entrar em contato
          pelo WhatsApp em breve.
        </p>
      </div>

      <div className="pt-2">
        <Button asChild variant="outline" className="gap-2 h-11 font-semibold rounded-xl shadow-sm">
          <Link href="/quote">
            <ArrowLeft className="h-4 w-4" />
            Enviar outro orçamento
          </Link>
        </Button>
      </div>
    </div>
  );
}
