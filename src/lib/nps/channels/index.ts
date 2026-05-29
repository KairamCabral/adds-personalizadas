import type { NpsDispatchChannel } from "@/lib/nps/scoring";
import { emailChannel } from "./email-channel";
import type { MessagingChannel } from "./types";
import { whatsappNiChannel } from "./whatsapp-ni-channel";

/** Resolve o driver de envio a partir do canal do disparo. */
export function resolveChannel(channel: NpsDispatchChannel): MessagingChannel {
  switch (channel) {
    case "WHATSAPP":
      return whatsappNiChannel;
    case "EMAIL":
    default:
      return emailChannel;
  }
}

export type { ChannelSendResult, MessagingChannel, NpsSurveyMessage } from "./types";
