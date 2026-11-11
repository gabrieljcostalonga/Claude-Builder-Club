import { requireUser } from "@/lib/supabase/server";
import { Card, EmptyState, PageHeader } from "@/components/ui";
import { formatBRL } from "@/lib/format";
import { NEEDS_RECONNECT } from "@/lib/pluggy/types";
import { ConnectButton, ConnectionActions } from "./ConnectionControls";

export const metadata = { title: "Contas · Finanças" };
export const maxDuration = 60;

const STATUS_LABEL: Record<string, string> = {
  UPDATED: "Atualizada",
  UPDATING: "Atualizando…",
  LOGIN_ERROR: "Erro de login",
  OUTDATED: "Desatualizada",
  WAITING_USER_INPUT: "Aguardando você",
};

export default async function ContasPage() {
  const { supabase } = await requireUser();
  const { data: connections } = await supabase
    .from("bank_connections")
    .select("id, pluggy_item_id, connector_name, connector_image_url, status, error, last_synced_at, accounts(id, name, type, subtype, number, balance)")
    .order("created_at");

  return (
    <>
      <PageHeader title="Contas">
        <ConnectButton />
      </PageHeader>
      <p className="mb-6 max-w-2xl text-sm text-muted">
        As contas são conectadas via Open Finance pela Pluggy. Suas credenciais bancárias nunca passam por este app, e
        as transações são importadas e categorizadas automaticamente.
      </p>

      {!connections?.length ? (
        <EmptyState>Nenhum banco conectado ainda. Clique em “Conectar banco” para começar.</EmptyState>
      ) : (
        <div className="space-y-4">
          {connections.map((c) => {
            const needsReconnect = (NEEDS_RECONNECT as string[]).includes(c.status);
            return (
              <Card key={c.id}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    {c.connector_image_url && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={c.connector_image_url} alt="" className="h-9 w-9 rounded-md object-contain" />
                    )}
                    <div>
                      <p className="font-medium">{c.connector_name ?? "Banco"}</p>
                      <p className={`text-xs ${needsReconnect ? "text-danger" : "text-muted"}`}>
                        {STATUS_LABEL[c.status] ?? c.status}
                        {c.last_synced_at && ` · sincronizado em ${new Date(c.last_synced_at).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}`}
                      </p>
                      {c.error && <p className="mt-1 text-xs text-danger">{c.error}</p>}
                    </div>
                  </div>
                  <ConnectionActions connectionId={c.id} pluggyItemId={c.pluggy_item_id} needsReconnect={needsReconnect} />
                </div>
                {c.accounts?.length > 0 && (
                  <ul className="mt-4 divide-y divide-border border-t border-border">
                    {c.accounts.map((a) => (
                      <li key={a.id} className="flex items-center justify-between py-2 text-sm">
                        <span>
                          {a.name}
                          <span className="ml-2 text-xs text-muted">
                            {a.type === "CREDIT" ? "Cartão de crédito" : "Conta"} {a.number ? `· ${a.number}` : ""}
                          </span>
                        </span>
                        <span className="tabular font-medium">
                          {a.type === "CREDIT" ? `Fatura ${formatBRL(Number(a.balance))}` : formatBRL(Number(a.balance))}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}
