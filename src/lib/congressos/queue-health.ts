/**
 * Congressos — avaliação de limiar das filas (E7 / Story 7.1).
 *
 * Função pura sobre as contagens das duas filas duráveis
 * (`tiny_contact_sync_jobs` e `event_dispatches`) que decide o nível do alerta
 * in-app e as mensagens em pt-BR. Sem I/O — a leitura fica no service; a UI só
 * renderiza o resultado. Testável isoladamente.
 *
 * Limiares como constantes nomeadas (podem migrar para env no go-live, se o
 * teste de carga do E7/Story 7.2 indicar outros valores):
 * - jobs de sync MORTOS (esgotaram o retry) e e-mails que FALHARAM são
 *   terminais → exigem ação → `critical` a partir de 1.
 * - jobs de sync em retry (FAILED) e backlog de pendentes só avisam (`warn`).
 */

export const DEAD_THRESHOLD = 1;
export const DISPATCH_FAILED_THRESHOLD = 1;
export const SYNC_FAILED_WARN = 10;
export const BACKLOG_WARN = 500;

export interface SyncQueueCounts {
  pending: number;
  processing: number;
  failed: number;
  dead: number;
  done: number;
}

export interface DispatchQueueCounts {
  pendente: number;
  enviado: number;
  falhou: number;
  cancelado: number;
}

export interface QueueCounts {
  sync: SyncQueueCounts;
  dispatch: DispatchQueueCounts;
}

export type QueueAlertLevel = "ok" | "warn" | "critical";

export interface QueueAlert {
  level: QueueAlertLevel;
  messages: string[];
}

function plural(n: number, singular: string, plural: string): string {
  return `${n.toLocaleString("pt-BR")} ${n === 1 ? singular : plural}`;
}

/**
 * Deriva o nível do alerta e as mensagens a partir das contagens das filas.
 * `critical` prevalece sobre `warn`; as mensagens vêm com as críticas primeiro.
 */
export function evaluateQueueAlert(counts: QueueCounts): QueueAlert {
  const { sync, dispatch } = counts;
  const critical: string[] = [];
  const warn: string[] = [];

  if (sync.dead >= DEAD_THRESHOLD) {
    critical.push(
      `${plural(sync.dead, "job de sync morto", "jobs de sync mortos")} — esgotaram o retry e precisam de reprocessamento.`
    );
  }
  if (dispatch.falhou >= DISPATCH_FAILED_THRESHOLD) {
    critical.push(
      `${plural(dispatch.falhou, "e-mail de confirmação falhou", "e-mails de confirmação falharam")} — reenvie para o participante receber o brinde.`
    );
  }

  if (sync.failed >= SYNC_FAILED_WARN) {
    warn.push(
      `${plural(sync.failed, "job de sync em retry", "jobs de sync em retry")} — acompanhe se não viram mortos.`
    );
  }
  const backlog = sync.pending + sync.processing;
  if (backlog >= BACKLOG_WARN) {
    warn.push(
      `${plural(backlog, "job de sync pendente", "jobs de sync pendentes")} na fila — verifique se o cron está drenando.`
    );
  }

  const level: QueueAlertLevel =
    critical.length > 0 ? "critical" : warn.length > 0 ? "warn" : "ok";

  return { level, messages: [...critical, ...warn] };
}
