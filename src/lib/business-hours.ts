/**
 * Verifica se está em horário comercial (configurável via env).
 * Padrão: seg-sex 8h-18h (timezone America/Sao_Paulo).
 */

const DEFAULT_START_HOUR = 8;
const DEFAULT_END_HOUR = 18;
const DEFAULT_TZ = "America/Sao_Paulo";

export type BusinessHoursConfig = {
  startHour: number;
  endHour: number;
  timezone: string;
  weekdays: number[];
};

function parseEnvInt(key: string, defaultVal: number): number {
  const v = process.env[key];
  if (!v) return defaultVal;
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : defaultVal;
}

export function getBusinessHoursConfig(): BusinessHoursConfig {
  return {
    startHour: parseEnvInt("TINY_SYNC_START_HOUR", DEFAULT_START_HOUR),
    endHour: parseEnvInt("TINY_SYNC_END_HOUR", DEFAULT_END_HOUR),
    timezone: process.env.TINY_SYNC_TIMEZONE ?? DEFAULT_TZ,
    weekdays: [1, 2, 3, 4, 5],
  };
}

const WEEKDAY_MAP: Record<string, number> = {
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
  Sun: 7,
};

export function isWithinBusinessHours(config?: BusinessHoursConfig): boolean {
  const cfg = config ?? getBusinessHoursConfig();
  const now = new Date();
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: cfg.timezone,
    hour: "numeric",
    minute: "numeric",
    weekday: "short",
  });
  const parts = formatter.formatToParts(now);
  let hour = 0;
  let weekday = 0;
  for (const p of parts) {
    if (p.type === "hour") hour = parseInt(p.value, 10);
    if (p.type === "weekday") weekday = WEEKDAY_MAP[p.value] ?? 0;
  }
  const inWeekday = cfg.weekdays.includes(weekday);
  const inHours = hour >= cfg.startHour && hour < cfg.endHour;
  return inWeekday && inHours;
}
