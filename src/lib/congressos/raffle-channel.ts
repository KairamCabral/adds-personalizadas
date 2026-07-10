import { createClient } from "@/lib/supabase/client";
import type { RaffleDrawResult } from "@/services/congressos-raffle.service";

/**
 * Canal de sincronização controle → telão do sorteio (E8 / modo telão).
 *
 * O RPC `raffle_draw` decide+persiste o ganhador no servidor numa chamada só, então
 * o telão NÃO pode re-sortear: ele recebe o MESMO resultado que o painel de controle
 * obteve. Transmite por dois meios, cobrindo os dois cenários de projeção:
 *  - `BroadcastChannel` → controle e telão na MESMA máquina (2 janelas): instantâneo,
 *    offline, sem backend.
 *  - Supabase Realtime `broadcast` → controle e telão em DISPOSITIVOS separados.
 * O telão deduplica por `drawId` (a mesma mensagem chega pelos dois canais).
 */

export interface RaffleWinnerMessage {
  drawId: string;
  editionId: string;
  winner: RaffleDrawResult;
  emittedAt: number;
}

export interface RaffleChannel {
  /** Controle: transmite o ganhador recém-sorteado. */
  emit: (winner: RaffleDrawResult) => void;
  /** Telão: registra o callback de recebimento (deduplicado). */
  subscribe: (cb: (msg: RaffleWinnerMessage) => void) => void;
  close: () => void;
}

const BC_PREFIX = "raffle-telao:";
const RT_PREFIX = "raffle:";
const RT_EVENT = "winner";

export function createRaffleChannel(editionId: string): RaffleChannel {
  const supabase = createClient();
  const bc =
    typeof BroadcastChannel !== "undefined"
      ? new BroadcastChannel(BC_PREFIX + editionId)
      : null;

  const seen = new Set<string>();
  let listener: ((msg: RaffleWinnerMessage) => void) | null = null;

  const dispatch = (msg: RaffleWinnerMessage | undefined) => {
    if (!msg?.drawId || seen.has(msg.drawId)) return;
    seen.add(msg.drawId);
    listener?.(msg);
  };

  // Realtime já subscrito na criação — `send()` exige canal subscrito. `self:false`
  // evita o emissor receber o próprio broadcast.
  const rt = supabase.channel(RT_PREFIX + editionId, {
    config: { broadcast: { self: false } },
  });
  rt.on("broadcast", { event: RT_EVENT }, ({ payload }) =>
    dispatch(payload as RaffleWinnerMessage)
  ).subscribe();

  if (bc) {
    bc.onmessage = (e: MessageEvent) =>
      dispatch(e.data as RaffleWinnerMessage);
  }

  return {
    emit(winner) {
      const msg: RaffleWinnerMessage = {
        drawId: `${winner.registration_id}:${Date.now()}`,
        editionId,
        winner,
        emittedAt: Date.now(),
      };
      seen.add(msg.drawId); // não reprocessa o próprio emit
      bc?.postMessage(msg);
      void rt.send({ type: "broadcast", event: RT_EVENT, payload: msg });
    },
    subscribe(cb) {
      listener = cb;
    },
    close() {
      bc?.close();
      supabase.removeChannel(rt);
    },
  };
}
