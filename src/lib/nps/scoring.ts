/**
 * NPS scoring — helpers puros (sem I/O). Fonte de verdade da classificação
 * espelha a coluna GENERATED `nps_responses.category` no banco.
 */
import type { Database } from "@/types/database.types";

export type NpsCategory = Database["public"]["Enums"]["nps_category"];
export type NpsTheme = Database["public"]["Enums"]["nps_theme"];
export type NpsSurveyType = Database["public"]["Enums"]["nps_survey_type"];
export type NpsDispatchChannel = Database["public"]["Enums"]["nps_dispatch_channel"];

/** 0–6 = DETRATOR · 7–8 = PASSIVO · 9–10 = PROMOTOR */
export function scoreToCategory(score: number): NpsCategory {
  if (score <= 6) return "DETRATOR";
  if (score <= 8) return "PASSIVO";
  return "PROMOTOR";
}

export interface NpsBreakdown {
  total: number;
  promoters: number;
  passives: number;
  detractors: number;
  /** NPS = %promotores − %detratores, arredondado, escala −100..100 */
  nps: number;
}

export function computeNps(scores: number[]): NpsBreakdown {
  const total = scores.length;
  if (total === 0) {
    return { total: 0, promoters: 0, passives: 0, detractors: 0, nps: 0 };
  }
  let promoters = 0;
  let passives = 0;
  let detractors = 0;
  for (const s of scores) {
    const c = scoreToCategory(s);
    if (c === "PROMOTOR") promoters++;
    else if (c === "PASSIVO") passives++;
    else detractors++;
  }
  const nps = Math.round(((promoters - detractors) / total) * 100);
  return { total, promoters, passives, detractors, nps };
}

/** Pergunta de follow-up condicional à faixa da nota (UX inteligente). */
export function followupQuestionFor(
  category: NpsCategory,
  survey: {
    question_detractor: string;
    question_passive: string;
    question_promoter: string;
  },
): string {
  if (category === "DETRATOR") return survey.question_detractor;
  if (category === "PASSIVO") return survey.question_passive;
  return survey.question_promoter;
}

export const NPS_CATEGORY_LABELS: Record<NpsCategory, string> = {
  DETRATOR: "Detrator",
  PASSIVO: "Passivo",
  PROMOTOR: "Promotor",
};

export const NPS_THEME_LABELS: Record<NpsTheme, string> = {
  ATENDIMENTO: "Atendimento",
  PRAZO_ENTREGA: "Prazo de entrega",
  QUALIDADE_ARTE: "Qualidade da arte",
  QUALIDADE_PRODUTO: "Qualidade do produto",
  PRECO: "Preço",
  COMUNICACAO: "Comunicação",
  FACILIDADE_COMPRA: "Facilidade de compra",
  POS_VENDA: "Pós-venda",
  OUTRO: "Outro",
};

export const NPS_THEMES: NpsTheme[] = Object.keys(NPS_THEME_LABELS) as NpsTheme[];
