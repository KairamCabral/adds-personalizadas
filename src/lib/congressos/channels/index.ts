/** Resolve o driver de envio a partir do canal do disparo. */
import { emailChannel } from "./email-channel";
import type {
  EventDispatchChannel,
  GiftConfirmationMessage,
  MessagingChannel,
} from "./types";

/** Stub de WhatsApp (Fase 2, Story 4.4): nunca configurado no MVP. */
const whatsappStub: MessagingChannel = {
  channel: "WHATSAPP",
  isConfigured() {
    return false;
  },
  async send(_message: GiftConfirmationMessage) {
    return { success: false, error: "Canal WHATSAPP ainda não disponível (Fase 2)." };
  },
};

export function resolveChannel(channel: EventDispatchChannel): MessagingChannel {
  switch (channel) {
    case "WHATSAPP":
      return whatsappStub;
    case "EMAIL":
    default:
      return emailChannel;
  }
}

export type {
  ChannelSendResult,
  EventDispatchChannel,
  GiftConfirmationMessage,
  MessagingChannel,
} from "./types";
