import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { shiftMonth } from "@/lib/finance/monthly";
import { formatMonthLabel } from "@/lib/format";

/** Navegação entre meses preservando os demais filtros da URL. */
export function MonthPicker({ month, basePath, params = {} }: { month: string; basePath: string; params?: Record<string, string | undefined> }) {
  const href = (m: string) => {
    const qs = new URLSearchParams(Object.entries({ ...params, mes: m }).filter(([, v]) => v) as [string, string][]);
    return `${basePath}?${qs}`;
  };
  return (
    <div className="flex items-center gap-1 rounded-lg border border-border bg-surface">
      <Link href={href(shiftMonth(month, -1))} className="p-2 text-muted hover:text-text" aria-label="Mês anterior">
        <ChevronLeft size={16} />
      </Link>
      <span className="min-w-36 text-center text-sm font-medium">{formatMonthLabel(month)}</span>
      <Link href={href(shiftMonth(month, 1))} className="p-2 text-muted hover:text-text" aria-label="Próximo mês">
        <ChevronRight size={16} />
      </Link>
    </div>
  );
}
