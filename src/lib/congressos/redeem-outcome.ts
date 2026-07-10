/**
 * Mapeia o `outcome` do RPC `redeem_gift` para uma mensagem/estado visual.
 * Função pura (testável) — sem React, sem side-effects.
 *
 * Outcomes possíveis (ver `redeem_gift` na migration do módulo Congressos):
 * RETIRADO · JA_RETIRADO · CANCELADO · NAO_ENCONTRADO · SEM_PERMISSAO.
 */
export type RedeemTone = "success" | "warning" | "error";

export interface RedeemFeedback {
  tone: RedeemTone;
  title: string;
  description: string;
}

export function classifyRedeemOutcome(
  outcome: string | null | undefined
): RedeemFeedback {
  switch (outcome) {
    case "RETIRADO":
      return {
        tone: "success",
        title: "Brinde entregue!",
        description: "Retirada confirmada.",
      };
    case "JA_RETIRADO":
      return {
        tone: "warning",
        title: "Brinde já retirado",
        description: "Este brinde já havia sido entregue.",
      };
    case "CANCELADO":
      return {
        tone: "error",
        title: "Brinde cancelado",
        description: "Este brinde foi cancelado e não pode ser entregue.",
      };
    case "NAO_ENCONTRADO":
      return {
        tone: "error",
        title: "Não encontrado",
        description: "Nenhum brinde corresponde a este código.",
      };
    case "SEM_PERMISSAO":
      return {
        tone: "error",
        title: "Sem permissão",
        description: "Você não tem permissão para registrar retiradas.",
      };
    default:
      return {
        tone: "error",
        title: "Erro",
        description: "Não foi possível processar a retirada. Tente de novo.",
      };
  }
}
