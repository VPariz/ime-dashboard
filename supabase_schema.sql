-- =============================================================================
-- IME ANALYTICS — SCHEMA MULTI-TURMA + 3 NÍVEIS (viewer, gestor, super_admin)
-- Execute no SQL Editor do Supabase (Database -> SQL Editor -> New query)
-- =============================================================================

-- 1. Tabela de Turmas
create table if not exists public.turmas (
  id text primary key,                          -- ex: 'turma_28', 'turma_29'
  nome text not null,                           -- ex: 'Turma 28'
  semestre_atual text not null default '3.2',   -- único semestre editável pelo gestor
  storage_path text not null,                   -- ex: 'turma_28/data.json'
  updated_at timestamptz not null default now()
);

-- 2. Tabela de Papéis de Usuários (ligada ao auth.users)
create table if not exists public.user_roles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  role text not null check (role in ('viewer', 'gestor', 'super_admin')),
  turma_id text references public.turmas(id) on delete set null,
  created_at timestamptz not null default now()
);

-- 3. Whitelist opcional para cadastro autônomo ("Primeiro Acesso")
create table if not exists public.allowed_emails (
  email text primary key,
  role text not null default 'viewer' check (role in ('viewer', 'gestor', 'super_admin')),
  turma_id text references public.turmas(id) on delete set null,
  created_at timestamptz not null default now()
);

-- Habilitar RLS em todas as tabelas
alter table public.turmas enable row level security;
alter table public.user_roles enable row level security;
alter table public.allowed_emails enable row level security;

-- 4. Funções SECURITY DEFINER para checar role/turma sem recursão em RLS
create or replace function public.get_my_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from public.user_roles where user_id = auth.uid();
$$;

create or replace function public.get_my_turma_id()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select turma_id from public.user_roles where user_id = auth.uid();
$$;

-- 5. Políticas RLS — public.turmas
drop policy if exists "turmas_select" on public.turmas;
create policy "turmas_select"
on public.turmas for select to authenticated
using (
  public.get_my_role() = 'super_admin'
  or id = public.get_my_turma_id()
);

drop policy if exists "turmas_super_admin_insert" on public.turmas;
create policy "turmas_super_admin_insert"
on public.turmas for insert to authenticated
with check (public.get_my_role() = 'super_admin');

drop policy if exists "turmas_super_admin_update" on public.turmas;
create policy "turmas_super_admin_update"
on public.turmas for update to authenticated
using (public.get_my_role() = 'super_admin')
with check (public.get_my_role() = 'super_admin');

drop policy if exists "turmas_super_admin_delete" on public.turmas;
create policy "turmas_super_admin_delete"
on public.turmas for delete to authenticated
using (public.get_my_role() = 'super_admin');

-- 6. Políticas RLS — public.user_roles
drop policy if exists "user_roles_select" on public.user_roles;
create policy "user_roles_select"
on public.user_roles for select to authenticated
using (
  user_id = auth.uid()
  or public.get_my_role() = 'super_admin'
);

drop policy if exists "user_roles_super_admin_write" on public.user_roles;
create policy "user_roles_super_admin_write"
on public.user_roles for all to authenticated
using (public.get_my_role() = 'super_admin')
with check (public.get_my_role() = 'super_admin');

-- 7. Políticas RLS — public.allowed_emails
drop policy if exists "allowed_emails_super_admin" on public.allowed_emails;
create policy "allowed_emails_super_admin"
on public.allowed_emails for all to authenticated
using (public.get_my_role() = 'super_admin')
with check (public.get_my_role() = 'super_admin');

-- 8. Políticas RLS — Storage bucket privado 'ime-private'
-- viewer: somente leitura (SELECT) na pasta da sua turma (ex: turma_28/data.json)
-- gestor: leitura e escrita (SELECT/INSERT/UPDATE) na pasta da sua turma
-- super_admin: acesso completo a todas as pastas de 'ime-private'
drop policy if exists "Apenas autenticados leem ime-private" on storage.objects;
drop policy if exists "ime_private_select" on storage.objects;
create policy "ime_private_select"
on storage.objects for select to authenticated
using (
  bucket_id = 'ime-private'
  and (
    public.get_my_role() = 'super_admin'
    or (
      public.get_my_role() in ('viewer', 'gestor')
      and (storage.foldername(name))[1] = public.get_my_turma_id()
    )
  )
);

drop policy if exists "ime_private_insert" on storage.objects;
create policy "ime_private_insert"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'ime-private'
  and (
    public.get_my_role() = 'super_admin'
    or (
      public.get_my_role() = 'gestor'
      and (storage.foldername(name))[1] = public.get_my_turma_id()
    )
  )
);

drop policy if exists "ime_private_update" on storage.objects;
create policy "ime_private_update"
on storage.objects for update to authenticated
using (
  bucket_id = 'ime-private'
  and (
    public.get_my_role() = 'super_admin'
    or (
      public.get_my_role() = 'gestor'
      and (storage.foldername(name))[1] = public.get_my_turma_id()
    )
  )
)
with check (
  bucket_id = 'ime-private'
  and (
    public.get_my_role() = 'super_admin'
    or (
      public.get_my_role() = 'gestor'
      and (storage.foldername(name))[1] = public.get_my_turma_id()
    )
  )
);

-- 9. Trigger opcional para Whitelist no "Primeiro Acesso (Criar Senha)"
-- Se você quiser permitir que alunos pré-autorizados criem a própria senha no site,
-- basta cadastrar os e-mails em public.allowed_emails. Quem não estiver na lista é bloqueado.
create or replace function public.handle_allowed_signup()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  wl record;
begin
  -- Se existir ao menos 1 e-mail na whitelist ou se foi criado via signUp público, valida
  select * into wl from public.allowed_emails where lower(email) = lower(new.email);
  if found then
    insert into public.user_roles (user_id, email, role, turma_id)
    values (new.id, lower(new.email), wl.role, wl.turma_id)
    on conflict (user_id) do update
      set role = excluded.role, turma_id = excluded.turma_id;
    return new;
  end if;

  -- Se o usuário foi criado por auto-cadastro público (sem email_confirmed_at prévio)
  -- e existe whitelist configurada, bloqueia e-mails fora da whitelist.
  -- Pelo painel "Add User" do Supabase (com Auto Confirm marcado), continua livre para o Admin.
  if new.email_confirmed_at is null and exists (select 1 from public.allowed_emails) then
    raise exception 'E-mail nao autorizado na whitelist. Solicite inclusao ao Super Admin.';
  end if;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created_whitelist on auth.users;
create trigger on_auth_user_created_whitelist
after insert on auth.users
for each row execute function public.handle_allowed_signup();

-- 10. Dados iniciais de exemplo (Turma 28)
insert into public.turmas (id, nome, semestre_atual, storage_path)
values ('turma_28', 'Turma 28', '3.2', 'turma_28/data.json')
on conflict (id) do nothing;
