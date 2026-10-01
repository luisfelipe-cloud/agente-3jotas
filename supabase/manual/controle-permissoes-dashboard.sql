-- Execute no SQL Editor do projeto Supabase ANTES de publicar o dashboard.
-- Ajuste o email de bootstrap abaixo se o administrador principal for outro.
begin;

create table if not exists public.usuarios_permissoes (
  auth_user_id uuid primary key references auth.users(id) on delete cascade,
  papel text not null check (papel in ('admin', 'gestor')),
  criado_em timestamptz not null default now()
);

alter table public.usuarios_permissoes enable row level security;
revoke all on public.usuarios_permissoes from anon, authenticated;
grant select, insert, update, delete on public.usuarios_permissoes to service_role;

do $$
declare v_admin_id uuid;
begin
  select id into v_admin_id
  from auth.users
  where lower(email) = lower('tresjotasimoveis@gmail.com');

  if v_admin_id is null then
    raise exception 'Administrador inicial não encontrado em auth.users; ajuste o email no script antes de executar.';
  end if;

  if exists (select 1 from public.corretores where auth_user_id = v_admin_id) then
    raise exception 'Administrador inicial está vinculado a corretor; escolha outro usuário.';
  end if;

  insert into public.usuarios_permissoes (auth_user_id, papel)
  values (v_admin_id, 'admin')
  on conflict (auth_user_id) do update set papel = excluded.papel;
end $$;

commit;
