/**
 * Validação de celular brasileiro para o módulo Congressos.
 *
 * Fonte ÚNICA da regra — usada no wizard público (cliente), no
 * `congressoRegisterSchema` (servidor, o gate que importa) e na correção de
 * telefone no balcão. Não duplicar a regra em nenhum desses lugares.
 *
 * O objetivo é qualidade de dado: o número alimenta o contato no Tiny e a base
 * comercial, e a ADDS fala com dentista por WhatsApp. Por isso exige celular,
 * não fixo.
 *
 * Funções puras (testáveis) — sem React, sem side-effects.
 */

/**
 * DDDs realmente atribuídos no Brasil. Os buracos são de propósito (23, 25, 26,
 * 29, 30, 36, 39, 40, 50, 52, 56–60, 70, 72, 76, 78, 80 e 90 não existem).
 */
export const DDDS_VALIDOS: ReadonlySet<string> = new Set([
  "11", "12", "13", "14", "15", "16", "17", "18", "19",
  "21", "22", "24", "27", "28",
  "31", "32", "33", "34", "35", "37", "38",
  "41", "42", "43", "44", "45", "46", "47", "48", "49",
  "51", "53", "54", "55",
  "61", "62", "63", "64", "65", "66", "67", "68", "69",
  "71", "73", "74", "75", "77", "79",
  "81", "82", "83", "84", "85", "86", "87", "88", "89",
  "91", "92", "93", "94", "95", "96", "97", "98", "99",
]);

export type PhoneIssue =
  | "VAZIO"
  | "TAMANHO"
  | "DDD_INVALIDO"
  | "NAO_CELULAR"
  | "DIGITOS_REPETIDOS";

export type PhoneValidation =
  | { ok: true; digits: string }
  | { ok: false; reason: PhoneIssue };

/** Só os dígitos (o campo aceita máscara, colagem com +55, espaços etc.). */
export function onlyDigits(value: string | null | undefined): string {
  return (value ?? "").replace(/\D/g, "");
}

/**
 * Valida celular BR: 11 dígitos, DDD existente, 9 na frente do número e miolo
 * que não seja todos os dígitos iguais.
 *
 * Aceita entrada com DDI 55 na frente (13 dígitos) e normaliza.
 *
 * DELIBERADAMENTE NÃO bloqueia sequências como 91234-5678: são números
 * perfeitamente possíveis e barrar um participante real no congresso custa mais
 * caro do que deixar passar um raro chute sequencial.
 */
export function validateBrMobile(
  value: string | null | undefined
): PhoneValidation {
  let digits = onlyDigits(value);
  if (!digits) return { ok: false, reason: "VAZIO" };

  // Tolera DDI: +55 (11) 91234-5678
  if (digits.length === 13 && digits.startsWith("55")) {
    digits = digits.slice(2);
  }

  if (digits.length !== 11) return { ok: false, reason: "TAMANHO" };

  const ddd = digits.slice(0, 2);
  if (!DDDS_VALIDOS.has(ddd)) return { ok: false, reason: "DDD_INVALIDO" };

  const numero = digits.slice(2);
  if (numero[0] !== "9") return { ok: false, reason: "NAO_CELULAR" };

  // 99999-9999, 00000-0000 e afins: o caso clássico de telefone inventado.
  if (/^(\d)\1+$/.test(numero)) {
    return { ok: false, reason: "DIGITOS_REPETIDOS" };
  }

  return { ok: true, digits };
}

/** true/false direto, para gates de formulário. */
export function isValidBrMobile(value: string | null | undefined): boolean {
  return validateBrMobile(value).ok;
}

/** Explicação pt-BR do problema — mesma frase no wizard e no balcão. */
export function phoneIssueMessage(reason: PhoneIssue): string {
  switch (reason) {
    case "VAZIO":
      return "Informe o WhatsApp com DDD.";
    case "TAMANHO":
      return "O WhatsApp precisa ter DDD + 9 dígitos.";
    case "DDD_INVALIDO":
      return "Esse DDD não existe. Confira o começo do número.";
    case "NAO_CELULAR":
      return "Precisa ser um celular (o número começa com 9 depois do DDD).";
    case "DIGITOS_REPETIDOS":
      return "Esse número não parece real. Informe o seu WhatsApp.";
    default:
      return "Número de WhatsApp inválido.";
  }
}

/** Menos que isso casa com gente demais para ser útil no balcão. */
export const MIN_PHONE_SEARCH_DIGITS = 4;

/**
 * Um termo da busca por telefone no balcão.
 * - `contains`: o que o operador digitou, que pode vir sem DDD ("99916").
 * - `prefix`: variante construída a partir de um DDD — sempre começa com ele,
 *   então é buscada como "começa com". Como "contém", um trecho curto como
 *   "48916" casaria no MEIO de números de outro DDD ((47) 99148-9160).
 */
export interface PhoneSearchTerm {
  value: string;
  mode: "contains" | "prefix";
}

/**
 * Termos a procurar no telefone do cadastro a partir do que o operador digitou
 * no balcão — o número inteiro ou só o começo.
 *
 * Cobre o "9 a mais" nos dois sentidos:
 *  - digitou SEM o 9 (formato antigo): `(48) 9916-8070` também procura
 *    `48 9 9916-8070`;
 *  - digitou COM o 9, mas o cadastro antigo está sem ele: `(48) 99916-8070`
 *    também procura `48 9916-8070`.
 *
 * As variantes só entram quando dá para ler DDD + parte do número (6+
 * dígitos). Com menos, "99916" poderia ser DDD 99 + "916". O DDI 55 só é
 * removido com 12+ dígitos — 55 também é DDD (RS).
 */
export function phoneSearchTerms(
  value: string | null | undefined
): PhoneSearchTerm[] {
  let d = onlyDigits(value);
  if (d.length >= 12 && d.startsWith("55")) d = d.slice(2);
  if (d.length < MIN_PHONE_SEARCH_DIGITS) return [];

  const terms: PhoneSearchTerm[] = [{ value: d, mode: "contains" }];
  const ddd = d.slice(0, 2);
  const resto = d.slice(2);

  if (d.length >= 6 && DDDS_VALIDOS.has(ddd)) {
    // Sem o 9 → acrescenta. Com 11 dígitos já está completo, não cabe outro.
    if (d.length <= 10) terms.push({ value: `${ddd}9${resto}`, mode: "prefix" });
    // Com o 9 → também tenta sem, para cadastro antigo de 10 dígitos.
    if (resto.startsWith("9")) {
      terms.push({ value: `${ddd}${resto.slice(1)}`, mode: "prefix" });
    }
  }

  return terms.filter((t) => t.value.length >= MIN_PHONE_SEARCH_DIGITS);
}

/**
 * Mesma semântica do filtro SQL, em memória. Serve aos testes e documenta a
 * regra num lugar só: `contains` = LIKE '%x%', `prefix` = LIKE 'x%'.
 */
export function phoneMatchesSearch(
  storedPhone: string | null | undefined,
  typed: string
): boolean {
  const stored = onlyDigits(storedPhone);
  if (!stored) return false;
  return phoneSearchTerms(typed).some((t) =>
    t.mode === "prefix" ? stored.startsWith(t.value) : stored.includes(t.value)
  );
}

/** Atalho: valida e já devolve a mensagem, ou null quando está tudo certo. */
export function brMobileError(value: string | null | undefined): string | null {
  const res = validateBrMobile(value);
  return res.ok ? null : phoneIssueMessage(res.reason);
}
