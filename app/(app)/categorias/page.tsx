import { requireUser } from "@/lib/supabase/server";
import { Card, CardTitle, EmptyState, PageHeader } from "@/components/ui";
import { CategoryRow, DeleteButton, NewCategoryForm, NewMappingForm, NewRuleForm, ReapplyButton } from "./forms";
import { deleteMapping, deleteRule } from "./actions";

export const metadata = { title: "Categorias · Finanças" };

const KIND_LABEL = { expense: "Despesas", income: "Receitas", transfer: "Transferências (não contam no resumo)" } as const;

export default async function CategoriasPage() {
  const { supabase } = await requireUser();
  const [{ data: categories }, { data: rules }, { data: mappings }, { data: pluggyCats }] = await Promise.all([
    supabase.from("categories").select("id, name, kind, color").order("name"),
    supabase.from("category_rules").select("id, match, priority, category_id").order("priority", { ascending: false }),
    supabase.from("category_mappings").select("id, pluggy_category, category_id").order("pluggy_category"),
    supabase.from("transactions").select("pluggy_category").not("pluggy_category", "is", null).limit(5000),
  ]);
  const cats = categories ?? [];
  const catName = new Map(cats.map((c) => [c.id, c.name]));
  const seenPluggy = [...new Set((pluggyCats ?? []).map((t) => t.pluggy_category as string))].sort();

  return (
    <>
      <PageHeader title="Categorias">
        <ReapplyButton />
      </PageHeader>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-6">
          {(["expense", "income", "transfer"] as const).map((kind) => (
            <Card key={kind}>
              <CardTitle>{KIND_LABEL[kind]}</CardTitle>
              <ul className="divide-y divide-border">
                {cats.filter((c) => c.kind === kind).map((c) => (
                  <CategoryRow key={c.id} category={c} />
                ))}
              </ul>
            </Card>
          ))}
          <Card>
            <CardTitle>Nova categoria</CardTitle>
            <NewCategoryForm />
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardTitle>Regras por descrição</CardTitle>
            <p className="mb-3 text-xs text-muted">
              Se a descrição da transação contém o texto, ela vai para a categoria escolhida. As regras vencem a
              categorização automática da Pluggy.
            </p>
            <NewRuleForm categories={cats} />
            {rules?.length ? (
              <ul className="mt-4 divide-y divide-border">
                {rules.map((r) => (
                  <li key={r.id} className="flex items-center justify-between py-2 text-sm">
                    <span>
                      <code className="rounded bg-bg px-1.5 py-0.5">{r.match}</code> → {catName.get(r.category_id)}
                      {r.priority > 0 && <span className="ml-2 text-xs text-muted">prioridade {r.priority}</span>}
                    </span>
                    <DeleteButton action={deleteRule.bind(null, r.id)} />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-sm text-muted">Nenhuma regra ainda.</p>
            )}
          </Card>

          <Card>
            <CardTitle>Categorias da Pluggy</CardTitle>
            <p className="mb-3 text-xs text-muted">
              Ajuste para qual categoria sua cada categoria detectada pela Pluggy deve ir.
            </p>
            {seenPluggy.length ? (
              <NewMappingForm categories={cats} pluggyCategories={seenPluggy} />
            ) : (
              <EmptyState>Conecte um banco para ver as categorias detectadas.</EmptyState>
            )}
            {mappings?.length ? (
              <ul className="mt-4 divide-y divide-border">
                {mappings.map((m) => (
                  <li key={m.id} className="flex items-center justify-between py-2 text-sm">
                    <span>
                      {m.pluggy_category} → {catName.get(m.category_id)}
                    </span>
                    <DeleteButton action={deleteMapping.bind(null, m.id)} />
                  </li>
                ))}
              </ul>
            ) : null}
          </Card>
        </div>
      </div>
    </>
  );
}
