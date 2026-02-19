"use client";

import { Button } from "@/components/ui/button";

interface StepWelcomeProps {
  onNext: () => void;
}

export function StepWelcome({ onNext }: StepWelcomeProps) {
  return (
    <div className="space-y-8 text-center">
      <div>
        <h2 className="text-2xl font-bold text-foreground">
          Bem-vindo ao orçamento ADDS
        </h2>
        <p className="mt-3 text-muted-foreground">
          Preencha algumas informações e em breve nossa equipe entrará em contato
          com a melhor proposta para você. O processo leva apenas alguns minutos.
        </p>
      </div>
      <Button size="lg" onClick={onNext}>
        Começar
      </Button>
    </div>
  );
}
