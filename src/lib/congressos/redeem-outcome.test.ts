import { describe, it, expect } from "vitest";
import { classifyRedeemOutcome } from "./redeem-outcome";

describe("classifyRedeemOutcome", () => {
  it("RETIRADO → success", () => {
    const f = classifyRedeemOutcome("RETIRADO");
    expect(f.tone).toBe("success");
    expect(f.title).toBeTruthy();
  });

  it("JA_RETIRADO → warning", () => {
    expect(classifyRedeemOutcome("JA_RETIRADO").tone).toBe("warning");
  });

  it("CANCELADO → error", () => {
    expect(classifyRedeemOutcome("CANCELADO").tone).toBe("error");
  });

  it("NAO_ENCONTRADO → error", () => {
    expect(classifyRedeemOutcome("NAO_ENCONTRADO").tone).toBe("error");
  });

  it("SEM_PERMISSAO → error", () => {
    expect(classifyRedeemOutcome("SEM_PERMISSAO").tone).toBe("error");
  });

  it("outcome desconhecido ou null → fallback de erro", () => {
    expect(classifyRedeemOutcome(null).tone).toBe("error");
    expect(classifyRedeemOutcome(undefined).tone).toBe("error");
    expect(classifyRedeemOutcome("XPTO").tone).toBe("error");
  });

  it("sempre retorna title e description não-vazios", () => {
    for (const o of [
      "RETIRADO",
      "JA_RETIRADO",
      "CANCELADO",
      "NAO_ENCONTRADO",
      "SEM_PERMISSAO",
      "???",
    ]) {
      const f = classifyRedeemOutcome(o);
      expect(f.title.length).toBeGreaterThan(0);
      expect(f.description.length).toBeGreaterThan(0);
    }
  });
});
