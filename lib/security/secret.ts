import { timingSafeEqual } from "crypto";

/** Comparação de segredo em tempo constante. */
export function secretMatches(received: string | null | undefined, expected: string | undefined): boolean {
  if (!received || !expected) return false;
  const a = Buffer.from(received);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
