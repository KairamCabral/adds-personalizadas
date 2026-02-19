"use client";

import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function QuoteSuccessPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 py-16">
      <div className="flex max-w-md flex-col items-center text-center">
        <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/30">
          <CheckCircle2 className="h-12 w-12 text-emerald-600 dark:text-emerald-400" />
        </div>
        <h1 className="text-2xl font-bold text-foreground">
          Obrigado! Seu orçamento foi enviado com sucesso.
        </h1>
        <p className="mt-3 text-muted-foreground">
          Nossa equipe entrará em contato em breve.
        </p>
        <Button asChild className="mt-8">
          <Link href="/">Voltar ao início</Link>
        </Button>
      </div>
    </div>
  );
}
