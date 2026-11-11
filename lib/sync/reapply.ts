import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { categorize } from "./categorize";
import { loadCategorizeContext } from "./syncItem";

/**
 * Recalcula a categoria de todas as transações não categorizadas manualmente.
 * Roda com o client do usuário (RLS garante o escopo). Retorna quantas mudaram.
 */
export async function reapplyCategorization(db: SupabaseClient, userId: string): Promise<number> {
  const ctx = await loadCategorizeContext(db, userId);
  const changes = new Map<string, { categoryId: string | null; source: "auto" | "rule"; ids: string[] }>();

  for (let from = 0; ; from += 1000) {
    const { data, error } = await db
      .from("transactions")
      .select("id, description, amount, pluggy_category, category_id, category_source")
      .neq("category_source", "manual")
      .order("id")
      .range(from, from + 999);
    if (error) throw new Error(error.message);
    for (const tx of data ?? []) {
      const r = categorize(
        { description: tx.description, amount: Number(tx.amount), pluggyCategory: tx.pluggy_category },
        ctx,
      );
      if (r.categoryId === tx.category_id && r.source === tx.category_source) continue;
      const key = `${r.categoryId}|${r.source}`;
      const entry = changes.get(key) ?? { categoryId: r.categoryId, source: r.source, ids: [] };
      entry.ids.push(tx.id);
      changes.set(key, entry);
    }
    if (!data || data.length < 1000) break;
  }

  let count = 0;
  for (const { categoryId, source, ids } of changes.values()) {
    for (let i = 0; i < ids.length; i += 200) {
      const chunk = ids.slice(i, i + 200);
      const { error } = await db
        .from("transactions")
        .update({ category_id: categoryId, category_source: source })
        .in("id", chunk);
      if (error) throw new Error(error.message);
      count += chunk.length;
    }
  }
  return count;
}
