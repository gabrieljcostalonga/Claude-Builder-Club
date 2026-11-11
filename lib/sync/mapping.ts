import type { PluggyTransaction } from "@/lib/pluggy/types";
import { categorize, type CategorizeContext } from "./categorize";

export interface ExistingTx {
  pluggy_transaction_id: string;
  category_id: string | null;
  category_source: "auto" | "rule" | "manual";
  ignored: boolean;
}

export interface TransactionRow {
  user_id: string;
  account_id: string;
  pluggy_transaction_id: string;
  date: string;
  description: string;
  amount: number;
  currency: string;
  pluggy_category: string | null;
  status: string | null;
  category_id: string | null;
  category_source: "auto" | "rule" | "manual";
  ignored: boolean;
}

/** Valor com sinal: DEBIT = saída (negativo), CREDIT = entrada (positivo). */
export function signedAmount(tx: Pick<PluggyTransaction, "amount" | "type">): number {
  const abs = Math.round(Math.abs(tx.amount) * 100) / 100;
  return tx.type === "DEBIT" ? -abs : abs;
}

/** Data ISO -> YYYY-MM-DD no fuso de São Paulo (transações à meia-noite UTC não "voltam" um dia). */
export function toLocalDate(iso: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso;
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date(iso)).slice(0, 10);
}

/**
 * Converte transações da Pluggy em linhas do banco.
 * Preserva categorização manual e o flag "ignorar" de transações já existentes.
 */
export function mapTransactions(params: {
  userId: string;
  accountId: string;
  transactions: PluggyTransaction[];
  existing: Map<string, ExistingTx>;
  ctx: CategorizeContext;
}): TransactionRow[] {
  const { userId, accountId, transactions, existing, ctx } = params;

  return transactions.map((tx) => {
    const amount = signedAmount(tx);
    const description = (tx.description || tx.descriptionRaw || "Sem descrição").trim();
    const prev = existing.get(tx.id);

    let categoryId: string | null;
    let source: TransactionRow["category_source"];
    if (prev?.category_source === "manual") {
      categoryId = prev.category_id;
      source = "manual";
    } else {
      const r = categorize({ description, amount, pluggyCategory: tx.category }, ctx);
      categoryId = r.categoryId;
      source = r.source;
    }

    return {
      user_id: userId,
      account_id: accountId,
      pluggy_transaction_id: tx.id,
      date: toLocalDate(tx.date),
      description,
      amount,
      currency: tx.currencyCode ?? "BRL",
      pluggy_category: tx.category ?? null,
      status: tx.status ?? null,
      category_id: categoryId,
      category_source: source,
      ignored: prev?.ignored ?? false,
    };
  });
}
