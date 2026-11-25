-- Muitas Ofertas — Fase 1: campanhas e códigos de cupons
-- Execute UMA VEZ no SQL Editor do Supabase (o arquivo é reaplicável).
-- NÃO inclua chaves secretas neste arquivo.

create table if not exists public.cupons (
  id uuid primary key default gen_random_uuid(),
  titulo text not null check (char_length(titulo) between 3 and 180),
  loja text not null check (char_length(loja) between 2 and 80),
  link_ativacao text not null check (link_ativacao ~ '^https://'),
  imagem text,
  destaque text,
  observacoes text,
  validade date,
  publicado boolean not null default false,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create table if not exists public.cupom_itens (
  id uuid primary key default gen_random_uuid(),
  cupom_id uuid not null references public.cupons(id) on delete cascade,
  codigo text,
  descricao text not null check (char_length(descricao) between 2 and 400),
  link text,
  ordem integer not null default 0,
  criado_em timestamptz not null default now()
);

create index if not exists cupons_publicados_criado_em_idx
  on public.cupons (publicado, criado_em desc);
create index if not exists cupom_itens_campanha_ordem_idx
  on public.cupom_itens (cupom_id, ordem);

-- Consulta restrita a usuários com papel admin. Definição fixa o search_path
-- para não depender de schemas controlados pelo usuário.
create or replace function public.mo_usuario_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.perfis
    where id = (select auth.uid()) and papel = 'admin'
  );
$$;
revoke all on function public.mo_usuario_admin() from public;
grant execute on function public.mo_usuario_admin() to authenticated;

alter table public.cupons enable row level security;
alter table public.cupom_itens enable row level security;

-- Cupons: visitantes só leem campanhas publicadas; admins gerenciam tudo.
drop policy if exists mo_cupons_publico_select on public.cupons;
create policy mo_cupons_publico_select on public.cupons for select
  to anon, authenticated using (publicado = true);
drop policy if exists mo_cupons_admin_select on public.cupons;
create policy mo_cupons_admin_select on public.cupons for select
  to authenticated using (public.mo_usuario_admin());
drop policy if exists mo_cupons_admin_insert on public.cupons;
create policy mo_cupons_admin_insert on public.cupons for insert
  to authenticated with check (public.mo_usuario_admin());
drop policy if exists mo_cupons_admin_update on public.cupons;
create policy mo_cupons_admin_update on public.cupons for update
  to authenticated using (public.mo_usuario_admin()) with check (public.mo_usuario_admin());
drop policy if exists mo_cupons_admin_delete on public.cupons;
create policy mo_cupons_admin_delete on public.cupons for delete
  to authenticated using (public.mo_usuario_admin());

-- Itens: visitantes só leem os itens pertencentes a campanhas publicadas.
drop policy if exists mo_cupom_itens_publico_select on public.cupom_itens;
create policy mo_cupom_itens_publico_select on public.cupom_itens for select
  to anon, authenticated using (
    exists (select 1 from public.cupons c
            where c.id = cupom_id and c.publicado = true)
  );
drop policy if exists mo_cupom_itens_admin_select on public.cupom_itens;
create policy mo_cupom_itens_admin_select on public.cupom_itens for select
  to authenticated using (public.mo_usuario_admin());
drop policy if exists mo_cupom_itens_admin_insert on public.cupom_itens;
create policy mo_cupom_itens_admin_insert on public.cupom_itens for insert
  to authenticated with check (public.mo_usuario_admin());
drop policy if exists mo_cupom_itens_admin_update on public.cupom_itens;
create policy mo_cupom_itens_admin_update on public.cupom_itens for update
  to authenticated using (public.mo_usuario_admin()) with check (public.mo_usuario_admin());
drop policy if exists mo_cupom_itens_admin_delete on public.cupom_itens;
create policy mo_cupom_itens_admin_delete on public.cupom_itens for delete
  to authenticated using (public.mo_usuario_admin());

-- Permissões de banco; a RLS continua responsável por autorizar cada linha.
grant select on public.cupons, public.cupom_itens to anon;
grant select, insert, update, delete on public.cupons, public.cupom_itens to authenticated;

-- Verificação inicial (sem dados pessoais):
-- select tablename, rowsecurity from pg_tables
--   where schemaname = 'public' and tablename in ('cupons','cupom_itens');
