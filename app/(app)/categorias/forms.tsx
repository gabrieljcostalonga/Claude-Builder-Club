"use client";
import { useActionState, useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { Button, Input, Label, Select } from "@/components/ui";
import {
  createCategory,
  createRule,
  deleteCategory,
  reapplyAll,
  updateCategory,
  upsertMapping,
  type FormState,
} from "./actions";

type Cat = { id: string; name: string; kind: string; color: string };

function Feedback({ state }: { state: FormState }) {
  if (state.error) return <p role="alert" className="text-xs text-danger">{state.error}</p>;
  if (state.message) return <p className="text-xs text-success">{state.message}</p>;
  return null;
}

export function CategoryOptions({ categories }: { categories: Cat[] }) {
  const groups = [
    ["expense", "Despesas"],
    ["income", "Receitas"],
    ["transfer", "Transferências"],
  ] as const;
  return (
    <>
      {groups.map(([kind, label]) => (
        <optgroup key={kind} label={label}>
          {categories.filter((c) => c.kind === kind).map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </optgroup>
      ))}
    </>
  );
}

export function NewCategoryForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(createCategory, {});
  return (
    <form action={action} className="grid grid-cols-[1fr_auto] gap-3 sm:grid-cols-[1fr_9rem_auto_auto] sm:items-end">
      <div className="col-span-2 sm:col-span-1">
        <Label htmlFor="cat-name">Nome</Label>
        <Input id="cat-name" name="name" required maxLength={60} />
      </div>
      <div>
        <Label htmlFor="cat-kind">Tipo</Label>
        <Select id="cat-kind" name="kind" defaultValue="expense">
          <option value="expense">Despesa</option>
          <option value="income">Receita</option>
          <option value="transfer">Transferência</option>
        </Select>
      </div>
      <div>
        <Label htmlFor="cat-color">Cor</Label>
        <Input id="cat-color" name="color" type="color" defaultValue="#0ea5e9" className="h-[38px] w-14 p-1" />
      </div>
      <Button type="submit" disabled={pending} className="col-span-2 sm:col-span-1">Adicionar</Button>
      <div className="col-span-full"><Feedback state={state} /></div>
    </form>
  );
}

export function CategoryRow({ category }: { category: Cat }) {
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();

  if (!editing) {
    return (
      <li className="flex items-center justify-between py-2 text-sm">
        <span className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-full" style={{ background: category.color }} />
          {category.name}
        </span>
        <span className="flex gap-1">
          <Button variant="ghost" className="px-2 py-1" onClick={() => setEditing(true)}>Editar</Button>
          <Button
            variant="ghost"
            className="px-2 py-1"
            aria-label={`Excluir ${category.name}`}
            disabled={pending}
            onClick={() => {
              if (!confirm(`Excluir “${category.name}”? As transações dela ficarão sem categoria.`)) return;
              start(async () => setError((await deleteCategory(category.id)).error));
            }}
          >
            <Trash2 size={14} />
          </Button>
        </span>
        {error && <span className="text-xs text-danger">{error}</span>}
      </li>
    );
  }

  return (
    <li className="py-2">
      <form
        className="flex flex-wrap items-center gap-2"
        action={(form) =>
          start(async () => {
            const res = await updateCategory(category.id, form);
            setError(res.error);
            if (!res.error) setEditing(false);
          })
        }
      >
        <Input name="name" defaultValue={category.name} required maxLength={60} className="min-w-0 flex-1" />
        <input type="hidden" name="kind" value={category.kind} />
        <Input name="color" type="color" defaultValue={category.color} className="h-[38px] w-12 p-1" />
        <Button type="submit" disabled={pending}>Salvar</Button>
        <Button type="button" variant="ghost" onClick={() => setEditing(false)}>Cancelar</Button>
        {error && <p className="w-full text-xs text-danger">{error}</p>}
      </form>
    </li>
  );
}

export function NewRuleForm({ categories }: { categories: Cat[] }) {
  const [state, action, pending] = useActionState<FormState, FormData>(createRule, {});
  return (
    <form action={action} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-[1fr_1fr_5rem]">
        <div>
          <Label htmlFor="rule-match">Descrição contém</Label>
          <Input id="rule-match" name="match" placeholder="ex.: IFOOD" required minLength={2} maxLength={100} />
        </div>
        <div>
          <Label htmlFor="rule-cat">Categoria</Label>
          <Select id="rule-cat" name="category_id" required defaultValue="">
            <option value="" disabled>Escolha…</option>
            <CategoryOptions categories={categories} />
          </Select>
        </div>
        <div>
          <Label htmlFor="rule-prio">Prioridade</Label>
          <Input id="rule-prio" name="priority" type="number" min={0} max={100} defaultValue={0} />
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label className="flex items-center gap-2 text-sm text-muted">
          <input type="checkbox" name="apply" defaultChecked /> Aplicar às transações existentes
        </label>
        <Button type="submit" disabled={pending}>Criar regra</Button>
      </div>
      <Feedback state={state} />
    </form>
  );
}

export function NewMappingForm({ categories, pluggyCategories }: { categories: Cat[]; pluggyCategories: string[] }) {
  const [state, action, pending] = useActionState<FormState, FormData>(upsertMapping, {});
  return (
    <form action={action} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label htmlFor="map-pluggy">Categoria da Pluggy</Label>
          <Select id="map-pluggy" name="pluggy_category" required>
            {pluggyCategories.map((p) => (
              <option key={p}>{p}</option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="map-cat">Vai para</Label>
          <Select id="map-cat" name="category_id" required defaultValue="">
            <option value="" disabled>Escolha…</option>
            <CategoryOptions categories={categories} />
          </Select>
        </div>
      </div>
      <div className="flex items-center justify-between gap-2">
        <Feedback state={state} />
        <Button type="submit" disabled={pending} className="ml-auto">Salvar mapeamento</Button>
      </div>
    </form>
  );
}

export function DeleteButton({ action }: { action: () => Promise<FormState> }) {
  const [pending, start] = useTransition();
  return (
    <Button variant="ghost" className="px-2 py-1" aria-label="Excluir" disabled={pending} onClick={() => start(async () => { await action(); })}>
      <Trash2 size={14} />
    </Button>
  );
}

export function ReapplyButton() {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string>();
  return (
    <div className="flex items-center gap-3">
      {msg && <span className="text-xs text-muted">{msg}</span>}
      <Button
        variant="secondary"
        disabled={pending}
        onClick={() => start(async () => { const r = await reapplyAll(); setMsg(r.error ?? r.message); })}
      >
        {pending ? "Recategorizando…" : "Reaplicar regras"}
      </Button>
    </div>
  );
}
