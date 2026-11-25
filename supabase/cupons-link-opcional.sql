-- Muitas Ofertas: atualização incremental, NÃO apaga campanhas nem códigos.
-- Execute uma vez no SQL Editor ANTES de testar o novo Admin.
-- Necessário porque o schema inicial exigia link_ativacao NOT NULL.
begin;
alter table public.cupons alter column link_ativacao drop not null;
commit;
-- Conferir: is_nullable deve aparecer como YES
select column_name, is_nullable from information_schema.columns
where table_schema='public' and table_name='cupons'
  and column_name in ('titulo','link_ativacao');
