import { requireUser } from "@/lib/supabase/server";
import { Card, CardTitle, EmptyState, PageHeader } from "@/components/ui";
import { MonthPicker } from "@/components/MonthPicker";
import { monthRange } from "@/lib/finance/monthly";
import { parseMonthParam } from "@/lib/finance/params";
import { BudgetInput, CopyBudgetsButton, GoalCard, NewGoalForm } from "./forms";

export const metadata = { title: "Metas · Finanças" };

export default async function MetasPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const month = parseMonthParam((await searchParams).mes);
  const { start, end } = monthRange(month);
  const { supabase } = await requireUser();

  const [{ data: categories }, { data: budgets }, { data: txs }, { data: goals }] = await Promise.all([
    supabase.from("categories").select("id, name, color").eq("kind", "expense").order("name"),
    supabase.from("budgets").select("category_id, limit_amount").eq("month", start),
    supabase.from("transactions").select("category_id, amount").gte("date", start).lt("date", end).lt("amount", 0).eq("ignored", false),
    supabase.from("savings_goals").select("id, name, target_amount, current_amount, deadline").order("created_at"),
  ]);

  const limitBy = new Map((budgets ?? []).map((b) => [b.category_id, Number(b.limit_amount)]));
  const spentBy = new Map<string, number>();
  for (const t of txs ?? []) if (t.category_id) spentBy.set(t.category_id, (spentBy.get(t.category_id) ?? 0) - Number(t.amount));

  return (
    <>
      <PageHeader title="Metas">
        <MonthPicker month={month} basePath="/metas" />
      </PageHeader>

      <div className="grid gap-6 lg:grid-cols-[3fr_2fr]">
        <Card>
          <div className="mb-3 flex items-center justify-between gap-2">
            <CardTitle className="mb-0">Orçamento mensal por categoria</CardTitle>
            <CopyBudgetsButton month={month} />
          </div>
          <p className="mb-4 text-xs text-muted">Defina quanto pretende gastar em cada categoria. Deixe vazio para não acompanhar.</p>
          <ul className="space-y-3">
            {(categories ?? []).map((c) => (
              <BudgetInput
                key={`${month}-${c.id}`}
                month={month}
                category={c}
                limit={limitBy.get(c.id)}
                spent={Math.round((spentBy.get(c.id) ?? 0) * 100) / 100}
              />
            ))}
          </ul>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardTitle>Nova meta de economia</CardTitle>
            <NewGoalForm />
          </Card>
          {goals?.length ? (
            goals.map((g) => (
              <GoalCard
                key={g.id}
                goal={{ ...g, target_amount: Number(g.target_amount), current_amount: Number(g.current_amount) }}
              />
            ))
          ) : (
            <EmptyState>Nenhuma meta de economia ainda. Ex.: reserva de emergência, viagem, entrada do apê.</EmptyState>
          )}
        </div>
      </div>
    </>
  );
}
