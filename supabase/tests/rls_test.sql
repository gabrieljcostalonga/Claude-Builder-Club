-- Testa isolamento entre usuários (RLS) e restrições de escrita.
-- Executado por scripts/test-db.sh depois da migration.
\set ON_ERROR_STOP on
begin;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'a@test'),
  ('00000000-0000-0000-0000-00000000000b', 'b@test');

-- trigger criou categorias padrão
do $$ begin
  assert (select count(*) from categories where user_id = '00000000-0000-0000-0000-00000000000a') = 18,
    'categorias padrão não criadas';
end $$;

-- dados da Pluggy inseridos pelo servidor (superuser aqui = service role)
insert into bank_connections (id, user_id, pluggy_item_id, status)
values ('10000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000a', 'item-a', 'UPDATED'),
       ('10000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-00000000000b', 'item-b', 'UPDATED');
insert into accounts (id, user_id, connection_id, pluggy_account_id, name, type)
values ('20000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000a', '10000000-0000-0000-0000-00000000000a', 'acc-a', 'Conta A', 'BANK'),
       ('20000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-00000000000b', '10000000-0000-0000-0000-00000000000b', 'acc-b', 'Conta B', 'BANK');
insert into transactions (id, user_id, account_id, pluggy_transaction_id, date, description, amount)
values ('30000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000a', '20000000-0000-0000-0000-00000000000a', 'tx-a', '2026-11-01', 'MERCADO', -10),
       ('30000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-00000000000b', '20000000-0000-0000-0000-00000000000b', 'tx-b', '2026-11-01', 'FARMACIA', -20);

-- categoria de outro usuário é rejeitada
do $$ begin
  begin
    update transactions set category_id = (select id from categories where user_id = '00000000-0000-0000-0000-00000000000b' limit 1)
    where id = '30000000-0000-0000-0000-00000000000a';
    raise exception 'deveria ter falhado';
  exception when raise_exception then
    if sqlerrm = 'deveria ter falhado' then raise; end if;
  end;
end $$;

-- agora como usuário A
set local role authenticated;
do $$ begin perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', true); end $$;

do $$ begin
  assert (select count(*) from transactions) = 1, 'A deveria ver só a própria transação';
  assert (select count(*) from bank_connections) = 1, 'A deveria ver só a própria conexão';
  assert (select count(*) from categories) = 18, 'A deveria ver só as próprias categorias';
  assert not exists (select 1 from transactions where user_id <> auth.uid()), 'vazamento entre usuários';
end $$;

-- A pode recategorizar a própria transação
update transactions set category_id = (select id from categories where name = 'Mercado'), category_source = 'manual'
where id = '30000000-0000-0000-0000-00000000000a';

-- A não altera transação de B (RLS filtra: 0 linhas)
do $$ declare n int; begin
  update transactions set ignored = true where id = '30000000-0000-0000-0000-00000000000b';
  get diagnostics n = row_count;
  assert n = 0, 'A alterou transação de B';
end $$;

-- A não pode alterar valor (coluna sem grant) nem inserir transações
do $$ begin
  begin update transactions set amount = 0; raise exception 'amount editável';
  exception when insufficient_privilege then null; end;
  begin insert into transactions (user_id, account_id, pluggy_transaction_id, date, description, amount)
        values (auth.uid(), '20000000-0000-0000-0000-00000000000a', 'x', '2026-11-01', 'x', 1);
        raise exception 'insert permitido';
  exception when insufficient_privilege then null; end;
  begin insert into bank_connections (user_id, pluggy_item_id) values (auth.uid(), 'fake');
        raise exception 'insert de conexão permitido';
  exception when insufficient_privilege then null; end;
end $$;

-- A não cria dados em nome de B
do $$ begin
  begin insert into savings_goals (user_id, name, target_amount) values ('00000000-0000-0000-0000-00000000000b', 'x', 1);
        raise exception 'insert em nome de B permitido';
  exception when insufficient_privilege then null; end;
end $$;

-- A gerencia as próprias metas
insert into budgets (user_id, category_id, month, limit_amount)
values (auth.uid(), (select id from categories where name = 'Mercado'), '2026-11-01', 500);
insert into savings_goals (user_id, name, target_amount) values (auth.uid(), 'Reserva', 10000);

-- anônimo não vê nada
reset role;
set local role anon;
do $$ begin
  assert (select count(*) from transactions) = 0, 'anon vê transações';
end $$;

reset role;
\echo 'RLS: todos os testes passaram'
rollback;
