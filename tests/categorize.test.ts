import { describe, expect, it } from "vitest";
import { categorize, type CategorizeContext } from "@/lib/sync/categorize";

const categories = [
  { id: "c-sal", name: "Salário", kind: "income" as const },
  { id: "c-outras-rec", name: "Outras receitas", kind: "income" as const },
  { id: "c-alim", name: "Alimentação", kind: "expense" as const },
  { id: "c-merc", name: "Mercado", kind: "expense" as const },
  { id: "c-outros", name: "Outros", kind: "expense" as const },
  { id: "c-transf", name: "Transferências", kind: "transfer" as const },
  { id: "c-fatura", name: "Pagamento de fatura", kind: "transfer" as const },
];
const base: CategorizeContext = { categories, rules: [], mappings: [] };

describe("categorize", () => {
  it("usa o mapeamento padrão por palavra-chave", () => {
    expect(categorize({ description: "PAO DE ACUCAR", amount: -120, pluggyCategory: "Groceries" }, base)).toEqual({
      categoryId: "c-merc",
      source: "auto",
    });
    expect(categorize({ description: "IFOOD", amount: -45, pluggyCategory: "Food delivery" }, base).categoryId).toBe("c-alim");
    expect(categorize({ description: "PGTO FATURA", amount: -900, pluggyCategory: "Credit card payment" }, base).categoryId).toBe("c-fatura");
    expect(categorize({ description: "EMPRESA X", amount: 5000, pluggyCategory: "Salary" }, base).categoryId).toBe("c-sal");
  });

  it("regra do usuário vence o mapeamento, ignorando acentos e caixa", () => {
    const ctx = { ...base, rules: [{ match: "padaria", category_id: "c-alim", priority: 0 }] };
    expect(categorize({ description: "PADÁRIA DO ZÉ", amount: -10, pluggyCategory: "Groceries" }, ctx)).toEqual({
      categoryId: "c-alim",
      source: "rule",
    });
  });

  it("regra de maior prioridade vence", () => {
    const ctx = {
      ...base,
      rules: [
        { match: "uber", category_id: "c-outros", priority: 0 },
        { match: "uber eats", category_id: "c-alim", priority: 10 },
      ],
    };
    expect(categorize({ description: "UBER EATS *PEDIDO", amount: -30 }, ctx).categoryId).toBe("c-alim");
  });

  it("mapeamento do usuário vence o padrão", () => {
    const ctx = { ...base, mappings: [{ pluggy_category: "groceries", category_id: "c-alim" }] };
    expect(categorize({ description: "X", amount: -1, pluggyCategory: "Groceries" }, ctx).categoryId).toBe("c-alim");
  });

  it("não usa categoria de despesa para entrada (estorno) e cai no fallback", () => {
    expect(categorize({ description: "ESTORNO", amount: 50, pluggyCategory: "Groceries" }, base).categoryId).toBe("c-outras-rec");
    expect(categorize({ description: "???", amount: -5, pluggyCategory: null }, base).categoryId).toBe("c-outros");
  });
});
