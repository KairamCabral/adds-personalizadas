/**
 * Driver de e-mail do NPS (Resend + react-email). Autocontido — não acopla
 * em email.service para manter o módulo NPS isolado.
 */
import { render } from "@react-email/components";
import { Resend } from "resend";

import { NpsSurveyEmail } from "@/lib/email-templates/nps-survey";
import type { ChannelSendResult, MessagingChannel, NpsSurveyMessage } from "./types";

const FROM = process.env.RESEND_FROM_EMAIL ?? "ADDS Brasil <noreply@adds.com.br>";

export const emailChannel: MessagingChannel = {
  channel: "EMAIL",

  isConfigured() {
    return Boolean(process.env.RESEND_API_KEY);
  },

  async send(message: NpsSurveyMessage): Promise<ChannelSendResult> {
    const key = process.env.RESEND_API_KEY;
    if (!key) {
      return { success: false, error: "RESEND_API_KEY não configurada." };
    }
    try {
      const html = await render(
        NpsSurveyEmail({
          clientName: message.clientName,
          surveyUrl: message.surveyUrl,
          orderTitle: message.orderTitle,
          isReminder: message.isReminder,
        }),
      );
      const subject = message.isReminder
        ? "Lembrete: sua opinião vale muito 💬"
        : "Como foi sua experiência com a ADDS? 💙";

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
      const msg = err instanceof Error ? err.message : "Erro desconhecido ao enviar e-mail NPS";
      console.error("[nps/email-channel]", msg);
      return { success: false, error: msg };
    }
  },
};
