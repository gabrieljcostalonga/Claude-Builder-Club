import Link from "next/link";
import { requireUser } from "@/lib/supabase/server";
import { Card, CardTitle, EmptyState, PageHeader } from "@/components/ui";
import { MonthPicker } from "@/components/MonthPicker";
import { monthRange, shiftMonth, summarizeMonth } from "@/lib/finance/monthly";
import { parseMonthParam } from "@/lib/finance/params";
import { formatBRL, formatMonthLabel } from "@/lib/format";
import { ProgressBar } from "../metas/forms";
import { CategoryBars, CumulativeChart } from "./charts";

export const metadata = { title: "Dashboard · Finanças" };

function Delta({ current, previous, invert }: { current: number; previous: number; invert?: boolean }) {
  if (!previous) return <p className="mt-1 text-xs text-muted">sem dados do mês anterior</p>;
  const pct = Math.round(((current - previous) / Math.abs(previous)) * 100);
  const good = invert ? pct <= 0 : pct >= 0;
  return (
    <p className={`mt-1 text-xs ${good ? "text-success" : "text-danger"}`}>
      {pct >= 0 ? "▲" : "▼"} {Math.abs(pct)}% vs. mês anterior
    </p>
  );
}

export default async function DashboardPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const month = parseMonthParam((await searchParams).mes);
  const prevMonth = shiftMonth(month, -1);
  const { start } = monthRange(prevMonth);
  const { end, start: monthStart } = monthRange(month);
  const { supabase } = await requireUser();

  const [{ data: txs }, { data: categories }, { data: budgets }, { data: goals }, { count: connCount }] = await Promise.all([
    supabase.from("transactions").select("date, amount, ignored, category_id").gte("date", start).lt("date", end).limit(10000),
    supabase.from("categories").select("id, name, kind, color"),
    supabase.from("budgets").select("category_id, limit_amount").eq("month", monthStart),
    supabase.from("savings_goals").select("id, name, target_amount, current_amount").order("created_at"),
    supabase.from("bank_connections").select("id", { count: "exact", head: true }),
  ]);

  const transactions = (txs ?? []).map((t) => ({ ...t, amount: Number(t.amount) }));
  const cats = categories ?? [];
  const budgetRows = (budgets ?? []).map((b) => ({ ...b, limit_amount: Number(b.limit_amount) }));
  const s = summarizeMonth({ month, transactions, categories: cats, budgets: budgetRows });
  const p = summarizeMonth({ month: prevMonth, transactions, categories: cats, budgets: [] });

  const cumulative = s.dailyExpenses.map((d) => ({
    day: d.day,
    atual: d.cumulative,
    anterior: p.dailyExpenses[d.day - 1]?.cumulative ?? null,
  }));
  // dias futuros do mês corrente não têm valor ainda
  const today = new Date().toISOString().slice(0, 10);
  const lastDay = today.startsWith(month) ? Number(today.slice(8, 10)) : s.dailyExpenses.length;
  const cumulativeData = cumulative.map((d) => (d.day > lastDay ? { ...d, atual: null } : d));

  if (!connCount && !transactions.length) {
    return (
      <>
        <PageHeader title="Dashboard" />
        <EmptyState>
          Bem-vindo! Comece <Link href="/contas" className="text-primary hover:underline">conectando um banco</Link> para
          importar suas transações automaticamente.
        </EmptyState>
      </>
    );
  }

  return (
    <>
      <PageHeader title="Dashboard">
        <MonthPicker month={month} basePath="/dashboard" />
      </PageHeader>

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Card>
          <CardTitle className="mb-1">Entradas</CardTitle>
          <p className="tabular text-2xl font-semibold">{formatBRL(s.income)}</p>
          <Delta current={s.income} previous={p.income} />
        </Card>
        <Card>
          <CardTitle className="mb-1">Saídas</CardTitle>
          <p className="tabular text-2xl font-semibold">{formatBRL(s.expenses)}</p>
          <Delta current={s.expenses} previous={p.expenses} invert />
        </Card>
        <Card>
          <CardTitle className="mb-1">Saldo do mês</CardTitle>
          <p className={`tabular text-2xl font-semibold ${s.balance < 0 ? "text-danger" : ""}`}>{formatBRL(s.balance)}</p>
          <p className="mt-1 text-xs text-muted">
            {s.income > 0 ? `${Math.round((s.balance / s.income) * 100)}% da renda poupada` : "—"}
          </p>
        </Card>
      </div>

      <div className="mb-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardTitle>Gastos por categoria</CardTitle>
          {s.expensesByCategory.length ? (
            <CategoryBars data={s.expensesByCategory} month={month} />
          ) : (
            <p className="text-sm text-muted">Sem gastos neste mês.</p>
          )}
        </Card>
        <Card>
          <CardTitle>Gasto acumulado — {formatMonthLabel(month)} vs. {formatMonthLabel(prevMonth)}</CardTitle>
          <CumulativeChart data={cumulativeData} />
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <div className="mb-3 flex items-center justify-between">
            <CardTitle className="mb-0">Orçamento do mês</CardTitle>
            <Link href={`/metas?mes=${month}`} className="text-xs text-primary hover:underline">Editar</Link>
          </div>
          {s.budgets.length ? (
            <ul className="space-y-3">
              {s.budgets.map((b) => (
                <li key={b.categoryId}>
                  <div className="mb-1 flex justify-between text-sm">
                    <span>{b.name}</span>
                    <span className={`tabular ${b.pct > 100 ? "text-danger" : "text-muted"}`}>
                      {formatBRL(b.spent)} / {formatBRL(b.limit)} {b.pct > 100 && "⚠ estourou"}
                    </span>
                  </div>
                  <ProgressBar pct={b.pct} color={b.pct >= 80 ? "#d97706" : "var(--series-1)"} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted">
              Nenhum orçamento definido. <Link href={`/metas?mes=${month}`} className="text-primary hover:underline">Criar</Link>
            </p>
          )}
        </Card>
        <Card>
          <div className="mb-3 flex items-center justify-between">
            <CardTitle className="mb-0">Metas de economia</CardTitle>
            <Link href="/metas" className="text-xs text-primary hover:underline">Ver todas</Link>
          </div>
          {goals?.length ? (
            <ul className="space-y-3">
              {goals.map((g) => {
                const pct = Math.round((Number(g.current_amount) / Number(g.target_amount)) * 100);
                return (
                  <li key={g.id}>
                    <div className="mb-1 flex justify-between text-sm">
                      <span>{g.name}</span>
                      <span className="tabular text-muted">{pct}% · {formatBRL(Number(g.current_amount))}</span>
                    </div>
                    <ProgressBar pct={Math.min(pct, 100)} color="var(--success)" />
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-sm text-muted">Nenhuma meta criada.</p>
          )}
        </Card>
      </div>
    </>
  );
}
