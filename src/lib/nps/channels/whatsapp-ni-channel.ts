/**
 * Driver de WhatsApp do NPS via Notificações Inteligentes (NI).
 *
 * FASE 2 (pluggável): a API de envio outbound do NI (docs.notificacoesinteligentes.com)
 * será plugada aqui. Hoje o canal reporta-se como NÃO configurado, então o
 * trigger de enfileiramento não cria disparos WhatsApp órfãos e o cron os ignora.
 * Quando migrarmos para Chatwoot, basta trocar este driver.
 *
 * Env esperadas na Fase 2: NI_OUTBOUND_URL, NI_OUTBOUND_TOKEN (+ template aprovado).
 */
import type { ChannelSendResult, MessagingChannel, NpsSurveyMessage } from "./types";

const NI_OUTBOUND_URL = process.env.NI_OUTBOUND_URL;
const NI_OUTBOUND_TOKEN = process.env.NI_OUTBOUND_TOKEN;

export const whatsappNiChannel: MessagingChannel = {
  channel: "WHATSAPP",

  isConfigured() {
    return Boolean(NI_OUTBOUND_URL && NI_OUTBOUND_TOKEN);
  },

  async send(_message: NpsSurveyMessage): Promise<ChannelSendResult> {
    // Implementação real entra na Fase 2 (POST para a API outbound do NI).
    return {
      success: false,
      error: "Canal WhatsApp (Notificações Inteligentes) ainda não configurado (Fase 2).",
    };
  },
};
