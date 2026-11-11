"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createConnectToken, deleteItem, getItem, refreshItem } from "@/lib/pluggy/client";
import { syncItem } from "@/lib/sync/syncItem";

type Result<T = undefined> = { ok: true; data?: T } | { ok: false; error: string };

const uuid = z.string().uuid();
const pluggyId = z.string().min(1).max(100);

function webhookUrl() {
  const base = process.env.APP_URL;
  const secret = process.env.PLUGGY_WEBHOOK_SECRET;
  // a Pluggy só aceita webhooks HTTPS públicos
  if (!base?.startsWith("https://") || !secret) return undefined;
  return `${base}/api/pluggy/webhook?secret=${encodeURIComponent(secret)}`;
}

/** Busca a conexão garantindo que pertence ao usuário logado (RLS). */
async function ownConnection(connectionId: string) {
  const { supabase } = await requireUser();
  const { data } = await supabase
    .from("bank_connections")
    .select("id, pluggy_item_id")
    .eq("id", uuid.parse(connectionId))
    .single();
  if (!data) throw new Error("Conexão não encontrada");
  return data;
}

export async function getConnectToken(connectionId?: string): Promise<Result<string>> {
  try {
    const { user } = await requireUser();
    const itemId = connectionId ? (await ownConnection(connectionId)).pluggy_item_id : undefined;
    const token = await createConnectToken({ clientUserId: user.id, itemId, webhookUrl: webhookUrl() });
    return { ok: true, data: token };
  } catch (e) {
    console.error("connect token", e);
    return { ok: false, error: "Não foi possível iniciar a conexão com a Pluggy." };
  }
}

/** Chamado pelo widget após conectar um banco. */
export async function registerConnection(itemId: string): Promise<Result> {
  try {
    const { user } = await requireUser();
    const item = await getItem(pluggyId.parse(itemId));
    // garante que o item foi criado com o connect token deste usuário
    if (item.clientUserId !== user.id) return { ok: false, error: "Conexão inválida." };

    const admin = createAdminClient();
    const { data: existing } = await admin
      .from("bank_connections")
      .select("user_id")
      .eq("pluggy_item_id", item.id)
      .maybeSingle();
    if (existing && existing.user_id !== user.id) return { ok: false, error: "Conexão inválida." };

    const { error } = await admin.from("bank_connections").upsert(
      {
        user_id: user.id,
        pluggy_item_id: item.id,
        connector_name: item.connector?.name,
        connector_image_url: item.connector?.imageUrl ?? null,
        status: item.status,
      },
      { onConflict: "pluggy_item_id" },
    );
    if (error) throw error;

    await syncItem(admin, item.id);
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (e) {
    console.error("register connection", e);
    return { ok: false, error: "Banco conectado, mas a sincronização falhou. Tente “Sincronizar agora”." };
  }
}

export async function syncConnection(connectionId: string): Promise<Result> {
  try {
    const conn = await ownConnection(connectionId);
    await syncItem(createAdminClient(), conn.pluggy_item_id);
    // pede dados novos ao banco; o webhook item/updated sincroniza quando terminar
    await refreshItem(conn.pluggy_item_id).catch((e) => console.warn("refresh item", e));
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (e) {
    console.error("sync connection", e);
    return { ok: false, error: "Falha ao sincronizar." };
  }
}

export async function removeConnection(connectionId: string): Promise<Result> {
  try {
    const conn = await ownConnection(connectionId);
    await deleteItem(conn.pluggy_item_id).catch((e) => console.warn("delete item na Pluggy", e));
    const { error } = await createAdminClient().from("bank_connections").delete().eq("id", conn.id);
    if (error) throw error;
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (e) {
    console.error("remove connection", e);
    return { ok: false, error: "Falha ao remover a conexão." };
  }
}
