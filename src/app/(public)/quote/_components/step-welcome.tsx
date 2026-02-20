"use client";

import { UserCheck, UserPlus } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

interface StepWelcomeProps {
  onSelect: (isExistingClient: boolean) => void;
}

export function StepWelcome({ onSelect }: StepWelcomeProps) {
  return (
    <div className="text-center space-y-10 sm:space-y-12 py-8 sm:py-12 w-full min-w-0">
      <div className="space-y-2 sm:space-y-3 px-1">
        <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight break-words">
          Solicite seu Orçamento
        </h1>
        <p className="text-muted-foreground text-base sm:text-lg max-w-md mx-auto px-2">
          Escovas personalizadas com a sua marca
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 max-w-5xl mx-auto w-full min-w-0">
        <Card
          className="cursor-pointer transition-all duration-300 group hover:shadow-xl hover:shadow-primary/10 hover:scale-[1.02] border-2 hover:border-primary/50 rounded-xl min-w-0 overflow-hidden"
          onClick={() => onSelect(true)}
        >
          <CardContent className="flex flex-col items-center gap-4 sm:gap-6 p-6 sm:p-10 min-w-0">
            <div className="h-20 w-20 rounded-2xl bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors duration-300">
              <UserCheck className="h-10 w-10 text-primary" />
            </div>
            <div className="space-y-1">
              <p className="font-bold text-xl">Já sou cliente</p>
              <p className="text-sm text-muted-foreground">
                Buscar meus dados cadastrados
              </p>
            </div>
          </CardContent>
        </Card>

        <Card
          className="cursor-pointer transition-all duration-300 group hover:shadow-xl hover:shadow-accent/10 hover:scale-[1.02] border-2 hover:border-accent/50 rounded-xl min-w-0 overflow-hidden"
          onClick={() => onSelect(false)}
        >
          <CardContent className="flex flex-col items-center gap-4 sm:gap-6 p-6 sm:p-10 min-w-0">
            <div className="h-20 w-20 rounded-2xl bg-accent/10 flex items-center justify-center group-hover:bg-accent/20 transition-colors duration-300">
              <UserPlus className="h-10 w-10 text-accent" />
            </div>
            <div className="space-y-1">
              <p className="font-bold text-xl">Sou novo cliente</p>
              <p className="text-sm text-muted-foreground">
                Preencher meus dados
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
