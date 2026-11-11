"use client";
import { useState, useTransition } from "react";
import clsx from "clsx";
import { Select } from "@/components/ui";
import { formatBRL, formatDate } from "@/lib/format";
import { CategoryOptions } from "../categorias/forms";
import { createRuleFromTransaction, setTransactionCategory, setTransactionIgnored } from "./actions";

type Cat = { id: string; name: string; kind: string; color: string };
type Tx = {
  id: string;
  date: string;
  description: string;
  amount: number;
  status: string | null;
  ignored: boolean;
  category_id: string | null;
  category_source: string;
  account: string;
};

/** Sugestão de texto para regra: primeira(s) palavra(s) significativas da descrição. */
function suggestRule(description: string) {
  const words = description.replace(/[*\d]+/g, " ").split(/\s+/).filter((w) => w.length > 2);
  return words.slice(0, 2).join(" ") || description.slice(0, 20);
}

export function TransactionRow({ tx, categories }: { tx: Tx; categories: Cat[] }) {
  const [pending, start] = useTransition();
  const [category, setCategory] = useState(tx.category_id ?? "");
  const [ignored, setIgnored] = useState(tx.ignored);
  const [msg, setMsg] = useState<string>();

  const onCategory = (value: string) => {
    setCategory(value);
    start(async () => {
      const res = await setTransactionCategory(tx.id, value || null);
      if (!res.ok) return setMsg(res.error);
      if (!value) return;
      const match = prompt(
        "Categoria alterada. Quer criar uma regra para transações parecidas? Edite o texto que a descrição deve conter (ou cancele):",
        suggestRule(tx.description),
      );
      if (match) {
        const r = await createRuleFromTransaction(match, value);
        setMsg(r.ok ? r.message : r.error);
      }
    });
  };

  return (
    <tr className={clsx(ignored && "opacity-50", pending && "animate-pulse")}>
      <td className="whitespace-nowrap px-4 py-2.5 text-muted tabular">{formatDate(tx.date)}</td>
      <td className="px-4 py-2.5">
        <p className="font-medium">{tx.description}</p>
        <p className="text-xs text-muted">
          {tx.account}
          {tx.status === "PENDING" && " · pendente"}
          {tx.category_source === "rule" && " · por regra"}
        </p>
        {msg && <p className="text-xs text-primary">{msg}</p>}
      </td>
      <td className="px-4 py-2.5">
        <Select
          value={category}
          onChange={(e) => onCategory(e.target.value)}
          disabled={pending}
          aria-label="Categoria"
          className="min-w-40 py-1.5"
        >
          <option value="">Sem categoria</option>
          <CategoryOptions categories={categories} />
        </Select>
      </td>
      <td className={clsx("tabular whitespace-nowrap px-4 py-2.5 text-right font-medium", tx.amount < 0 ? "" : "text-success")}>
        {formatBRL(tx.amount)}
      </td>
      <td className="px-4 py-2.5 text-center">
        <input
          type="checkbox"
          checked={ignored}
          aria-label="Ignorar no resumo"
          disabled={pending}
          onChange={(e) => {
            const v = e.target.checked;
            setIgnored(v);
            start(async () => {
              const r = await setTransactionIgnored(tx.id, v);
              if (!r.ok) {
                setIgnored(!v);
                setMsg(r.error);
              }
            });
          }}
        />
      </td>
    </tr>
  );
}
