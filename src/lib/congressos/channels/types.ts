/**
 * Abstração de canal de confirmação do módulo Congressos (driver pattern).
 * Hoje: EMAIL (Resend). Fase 2: WHATSAPP (Story 4.4).
 * Molde: src/lib/nps/channels/types.ts.
 */
import type { Database } from "@/types/database.types";

export type EventDispatchChannel =
  Database["public"]["Enums"]["event_dispatch_channel"];

export interface GiftConfirmationMessage {
  /** destinatário: e-mail (EMAIL) ou telefone (WHATSAPP) */
  to: string;
  /** primeiro nome do participante, para saudação (pode ser null) */
  participantFirstName: string | null;
  /** nome da edição/congresso (pode ser null) */
  editionName: string | null;
  /** nome do brinde (pode ser null) */
  giftName: string | null;
  /** token do resgate — o que o QR codifica (nunca PII) */
  giftToken: string;
  /** código curto de 6 dígitos exibido no balcão */
  shortCode: string;
  /** frase de cashback (Épico 6) — null quando a edição não dá cashback elegível */
  cashbackLabel: string | null;
}

export interface ChannelSendResult {
  success: boolean;
  error?: string;
  /** id do provedor (message id), quando houver */
  providerId?: string | null;
}

export interface MessagingChannel {
  readonly channel: EventDispatchChannel;
  /** true se o driver tem credenciais/config para enviar */
  isConfigured(): boolean;
  send(message: GiftConfirmationMessage): Promise<ChannelSendResult>;
}
