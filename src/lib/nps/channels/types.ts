/**
 * Abstração de canal de envio do NPS (driver pattern).
 * Hoje: EMAIL (Resend). Fase 2: WHATSAPP via Notificações Inteligentes.
 * Futuro: trocar driver (ex.: Chatwoot) sem tocar no service/cron.
 */
import type { NpsDispatchChannel } from "@/lib/nps/scoring";

export interface NpsSurveyMessage {
  /** destinatário: e-mail (EMAIL) ou telefone (WHATSAPP) */
  to: string;
  /** primeiro nome do cliente, para saudação (pode ser null) */
  clientName: string | null;
  /** URL pública com o token */
  surveyUrl: string;
  /** título do pedido, quando transacional (pode ser null) */
  orderTitle: string | null;
  /** true quando é lembrete (muda assunto/copy) */
  isReminder: boolean;
}

export interface ChannelSendResult {
  success: boolean;
  error?: string;
  /** id do provedor (message id), quando houver */
  providerId?: string | null;
}

export interface MessagingChannel {
  readonly channel: NpsDispatchChannel;
  /** true se o driver tem credenciais/config para enviar */
  isConfigured(): boolean;
  send(message: NpsSurveyMessage): Promise<ChannelSendResult>;
}
