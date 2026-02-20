import { CheckCircle2, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function QuoteSuccessPage() {
  return (
    <div className="text-center py-20 space-y-8 max-w-md mx-auto">
      <div className="h-24 w-24 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
        <CheckCircle2 className="h-12 w-12 text-primary" />
      </div>

      <div className="space-y-3">
        <h1 className="text-3xl font-bold tracking-tight">Orçamento Enviado!</h1>
        <p className="text-muted-foreground text-lg">
          Recebemos sua solicitação. Nossa equipe vai analisar e entrar em
          contato pelo WhatsApp em breve.
        </p>
      </div>

      <div className="pt-4">
        <Button asChild variant="outline" className="gap-2 h-11 font-semibold">
          <Link href="/quote">
            <ArrowLeft className="h-4 w-4" />
            Enviar outro orçamento
          </Link>
        </Button>
      </div>
    </div>
  );
}
