import { describe, it, expect } from "vitest";
import {
  maskEmail,
  maskPhoneBr,
  pickMobile,
  sameDocument,
} from "./participant-lookup";

describe("maskEmail", () => {
  it("mostra só o começo do usuário e o domínio", () => {
    // "maysa.pereira.rosa" tem 18 caracteres: mostra 2, mascara 16.
    expect(maskEmail("maysa.pereira.rosa@gmail.com")).toBe(
      `ma${"•".repeat(16)}@gmail.com`
    );
  });

  it("usuário curto ainda ganha ao menos um •", () => {
    expect(maskEmail("ab@x.com")).toBe("ab•@x.com");
  });

  it("sem @ válido não devolve o valor cru — devolve null", () => {
    // A versão antiga devolvia o texto original quando não havia "@".
    expect(maskEmail("sem-arroba")).toBeNull();
    expect(maskEmail("@dominio.com")).toBeNull();
    expect(maskEmail("usuario@")).toBeNull();
    expect(maskEmail(null)).toBeNull();
  });
});

describe("maskPhoneBr", () => {
  it("DDD e últimos 4 dígitos", () => {
    expect(maskPhoneBr("48998546431")).toBe("(48) •••••-6431");
    expect(maskPhoneBr("(47) 99187-8070")).toBe("(47) •••••-8070");
  });

  it("não mascara o que não é celular válido", () => {
    expect(maskPhoneBr("(48) 3333-4444")).toBeNull();
    expect(maskPhoneBr("(11) 99999-9999")).toBeNull();
    expect(maskPhoneBr(null)).toBeNull();
  });
});

describe("pickMobile", () => {
  it("pula fixo e fica com o primeiro celular válido", () => {
    expect(pickMobile("(48) 3333-4444", null, "48998546431")).toBe(
      "48998546431"
    );
  });

  it("null quando nenhum serve", () => {
    expect(pickMobile("(48) 3333-4444", "", undefined)).toBeNull();
  });
});

describe("sameDocument", () => {
  it("compara só dígitos", () => {
    expect(sameDocument("140.859.569-90", "14085956990")).toBe(true);
  });

  it("CPF diferente ou vazio não bate", () => {
    expect(sameDocument("140.859.569-90", "52998224725")).toBe(false);
    expect(sameDocument("", "")).toBe(false);
    expect(sameDocument(null, null)).toBe(false);
  });
});
