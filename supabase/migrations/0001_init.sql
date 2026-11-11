-- =====================================================================
-- Finanças pessoais — schema inicial
-- Todas as tabelas são isoladas por usuário via Row Level Security.
-- Dados vindos da Pluggy (conexões, contas, transações) só são inseridos
-- pelo servidor com a service role; o usuário pode apenas ler e alterar
-- a categorização das transações.
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- Categorias
-- ---------------------------------------------------------------------
create type category_kind as enum ('income', 'expense', 'transfer');

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  kind category_kind not null,
  color text not null default '#64748b',
  icon text,
  parent_id uuid references public.categories(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (user_id, name)
);
create index categories_user_idx on public.categories(user_id);

-- Mapeamento personalizado: categoria da Pluggy -> categoria do usuário
create table public.category_mappings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  pluggy_category text not null,
  category_id uuid not null references public.categories(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, pluggy_category)
);

-- Regras por descrição ("IFOOD" -> Alimentação)
create table public.category_rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  match text not null check (char_length(match) between 2 and 100),
  category_id uuid not null references public.categories(id) on delete cascade,
  priority int not null default 0,
  created_at timestamptz not null default now()
);
create index category_rules_user_idx on public.category_rules(user_id);

-- ---------------------------------------------------------------------
-- Open Finance (Pluggy)
-- ---------------------------------------------------------------------
create table public.bank_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  pluggy_item_id text not null unique,
  connector_name text,
  connector_image_url text,
  status text not null default 'UPDATING',
  error text,
  last_synced_at timestamptz,
  created_at timestamptz not null default now()
);
create index bank_connections_user_idx on public.bank_connections(user_id);

create table public.accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  connection_id uuid not null references public.bank_connections(id) on delete cascade,
  pluggy_account_id text not null unique,
  name text not null,
  type text not null,          -- BANK | CREDIT
  subtype text,
  number text,
  balance numeric(14,2) not null default 0,
  currency text not null default 'BRL',
  updated_at timestamptz not null default now()
);
create index accounts_user_idx on public.accounts(user_id);

create type category_source as enum ('auto', 'rule', 'manual');

create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  account_id uuid not null references public.accounts(id) on delete cascade,
  pluggy_transaction_id text not null unique,
  date date not null,
  description text not null,
  amount numeric(14,2) not null,       -- negativo = saída, positivo = entrada
  currency text not null default 'BRL',
  pluggy_category text,
  status text,                          -- POSTED | PENDING
  category_id uuid references public.categories(id) on delete set null,
  category_source category_source not null default 'auto',
  ignored boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index transactions_user_date_idx on public.transactions(user_id, date desc);
create index transactions_account_date_idx on public.transactions(account_id, date);

-- ---------------------------------------------------------------------
-- Metas
-- ---------------------------------------------------------------------
create table public.budgets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  category_id uuid not null references public.categories(id) on delete cascade,
  month date not null check (extract(day from month) = 1),
  limit_amount numeric(14,2) not null check (limit_amount > 0),
  created_at timestamptz not null default now(),
  unique (user_id, category_id, month)
);

create table public.savings_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  target_amount numeric(14,2) not null check (target_amount > 0),
  current_amount numeric(14,2) not null default 0 check (current_amount >= 0),
  deadline date,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Integridade: referências a categorias devem ser do mesmo usuário
-- ---------------------------------------------------------------------
create or replace function public.assert_category_owner()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.category_id is not null and not exists (
    select 1 from public.categories c where c.id = new.category_id and c.user_id = new.user_id
  ) then
    raise exception 'category does not belong to user';
  end if;
  return new;
end $$;

create trigger transactions_category_owner before insert or update of category_id on public.transactions
  for each row execute function public.assert_category_owner();
create trigger budgets_category_owner before insert or update of category_id on public.budgets
  for each row execute function public.assert_category_owner();
create trigger rules_category_owner before insert or update of category_id on public.category_rules
  for each row execute function public.assert_category_owner();
create trigger mappings_category_owner before insert or update of category_id on public.category_mappings
  for each row execute function public.assert_category_owner();

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;
create trigger transactions_touch before update on public.transactions
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------
alter table public.categories enable row level security;
alter table public.category_mappings enable row level security;
alter table public.category_rules enable row level security;
alter table public.bank_connections enable row level security;
alter table public.accounts enable row level security;
alter table public.transactions enable row level security;
alter table public.budgets enable row level security;
alter table public.savings_goals enable row level security;

-- Tabelas que o usuário gerencia por completo
do $$
declare t text;
begin
  foreach t in array array['categories','category_mappings','category_rules','budgets','savings_goals'] loop
    execute format('create policy "own rows" on public.%I for all to authenticated
      using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))', t);
  end loop;
end $$;

-- Dados da Pluggy: somente leitura para o usuário
create policy "read own" on public.bank_connections for select to authenticated
  using (user_id = (select auth.uid()));
create policy "read own" on public.accounts for select to authenticated
  using (user_id = (select auth.uid()));
create policy "read own" on public.transactions for select to authenticated
  using (user_id = (select auth.uid()));
create policy "recategorize own" on public.transactions for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- O usuário só pode alterar estas colunas das transações
revoke insert, update, delete on public.transactions from authenticated, anon;
grant update (category_id, category_source, ignored) on public.transactions to authenticated;
revoke insert, update, delete on public.bank_connections, public.accounts from authenticated, anon;

-- ---------------------------------------------------------------------
-- Categorias padrão criadas no cadastro
-- ---------------------------------------------------------------------
create or replace function public.create_default_categories(p_user uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into public.categories (user_id, name, kind, color, icon) values
    (p_user, 'Salário',               'income',   '#16a34a', 'briefcase'),
    (p_user, 'Rendimentos',           'income',   '#22c55e', 'trending-up'),
    (p_user, 'Outras receitas',       'income',   '#4ade80', 'plus-circle'),
    (p_user, 'Moradia',               'expense',  '#7c3aed', 'home'),
    (p_user, 'Mercado',               'expense',  '#ea580c', 'shopping-cart'),
    (p_user, 'Alimentação',           'expense',  '#f97316', 'utensils'),
    (p_user, 'Transporte',            'expense',  '#0284c7', 'car'),
    (p_user, 'Saúde',                 'expense',  '#e11d48', 'heart-pulse'),
    (p_user, 'Educação',              'expense',  '#4f46e5', 'graduation-cap'),
    (p_user, 'Lazer',                 'expense',  '#db2777', 'party-popper'),
    (p_user, 'Compras',               'expense',  '#ca8a04', 'shopping-bag'),
    (p_user, 'Serviços e assinaturas','expense',  '#0891b2', 'wifi'),
    (p_user, 'Impostos e taxas',      'expense',  '#78716c', 'landmark'),
    (p_user, 'Viagem',                'expense',  '#0d9488', 'plane'),
    (p_user, 'Outros',                'expense',  '#94a3b8', 'circle'),
    (p_user, 'Transferências',        'transfer', '#64748b', 'arrow-left-right'),
    (p_user, 'Pagamento de fatura',   'transfer', '#475569', 'credit-card'),
    (p_user, 'Aplicações',            'transfer', '#334155', 'piggy-bank')
  on conflict (user_id, name) do nothing;
end $$;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.create_default_categories(new.id);
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

revoke execute on function public.create_default_categories(uuid) from public, anon, authenticated;
