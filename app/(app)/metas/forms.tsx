"use client";
import { useActionState, useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { Button, Card, Input, Label } from "@/components/ui";
import { formatBRL, formatDate } from "@/lib/format";
import { contributeToGoal, copyBudgetsFromPreviousMonth, createGoal, deleteGoal, setBudget, type FormState } from "./actions";

export function ProgressBar({ pct, color }: { pct: number; color?: string }) {
  const over = pct > 100;
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-border" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
      <div
        className="h-full rounded-full transition-all"
        style={{ width: `${Math.min(pct, 100)}%`, background: over ? "var(--danger)" : (color ?? "var(--primary)") }}
      />
    </div>
  );
}

export function BudgetInput({
  month,
  category,
  limit,
  spent,
}: {
  month: string;
  category: { id: string; name: string; color: string };
  limit?: number;
  spent: number;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string>();
  const pct = limit ? Math.round((spent / limit) * 100) : 0;

  return (
    <li>
      <div className="flex items-center gap-3">
        <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: category.color }} />
        <span className="flex-1 text-sm">{category.name}</span>
        <span className="tabular text-xs text-muted">{formatBRL(spent)} de</span>
        <Input
          aria-label={`Orçamento de ${category.name}`}
          inputMode="decimal"
          placeholder="—"
          defaultValue={limit ?? ""}
          disabled={pending}
          className="w-28 py-1 text-right tabular"
          onBlur={(e) => {
            const v = e.target.value;
            if (String(limit ?? "") === v) return;
            start(async () => setError((await setBudget(month, category.id, v)).error));
          }}
        />
      </div>
      {limit ? <div className="mt-1.5 pl-6"><ProgressBar pct={pct} color={category.color} /></div> : null}
      {error && <p className="pl-6 text-xs text-danger">{error}</p>}
    </li>
  );
}

export function CopyBudgetsButton({ month }: { month: string }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string>();
  return (
    <div className="flex items-center gap-2">
      {msg && <span className="text-xs text-muted">{msg}</span>}
      <Button
        variant="secondary"
        className="py-1 text-xs"
        disabled={pending}
        onClick={() => start(async () => { const r = await copyBudgetsFromPreviousMonth(month); setMsg(r.error ?? r.message); })}
      >
        Copiar do mês anterior
      </Button>
    </div>
  );
}

export function NewGoalForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(createGoal, {});
  return (
    <form action={action} className="space-y-3">
      <div>
        <Label htmlFor="goal-name">Nome</Label>
        <Input id="goal-name" name="name" required maxLength={80} placeholder="Reserva de emergência" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="goal-target">Valor alvo (R$)</Label>
          <Input id="goal-target" name="target_amount" type="number" min="0.01" step="0.01" required />
        </div>
        <div>
          <Label htmlFor="goal-current">Já guardado (R$)</Label>
          <Input id="goal-current" name="current_amount" type="number" min="0" step="0.01" defaultValue="0" />
        </div>
      </div>
      <div>
        <Label htmlFor="goal-deadline">Prazo (opcional)</Label>
        <Input id="goal-deadline" name="deadline" type="date" />
      </div>
      {state.error && <p role="alert" className="text-xs text-danger">{state.error}</p>}
      <Button type="submit" disabled={pending} className="w-full">Criar meta</Button>
    </form>
  );
}

type Goal = { id: string; name: string; target_amount: number; current_amount: number; deadline: string | null };

function monthsUntil(deadline: string) {
  const now = new Date();
  const d = new Date(`${deadline}T00:00:00`);
  return Math.max(0, (d.getFullYear() - now.getFullYear()) * 12 + d.getMonth() - now.getMonth());
}

export function GoalCard({ goal }: { goal: Goal }) {
  const [pending, start] = useTransition();
  const [amount, setAmount] = useState("");
  const pct = Math.round((goal.current_amount / goal.target_amount) * 100);
  const remaining = Math.max(0, goal.target_amount - goal.current_amount);
  const months = goal.deadline ? monthsUntil(goal.deadline) : null;

  const contribute = (sign: 1 | -1) => {
    const v = Number(amount.replace(",", "."));
    if (!Number.isFinite(v) || v <= 0) return;
    start(async () => {
      await contributeToGoal(goal.id, sign * v);
      setAmount("");
    });
  };

  return (
    <Card>
      <div className="mb-2 flex items-start justify-between gap-2">
        <div>
          <p className="font-medium">{goal.name}</p>
          <p className="tabular text-xs text-muted">
            {formatBRL(goal.current_amount)} de {formatBRL(goal.target_amount)} · {pct}%
          </p>
        </div>
        <Button
          variant="ghost"
          className="px-2 py-1"
          aria-label={`Excluir meta ${goal.name}`}
          disabled={pending}
          onClick={() => confirm(`Excluir a meta “${goal.name}”?`) && start(async () => { await deleteGoal(goal.id); })}
        >
          <Trash2 size={14} />
        </Button>
      </div>
      <ProgressBar pct={Math.min(pct, 100)} color="var(--success)" />
      {goal.deadline && remaining > 0 && (
        <p className="mt-2 text-xs text-muted">
          Prazo {formatDate(goal.deadline)} · guarde {formatBRL(remaining / Math.max(1, months ?? 1))}/mês para chegar lá
        </p>
      )}
      <div className="mt-3 flex gap-2">
        <Input
          aria-label="Valor"
          inputMode="decimal"
          placeholder="R$"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="py-1.5"
        />
        <Button variant="secondary" disabled={pending} onClick={() => contribute(1)}>Guardar</Button>
        <Button variant="ghost" disabled={pending} onClick={() => contribute(-1)}>Retirar</Button>
      </div>
    </Card>
  );
}
