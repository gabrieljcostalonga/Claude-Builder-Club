import "server-only";
import { requireEnv } from "@/lib/env";
import type { PluggyAccount, PluggyItem, PluggyPage, PluggyTransaction } from "./types";

const BASE_URL = "https://api.pluggy.ai";

let cachedKey: { value: string; expiresAt: number } | null = null;

/** API key da Pluggy vale 2h; guardamos em memória com margem. */
async function getApiKey(): Promise<string> {
  if (cachedKey && cachedKey.expiresAt > Date.now()) return cachedKey.value;
  const res = await fetch(`${BASE_URL}/auth`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      clientId: requireEnv("PLUGGY_CLIENT_ID"),
      clientSecret: requireEnv("PLUGGY_CLIENT_SECRET"),
    }),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Pluggy auth falhou (${res.status})`);
  const { apiKey } = (await res.json()) as { apiKey: string };
  cachedKey = { value: apiKey, expiresAt: Date.now() + 100 * 60 * 1000 };
  return apiKey;
}

async function pluggyFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const apiKey = await getApiKey();
  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", "X-API-KEY": apiKey, ...init.headers },
    cache: "no-store",
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Pluggy ${init.method ?? "GET"} ${path} falhou (${res.status}): ${body.slice(0, 200)}`);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export async function createConnectToken(opts: { clientUserId: string; itemId?: string; webhookUrl?: string }) {
  const { accessToken } = await pluggyFetch<{ accessToken: string }>("/connect_token", {
    method: "POST",
    body: JSON.stringify({
      itemId: opts.itemId,
      options: { clientUserId: opts.clientUserId, webhookUrl: opts.webhookUrl, avoidDuplicates: true },
    }),
  });
  return accessToken;
}

export const getItem = (itemId: string) => pluggyFetch<PluggyItem>(`/items/${encodeURIComponent(itemId)}`);

export const deleteItem = (itemId: string) =>
  pluggyFetch<void>(`/items/${encodeURIComponent(itemId)}`, { method: "DELETE" });

/** Pede à Pluggy para buscar dados novos no banco (assíncrono; o webhook avisa quando terminar). */
export const refreshItem = (itemId: string) =>
  pluggyFetch<PluggyItem>(`/items/${encodeURIComponent(itemId)}`, { method: "PATCH", body: "{}" });

export async function listAccounts(itemId: string): Promise<PluggyAccount[]> {
  const page = await pluggyFetch<PluggyPage<PluggyAccount>>(`/accounts?itemId=${encodeURIComponent(itemId)}`);
  return page.results;
}

export async function listTransactions(accountId: string, from: string, to: string): Promise<PluggyTransaction[]> {
  const all: PluggyTransaction[] = [];
  for (let page = 1; ; page++) {
    const qs = new URLSearchParams({ accountId, from, to, pageSize: "500", page: String(page) });
    const res = await pluggyFetch<PluggyPage<PluggyTransaction>>(`/transactions?${qs}`);
    all.push(...res.results);
    if (!res.totalPages || page >= res.totalPages) break;
  }
  return all;
}

export type PluggyApi = {
  getItem: typeof getItem;
  listAccounts: typeof listAccounts;
  listTransactions: typeof listTransactions;
};
export const pluggyApi: PluggyApi = { getItem, listAccounts, listTransactions };
