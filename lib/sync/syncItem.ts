import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { pluggyApi, type PluggyApi } from "@/lib/pluggy/client";
import { mapTransactions, type ExistingTx } from "./mapping";
import type { CategorizeContext } from "./categorize";

const INITIAL_HISTORY_DAYS = 365;
const OVERLAP_DAYS = 7; // transações pendentes mudam por alguns dias

const isoDate = (d: Date) => d.toISOString().slice(0, 10);
const daysAgo = (base: Date, n: number) => new Date(base.getTime() - n * 86_400_000);

export interface SyncResult {
  itemId: string;
  status: string;
  accounts: number;
  upserted: number;
  deleted: number;
}

/**
 * Sincroniza um item da Pluggy (uma conexão bancária) para o banco.
 * Usa o client admin: é chamado por rotas de servidor que já validaram a posse.
 */
export async function syncItem(
  db: SupabaseClient,
  pluggyItemId: string,
  api: PluggyApi = pluggyApi,
): Promise<SyncResult> {
  const { data: conn, error: connErr } = await db
    .from("bank_connections")
    .select("id, user_id, last_synced_at")
    .eq("pluggy_item_id", pluggyItemId)
    .single();
  if (connErr || !conn) throw new Error(`Conexão não encontrada para item ${pluggyItemId}`);

  const item = await api.getItem(pluggyItemId);
  await db
    .from("bank_connections")
    .update({
      status: item.status,
      error: item.error?.message ?? null,
      connector_name: item.connector?.name,
      connector_image_url: item.connector?.imageUrl ?? null,
    })
    .eq("id", conn.id);

  const result: SyncResult = { itemId: pluggyItemId, status: item.status, accounts: 0, upserted: 0, deleted: 0 };
  // enquanto a Pluggy ainda está coletando, aguardamos o webhook item/updated
  if (item.status === "UPDATING") return result;

  const ctx = await loadCategorizeContext(db, conn.user_id);
  const now = new Date();
  const from = isoDate(
    conn.last_synced_at ? daysAgo(new Date(conn.last_synced_at), OVERLAP_DAYS) : daysAgo(now, INITIAL_HISTORY_DAYS),
  );
  const to = isoDate(daysAgo(now, -1));

  const accounts = await api.listAccounts(pluggyItemId);
  for (const acc of accounts) {
    const { data: accRow, error: accErr } = await db
      .from("accounts")
      .upsert(
        {
          user_id: conn.user_id,
          connection_id: conn.id,
          pluggy_account_id: acc.id,
          name: acc.marketingName || acc.name,
          type: acc.type,
          subtype: acc.subtype ?? null,
          number: acc.number ?? null,
          balance: acc.balance ?? 0,
          currency: acc.currencyCode ?? "BRL",
          updated_at: now.toISOString(),
        },
        { onConflict: "pluggy_account_id" },
      )
      .select("id")
      .single();
    if (accErr || !accRow) throw new Error(`Falha ao salvar conta: ${accErr?.message}`);
    result.accounts++;

    const pluggyTxs = await api.listTransactions(acc.id, from, to);

    const { data: existingRows, error: exErr } = await db
      .from("transactions")
      .select("pluggy_transaction_id, category_id, category_source, ignored")
      .eq("account_id", accRow.id)
      .gte("date", from);
    if (exErr) throw new Error(exErr.message);
    const existing = new Map<string, ExistingTx>((existingRows ?? []).map((r) => [r.pluggy_transaction_id, r]));

    const rows = mapTransactions({ userId: conn.user_id, accountId: accRow.id, transactions: pluggyTxs, existing, ctx });
    for (let i = 0; i < rows.length; i += 500) {
      const { error } = await db.from("transactions").upsert(rows.slice(i, i + 500), { onConflict: "pluggy_transaction_id" });
      if (error) throw new Error(`Falha ao salvar transações: ${error.message}`);
    }
    result.upserted += rows.length;

    // transações removidas na origem (ex.: pendente que virou outra) dentro da janela
    const fetchedIds = new Set(pluggyTxs.map((t) => t.id));
    const stale = [...existing.keys()].filter((id) => !fetchedIds.has(id));
    if (stale.length) {
      await db.from("transactions").delete().in("pluggy_transaction_id", stale);
      result.deleted += stale.length;
    }
  }

  await db.from("bank_connections").update({ last_synced_at: now.toISOString() }).eq("id", conn.id);
  return result;
}

export async function loadCategorizeContext(db: SupabaseClient, userId: string): Promise<CategorizeContext> {
  const [cats, rules, maps] = await Promise.all([
    db.from("categories").select("id, name, kind").eq("user_id", userId),
    db.from("category_rules").select("match, category_id, priority").eq("user_id", userId),
    db.from("category_mappings").select("pluggy_category, category_id").eq("user_id", userId),
  ]);
  return { categories: cats.data ?? [], rules: rules.data ?? [], mappings: maps.data ?? [] };
}
