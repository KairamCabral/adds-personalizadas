"use client";

import { CheckCircle2, Phone } from "lucide-react";
import { maskPhone } from "@/lib/utils";
import { isValidBrMobile } from "@/lib/congressos/phone-br";
import type { RegisterResult } from "@/services/congressos-public.service";

/**
 * Tela final do pré-cadastro.
 *
 * Sem QR e sem código de 6 dígitos: a retirada no estande agora é pelo
 * TELEFONE (busca no balcão + código de confirmação enviado no WhatsApp).
 * Mostrar o código aqui levaria o participante a apresentar algo que o
 * operador não usa mais.
 */
export function StepSuccess({
  result,
  hasEmail,
  phone,
}: {
  result: RegisterResult;
  hasEmail: boolean;
  /** Telefone informado NESTA inscrição. Null quando não se sabe qual vale. */
  phone: string | null;
}) {
  const firstName = result.participant_first_name;
  const brinde = result.gift_name ? `o seu ${result.gift_name}` : "o seu brinde";

  // No recadastro, o telefone que vale é o da PRIMEIRA inscrição — que pode ser
  // diferente do digitado agora. Mostrar o novo induziria a informar o errado.
  // E só exibe celular válido: cliente antigo pode ter fixo no cadastro, que
  // não recebe o código no WhatsApp.
  const telefoneParaMostrar =
    !result.alreadyRegistered && isValidBrMobile(phone) ? maskPhone(phone!) : null;

  return (
    <div className="mx-auto max-w-md space-y-6 py-6 text-center">
      <div className="flex flex-col items-center gap-3">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/[0.08] ring-1 ring-primary/15">
          <CheckCircle2 className="h-9 w-9 text-primary" strokeWidth={1.75} />
        </div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          {result.alreadyRegistered
            ? "Você já está inscrito!"
            : firstName
              ? `Prontinho, ${firstName}!`
              : "Inscrição confirmada!"}
        </h1>
        <p className="text-sm text-muted-foreground">
          {result.alreadyRegistered
            ? `Seu brinde já estava reservado. É só ir ao estande da ADDS e informar o telefone que você usou na inscrição para retirar ${brinde}.`
            : `Vá ao estande da ADDS e informe seu telefone para retirar ${brinde}.`}
        </p>
      </div>

      {telefoneParaMostrar && (
        <div className="space-y-1 rounded-xl border bg-card p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Informe este telefone no estande
          </p>
          <p className="flex items-center justify-center gap-2 text-2xl font-bold tabular-nums text-adds-navy">
            <Phone className="h-5 w-5" />
            {telefoneParaMostrar}
          </p>
          <p className="text-xs text-muted-foreground">
            Vamos enviar um código de confirmação no seu WhatsApp.
          </p>
        </div>
      )}

      {result.cashback_label && (
        <div className="rounded-xl border border-emerald-300 bg-emerald-50 p-4 text-sm font-medium text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200">
          🛍️ {result.cashback_label}
        </div>
      )}

      {result.raffle_number != null && (
        <div className="space-y-1 rounded-xl border border-adds-orange/30 bg-adds-orange/10 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            🎟️ Seu número da sorte
          </p>
          <p className="text-4xl font-bold tracking-[0.3em] text-adds-orange">
            {String(result.raffle_number).padStart(4, "0")}
          </p>
          <p className="text-xs text-muted-foreground">
            Guarde este número — o sorteio acontece no evento.
          </p>
        </div>
      )}

      {hasEmail && (
        <p className="text-sm text-muted-foreground">
          Enviamos a confirmação para o seu e-mail. 💙
        </p>
      )}
    </div>
  );
}
