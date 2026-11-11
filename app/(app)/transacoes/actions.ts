"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/supabase/server";
import { reapplyCategorization } from "@/lib/sync/reapply";

type Result = { ok: boolean; error?: string; message?: string };

export async function setTransactionCategory(txId: string, categoryId: string | null): Promise<Result> {
  const id = z.string().uuid().parse(txId);
  const cat = z.string().uuid().nullable().parse(categoryId);
  const { supabase } = await requireUser();
  const { error } = await supabase
    .from("transactions")
    .update({ category_id: cat, category_source: "manual" })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function setTransactionIgnored(txId: string, ignored: boolean): Promise<Result> {
  const { supabase } = await requireUser();
  const { error } = await supabase
    .from("transactions")
    .update({ ignored: z.boolean().parse(ignored) })
    .eq("id", z.string().uuid().parse(txId));
  if (error) return { ok: false, error: error.message };
  revalidatePath("/", "layout");
  return { ok: true };
}

/** Cria uma regra a partir de uma transação e aplica nas demais. */
export async function createRuleFromTransaction(match: string, categoryId: string): Promise<Result> {
  const m = z.string().trim().min(2).max(100).safeParse(match);
  if (!m.success) return { ok: false, error: "Texto da regra inválido." };
  const { supabase, user } = await requireUser();
  const { error } = await supabase
    .from("category_rules")
    .insert({ match: m.data, category_id: z.string().uuid().parse(categoryId), priority: 0, user_id: user.id });
  if (error) return { ok: false, error: error.message };
  const n = await reapplyCategorization(supabase, user.id);
  revalidatePath("/", "layout");
  return { ok: true, message: `Regra criada. ${n} transação(ões) recategorizada(s).` };
}
