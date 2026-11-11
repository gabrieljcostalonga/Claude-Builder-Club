"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/supabase/server";
import { shiftMonth } from "@/lib/finance/monthly";

export type FormState = { error?: string; message?: string };

const monthSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/);
const money = z.coerce.number().finite().min(0).max(1e10);

/** Salva o orçamento de uma categoria no mês. Valor 0 ou vazio remove. */
export async function setBudget(month: string, categoryId: string, value: string): Promise<FormState> {
  const m = monthSchema.parse(month);
  const cat = z.string().uuid().parse(categoryId);
  const parsed = money.safeParse(value.trim() === "" ? 0 : value.replace(",", "."));
  if (!parsed.success) return { error: "Valor inválido." };
  const limit = parsed.data;

  const { supabase, user } = await requireUser();
  const monthDate = `${m}-01`;
  const { error } =
    limit > 0
      ? await supabase
          .from("budgets")
          .upsert({ user_id: user.id, category_id: cat, month: monthDate, limit_amount: limit }, { onConflict: "user_id,category_id,month" })
      : await supabase.from("budgets").delete().eq("category_id", cat).eq("month", monthDate);
  if (error) return { error: error.message };
  revalidatePath("/", "layout");
  return {};
}

export async function copyBudgetsFromPreviousMonth(month: string): Promise<FormState> {
  const m = monthSchema.parse(month);
  const { supabase, user } = await requireUser();
  const { data: prev, error } = await supabase
    .from("budgets")
    .select("category_id, limit_amount")
    .eq("month", `${shiftMonth(m, -1)}-01`);
  if (error) return { error: error.message };
  if (!prev?.length) return { error: "O mês anterior não tem orçamentos." };
  const { error: upErr } = await supabase.from("budgets").upsert(
    prev.map((b) => ({ ...b, user_id: user.id, month: `${m}-01` })),
    { onConflict: "user_id,category_id,month", ignoreDuplicates: true },
  );
  if (upErr) return { error: upErr.message };
  revalidatePath("/", "layout");
  return { message: `${prev.length} orçamento(s) copiado(s).` };
}

const goalSchema = z.object({
  name: z.string().trim().min(1, "Informe o nome").max(80),
  target_amount: z.coerce.number().positive("Valor alvo deve ser positivo").max(1e10),
  current_amount: z.coerce.number().min(0).max(1e10).default(0),
  deadline: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal("").transform(() => undefined)),
});

export async function createGoal(_: FormState, form: FormData): Promise<FormState> {
  const parsed = goalSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { supabase, user } = await requireUser();
  const { error } = await supabase
    .from("savings_goals")
    .insert({ ...parsed.data, deadline: parsed.data.deadline ?? null, user_id: user.id });
  if (error) return { error: error.message };
  revalidatePath("/", "layout");
  return { message: "Meta criada." };
}

/** Soma (ou subtrai, se negativo) um valor ao saldo da meta. */
export async function contributeToGoal(goalId: string, delta: number): Promise<FormState> {
  const id = z.string().uuid().parse(goalId);
  const d = z.number().finite().parse(delta);
  const { supabase } = await requireUser();
  const { data: goal, error } = await supabase.from("savings_goals").select("current_amount").eq("id", id).single();
  if (error || !goal) return { error: "Meta não encontrada." };
  const next = Math.max(0, Math.round((Number(goal.current_amount) + d) * 100) / 100);
  const { error: upErr } = await supabase.from("savings_goals").update({ current_amount: next }).eq("id", id);
  if (upErr) return { error: upErr.message };
  revalidatePath("/", "layout");
  return {};
}

export async function deleteGoal(goalId: string): Promise<FormState> {
  const { supabase } = await requireUser();
  const { error } = await supabase.from("savings_goals").delete().eq("id", z.string().uuid().parse(goalId));
  if (error) return { error: error.message };
  revalidatePath("/", "layout");
  return {};
}
