/**
 * Mapeia o `outcome` do RPC `raffle_draw` para mensagem/estado visual. Puro
 * (testável). Outcomes: SORTEADO · NENHUM_ELEGIVEL · RIFA_DESATIVADA · SEM_PERMISSAO.
 */
export type DrawTone = "success" | "warning" | "error";

export interface DrawFeedback {
  tone: DrawTone;
  title: string;
  description: string;
}

export function classifyDrawOutcome(
  outcome: string | null | undefined
): DrawFeedback {
  switch (outcome) {
    case "SORTEADO":
      return {
        tone: "success",
        title: "Temos um ganhador!",
        description: "Sorteio registrado no histórico.",
      };
    case "NENHUM_ELEGIVEL":
      return {
        tone: "warning",
        title: "Ninguém elegível",
        description:
          "Não há inscritos elegíveis para este sorteio (confira a regra e os ganhadores anteriores).",
      };
    case "RIFA_DESATIVADA":
      return {
        tone: "error",
        title: "Sorteio desligado",
        description: "Ative o sorteio na configuração da edição.",
      };
    case "SEM_PERMISSAO":
      return {
        tone: "error",
        title: "Sem permissão",
        description: "Você não tem permissão para sortear.",
      };
    default:
      return {
        tone: "error",
        title: "Erro",
        description: "Não foi possível sortear. Tente de novo.",
      };
  }
}
