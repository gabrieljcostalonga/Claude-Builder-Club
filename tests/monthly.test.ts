import { describe, expect, it } from "vitest";
import { monthRange, shiftMonth, summarizeMonth } from "@/lib/finance/monthly";

const categories = [
  { id: "sal", name: "Salário", kind: "income" as const, color: "#0f0" },
  { id: "merc", name: "Mercado", kind: "expense" as const, color: "#f00" },
  { id: "alim", name: "Alimentação", kind: "expense" as const, color: "#fa0" },
  { id: "fat", name: "Pagamento de fatura", kind: "transfer" as const, color: "#333" },
];

describe("monthRange / shiftMonth", () => {
  it("calcula limites do mês", () => {
    expect(monthRange("2026-02")).toEqual({ start: "2026-02-01", end: "2026-03-01", days: 28 });
    expect(monthRange("2026-12")).toEqual({ start: "2026-12-01", end: "2027-01-01", days: 31 });
    expect(() => monthRange("2026-13")).toThrow();
  });
  it("navega entre meses", () => {
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
    expect(shiftMonth("2026-12", 1)).toBe("2027-01");
  });
});

describe("summarizeMonth", () => {
  const s = summarizeMonth({
    month: "2026-11",
    categories,
    budgets: [
      { category_id: "merc", limit_amount: 500 },
      { category_id: "alim", limit_amount: 100 },
    ],
    transactions: [
      { date: "2026-11-05", amount: 5000, ignored: false, category_id: "sal" },
      { date: "2026-11-05", amount: -300, ignored: false, category_id: "merc" },
      { date: "2026-11-10", amount: -150, ignored: false, category_id: "alim" },
      { date: "2026-11-10", amount: -50.5, ignored: false, category_id: null },
      { date: "2026-11-15", amount: -2000, ignored: false, category_id: "fat" }, // transferência: fora
      { date: "2026-11-16", amount: -999, ignored: true, category_id: "merc" }, // ignorada: fora
      { date: "2026-10-31", amount: -77, ignored: false, category_id: "merc" }, // outro mês: fora
    ],
  });

  it("soma entradas, saídas e saldo excluindo transferências e ignoradas", () => {
    expect(s.income).toBe(5000);
    expect(s.expenses).toBe(500.5);
    expect(s.balance).toBe(4499.5);
  });

  it("agrupa por categoria em ordem decrescente", () => {
    expect(s.expensesByCategory.map((c) => [c.name, c.total])).toEqual([
      ["Mercado", 300],
      ["Alimentação", 150],
      ["Sem categoria", 50.5],
    ]);
  });

  it("gera série diária acumulada", () => {
    expect(s.dailyExpenses).toHaveLength(30);
    expect(s.dailyExpenses[4]).toEqual({ day: 5, total: 300, cumulative: 300 });
    expect(s.dailyExpenses[29].cumulative).toBe(500.5);
  });

  it("calcula progresso dos orçamentos", () => {
    expect(s.budgets).toEqual([
      expect.objectContaining({ name: "Alimentação", spent: 150, limit: 100, pct: 150 }),
      expect.objectContaining({ name: "Mercado", spent: 300, limit: 500, pct: 60 }),
    ]);
  });
});
