import { describe, expect, it } from "vitest";

import {
  computeNps,
  followupQuestionFor,
  scoreToCategory,
  type NpsCategory,
} from "./scoring";

describe("scoreToCategory", () => {
  it("classifica detratores (0–6)", () => {
    for (let s = 0; s <= 6; s++) {
      expect(scoreToCategory(s)).toBe<NpsCategory>("DETRATOR");
    }
  });

  it("classifica passivos (7–8)", () => {
    expect(scoreToCategory(7)).toBe("PASSIVO");
    expect(scoreToCategory(8)).toBe("PASSIVO");
  });

  it("classifica promotores (9–10)", () => {
    expect(scoreToCategory(9)).toBe("PROMOTOR");
    expect(scoreToCategory(10)).toBe("PROMOTOR");
  });
});

describe("computeNps", () => {
  it("retorna zero para amostra vazia", () => {
    expect(computeNps([])).toEqual({
      total: 0,
      promoters: 0,
      passives: 0,
      detractors: 0,
      nps: 0,
    });
  });

  it("calcula NPS = %promotores − %detratores", () => {
    // 5 promotores, 3 passivos, 2 detratores → (50 − 20) = 30
    const scores = [10, 10, 9, 9, 9, 8, 7, 7, 3, 0];
    const r = computeNps(scores);
    expect(r.total).toBe(10);
    expect(r.promoters).toBe(5);
    expect(r.passives).toBe(3);
    expect(r.detractors).toBe(2);
    expect(r.nps).toBe(30);
  });

  it("vai a -100 com só detratores e +100 com só promotores", () => {
    expect(computeNps([0, 1, 6]).nps).toBe(-100);
    expect(computeNps([9, 10, 10]).nps).toBe(100);
  });

  it("arredonda corretamente", () => {
    // 1 promotor, 2 detratores em 3 → (33.33 − 66.66) = -33.33 → -33
    expect(computeNps([10, 0, 5]).nps).toBe(-33);
  });
});

describe("followupQuestionFor", () => {
  const survey = {
    question_detractor: "D?",
    question_passive: "P?",
    question_promoter: "G?",
  };

  it("escolhe a pergunta condicional à faixa", () => {
    expect(followupQuestionFor("DETRATOR", survey)).toBe("D?");
    expect(followupQuestionFor("PASSIVO", survey)).toBe("P?");
    expect(followupQuestionFor("PROMOTOR", survey)).toBe("G?");
  });
});
