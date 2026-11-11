"use client";
import Link from "next/link";
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatBRL } from "@/lib/format";
import type { CategoryTotal } from "@/lib/finance/monthly";

const compact = new Intl.NumberFormat("pt-BR", { notation: "compact", maximumFractionDigits: 1 });
const MAX_BARS = 8;

/**
 * Barras horizontais ordenadas (magnitude), um único tom. Cada linha leva à
 * lista de transações filtrada. A bolinha mostra a cor da categoria para identificação.
 */
export function CategoryBars({ data, month }: { data: CategoryTotal[]; month: string }) {
  const top = data.slice(0, MAX_BARS);
  const rest = data.slice(MAX_BARS);
  const rows = rest.length
    ? [...top, { categoryId: "__other", name: `Outras (${rest.length})`, color: "#94a3b8", total: rest.reduce((s, r) => s + r.total, 0) }]
    : top;
  const max = Math.max(...rows.map((r) => r.total));
  const sum = data.reduce((s, r) => s + r.total, 0);

  return (
    <ul className="space-y-2.5">
      {rows.map((r) => {
        const pct = sum ? Math.round((r.total / sum) * 100) : 0;
        const href =
          r.categoryId === "__other" ? null : `/transacoes?mes=${month}&categoria=${r.categoryId ?? "sem"}`;
        const content = (
          <>
            <div className="mb-1 flex items-center justify-between gap-2 text-sm">
              <span className="flex min-w-0 items-center gap-2">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: r.color }} />
                <span className="truncate">{r.name}</span>
              </span>
              <span className="tabular shrink-0 text-muted">
                {formatBRL(r.total)} <span className="text-xs">· {pct}%</span>
              </span>
            </div>
            <div className="h-2 rounded-r bg-transparent">
              <div className="h-full rounded-r-[4px]" style={{ width: `${(r.total / max) * 100}%`, background: "var(--series-1)" }} />
            </div>
          </>
        );
        return (
          <li key={r.categoryId ?? "sem"} title={`${r.name}: ${formatBRL(r.total)} (${pct}% dos gastos)`}>
            {href ? <Link href={href} className="block rounded-md p-1 -m-1 hover:bg-bg">{content}</Link> : content}
          </li>
        );
      })}
    </ul>
  );
}

type Point = { day: number; atual: number | null; anterior: number | null };

export function CumulativeChart({ data }: { data: Point[] }) {
  return (
    <div className="h-64" role="img" aria-label="Gasto acumulado por dia, mês atual comparado ao anterior">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid stroke="var(--grid)" vertical={false} />
          <XAxis dataKey="day" tickLine={false} axisLine={false} tick={{ fill: "var(--muted)", fontSize: 12 }} interval="preserveStartEnd" />
          <YAxis
            tickLine={false}
            axisLine={false}
            width={48}
            tick={{ fill: "var(--muted)", fontSize: 12 }}
            tickFormatter={(v: number) => compact.format(v)}
          />
          <Tooltip
            cursor={{ stroke: "var(--muted)", strokeDasharray: "3 3" }}
            contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }}
            labelStyle={{ color: "var(--text)" }}
            itemStyle={{ color: "var(--text)" }}
            labelFormatter={(d) => `Dia ${d}`}
            formatter={(v, name) => [v == null ? "—" : formatBRL(Number(v)), name === "atual" ? "Este mês" : "Mês anterior"]}
          />
          <Legend
            iconType="plainline"
            wrapperStyle={{ fontSize: 12, color: "var(--muted)" }}
            formatter={(name) => <span style={{ color: "var(--muted)" }}>{name === "atual" ? "Este mês" : "Mês anterior"}</span>}
          />
          <Line type="monotone" dataKey="anterior" stroke="var(--series-ref)" strokeWidth={2} strokeDasharray="4 4" dot={false} connectNulls />
          <Line type="monotone" dataKey="atual" stroke="var(--series-1)" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
