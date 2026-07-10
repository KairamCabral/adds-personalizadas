import { describe, it, expect } from "vitest";
import { classifyDrawOutcome } from "./draw-outcome";

describe("classifyDrawOutcome", () => {
  it("SORTEADO → success", () => {
    expect(classifyDrawOutcome("SORTEADO").tone).toBe("success");
  });
  it("NENHUM_ELEGIVEL → warning", () => {
    expect(classifyDrawOutcome("NENHUM_ELEGIVEL").tone).toBe("warning");
  });
  it("RIFA_DESATIVADA → error", () => {
    expect(classifyDrawOutcome("RIFA_DESATIVADA").tone).toBe("error");
  });
  it("SEM_PERMISSAO → error", () => {
    expect(classifyDrawOutcome("SEM_PERMISSAO").tone).toBe("error");
  });
  it("desconhecido/null → fallback de erro", () => {
    expect(classifyDrawOutcome(null).tone).toBe("error");
    expect(classifyDrawOutcome("XPTO").tone).toBe("error");
  });
  it("sempre retorna title e description não-vazios", () => {
    for (const o of [
      "SORTEADO",
      "NENHUM_ELEGIVEL",
      "RIFA_DESATIVADA",
      "SEM_PERMISSAO",
      "???",
    ]) {
      const f = classifyDrawOutcome(o);
      expect(f.title.length).toBeGreaterThan(0);
      expect(f.description.length).toBeGreaterThan(0);
    }
  });
});
