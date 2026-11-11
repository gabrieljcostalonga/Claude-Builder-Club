import { requireUser } from "@/lib/supabase/server";
import { Card, EmptyState, Input, PageHeader, Select, Button } from "@/components/ui";
import { MonthPicker } from "@/components/MonthPicker";
import { monthRange } from "@/lib/finance/monthly";
import { parseMonthParam } from "@/lib/finance/params";
import { formatBRL } from "@/lib/format";
import { TransactionRow } from "./TransactionRow";

export const metadata = { title: "Transações · Finanças" };

type SP = Promise<Record<string, string | string[] | undefined>>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) || undefined;
const isUuid = (v?: string) => !!v && /^[0-9a-f-]{36}$/i.test(v);

export default async function TransacoesPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const month = parseMonthParam(sp.mes);
  const conta = one(sp.conta);
  const categoria = one(sp.categoria);
  const q = one(sp.q)?.slice(0, 100);
  const { start, end } = monthRange(month);

  const { supabase } = await requireUser();
  let query = supabase
    .from("transactions")
    .select("id, date, description, amount, status, ignored, category_id, category_source, pluggy_category, accounts(name, type)")
    .gte("date", start)
    .lt("date", end)
    .order("date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(1000);
  if (isUuid(conta)) query = query.eq("account_id", conta!);
  if (categoria === "sem") query = query.is("category_id", null);
  else if (isUuid(categoria)) query = query.eq("category_id", categoria!);
  if (q) query = query.ilike("description", `%${q.replace(/[%_\\]/g, (c) => `\\${c}`)}%`);

  const [{ data: txs }, { data: categories }, { data: accounts }] = await Promise.all([
    query,
    supabase.from("categories").select("id, name, kind, color").order("name"),
    supabase.from("accounts").select("id, name").order("name"),
  ]);

  const total = (txs ?? []).filter((t) => !t.ignored).reduce((s, t) => s + Number(t.amount), 0);

  return (
    <>
      <PageHeader title="Transações">
        <MonthPicker month={month} basePath="/transacoes" params={{ conta, categoria, q }} />
      </PageHeader>

      <form className="mb-4 grid gap-2 sm:grid-cols-[1fr_12rem_12rem_auto]">
        <input type="hidden" name="mes" value={month} />
        <Input name="q" placeholder="Buscar descrição…" defaultValue={q} aria-label="Buscar" />
        <Select name="conta" defaultValue={conta ?? ""} aria-label="Conta">
          <option value="">Todas as contas</option>
          {accounts?.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </Select>
        <Select name="categoria" defaultValue={categoria ?? ""} aria-label="Categoria">
          <option value="">Todas as categorias</option>
          <option value="sem">Sem categoria</option>
          {categories?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </Select>
        <Button type="submit" variant="secondary">Filtrar</Button>
      </form>

      {!txs?.length ? (
        <EmptyState>Nenhuma transação neste período.</EmptyState>
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="border-b border-border text-left text-xs text-muted">
              <tr>
                <th className="px-4 py-3 font-medium">Data</th>
                <th className="px-4 py-3 font-medium">Descrição</th>
                <th className="px-4 py-3 font-medium">Categoria</th>
                <th className="px-4 py-3 text-right font-medium">Valor</th>
                <th className="px-4 py-3 text-center font-medium" title="Ignorar no resumo">Ignorar</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {txs.map((t) => (
                <TransactionRow
                  key={t.id}
                  tx={{
                    ...t,
                    amount: Number(t.amount),
                    account: (Array.isArray(t.accounts) ? t.accounts[0] : t.accounts)?.name ?? "",
                  }}
                  categories={categories ?? []}
                />
              ))}
            </tbody>
            <tfoot className="border-t border-border">
              <tr>
                <td colSpan={3} className="px-4 py-3 text-right text-xs text-muted">
                  {txs.length} transações · total líquido (sem ignoradas)
                </td>
                <td className={`tabular px-4 py-3 text-right font-semibold ${total < 0 ? "text-danger" : "text-success"}`}>
                  {formatBRL(total)}
                </td>
                <td />
              </tr>
            </tfoot>
          </table>
        </Card>
      )}
    </>
  );
}
