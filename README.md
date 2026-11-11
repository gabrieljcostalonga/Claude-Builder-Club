# Finanças pessoais

SaaS de finanças pessoais: suas contas bancárias são conectadas via **Open Finance (Pluggy)** e as transações são
importadas e categorizadas automaticamente. Sem lançamentos manuais.

**Funcionalidades**

- Login com e-mail/senha ou link mágico (Supabase Auth); multiusuário, com Row Level Security em todas as tabelas
- Conexão de bancos pelo widget da Pluggy, sincronização inicial de 12 meses, webhook + rotina diária
- Reconexão quando o consentimento expira, "Sincronizar agora" e remoção de conexão
- Categorização automática: **regras por descrição** do usuário › **mapeamento** da categoria Pluggy › padrões
- Recategorização manual (preservada nas sincronizações), com sugestão de criar regra; transações podem ser ignoradas
- **Metas**: orçamento mensal por categoria (com "copiar do mês anterior") e metas de economia com prazo
- **Dashboard**: entradas, saídas e saldo com variação vs. mês anterior, gastos por categoria, gasto acumulado no mês
  vs. mês anterior, progresso de orçamentos e metas
- Transferências entre contas próprias, pagamento de fatura e aplicações não contam como gasto (evita dupla contagem)

**Stack**: Next.js 15 (App Router, Server Actions) · Supabase (Postgres, Auth, RLS) · Pluggy · Tailwind 4 · Recharts ·
Zod · Vitest · Playwright.

## Como rodar

### 1. Supabase

1. Crie um projeto em [supabase.com](https://supabase.com).
2. No **SQL Editor**, rode `supabase/migrations/0001_init.sql` (ou `supabase db push` com a CLI).
3. Em **Authentication › URL Configuration**, defina o *Site URL* (ex.: `http://localhost:3000`) e adicione
   `http://localhost:3000/auth/callback` às *Redirect URLs*.

### 2. Pluggy

1. Crie uma conta em [dashboard.pluggy.ai](https://dashboard.pluggy.ai) e uma *Application* para obter
   `CLIENT_ID` e `CLIENT_SECRET`.
2. Para testar sem banco real, use o conector sandbox **Pluggy Bank** (usuário `user-ok`, senha `password-ok`).
3. O uso em produção com bancos reais é pago. Confira os planos da Pluggy.

### 3. App

```bash
cp .env.example .env.local   # preencha as variáveis
npm install
npm run dev
```

Abra http://localhost:3000, crie uma conta e vá em **Contas › Conectar banco**.

### Webhook e rotina diária

- O webhook (`/api/pluggy/webhook?secret=...`) só é registrado quando `APP_URL` é **HTTPS** e `PLUGGY_WEBHOOK_SECRET`
  está definido. Em desenvolvimento local, use "Sincronizar agora" (ou um túnel como ngrok).
- `vercel.json` agenda `/api/cron/sync` diariamente; a Vercel envia `Authorization: Bearer $CRON_SECRET`.

## Deploy (Vercel)

1. Importe o repositório na Vercel e configure as variáveis do `.env.example`, com `APP_URL` = URL de produção.
2. Adicione `https://SEU_DOMINIO/auth/callback` às Redirect URLs do Supabase.

## Segurança

- Credenciais bancárias nunca passam pelo app: o login no banco acontece no widget da Pluggy.
- `SUPABASE_SERVICE_ROLE_KEY`, `PLUGGY_CLIENT_SECRET` e os segredos de webhook/cron ficam somente no servidor.
- Conexões, contas e transações só são gravadas pelo servidor. O usuário pode apenas alterar `category_id`,
  `category_source` e `ignored` das próprias transações (grants por coluna + RLS).
- Ao registrar uma conexão, o servidor confere na Pluggy que o item foi criado com o `clientUserId` do usuário logado.
- O payload do webhook não é confiável: só o `itemId` é usado, e os dados são buscados na API da Pluggy.

## Testes

```bash
npm run lint && npm run typecheck
npm test            # unitários: categorização, mapeamento Pluggy, resumo mensal
npm run test:db     # migration + RLS num Postgres temporário (precisa dos binários do PostgreSQL)
npm run build && npm run e2e   # smoke tests com Playwright
```

## Estrutura

```
app/(auth)          login, cadastro, server actions de auth
app/(app)           dashboard, transacoes, categorias, metas, contas
app/api             webhook da Pluggy e cron de sincronização
lib/pluggy          client da API da Pluggy
lib/sync            sincronização, categorização, reaplicação de regras
lib/finance         agregações mensais
supabase/           migration e testes de RLS
```
