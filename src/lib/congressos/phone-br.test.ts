import { describe, it, expect } from "vitest";
import {
  brMobileError,
  isValidBrMobile,
  phoneIssueMessage,
  phoneMatchesSearch,
  phoneSearchTerms,
  validateBrMobile,
  type PhoneIssue,
} from "./phone-br";

describe("busca por telefone no balcão", () => {
  // Cadastro do exemplo: (48) 99916-8070
  const cadastro = "(48) 99916-8070";

  it.each([
    ["(48) 99916-8070", "número completo"],
    ["4899916", "só o começo, com o 9"],
    ["489916", "só o começo, SEM o 9"],
    ["4899168070", "completo SEM o 9 (formato antigo)"],
    ["99916", "sem DDD"],
    ["+55 (48) 99916-8070", "com DDI"],
  ])("acha digitando %s (%s)", (digitado) => {
    expect(phoneMatchesSearch(cadastro, digitado)).toBe(true);
  });

  it("acha cadastro ANTIGO sem o 9 quando o operador digita com o 9", () => {
    expect(phoneMatchesSearch("(48) 9916-8070", "(48) 99916-8070")).toBe(true);
  });

  it("variante sem o 9 NÃO casa no meio de número de outro DDD", () => {
    // "489916" gera a variante "48916". Como "contém", ela casaria dentro de
    // (47) 99148-9160 — ruído no balcão. Como "começa com", não casa.
    expect(phoneMatchesSearch("(47) 99148-9160", "489916")).toBe(false);
  });

  it("variantes são 'começa com'; só o digitado é 'contém'", () => {
    expect(phoneSearchTerms("489916")).toEqual([
      { value: "489916", mode: "contains" },
      { value: "4899916", mode: "prefix" },
      { value: "48916", mode: "prefix" },
    ]);
  });

  it("não inventa variante com menos de 6 dígitos (evita abrir demais)", () => {
    expect(phoneSearchTerms("99916")).toEqual([
      { value: "99916", mode: "contains" },
    ]);
  });

  it("não tira '55' de número curto — 55 também é DDD do RS", () => {
    expect(phoneSearchTerms("55991234567")[0].value).toBe("55991234567");
  });

  it("menos de 4 dígitos não busca", () => {
    expect(phoneSearchTerms("489")).toEqual([]);
    expect(phoneSearchTerms("")).toEqual([]);
  });
});

describe("validateBrMobile — aceita", () => {
  const validos: Array<[string, string]> = [
    ["(47) 99187-8070", "47991878070"],
    ["48999168070", "48999168070"],
    ["+55 (11) 98765-4321", "11987654321"],
    ["5511987654321", "11987654321"],
    // Sequência: passa DE PROPÓSITO. Barrar custa mais caro (participante real
    // travado no congresso) do que deixar passar um raro chute sequencial.
    ["(11) 91234-5678", "11912345678"],
  ];

  it.each(validos)("%s → válido", (entrada, esperado) => {
    const res = validateBrMobile(entrada);
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.digits).toBe(esperado);
  });
});

describe("validateBrMobile — recusa", () => {
  const invalidos: Array<[string, PhoneIssue, string]> = [
    ["", "VAZIO", "vazio"],
    ["   ", "VAZIO", "só espaço"],
    ["(11) 3456-7890", "TAMANHO", "fixo de 10 dígitos"],
    ["(11) 9876-543", "TAMANHO", "incompleto"],
    ["119876543210", "TAMANHO", "dígito a mais"],
    ["(23) 99123-4567", "DDD_INVALIDO", "DDD 23 não existe"],
    ["(00) 99123-4567", "DDD_INVALIDO", "DDD 00"],
    ["(11) 81234-5678", "NAO_CELULAR", "11 dígitos sem o 9"],
    ["(11) 99999-9999", "DIGITOS_REPETIDOS", "clássico do telefone falso"],
  ];

  it.each(invalidos)("%s → %s (%s)", (entrada, motivo) => {
    const res = validateBrMobile(entrada);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toBe(motivo);
  });

  it("00000-0000 cai em NAO_CELULAR antes de repetidos (não começa com 9)", () => {
    const res = validateBrMobile("(11) 00000-0000");
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toBe("NAO_CELULAR");
  });

  it("null e undefined são VAZIO", () => {
    expect(validateBrMobile(null)).toEqual({ ok: false, reason: "VAZIO" });
    expect(validateBrMobile(undefined)).toEqual({ ok: false, reason: "VAZIO" });
  });
});

describe("helpers de UI", () => {
  it("isValidBrMobile espelha o validate", () => {
    expect(isValidBrMobile("(47) 99187-8070")).toBe(true);
    expect(isValidBrMobile("(11) 99999-9999")).toBe(false);
  });

  it("brMobileError devolve null quando está certo e frase quando não", () => {
    expect(brMobileError("(47) 99187-8070")).toBeNull();
    expect(brMobileError("(23) 99123-4567")).toContain("DDD");
  });

  it("toda razão tem mensagem própria e não vazia", () => {
    const razoes: PhoneIssue[] = [
      "VAZIO",
      "TAMANHO",
      "DDD_INVALIDO",
      "NAO_CELULAR",
      "DIGITOS_REPETIDOS",
    ];
    const frases = razoes.map(phoneIssueMessage);
    expect(frases.every((f) => f.length > 0)).toBe(true);
    expect(new Set(frases).size).toBe(razoes.length);
  });
});
