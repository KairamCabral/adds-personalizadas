import { timingSafeEqual, createHash } from "crypto";

/**
 * Compara dois strings em tempo constante para prevenir timing attacks.
 *
 * Usa SHA-256 antes de timingSafeEqual para garantir buffers de tamanho
 * igual, independente do comprimento dos tokens comparados.
 *
 * Retorna false se qualquer argumento for falsy.
 */
export function safeCompare(a: string, b: string): boolean {
  if (!a || !b) return false;
  const bufA = createHash("sha256").update(a).digest();
  const bufB = createHash("sha256").update(b).digest();
  return timingSafeEqual(bufA, bufB);
}
