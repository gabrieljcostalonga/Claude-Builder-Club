export type CategoryKind = "income" | "expense" | "transfer";

export interface CategoryRef {
  id: string;
  name: string;
  kind: CategoryKind;
}

export interface CategoryRule {
  match: string;
  category_id: string;
  priority: number;
}

export interface CategoryMapping {
  pluggy_category: string;
  category_id: string;
}

export interface CategorizeContext {
  categories: CategoryRef[];
  rules: CategoryRule[];
  mappings: CategoryMapping[];
}

export interface CategorizeResult {
  categoryId: string | null;
  source: "auto" | "rule";
}

/**
 * Mapeamento padrão: palavras-chave da categoria da Pluggy (em inglês) ->
 * nome da categoria padrão do app. A ordem importa: o primeiro que casar vence.
 */
export const DEFAULT_PLUGGY_KEYWORDS: Array<[RegExp, string]> = [
  [/credit card payment|card payment/i, "Pagamento de fatura"],
  [/same person transfer|transfer/i, "Transferências"],
  [/salary|wage|payroll/i, "Salário"],
  [/investment income|interest|dividend|yield/i, "Rendimentos"],
  [/investment|savings/i, "Aplicações"],
  [/supermarket|groceries|grocery/i, "Mercado"],
  [/food|restaurant|eating|delivery|bakery/i, "Alimentação"],
  [/rent|housing|condominium|mortgage|electricity|water|gas|utilities/i, "Moradia"],
  [/transport|taxi|ride|fuel|gas station|parking|toll|vehicle|public transport/i, "Transporte"],
  [/health|pharmacy|drugstore|hospital|doctor|dentist|gym|wellness/i, "Saúde"],
  [/education|school|university|course|book/i, "Educação"],
  [/travel|airline|hotel|accommodation|tourism/i, "Viagem"],
  [/leisure|entertainment|cinema|game|sport|bar|nightlife/i, "Lazer"],
  [/digital service|streaming|subscription|telecom|internet|phone|service/i, "Serviços e assinaturas"],
  [/tax|fee|fine|bank fee|interest charge|iof|tariff/i, "Impostos e taxas"],
  [/shopping|clothing|electronics|retail|online shopping|store/i, "Compras"],
];

const normalize = (s: string) =>
  s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().trim();

/**
 * Ordem de prioridade:
 *  1. regras do usuário por descrição (maior prioridade primeiro)
 *  2. mapeamento do usuário (categoria Pluggy exata)
 *  3. mapeamento padrão por palavras-chave
 *  4. fallback: "Outras receitas" (entrada) ou "Outros" (saída)
 */
export function categorize(
  tx: { description: string; amount: number; pluggyCategory?: string | null },
  ctx: CategorizeContext,
): CategorizeResult {
  const desc = normalize(tx.description);
  const rules = [...ctx.rules].sort((a, b) => b.priority - a.priority || b.match.length - a.match.length);
  for (const rule of rules) {
    if (desc.includes(normalize(rule.match))) return { categoryId: rule.category_id, source: "rule" };
  }

  const byName = new Map(ctx.categories.map((c) => [normalize(c.name), c]));
  const pluggyCategory = tx.pluggyCategory?.trim();

  if (pluggyCategory) {
    const mapping = ctx.mappings.find((m) => normalize(m.pluggy_category) === normalize(pluggyCategory));
    if (mapping) return { categoryId: mapping.category_id, source: "auto" };

    for (const [re, name] of DEFAULT_PLUGGY_KEYWORDS) {
      if (!re.test(pluggyCategory)) continue;
      const cat = byName.get(normalize(name));
      // não aceita mapear uma entrada para categoria de despesa (ex.: estorno) nem o contrário
      if (cat && kindMatchesAmount(cat.kind, tx.amount)) return { categoryId: cat.id, source: "auto" };
    }
  }

  const fallback = byName.get(normalize(tx.amount >= 0 ? "Outras receitas" : "Outros"));
  return { categoryId: fallback?.id ?? null, source: "auto" };
}

function kindMatchesAmount(kind: CategoryKind, amount: number) {
  if (kind === "transfer") return true;
  return kind === "income" ? amount >= 0 : amount < 0;
}
