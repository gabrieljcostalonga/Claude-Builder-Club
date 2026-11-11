// Subconjunto dos tipos da API da Pluggy usados pelo app.

export type PluggyItemStatus =
  | "UPDATED"
  | "UPDATING"
  | "WAITING_USER_INPUT"
  | "LOGIN_ERROR"
  | "OUTDATED";

export interface PluggyItem {
  id: string;
  status: PluggyItemStatus;
  executionStatus?: string;
  clientUserId?: string | null;
  connector: { id: number; name: string; imageUrl?: string };
  error?: { code?: string; message?: string } | null;
  lastUpdatedAt?: string | null;
}

export interface PluggyAccount {
  id: string;
  itemId: string;
  type: "BANK" | "CREDIT" | string;
  subtype?: string;
  name: string;
  marketingName?: string | null;
  number?: string;
  balance: number;
  currencyCode?: string;
}

export interface PluggyTransaction {
  id: string;
  accountId: string;
  description: string;
  descriptionRaw?: string | null;
  currencyCode?: string;
  amount: number;
  date: string; // ISO
  category?: string | null;
  categoryId?: string | null;
  type: "DEBIT" | "CREDIT";
  status?: "POSTED" | "PENDING";
}

export interface PluggyPage<T> {
  total?: number;
  totalPages?: number;
  page?: number;
  results: T[];
}

export interface PluggyWebhookEvent {
  event: string;
  itemId?: string;
  eventId?: string;
}

/** Itens que precisam que o usuário reconecte no widget. */
export const NEEDS_RECONNECT: PluggyItemStatus[] = ["LOGIN_ERROR", "OUTDATED", "WAITING_USER_INPUT"];
