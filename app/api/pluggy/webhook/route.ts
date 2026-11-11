import { after, NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { syncItem } from "@/lib/sync/syncItem";
import { secretMatches } from "@/lib/security/secret";
import type { PluggyWebhookEvent } from "@/lib/pluggy/types";

export const maxDuration = 60;

const SYNC_EVENTS = new Set([
  "item/created",
  "item/updated",
  "item/error",
  "item/waiting_user_input",
  "item/login_succeeded",
  "transactions/created",
  "transactions/updated",
  "transactions/deleted",
]);

/**
 * Webhook da Pluggy. Não confiamos no payload: usamos só o itemId e
 * buscamos os dados direto na API da Pluggy.
 */
export async function POST(request: NextRequest) {
  if (!secretMatches(request.nextUrl.searchParams.get("secret"), process.env.PLUGGY_WEBHOOK_SECRET)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as PluggyWebhookEvent | null;
  const itemId = typeof body?.itemId === "string" ? body.itemId : null;
  if (!body || !itemId || !SYNC_EVENTS.has(body.event)) return NextResponse.json({ ok: true, skipped: true });

  const db = createAdminClient();
  const { data: conn } = await db.from("bank_connections").select("id").eq("pluggy_item_id", itemId).maybeSingle();
  // item ainda não registrado pelo app (ex.: item/created antes do onSuccess do widget)
  if (!conn) return NextResponse.json({ ok: true, skipped: true });

  // responde rápido à Pluggy e sincroniza em seguida
  after(async () => {
    try {
      await syncItem(db, itemId);
    } catch (e) {
      console.error("webhook sync", itemId, e);
    }
  });
  return NextResponse.json({ ok: true });
}
