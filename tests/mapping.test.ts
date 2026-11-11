import { describe, expect, it } from "vitest";
import { mapTransactions, signedAmount, toLocalDate } from "@/lib/sync/mapping";
import type { PluggyTransaction } from "@/lib/pluggy/types";

const ctx = {
  categories: [
    { id: "c-merc", name: "Mercado", kind: "expense" as const },
    { id: "c-outros", name: "Outros", kind: "expense" as const },
    { id: "c-outras-rec", name: "Outras receitas", kind: "income" as const },
  ],
  rules: [],
  mappings: [],
};

const tx = (over: Partial<PluggyTransaction>): PluggyTransaction => ({
  id: "t1",
  accountId: "pa1",
  description: "MERCADO BOM",
  amount: 100,
  date: "2026-11-05T03:00:00.000Z",
  category: "Groceries",
  type: "DEBIT",
  status: "POSTED",
  currencyCode: "BRL",
  ...over,
});

describe("signedAmount / toLocalDate", () => {
  it("DEBIT é negativo e CREDIT positivo independentemente do sinal original", () => {
    expect(signedAmount({ amount: 10.005, type: "DEBIT" })).toBe(-10.01);
    expect(signedAmount({ amount: -10, type: "DEBIT" })).toBe(-10);
    expect(signedAmount({ amount: -10, type: "CREDIT" })).toBe(10);
  });
  it("converte para a data local de São Paulo", () => {
    expect(toLocalDate("2026-11-01T02:00:00.000Z")).toBe("2026-10-31");
    expect(toLocalDate("2026-11-01")).toBe("2026-11-01");
  });
});

describe("mapTransactions", () => {
  it("categoriza transações novas", () => {
    const [row] = mapTransactions({ userId: "u", accountId: "a", transactions: [tx({})], existing: new Map(), ctx });
    expect(row).toMatchObject({
      user_id: "u",
      account_id: "a",
      pluggy_transaction_id: "t1",
      date: "2026-11-05",
      amount: -100,
      category_id: "c-merc",
      category_source: "auto",
      ignored: false,
    });
  });

  it("preserva categoria manual e flag ignorado em re-sincronizações", () => {
    const existing = new Map([
      ["t1", { pluggy_transaction_id: "t1", category_id: "c-outros", category_source: "manual" as const, ignored: true }],
    ]);
    const [row] = mapTransactions({ userId: "u", accountId: "a", transactions: [tx({})], existing, ctx });
    expect(row.category_id).toBe("c-outros");
    expect(row.category_source).toBe("manual");
    expect(row.ignored).toBe(true);
  });

  it("recategoriza transações automáticas existentes", () => {
    const existing = new Map([
      ["t1", { pluggy_transaction_id: "t1", category_id: "c-outros", category_source: "auto" as const, ignored: false }],
    ]);
    const [row] = mapTransactions({ userId: "u", accountId: "a", transactions: [tx({})], existing, ctx });
    expect(row.category_id).toBe("c-merc");
  });
});
