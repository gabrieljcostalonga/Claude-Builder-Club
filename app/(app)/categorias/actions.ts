"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/supabase/server";
import { reapplyCategorization } from "@/lib/sync/reapply";

export type FormState = { error?: string; message?: string };

const categorySchema = z.object({
  name: z.string().trim().min(1, "Informe o nome").max(60),
  kind: z.enum(["income", "expense", "transfer"]),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Cor inválida"),
});

const ruleSchema = z.object({
  match: z.string().trim().min(2, "O texto precisa de ao menos 2 caracteres").max(100),
  category_id: z.string().uuid("Escolha uma categoria"),
  priority: z.coerce.number().int().min(0).max(100).default(0),
});

const mappingSchema = z.object({
  pluggy_category: z.string().trim().min(1).max(100),
  category_id: z.string().uuid("Escolha uma categoria"),
});

function done(message?: string): FormState {
  revalidatePath("/", "layout");
  return { message };
}

export async function createCategory(_: FormState, form: FormData): Promise<FormState> {
  const parsed = categorySchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { supabase, user } = await requireUser();
  const { error } = await supabase.from("categories").insert({ ...parsed.data, user_id: user.id });
  if (error) return { error: error.code === "23505" ? "Já existe uma categoria com esse nome." : error.message };
  return done("Categoria criada.");
}

export async function updateCategory(id: string, form: FormData): Promise<FormState> {
  const parsed = categorySchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { supabase } = await requireUser();
  const { error } = await supabase.from("categories").update(parsed.data).eq("id", z.string().uuid().parse(id));
  if (error) return { error: error.message };
  return done();
}

export async function deleteCategory(id: string): Promise<FormState> {
  const { supabase } = await requireUser();
  const { error } = await supabase.from("categories").delete().eq("id", z.string().uuid().parse(id));
  if (error) return { error: error.message };
  return done();
}

export async function createRule(_: FormState, form: FormData): Promise<FormState> {
  const parsed = ruleSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { supabase, user } = await requireUser();
  const { error } = await supabase.from("category_rules").insert({ ...parsed.data, user_id: user.id });
  if (error) return { error: error.message };
  if (form.get("apply") === "on") {
    const n = await reapplyCategorization(supabase, user.id);
    return done(`Regra criada. ${n} transação(ões) recategorizada(s).`);
  }
  return done("Regra criada.");
}

export async function deleteRule(id: string): Promise<FormState> {
  const { supabase } = await requireUser();
  const { error } = await supabase.from("category_rules").delete().eq("id", z.string().uuid().parse(id));
  if (error) return { error: error.message };
  return done();
}

export async function upsertMapping(_: FormState, form: FormData): Promise<FormState> {
  const parsed = mappingSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { supabase, user } = await requireUser();
  const { error } = await supabase
    .from("category_mappings")
    .upsert({ ...parsed.data, user_id: user.id }, { onConflict: "user_id,pluggy_category" });
  if (error) return { error: error.message };
  const n = await reapplyCategorization(supabase, user.id);
  return done(`Mapeamento salvo. ${n} transação(ões) recategorizada(s).`);
}

export async function deleteMapping(id: string): Promise<FormState> {
  const { supabase } = await requireUser();
  const { error } = await supabase.from("category_mappings").delete().eq("id", z.string().uuid().parse(id));
  if (error) return { error: error.message };
  return done();
}

export async function reapplyAll(): Promise<FormState> {
  const { supabase, user } = await requireUser();
  const n = await reapplyCategorization(supabase, user.id);
  return done(`${n} transação(ões) recategorizada(s).`);
}
