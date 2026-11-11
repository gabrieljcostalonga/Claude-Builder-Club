"use client";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui";
import { getConnectToken, registerConnection, removeConnection, syncConnection } from "./actions";

// o widget usa APIs do navegador: carrega só no client
const PluggyConnect = dynamic(() => import("react-pluggy-connect").then((m) => m.PluggyConnect), { ssr: false });

const includeSandbox = process.env.NEXT_PUBLIC_PLUGGY_INCLUDE_SANDBOX === "true";

function useConnectWidget(connectionId?: string, pluggyItemId?: string) {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const open = () =>
    start(async () => {
      setError(null);
      const res = await getConnectToken(connectionId);
      if (res.ok) setToken(res.data!);
      else setError(res.error);
    });

  const widget = token ? (
    <PluggyConnect
      connectToken={token}
      includeSandbox={includeSandbox}
      updateItem={pluggyItemId}
      onSuccess={({ item }) => {
        setToken(null);
        start(async () => {
          const res = await registerConnection(item.id);
          if (!res.ok) setError(res.error);
          router.refresh();
        });
      }}
      onError={() => setError("A conexão com o banco falhou. Tente novamente.")}
      onClose={() => setToken(null)}
    />
  ) : null;

  return { open, widget, error, pending };
}

export function ConnectButton() {
  const { open, widget, error, pending } = useConnectWidget();
  return (
    <div className="text-right">
      <Button onClick={open} disabled={pending}>{pending ? "Conectando…" : "Conectar banco"}</Button>
      {error && <p className="mt-1 text-xs text-danger">{error}</p>}
      {widget}
    </div>
  );
}

export function ConnectionActions({
  connectionId,
  pluggyItemId,
  needsReconnect,
}: {
  connectionId: string;
  pluggyItemId: string;
  needsReconnect: boolean;
}) {
  const router = useRouter();
  const reconnect = useConnectWidget(connectionId, pluggyItemId);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>) =>
    start(async () => {
      setError(null);
      const res = await fn();
      if (!res.ok) setError(res.error ?? "Erro");
      router.refresh();
    });

  return (
    <div className="text-right">
      <div className="flex flex-wrap justify-end gap-2">
        {needsReconnect && (
          <Button onClick={reconnect.open} disabled={reconnect.pending}>Reconectar</Button>
        )}
        <Button variant="secondary" disabled={pending} onClick={() => run(() => syncConnection(connectionId))}>
          {pending ? "Sincronizando…" : "Sincronizar agora"}
        </Button>
        <Button
          variant="danger"
          disabled={pending}
          onClick={() => {
            if (confirm("Remover esta conexão e apagar as transações importadas dela?")) {
              run(() => removeConnection(connectionId));
            }
          }}
        >
          Remover
        </Button>
      </div>
      {(error || reconnect.error) && <p className="mt-1 text-xs text-danger">{error ?? reconnect.error}</p>}
      {reconnect.widget}
    </div>
  );
}
