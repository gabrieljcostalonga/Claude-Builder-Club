import { currentMonth } from "./monthly";

/** Valida o parâmetro ?mes=YYYY-MM, caindo no mês atual. */
export function parseMonthParam(value: string | string[] | undefined): string {
  const v = Array.isArray(value) ? value[0] : value;
  if (v && /^\d{4}-(0[1-9]|1[0-2])$/.test(v)) return v;
  return currentMonth();
}
