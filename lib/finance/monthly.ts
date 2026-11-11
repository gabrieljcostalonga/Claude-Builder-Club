import type { CategoryKind } from "@/lib/sync/categorize";

export interface SummaryTx {
  date: string; // YYYY-MM-DD
  amount: number;
  ignored: boolean;
  category_id: string | null;
}

export interface SummaryCategory {
  id: string;
  name: string;
  kind: CategoryKind;
  color: string;
}

export interface SummaryBudget {
  category_id: string;
  limit_amount: number;
}

export interface CategoryTotal {
  categoryId: string | null;
  name: string;
  color: string;
  total: number; // valor positivo gasto/recebido
}

export interface BudgetProgress {
  categoryId: string;
  name: string;
  color: string;
  limit: number;
  spent: number;
  pct: number;
}

export interface MonthlySummary {
  income: number;
  expenses: number; // valor positivo
  balance: number;
  expensesByCategory: CategoryTotal[];
  incomeByCategory: CategoryTotal[];
  dailyExpenses: Array<{ day: number; total: number; cumulative: number }>;
  budgets: BudgetProgress[];
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/** "2026-11" -> { start: "2026-11-01", end: "2026-12-01" } (end exclusivo) */
export function monthRange(month: string): { start: string; end: string; days: number } {
  const m = /^(\d{4})-(\d{2})$/.exec(month);
  if (!m) throw new Error(`Mês inválido: ${month}`);
  const y = Number(m[1]);
  const mo = Number(m[2]);
  if (mo < 1 || mo > 12) throw new Error(`Mês inválido: ${month}`);
  const next = mo === 12 ? `${y + 1}-01` : `${y}-${String(mo + 1).padStart(2, "0")}`;
  const days = new Date(Date.UTC(y, mo, 0)).getUTCDate();
  return { start: `${month}-01`, end: `${next}-01`, days };
}

export function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function currentMonth(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit" })
    .format(now)
    .slice(0, 7);
}

/**
 * Resumo do mês. Ignora transações marcadas como ignoradas e as de categorias
 * do tipo "transfer" (transferências próprias, pagamento de fatura, aplicações),
 * para não contar o mesmo dinheiro duas vezes.
 */
export function summarizeMonth(params: {
  month: string;
  transactions: SummaryTx[];
  categories: SummaryCategory[];
  budgets: SummaryBudget[];
}): MonthlySummary {
  const { month, transactions, categories, budgets } = params;
  const { start, end, days } = monthRange(month);
  const catById = new Map(categories.map((c) => [c.id, c]));

  let income = 0;
  let expenses = 0;
  const expenseMap = new Map<string | null, number>();
  const incomeMap = new Map<string | null, number>();
  const daily = new Array<number>(days).fill(0);

  for (const tx of transactions) {
    if (tx.ignored || tx.date < start || tx.date >= end) continue;
    const cat = tx.category_id ? catById.get(tx.category_id) : undefined;
    if (cat?.kind === "transfer") continue;

    if (tx.amount < 0) {
      const v = -tx.amount;
      expenses += v;
      expenseMap.set(tx.category_id, (expenseMap.get(tx.category_id) ?? 0) + v);
      daily[Number(tx.date.slice(8, 10)) - 1] += v;
    } else {
      income += tx.amount;
      incomeMap.set(tx.category_id, (incomeMap.get(tx.category_id) ?? 0) + tx.amount);
    }
  }

  const toTotals = (map: Map<string | null, number>): CategoryTotal[] =>
    [...map.entries()]
      .map(([id, total]) => {
        const c = id ? catById.get(id) : undefined;
        return { categoryId: id, name: c?.name ?? "Sem categoria", color: c?.color ?? "#94a3b8", total: round2(total) };
      })
      .sort((a, b) => b.total - a.total);

  let cumulative = 0;
  const dailyExpenses = daily.map((total, i) => {
    cumulative += total;
    return { day: i + 1, total: round2(total), cumulative: round2(cumulative) };
  });

  const budgetProgress: BudgetProgress[] = budgets
    .map((b) => {
      const c = catById.get(b.category_id);
      const spent = round2(expenseMap.get(b.category_id) ?? 0);
      const limit = Number(b.limit_amount);
      return {
        categoryId: b.category_id,
        name: c?.name ?? "—",
        color: c?.color ?? "#94a3b8",
        limit,
        spent,
        pct: limit > 0 ? Math.round((spent / limit) * 100) : 0,
      };
    })
    .sort((a, b) => b.pct - a.pct);

  return {
    income: round2(income),
    expenses: round2(expenses),
    balance: round2(income - expenses),
    expensesByCategory: toTotals(expenseMap),
    incomeByCategory: toTotals(incomeMap),
    dailyExpenses,
    budgets: budgetProgress,
  };
}
