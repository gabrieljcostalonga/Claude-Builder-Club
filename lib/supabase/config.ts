/**
 * Normaliza a URL do projeto Supabase. Aceita formatos comuns colados por engano:
 *   https://ref.supabase.co/rest/v1/   -> https://ref.supabase.co
 *   https://ref.supabase.co/           -> https://ref.supabase.co
 *   https://supabase.com/dashboard/project/ref -> https://ref.supabase.co
 * Um caminho extra faz o Supabase responder "Invalid path specified in request URL".
 */
export function normalizeSupabaseUrl(raw: string | undefined): string {
  const value = raw?.trim().replace(/^["']|["']$/g, "");
  if (!value) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL não definida. Preencha o .env.local e reinicie o npm run dev.");
  }
  let url: URL;
  try {
    url = new URL(value.includes("://") ? value : `https://${value}`);
  } catch {
    throw new Error(`NEXT_PUBLIC_SUPABASE_URL inválida: "${value}". Use https://SEU_PROJETO.supabase.co`);
  }
  const dashboard = /^\/dashboard\/project\/([a-z0-9]+)/i.exec(url.pathname);
  if (/(^|\.)supabase\.com$/i.test(url.hostname) && dashboard) {
    return `https://${dashboard[1].toLowerCase()}.supabase.co`;
  }
  return url.origin;
}

export function normalizeSupabaseKey(raw: string | undefined, name: string): string {
  const value = raw?.trim().replace(/^["']|["']$/g, "");
  if (!value) throw new Error(`${name} não definida. Preencha o .env.local e reinicie o npm run dev.`);
  return value;
}

// Referências literais a process.env.NEXT_PUBLIC_* para o Next injetar os valores no navegador.
export const supabaseUrl = () => normalizeSupabaseUrl(process.env.NEXT_PUBLIC_SUPABASE_URL);
export const supabaseAnonKey = () =>
  normalizeSupabaseKey(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, "NEXT_PUBLIC_SUPABASE_ANON_KEY");
