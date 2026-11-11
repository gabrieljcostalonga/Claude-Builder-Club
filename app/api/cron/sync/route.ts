import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { syncItem } from "@/lib/sync/syncItem";
import { refreshItem } from "@/lib/pluggy/client";
import { secretMatches } from "@/lib/security/secret";

export const maxDuration = 300;

/** Rotina diária: sincroniza todas as conexões (redundância ao webhook). */
export async function GET(request: NextRequest) {
  const auth = request.headers.get("authorization")?.replace(/^Bearer /, "");
  if (!secretMatches(auth, process.env.CRON_SECRET)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const db = createAdminClient();
  const { data: conns, error } = await db.from("bank_connections").select("pluggy_item_id");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const results = [];
  for (const { pluggy_item_id } of conns ?? []) {
    try {
      results.push(await syncItem(db, pluggy_item_id));
      await refreshItem(pluggy_item_id).catch(() => undefined);
    } catch (e) {
      results.push({ itemId: pluggy_item_id, error: e instanceof Error ? e.message : String(e) });
    }
  }
  return NextResponse.json({ ok: true, results });
}
