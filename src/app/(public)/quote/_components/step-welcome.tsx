"use client";

import { UserCheck, UserPlus, Info } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface StepWelcomeProps {
  onSelect: (isExistingClient: boolean) => void;
}

const cardShell =
  "cursor-pointer transition-all duration-200 border border-border/80 bg-card shadow-sm hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-xl sm:rounded-2xl min-w-0 overflow-hidden sm:hover:-translate-y-0.5";

export function StepWelcome({ onSelect }: StepWelcomeProps) {
  return (
    <div
      className={cn(
        "w-full min-w-0 mx-auto max-w-3xl",
        /* Mobile: encaixa na altura da tela; desktop: respiro maior */
        "flex flex-col gap-3 sm:gap-10 max-sm:gap-y-2.5 py-0 sm:py-6 md:py-10",
      )}
    >
      <header className="text-center space-y-1 sm:space-y-3 px-0.5 sm:px-1 max-sm:pt-0.5">
        <p className="text-[10px] sm:text-sm font-semibold uppercase tracking-[0.18em] sm:tracking-[0.2em] text-primary/90">
          Orçamento online
        </p>
        <h1 className="text-[1.35rem] leading-snug sm:text-4xl md:text-[2.5rem] font-bold tracking-tight text-balance text-foreground sm:leading-[1.15]">
          Solicite seu orçamento
        </h1>
        <p className="text-muted-foreground text-sm sm:text-lg max-w-lg mx-auto leading-snug sm:leading-relaxed">
          Escovas personalizadas com a sua marca
        </p>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-5 w-full min-w-0">
        <Card
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              onSelect(true);
            }
          }}
          className={cn(
            cardShell,
            "hover:border-primary/35 sm:hover:shadow-md",
          )}
          onClick={() => onSelect(true)}
        >
          <CardContent
            className={cn(
              "flex min-w-0 p-3.5 sm:p-8",
              "flex-row items-center gap-3 text-left",
              "sm:flex-col sm:items-center sm:gap-5 sm:text-center",
            )}
          >
            <div
              className={cn(
                "flex h-11 w-11 shrink-0 items-center justify-center rounded-lg sm:h-14 sm:w-14 sm:rounded-xl",
                "bg-primary/[0.08] ring-1 ring-primary/10",
              )}
            >
              <UserCheck
                className="h-[1.35rem] w-[1.35rem] sm:h-7 sm:w-7 text-primary"
                strokeWidth={1.75}
              />
            </div>
            <div className="min-w-0 flex-1 space-y-0.5 sm:space-y-1.5">
              <p className="font-semibold text-sm sm:text-lg tracking-tight leading-tight">
                Já sou cliente
              </p>
              <p className="text-[11px] sm:text-sm text-muted-foreground leading-snug">
                Buscar meus dados cadastrados
              </p>
            </div>
          </CardContent>
        </Card>

        <Card
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              onSelect(false);
            }
          }}
          className={cn(
            cardShell,
            "hover:border-accent/40 sm:hover:shadow-md",
          )}
          onClick={() => onSelect(false)}
        >
          <CardContent
            className={cn(
              "flex min-w-0 p-3.5 sm:p-8",
              "flex-row items-center gap-3 text-left",
              "sm:flex-col sm:items-center sm:gap-5 sm:text-center",
            )}
          >
            <div
              className={cn(
                "flex h-11 w-11 shrink-0 items-center justify-center rounded-lg sm:h-14 sm:w-14 sm:rounded-xl",
                "bg-accent/[0.08] ring-1 ring-accent/15",
              )}
            >
              <UserPlus
                className="h-[1.35rem] w-[1.35rem] sm:h-7 sm:w-7 text-accent"
                strokeWidth={1.75}
              />
            </div>
            <div className="min-w-0 flex-1 space-y-0.5 sm:space-y-1.5">
              <p className="font-semibold text-sm sm:text-lg tracking-tight leading-tight">
                Sou novo cliente
              </p>
              <p className="text-[11px] sm:text-sm text-muted-foreground leading-snug">
                Preencher meus dados
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <aside
        className={cn(
          "w-full rounded-xl sm:rounded-2xl border border-amber-100/90 bg-amber-50/90 text-foreground/85 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.6)]",
          "px-3 py-2.5 sm:px-8 sm:py-7 max-w-xl mx-auto",
        )}
      >
        {/* Mobile: uma faixa compacta, ícone ao lado — evita rolagem */}
        <div className="flex gap-2.5 items-start sm:hidden text-left">
          <div
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-amber-100/80 text-amber-900 ring-1 ring-amber-200/60"
            aria-hidden
          >
            <Info className="h-3.5 w-3.5" strokeWidth={2} />
          </div>
          <p className="text-[11px] leading-snug text-foreground/85 pt-0.5">
            <span className="font-semibold text-foreground">Prazo:</span> análise em até{" "}
            <strong className="font-semibold text-foreground">2 horas úteis</strong>. A produção
            só começa após a <strong className="font-semibold text-foreground">aprovação da arte</strong>.
            Depois enviamos o link de pagamento.
          </p>
        </div>

        <div className="hidden sm:flex flex-col items-center text-center">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100/80 text-amber-800 mb-4 ring-1 ring-amber-200/60">
            <Info className="h-5 w-5" strokeWidth={2} aria-hidden />
          </div>
          <div className="space-y-3.5 text-sm md:text-base text-foreground/80 leading-relaxed">
            <p>
              Os orçamentos enviados por este link são analisados manualmente por nossa equipe em até{" "}
              <strong className="font-semibold text-foreground">2 horas úteis</strong>.
            </p>
            <p>
              A produção só terá início após sua{" "}
              <strong className="font-semibold text-foreground">revisão e aprovação da arte</strong>.
            </p>
            <p className="text-muted-foreground">
              Após a aprovação enviaremos o link de pagamento para dar início à produção.
            </p>
          </div>
        </div>
      </aside>
    </div>
  );
}
