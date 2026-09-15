/**
 * Código de confirmação da retirada de brinde, enviado pelo WhatsApp.
 *
 * O envio é MANUAL: o operador do estande clica e o navegador abre a conversa
 * no WhatsApp Web com a mensagem pronta (`wa.me`). Não há API do WhatsApp aqui.
 *
 * Funções puras (testáveis) — sem React, sem side-effects.
 */

/** Só os dígitos do telefone (a origem do pré-cadastro grava formatado ou cru). */
export function phoneDigits(phone: string | null | undefined): string {
  return (phone ?? "").replace(/\D/g, "");
}

/** Telefone BR utilizável: 10 (fixo) ou 11 (celular) dígitos com DDD. */
export function isPhoneComplete(phone: string | null | undefined): boolean {
  const d = phoneDigits(phone);
  return d.length === 10 || d.length === 11;
}

/**
 * Número no formato que o wa.me espera (DDI + DDD + número).
 * Retorna null quando o telefone não dá para discar.
 */
export function toWhatsAppNumber(phone: string | null | undefined): string | null {
  const d = phoneDigits(phone);
  if (d.startsWith("55") && (d.length === 12 || d.length === 13)) return d;
  if (d.length === 10 || d.length === 11) return `55${d}`;
  return null;
}

/** Código de confirmação válido: exatamente 4 dígitos. */
export function isValidConfirmCode(code: string | null | undefined): boolean {
  return /^\d{4}$/.test((code ?? "").trim());
}

/** Mantém só dígitos e corta em 4 — para o input do balcão. */
export function sanitizeConfirmCode(value: string): string {
  return value.replace(/\D/g, "").slice(0, 4);
}

export interface GiftCodeMessageInput {
  participantName: string | null;
  editionName: string | null;
  giftName: string | null;
  code: string;
}

/** Mensagem pt-BR que vai pré-preenchida na conversa do WhatsApp. */
export function buildGiftCodeMessage({
  participantName,
  editionName,
  giftName,
  code,
}: GiftCodeMessageInput): string {
  const first = (participantName ?? "").trim().split(/\s+/)[0] ?? "";
  const saudacao = first ? `Olá, ${first}!` : "Olá!";
  const onde = editionName ? ` no ${editionName}` : "";
  const brinde = giftName ? ` (${giftName})` : "";
  return (
    `${saudacao} Aqui é da ADDS${onde}. ` +
    `Seu código para retirar o brinde${brinde} é ${code}. ` +
    `É só mostrar esse código no nosso estande.`
  );
}

/**
 * URL da conversa no WhatsApp com a mensagem pronta. Retorna null quando o
 * telefone não dá para discar — o botão fica desabilitado nesse caso.
 */
export function buildGiftCodeWaUrl(
  phone: string | null | undefined,
  message: string
): string | null {
  const num = toWhatsAppNumber(phone);
  if (!num) return null;
  return `https://wa.me/${num}?text=${encodeURIComponent(message)}`;
}
