/**
 * Driver de e-mail de confirmação do brinde (Resend + react-email). Autocontido —
 * não acopla em email.service, para manter o módulo Congressos isolado.
 * Molde: src/lib/nps/channels/email-channel.ts.
 */
import { render } from "@react-email/components";
import QRCode from "qrcode";
import { Resend } from "resend";

import { CongressoGiftEmail } from "@/lib/email-templates/congresso-gift";
import type {
  ChannelSendResult,
  GiftConfirmationMessage,
  MessagingChannel,
} from "./types";

const FROM = process.env.RESEND_FROM_EMAIL ?? "ADDS Brasil <noreply@addsbrasil.com.br>";

/** Gera o QR do token como data-URI (best-effort). Null se falhar. */
async function qrDataUrl(token: string): Promise<string | null> {
  try {
    return await QRCode.toDataURL(token, { width: 240, margin: 2 });
  } catch {
    return null;
  }
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
      const qr = await qrDataUrl(message.giftToken);
      const html = await render(
        CongressoGiftEmail({
          participantFirstName: message.participantFirstName,
          editionName: message.editionName,
          giftName: message.giftName,
          shortCode: message.shortCode,
          qrDataUrl: qr,
        }),
      );
      const subject = message.editionName
        ? `Seu brinde no ${message.editionName} está garantido 🎁`
        : "Seu brinde está garantido 🎁";

      const resend = new Resend(key);
      const { data, error } = await resend.emails.send({
        from: FROM,
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
