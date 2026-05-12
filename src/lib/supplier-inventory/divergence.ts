export type DivergenceStatus =
  | "MATCH"
  | "DIVERGE"
  | "MISSING_TINY"
  | "BREAK"
  | "COMMITTED_GT_DECLARED";

/**
 * Classifica divergência de uma linha de inventário.
 * Pura: usada tanto no client (preview) quanto pelo SQL `classify_inventory_divergence`.
 * Mantenha em sincronia com a função SQL (migration 20260512170000).
 */
export function classifyDivergence(args: {
  declared: number;
  committed: number;
  tiny: number | null | undefined;
  thresholdPct: number;
}): DivergenceStatus {
  const { declared, committed, tiny, thresholdPct } = args;
  if (committed > declared) return "BREAK";
  if (tiny == null) return "MISSING_TINY";
  const denom = Math.max(1, declared);
  const diffPct = (Math.abs(tiny - declared) / denom) * 100;
  return diffPct > thresholdPct ? "DIVERGE" : "MATCH";
}

/** Retorna o primeiro dia do mês corrente em America/Sao_Paulo no formato YYYY-MM-DD. */
export function currentReferenceMonth(now: Date = new Date()): string {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
  });
  const parts = fmt.formatToParts(now);
  const year = parts.find((p) => p.type === "year")?.value ?? "1970";
  const month = parts.find((p) => p.type === "month")?.value ?? "01";
  return `${year}-${month}-01`;
}
