/**
 * Driver de e-mail de confirmação do brinde (Resend + react-email). Autocontido —
 * não acopla em email.service, para manter o módulo Congressos isolado.
 * Molde: src/lib/nps/channels/email-channel.ts.
 *
 * Logo e QR são referenciados por URL HTTPS real (não data-URI): o Gmail e outros
 * clientes bloqueiam imagens embutidas em base64.
 */
import { render } from "@react-email/components";
import { Resend } from "resend";

import { CongressoGiftEmail } from "@/lib/email-templates/congresso-gift";
import type {
  ChannelSendResult,
  GiftConfirmationMessage,
  MessagingChannel,
} from "./types";

const FROM = process.env.RESEND_FROM_EMAIL ?? "ADDS Brasil <noreply@adds.com.br>";

/** URL pública do app, sem barra final. */
const APP_URL = (
  process.env.NEXT_PUBLIC_APP_URL ?? "https://personalizadas.adds.com.br"
).replace(/\/$/, "");

/** Garante nome de exibição no remetente (ex.: "ADDS Brasil <noreply@adds.com.br>"). */
function withDisplayName(from: string): string {
  return from.includes("<") ? from : `ADDS Brasil <${from.trim()}>`;
}

export const emailChannel: MessagingChannel = {
  channel: "EMAIL",

  isConfigured() {
    return Boolean(process.env.RESEND_API_KEY);
  },

  async send(message: GiftConfirmationMessage): Promise<ChannelSendResult> {
    const key = process.env.RESEND_API_KEY;
    if (!key) {
      return { success: false, error: "RESEND_API_KEY não configurada." };
    }
    try {
      const html = await render(
        CongressoGiftEmail({
          participantFirstName: message.participantFirstName,
          editionName: message.editionName,
          giftName: message.giftName,
          shortCode: message.shortCode,
          logoUrl: `${APP_URL}/Logo-cor-PNG.png`,
          qrUrl: `${APP_URL}/api/congressos/qr/${message.giftToken}`,
        }),
      );
      const subject = message.editionName
        ? `Seu brinde no ${message.editionName} está garantido 🎁`
        : "Seu brinde está garantido 🎁";

      const resend = new Resend(key);
      const { data, error } = await resend.emails.send({
        from: withDisplayName(FROM),
        to: [message.to],
        subject,
        html,
      });
      if (error) {
        return { success: false, error: error.message };
      }
      return { success: true, providerId: data?.id ?? null };
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Erro desconhecido ao enviar e-mail do brinde";
      console.error("[congressos/email-channel]", msg);
      return { success: false, error: msg };
    }
  },
};
