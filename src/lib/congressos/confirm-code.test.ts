import { describe, it, expect } from "vitest";
import {
  buildGiftCodeMessage,
  buildGiftCodeWaUrl,
  isPhoneComplete,
  isValidConfirmCode,
  phoneDigits,
  sanitizeConfirmCode,
  toWhatsAppNumber,
} from "./confirm-code";

describe("phoneDigits", () => {
  it("tira máscara, espaço e traço", () => {
    expect(phoneDigits("(11) 91234-5678")).toBe("11912345678");
    expect(phoneDigits(" +55 11 91234 5678 ")).toBe("5511912345678");
  });

  it("null/undefined viram string vazia", () => {
    expect(phoneDigits(null)).toBe("");
    expect(phoneDigits(undefined)).toBe("");
  });
});

describe("isPhoneComplete", () => {
  it("aceita fixo (10) e celular (11) com DDD", () => {
    expect(isPhoneComplete("(11) 3456-7890")).toBe(true);
    expect(isPhoneComplete("(11) 91234-5678")).toBe(true);
  });

  it("recusa incompleto e vazio", () => {
    expect(isPhoneComplete("91234-5678")).toBe(false);
    expect(isPhoneComplete("(11) 9123")).toBe(false);
    expect(isPhoneComplete(null)).toBe(false);
  });
});

describe("toWhatsAppNumber", () => {
  it("prefixa 55 quando o número vem só com DDD", () => {
    expect(toWhatsAppNumber("(11) 91234-5678")).toBe("5511912345678");
    expect(toWhatsAppNumber("11 3456-7890")).toBe("551134567890");
  });

  it("mantém o número que já vem com DDI 55", () => {
    expect(toWhatsAppNumber("+55 (11) 91234-5678")).toBe("5511912345678");
    expect(toWhatsAppNumber("551134567890")).toBe("551134567890");
  });

  it("devolve null quando não dá para discar", () => {
    expect(toWhatsAppNumber("91234")).toBeNull();
    expect(toWhatsAppNumber("")).toBeNull();
    expect(toWhatsAppNumber(null)).toBeNull();
  });
});

describe("isValidConfirmCode / sanitizeConfirmCode", () => {
  it("valida exatamente 4 dígitos", () => {
    expect(isValidConfirmCode("4821")).toBe(true);
    expect(isValidConfirmCode(" 4821 ")).toBe(true);
    expect(isValidConfirmCode("0000")).toBe(true);
    expect(isValidConfirmCode("482")).toBe(false);
    expect(isValidConfirmCode("48211")).toBe(false);
    expect(isValidConfirmCode("48a1")).toBe(false);
    expect(isValidConfirmCode(null)).toBe(false);
  });

  it("sanitize mantém só dígitos e corta em 4", () => {
    expect(sanitizeConfirmCode("4-8 2a1 9")).toBe("4821");
    expect(sanitizeConfirmCode("")).toBe("");
  });
});

describe("buildGiftCodeMessage", () => {
  it("usa o primeiro nome, a edição e o brinde", () => {
    const msg = buildGiftCodeMessage({
      participantName: "Ana Paula Souza",
      editionName: "CIOSP 2026",
      giftName: "Escova ADDS Implant",
      code: "4821",
    });
    expect(msg).toContain("Olá, Ana!");
    expect(msg).toContain("CIOSP 2026");
    expect(msg).toContain("Escova ADDS Implant");
    expect(msg).toContain("4821");
  });

  it("degrada sem nome/edição/brinde", () => {
    const msg = buildGiftCodeMessage({
      participantName: null,
      editionName: null,
      giftName: null,
      code: "0007",
    });
    expect(msg).toContain("Olá!");
    expect(msg).toContain("0007");
    expect(msg).not.toContain("null");
    expect(msg).not.toContain("undefined");
  });
});

describe("buildGiftCodeWaUrl", () => {
  it("monta o wa.me com a mensagem encodada", () => {
    const url = buildGiftCodeWaUrl("(11) 91234-5678", "Olá, Ana! Código 4821");
    expect(url).toBe(
      "https://wa.me/5511912345678?text=" +
        encodeURIComponent("Olá, Ana! Código 4821")
    );
  });

  it("devolve null quando o telefone não serve", () => {
    expect(buildGiftCodeWaUrl("123", "oi")).toBeNull();
    expect(buildGiftCodeWaUrl(null, "oi")).toBeNull();
  });
});
