-- =============================================================================
-- IME ANALYTICS — SCHEMA MULTI-TURMA + RBAC + VAGAS & PREFERÊNCIAS AO VIVO
-- Execute no SQL Editor do Supabase (Database -> SQL Editor -> New query)
-- Idempotente: pode ser re-executado com segurança em atualizações.
-- =============================================================================

-- 1. Tabela de Turmas
create table if not exists public.turmas (
  id text primary key,                          -- ex: 'turma_28', 'turma_29', 'turma_30', 'turma_31'
  nome text not null,                           -- ex: 'Turma 28'
  semestre_atual text not null default '3.2',   -- único semestre editável pelo gestor
  storage_path text not null,                   -- ex: 'turma_28/data.json'
  updated_at timestamptz not null default now()
);

-- 2. Tabela de Papéis e Vínculo Individual (ligada ao auth.users)
create table if not exists public.user_roles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  username text,                                -- ex: 'Aluno 28' ou 'Discente 29'
  role text not null check (role in ('viewer', 'gestor', 'super_admin')),
  turma_id text references public.turmas(id) on delete set null,
  aluno_numero integer,                         -- matrícula do aluno (para editar apenas suas preferências)
  must_change_password boolean not null default false,
  accepted_terms_at timestamptz,
  ime_email text,
  ime_verified_at timestamptz,
  created_at timestamptz not null default now()
);

-- Migração idempotente caso user_roles já existisse de versão anterior
alter table public.user_roles add column if not exists username text;
alter table public.user_roles add column if not exists aluno_numero integer;
alter table public.user_roles add column if not exists must_change_password boolean not null default false;
alter table public.user_roles add column if not exists accepted_terms_at timestamptz;
alter table public.user_roles add column if not exists ime_email text;
alter table public.user_roles add column if not exists ime_verified_at timestamptz;
create unique index if not exists user_roles_ime_email_unique
  on public.user_roles (lower(ime_email))
  where ime_email is not null;

-- 3. Whitelist opcional para pré-autorização
create table if not exists public.allowed_emails (
  email text primary key,
  username text,
  role text not null default 'viewer' check (role in ('viewer', 'gestor', 'super_admin')),
  turma_id text references public.turmas(id) on delete set null,
  aluno_numero integer,
  created_at timestamptz not null default now()
);

alter table public.allowed_emails add column if not exists username text;
alter table public.allowed_emails add column if not exists aluno_numero integer;

-- 4. Vagas / Locais compartilhados (Engenharia, Estágio, OM) — editáveis apenas por Gestor da turma / Super Admin
create table if not exists public.career_vagas (
  id text not null,
  turma_id text not null references public.turmas(id) on delete cascade,
  stage_key text not null check (stage_key in ('engenharia', 'estagio', 'om')),
  scope_key text not null,                      -- 'TURMA_COMPLETA' ou nome da engenharia
  nome text not null,
  qtd integer not null check (qtd >= 1),
  is_provisional boolean not null default true,
  sort_order integer not null default 0,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key (turma_id, stage_key, scope_key, id)
);

alter table public.career_vagas add column if not exists is_provisional boolean not null default true;

-- 5. Preferências individuais ao vivo (1ª a 10ª opção) — cada aluno edita apenas a própria linha
create table if not exists public.career_preferences (
  turma_id text not null references public.turmas(id) on delete cascade,
  stage_key text not null check (stage_key in ('engenharia', 'estagio', 'om')),
  scope_key text not null,
  aluno_numero integer not null,
  prefs jsonb not null default '[]'::jsonb,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key (turma_id, stage_key, scope_key, aluno_numero)
);

-- Habilitar RLS em todas as tabelas
alter table public.turmas enable row level security;
alter table public.user_roles enable row level security;
alter table public.allowed_emails enable row level security;
alter table public.career_vagas enable row level security;
alter table public.career_preferences enable row level security;

-- 6. Funções SECURITY DEFINER para checar papel/turma/aluno sem recursão em RLS
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

create or replace function public.get_my_aluno_numero()
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select aluno_numero from public.user_roles where user_id = auth.uid();
$$;

-- RPC segura: permite ao próprio usuário apenas marcar must_change_password = false após trocar senha
create or replace function public.complete_password_change()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Não autenticado';
  end if;
  update public.user_roles
  set must_change_password = false
  where user_id = auth.uid();
end;
$$;

grant execute on function public.complete_password_change() to authenticated;

-- RPC segura: permite ao próprio usuário registrar aceite do Termo de Uso (LGPD) e ativar sua ficha anônima
create or replace function public.accept_terms_of_use()
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := now();
  v_turma_id text;
  v_aluno_num integer;
  v_username text;
begin
  if auth.uid() is null then
    raise exception 'Não autenticado';
  end if;

  update public.user_roles
  set accepted_terms_at = coalesce(accepted_terms_at, v_now)
  where user_id = auth.uid()
  returning accepted_terms_at, turma_id, aluno_numero, username
    into v_now, v_turma_id, v_aluno_num, v_username;

  if v_turma_id is not null and v_aluno_num is not null then
    insert into public.student_profiles (
      turma_id, aluno_numero, nome_exibicao, perfil_publico, ativo_no_painel, updated_by, updated_at
    )
    values (
      v_turma_id, v_aluno_num, coalesce(nullif(trim(v_username), ''), 'Aluno #' || v_aluno_num::text),
      false, true, auth.uid(), now()
    )
    on conflict (turma_id, aluno_numero) do update
      set ativo_no_painel = true,
          updated_at = now();
  end if;

  return v_now;
end;
$$;

grant execute on function public.accept_terms_of_use() to authenticated;

-- RPC segura: confirma vínculo 2FA com conta Google institucional (@ime.eb.br)
create or replace function public.confirm_ime_google_link()
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_google_email text;
  v_now timestamptz := now();
begin
  if auth.uid() is null then
    raise exception 'Não autenticado';
  end if;

  select lower(i.identity_data->>'email')
    into v_google_email
  from auth.identities i
  where i.user_id = auth.uid()
    and i.provider = 'google'
    and lower(coalesce(i.identity_data->>'email', '')) ~ '^[^@\s]+@ime\.eb\.br$'
  limit 1;

  if v_google_email is null then
    raise exception 'Nenhuma conta Google @ime.eb.br vinculada a este usuário.';
  end if;

  if exists (
    select 1 from public.user_roles
    where lower(ime_email) = v_google_email
      and user_id <> auth.uid()
  ) then
    raise exception 'Este e-mail @ime.eb.br já está vinculado a outro aluno.';
  end if;

  update public.user_roles
  set ime_email = v_google_email,
      ime_verified_at = coalesce(ime_verified_at, v_now)
  where user_id = auth.uid();

  return jsonb_build_object(
    'ime_email', v_google_email,
    'ime_verified_at', v_now
  );
end;
$$;

grant execute on function public.confirm_ime_google_link() to authenticated;

-- 7. Políticas RLS — public.turmas
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

-- 8. Políticas RLS — public.user_roles (somente Super Admin edita papéis/vínculos)
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

-- 9. Políticas RLS — public.allowed_emails (somente Super Admin)
drop policy if exists "allowed_emails_super_admin" on public.allowed_emails;
create policy "allowed_emails_super_admin"
on public.allowed_emails for all to authenticated
using (public.get_my_role() = 'super_admin')
with check (public.get_my_role() = 'super_admin');

-- 10. Políticas RLS — public.career_vagas (leitura para turma; escrita só Gestor da turma ou Super Admin)
drop policy if exists "career_vagas_select" on public.career_vagas;
create policy "career_vagas_select"
on public.career_vagas for select to authenticated
using (
  public.get_my_role() = 'super_admin'
  or turma_id = public.get_my_turma_id()
);

drop policy if exists "career_vagas_write" on public.career_vagas;
create policy "career_vagas_write"
on public.career_vagas for all to authenticated
using (
  public.get_my_role() = 'super_admin'
  or (public.get_my_role() = 'gestor' and turma_id = public.get_my_turma_id())
)
with check (
  public.get_my_role() = 'super_admin'
  or (public.get_my_role() = 'gestor' and turma_id = public.get_my_turma_id())
);

-- 11. Políticas RLS — public.career_preferences (leitura ao vivo para turma; escrita própria ou Gestor/Super Admin)
drop policy if exists "career_preferences_select" on public.career_preferences;
create policy "career_preferences_select"
on public.career_preferences for select to authenticated
using (
  public.get_my_role() = 'super_admin'
  or turma_id = public.get_my_turma_id()
);

drop policy if exists "career_preferences_write" on public.career_preferences;
create policy "career_preferences_write"
on public.career_preferences for all to authenticated
using (
  public.get_my_role() = 'super_admin'
  or (public.get_my_role() = 'gestor' and turma_id = public.get_my_turma_id())
  or (
    turma_id = public.get_my_turma_id()
    and public.get_my_aluno_numero() is not null
    and aluno_numero = public.get_my_aluno_numero()
  )
)
with check (
  public.get_my_role() = 'super_admin'
  or (public.get_my_role() = 'gestor' and turma_id = public.get_my_turma_id())
  or (
    turma_id = public.get_my_turma_id()
    and public.get_my_aluno_numero() is not null
    and aluno_numero = public.get_my_aluno_numero()
  )
);

-- 12. Políticas RLS — Storage bucket privado 'ime-private' (datasets + avatars)
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
      and (
        (storage.foldername(name))[1] = public.get_my_turma_id()
        or (
          (storage.foldername(name))[1] = 'avatars'
          and (storage.foldername(name))[2] = public.get_my_turma_id()
          and (
            (
              public.get_my_aluno_numero() is not null
              and split_part(storage.filename(name), '.', 1) = public.get_my_aluno_numero()::text
            )
            or (
              split_part(storage.filename(name), '.', 1) ~ '^[0-9]+$'
              and public.is_student_profile_public(
                (storage.foldername(name))[2],
                split_part(storage.filename(name), '.', 1)::integer
              )
            )
          )
        )
      )
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
      and (
        (storage.foldername(name))[1] = public.get_my_turma_id()
        or (
          (storage.foldername(name))[1] = 'avatars'
          and (storage.foldername(name))[2] = public.get_my_turma_id()
          and lower(name) ~ '\.(webp|jpg|jpeg|png)$'
        )
      )
    )
    or (
      public.get_my_role() = 'viewer'
      and (storage.foldername(name))[1] = 'avatars'
      and (storage.foldername(name))[2] = public.get_my_turma_id()
      and public.get_my_aluno_numero() is not null
      and lower(storage.filename(name)) ~ ('^' || public.get_my_aluno_numero()::text || '\.(webp|jpg|jpeg|png)$')
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
      and (
        (storage.foldername(name))[1] = public.get_my_turma_id()
        or (
          (storage.foldername(name))[1] = 'avatars'
          and (storage.foldername(name))[2] = public.get_my_turma_id()
        )
      )
    )
    or (
      public.get_my_role() = 'viewer'
      and (storage.foldername(name))[1] = 'avatars'
      and (storage.foldername(name))[2] = public.get_my_turma_id()
      and public.get_my_aluno_numero() is not null
      and lower(storage.filename(name)) ~ ('^' || public.get_my_aluno_numero()::text || '\.(webp|jpg|jpeg|png)$')
    )
  )
)
with check (
  bucket_id = 'ime-private'
  and (
    public.get_my_role() = 'super_admin'
    or (
      public.get_my_role() = 'gestor'
      and (
        (storage.foldername(name))[1] = public.get_my_turma_id()
        or (
          (storage.foldername(name))[1] = 'avatars'
          and (storage.foldername(name))[2] = public.get_my_turma_id()
          and lower(name) ~ '\.(webp|jpg|jpeg|png)$'
        )
      )
    )
    or (
      public.get_my_role() = 'viewer'
      and (storage.foldername(name))[1] = 'avatars'
      and (storage.foldername(name))[2] = public.get_my_turma_id()
      and public.get_my_aluno_numero() is not null
      and lower(storage.filename(name)) ~ ('^' || public.get_my_aluno_numero()::text || '\.(webp|jpg|jpeg|png)$')
    )
  )
);

-- 12b. RPC segura para Gestor/Super Admin atualizar turmas.updated_at (invalidação de cache IndexedDB)
create or replace function public.bump_my_turma_version(p_turma_id text)
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := now();
begin
  if auth.uid() is null then
    raise exception 'Não autenticado';
  end if;
  if public.get_my_role() = 'super_admin'
     or (public.get_my_role() = 'gestor' and p_turma_id = public.get_my_turma_id()) then
    update public.turmas set updated_at = v_now where id = p_turma_id;
    return v_now;
  end if;
  raise exception 'Sem permissão para atualizar versão da turma';
end;
$$;

grant execute on function public.bump_my_turma_version(text) to authenticated;

-- 12c. Notas Pessoais do Semestre Atual (2 a 7 VEs com peso, VC, VF)
create table if not exists public.student_current_grades (
  turma_id text not null references public.turmas(id) on delete cascade,
  semestre text not null,
  aluno_numero integer not null,
  codigo text not null,
  ve_items jsonb not null default '[]'::jsonb
    check (jsonb_typeof(ve_items) = 'array' and jsonb_array_length(ve_items) <= 7),
  vc numeric(4,2) check (vc is null or (vc >= 0 and vc <= 10)),
  vf numeric(4,2) check (vf is null or (vf >= 0 and vf <= 10)),
  note text check (note is null or char_length(note) <= 300),
  updated_at timestamptz not null default now(),
  primary key (turma_id, semestre, aluno_numero, codigo)
);

alter table public.student_current_grades enable row level security;

drop policy if exists "student_current_grades_rw" on public.student_current_grades;
create policy "student_current_grades_rw"
on public.student_current_grades for all to authenticated
using (
  public.get_my_role() = 'super_admin'
  or (public.get_my_role() = 'gestor' and turma_id = public.get_my_turma_id())
  or (
    turma_id = public.get_my_turma_id()
    and public.get_my_aluno_numero() is not null
    and aluno_numero = public.get_my_aluno_numero()
  )
)
with check (
  public.get_my_role() = 'super_admin'
  or (public.get_my_role() = 'gestor' and turma_id = public.get_my_turma_id())
  or (
    turma_id = public.get_my_turma_id()
    and public.get_my_aluno_numero() is not null
    and aluno_numero = public.get_my_aluno_numero()
  )
);

-- 12d. Subturmas do Ciclo Básico (1º ano: Turma A/B; 2º ano: Turma A/B/C)
create table if not exists public.student_subturmas (
  turma_id text not null references public.turmas(id) on delete cascade,
  semestre text not null,
  aluno_numero integer not null,
  subturma text not null check (subturma in ('Turma A', 'Turma B', 'Turma C')),
  updated_at timestamptz not null default now(),
  primary key (turma_id, semestre, aluno_numero)
);

alter table public.student_subturmas enable row level security;

drop policy if exists "student_subturmas_select" on public.student_subturmas;
create policy "student_subturmas_select"
on public.student_subturmas for select to authenticated
using (
  public.get_my_role() = 'super_admin'
  or turma_id = public.get_my_turma_id()
);

drop policy if exists "student_subturmas_write" on public.student_subturmas;
create policy "student_subturmas_write"
on public.student_subturmas for all to authenticated
using (
  public.get_my_role() = 'super_admin'
  or (public.get_my_role() = 'gestor' and turma_id = public.get_my_turma_id())
  or (
    turma_id = public.get_my_turma_id()
    and public.get_my_aluno_numero() is not null
    and aluno_numero = public.get_my_aluno_numero()
  )
)
with check (
  public.get_my_role() = 'super_admin'
  or (public.get_my_role() = 'gestor' and turma_id = public.get_my_turma_id())
  or (
    turma_id = public.get_my_turma_id()
    and public.get_my_aluno_numero() is not null
    and aluno_numero = public.get_my_aluno_numero()
  )
);

-- 12e. Calendário Compartilhado & Anotações de Estudo (por Engenharia ou Turma A/B/C)
create table if not exists public.calendar_events (
  id uuid primary key default gen_random_uuid(),
  turma_id text not null references public.turmas(id) on delete cascade,
  semestre text not null,
  grupo_academico text not null check (char_length(grupo_academico) <= 60),
  event_date date not null,
  tipo text not null check (tipo in ('VE', 'VC', 'VF', 'Trabalho', 'Lista', 'Outro')),
  disciplina_nome text check (disciplina_nome is null or char_length(disciplina_nome) <= 80),
  titulo text not null check (char_length(titulo) between 1 and 120),
  anotacao text check (anotacao is null or char_length(anotacao) <= 1000),
  is_private boolean not null default false,
  owner_aluno_numero integer,
  created_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

alter table public.calendar_events enable row level security;

drop policy if exists "calendar_events_select" on public.calendar_events;
create policy "calendar_events_select"
on public.calendar_events for select to authenticated
using (
  public.get_my_role() = 'super_admin'
  or (
    turma_id = public.get_my_turma_id()
    and (
      not is_private
      or created_by = auth.uid()
      or (public.get_my_aluno_numero() is not null and owner_aluno_numero = public.get_my_aluno_numero())
    )
  )
);

drop policy if exists "calendar_events_insert" on public.calendar_events;
create policy "calendar_events_insert"
on public.calendar_events for insert to authenticated
with check (
  public.get_my_role() = 'super_admin'
  or (
    turma_id = public.get_my_turma_id()
    and (
      public.get_my_role() = 'gestor'
      or (public.get_my_aluno_numero() is not null and owner_aluno_numero = public.get_my_aluno_numero())
    )
  )
);

drop policy if exists "calendar_events_update_delete" on public.calendar_events;
create policy "calendar_events_update_delete"
on public.calendar_events for update to authenticated
using (
  public.get_my_role() = 'super_admin'
  or (public.get_my_role() = 'gestor' and turma_id = public.get_my_turma_id())
  or (turma_id = public.get_my_turma_id() and (created_by = auth.uid() or owner_aluno_numero = public.get_my_aluno_numero()))
)
with check (
  public.get_my_role() = 'super_admin'
  or (public.get_my_role() = 'gestor' and turma_id = public.get_my_turma_id())
  or (turma_id = public.get_my_turma_id() and (created_by = auth.uid() or owner_aluno_numero = public.get_my_aluno_numero()))
);

drop policy if exists "calendar_events_delete" on public.calendar_events;
create policy "calendar_events_delete"
on public.calendar_events for delete to authenticated
using (
  public.get_my_role() = 'super_admin'
  or (public.get_my_role() = 'gestor' and turma_id = public.get_my_turma_id())
  or (turma_id = public.get_my_turma_id() and (created_by = auth.uid() or owner_aluno_numero = public.get_my_aluno_numero()))
);

-- 12f. Registro de Avatares (evita requisições vazias ao Storage quando aluno ainda não tem foto)
create table if not exists public.student_avatars (
  turma_id text not null references public.turmas(id) on delete cascade,
  aluno_numero integer not null,
  storage_path text not null,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key (turma_id, aluno_numero)
);

alter table public.student_avatars enable row level security;

-- 12g. Perfis & Privacidade por Padrão (LGPD — Opt-In voluntário por aluno)
create table if not exists public.student_profiles (
  turma_id text not null references public.turmas(id) on delete cascade,
  aluno_numero integer not null,
  nome_exibicao text not null,
  perfil_publico boolean not null default false,
  ativo_no_painel boolean not null default false,
  consentimento_em timestamptz,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key (turma_id, aluno_numero)
);

alter table public.student_profiles add column if not exists ativo_no_painel boolean not null default false;
grant select, insert, update, delete on public.student_profiles to service_role;
grant select, insert, update on public.student_profiles to authenticated;

create or replace function public.get_turma_visibility_flags(p_turma_id text)
returns table (
  aluno_numero integer,
  ativo_no_painel boolean,
  perfil_publico boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select sp.aluno_numero, sp.ativo_no_painel, sp.perfil_publico
  from public.student_profiles sp
  where sp.turma_id = p_turma_id
    and (
      public.get_my_role() = 'super_admin'
      or p_turma_id = public.get_my_turma_id()
    );
$$;

grant execute on function public.get_turma_visibility_flags(text) to authenticated;

alter table public.student_profiles enable row level security;

-- Helper SECURITY DEFINER para verificar se o perfil do aluno é público (sem recursão em RLS)
create or replace function public.is_student_profile_public(p_turma_id text, p_aluno_numero integer)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select sp.perfil_publico
      from public.student_profiles sp
      where sp.turma_id = p_turma_id
        and sp.aluno_numero = p_aluno_numero
    ),
    false
  );
$$;

-- RLS SELECT: aluno da turma só lê nome_exibicao se for o próprio perfil OU se perfil_publico = true
drop policy if exists "student_profiles_select" on public.student_profiles;
create policy "student_profiles_select"
on public.student_profiles for select to authenticated
using (
  public.get_my_role() = 'super_admin'
  or (
    turma_id = public.get_my_turma_id()
    and (
      perfil_publico = true
      or (public.get_my_aluno_numero() is not null and aluno_numero = public.get_my_aluno_numero())
    )
  )
);

-- RLS UPDATE: somente o próprio aluno (ou super_admin) atualiza sua linha
drop policy if exists "student_profiles_update" on public.student_profiles;
create policy "student_profiles_update"
on public.student_profiles for update to authenticated
using (
  public.get_my_role() = 'super_admin'
  or (
    turma_id = public.get_my_turma_id()
    and public.get_my_aluno_numero() is not null
    and aluno_numero = public.get_my_aluno_numero()
  )
)
with check (
  public.get_my_role() = 'super_admin'
  or (
    turma_id = public.get_my_turma_id()
    and public.get_my_aluno_numero() is not null
    and aluno_numero = public.get_my_aluno_numero()
  )
);

-- RLS INSERT: apenas super_admin ou gestor da turma no provisionamento
drop policy if exists "student_profiles_insert" on public.student_profiles;
create policy "student_profiles_insert"
on public.student_profiles for insert to authenticated
with check (
  public.get_my_role() = 'super_admin'
  or (public.get_my_role() = 'gestor' and turma_id = public.get_my_turma_id())
);

-- RLS SELECT em student_avatars: espelha exatamente a regra de student_profiles
drop policy if exists "student_avatars_select" on public.student_avatars;
create policy "student_avatars_select"
on public.student_avatars for select to authenticated
using (
  public.get_my_role() = 'super_admin'
  or (
    turma_id = public.get_my_turma_id()
    and (
      (public.get_my_aluno_numero() is not null and aluno_numero = public.get_my_aluno_numero())
      or public.is_student_profile_public(turma_id, aluno_numero)
    )
  )
);

drop policy if exists "student_avatars_write" on public.student_avatars;
create policy "student_avatars_write"
on public.student_avatars for all to authenticated
using (
  public.get_my_role() = 'super_admin'
  or (public.get_my_role() = 'gestor' and turma_id = public.get_my_turma_id())
  or (
    turma_id = public.get_my_turma_id()
    and public.get_my_aluno_numero() is not null
    and aluno_numero = public.get_my_aluno_numero()
  )
)
with check (
  public.get_my_role() = 'super_admin'
  or (public.get_my_role() = 'gestor' and turma_id = public.get_my_turma_id())
  or (
    turma_id = public.get_my_turma_id()
    and public.get_my_aluno_numero() is not null
    and aluno_numero = public.get_my_aluno_numero()
  )
);

-- 12g. Privacidade por Padrão (LGPD — Opt-In voluntário por aluno)
create table if not exists public.student_privacy (
  turma_id text not null references public.turmas(id) on delete cascade,
  aluno_numero integer not null,
  perfil_publico boolean not null default false,
  consentimento_em timestamptz,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key (turma_id, aluno_numero)
);

alter table public.student_privacy enable row level security;

drop policy if exists "student_privacy_select" on public.student_privacy;
create policy "student_privacy_select"
on public.student_privacy for select to authenticated
using (
  public.get_my_role() = 'super_admin'
  or turma_id = public.get_my_turma_id()
);

drop policy if exists "student_privacy_write_own" on public.student_privacy;
create policy "student_privacy_write_own"
on public.student_privacy for all to authenticated
using (
  turma_id = public.get_my_turma_id()
  and public.get_my_aluno_numero() is not null
  and aluno_numero = public.get_my_aluno_numero()
)
with check (
  turma_id = public.get_my_turma_id()
  and public.get_my_aluno_numero() is not null
  and aluno_numero = public.get_my_aluno_numero()
);

create or replace function public.set_my_privacy_opt_in(p_perfil_publico boolean)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_turma_id text := public.get_my_turma_id();
  v_aluno_num integer := public.get_my_aluno_numero();
  v_now timestamptz := now();
  v_consent timestamptz := case when coalesce(p_perfil_publico, false) then v_now else null end;
  v_fallback_name text;
begin
  if auth.uid() is null then
    raise exception 'Não autenticado';
  end if;
  if v_turma_id is null or v_aluno_num is null then
    raise exception 'Conta sem turma ou matrícula vinculada';
  end if;

  select coalesce(nullif(trim(username), ''), 'Aluno #' || v_aluno_num::text)
    into v_fallback_name
  from public.user_roles
  where user_id = auth.uid();

  insert into public.student_profiles (
    turma_id, aluno_numero, nome_exibicao, perfil_publico, consentimento_em, updated_by, updated_at
  )
  values (
    v_turma_id, v_aluno_num, coalesce(v_fallback_name, 'Aluno #' || v_aluno_num::text),
    coalesce(p_perfil_publico, false), v_consent, auth.uid(), v_now
  )
  on conflict (turma_id, aluno_numero) do update
    set perfil_publico = excluded.perfil_publico,
        consentimento_em = excluded.consentimento_em,
        updated_by = auth.uid(),
        updated_at = v_now;

  return jsonb_build_object(
    'turma_id', v_turma_id,
    'aluno_numero', v_aluno_num,
    'perfil_publico', coalesce(p_perfil_publico, false),
    'consentimento_em', v_consent
  );
end;
$$;

grant execute on function public.set_my_privacy_opt_in(boolean) to authenticated;

-- 13. Trigger opcional para Whitelist
create or replace function public.handle_allowed_signup()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  wl record;
begin
  select * into wl from public.allowed_emails where lower(email) = lower(new.email);
  if found then
    insert into public.user_roles (user_id, email, username, role, turma_id, aluno_numero, must_change_password)
    values (new.id, lower(new.email), wl.username, wl.role, wl.turma_id, wl.aluno_numero, false)
    on conflict (user_id) do update
      set username = excluded.username,
          role = excluded.role,
          turma_id = excluded.turma_id,
          aluno_numero = excluded.aluno_numero;
    return new;
  end if;

  if lower(coalesce(new.email, '')) ~ '^[^@\s]+@ime\.eb\.br$' then
    return new;
  end if;

  if new.email_confirmed_at is null and exists (select 1 from public.allowed_emails) then
    raise exception 'Conta nao autorizada na whitelist. Solicite inclusao ao Super Admin.';
  end if;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created_whitelist on auth.users;
create trigger on_auth_user_created_whitelist
after insert on auth.users
for each row execute function public.handle_allowed_signup();

-- 14. Habilitar Supabase Realtime para atualização ao vivo de vagas e escolhas
do $$
begin
  alter publication supabase_realtime add table public.career_vagas;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.career_preferences;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.calendar_events;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.student_avatars;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.student_privacy;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.student_profiles;
exception when duplicate_object then null;
end $$;

-- 15. Turmas iniciais (Turma 28 atual até Turma 31 que entra ano que vem)
insert into public.turmas (id, nome, semestre_atual, storage_path) values
  ('turma_28', 'Turma 28', '3.2', 'turma_28/data.json'),
  ('turma_29', 'Turma 29', '2.2', 'turma_29/data.json'),
  ('turma_30', 'Turma 30', '1.2', 'turma_30/data.json'),
  ('turma_31', 'Turma 31', '1.1', 'turma_31/data.json')
on conflict (id) do nothing;

-- 15b. Estatísticas agregadas por matéria entre turmas (apenas médias/resumo, zero dado individual de aluno)
create table if not exists public.turma_disciplina_stats (
  turma_id text not null references public.turmas(id) on delete cascade,
  turma_nome text not null,
  semestre text not null,
  codigo text not null,
  nome text not null,
  grupo_equivalente text not null,
  curso_label text,
  militar boolean not null default false,
  is_parcial boolean not null default false,
  qtd_alunos integer not null default 0,
  media numeric(4,2),
  desvio_padrao numeric(4,2),
  menor_nota numeric(4,2),
  maior_nota numeric(4,2),
  updated_at timestamptz not null default now(),
  primary key (turma_id, semestre, codigo)
);

alter table public.turma_disciplina_stats add column if not exists curso_label text;

alter table public.turma_disciplina_stats enable row level security;

drop policy if exists "turma_disciplina_stats_select" on public.turma_disciplina_stats;
create policy "turma_disciplina_stats_select"
on public.turma_disciplina_stats for select to authenticated
using (true);

drop policy if exists "turma_disciplina_stats_write" on public.turma_disciplina_stats;
create policy "turma_disciplina_stats_write"
on public.turma_disciplina_stats for all to authenticated
using (
  public.get_my_role() = 'super_admin'
  or (public.get_my_role() = 'gestor' and turma_id = public.get_my_turma_id())
)
with check (
  public.get_my_role() = 'super_admin'
  or (public.get_my_role() = 'gestor' and turma_id = public.get_my_turma_id())
);

-- 16. Permissões de schema/tabelas/sequences para PostgREST (authenticated & service_role)
grant usage on schema public to anon, authenticated, service_role;
grant all on all tables in schema public to authenticated, service_role;
grant all on all sequences in schema public to authenticated, service_role;
alter default privileges in schema public grant all on tables to authenticated, service_role;
alter default privileges in schema public grant all on sequences to authenticated, service_role;

-- 17. Onboarding Google Institucional (1º Acesso sem senha padrão)
create or replace function public.get_onboarding_turmas_and_students()
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_email text;
  v_turmas jsonb;
  v_students jsonb;
begin
  if auth.uid() is null then
    raise exception 'Não autenticado';
  end if;

  select lower(coalesce(
    (select i.identity_data->>'email' from auth.identities i where i.user_id = auth.uid() and i.provider = 'google' limit 1),
    (select u.email from auth.users u where u.id = auth.uid())
  )) into v_email;

  if coalesce(v_email, '') !~ '^[^@\s]+@ime\.eb\.br$' then
    raise exception 'Acesso restrito a contas institucionais.';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object('id', t.id, 'nome', t.nome) order by t.id), '[]'::jsonb)
    into v_turmas
  from public.turmas t;

  select coalesce(jsonb_agg(jsonb_build_object(
    'turma_id', sp.turma_id,
    'aluno_numero', sp.aluno_numero,
    'nome_exibicao', sp.nome_exibicao
  ) order by sp.turma_id, sp.nome_exibicao), '[]'::jsonb)
    into v_students
  from public.student_profiles sp
  where not exists (
    select 1
    from public.user_roles ur
    where ur.turma_id = sp.turma_id
      and ur.aluno_numero = sp.aluno_numero
      and ur.ime_email is not null
  );

  return jsonb_build_object('turmas', v_turmas, 'students', v_students);
end;
$$;

grant execute on function public.get_onboarding_turmas_and_students() to authenticated;

create or replace function public.claim_student_google_account(
  p_turma_id text,
  p_aluno_numero integer
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_email text;
  v_now timestamptz := now();
  v_nome text;
  v_legacy_role text := 'viewer';
  v_legacy_username text;
begin
  if auth.uid() is null then
    raise exception 'Não autenticado';
  end if;

  select lower(coalesce(
    (select i.identity_data->>'email' from auth.identities i where i.user_id = auth.uid() and i.provider = 'google' limit 1),
    (select u.email from auth.users u where u.id = auth.uid())
  )) into v_email;

  if coalesce(v_email, '') !~ '^[^@\s]+@ime\.eb\.br$' then
    raise exception 'Acesso restrito a contas institucionais.';
  end if;

  if exists (
    select 1 from public.user_roles
    where lower(ime_email) = v_email
      and user_id <> auth.uid()
  ) then
    raise exception 'Esta conta Google já está vinculada a outro aluno.';
  end if;

  if exists (
    select 1 from public.user_roles
    where turma_id = p_turma_id
      and aluno_numero = p_aluno_numero
      and ime_email is not null
      and user_id <> auth.uid()
  ) then
    raise exception 'Este aluno já vinculou outra conta Google institucional.';
  end if;

  select sp.nome_exibicao
    into v_nome
  from public.student_profiles sp
  where sp.turma_id = p_turma_id
    and sp.aluno_numero = p_aluno_numero;

  if v_nome is null then
    raise exception 'Aluno não encontrado nesta turma.';
  end if;

  select ur.role, ur.username
    into v_legacy_role, v_legacy_username
  from public.user_roles ur
  where ur.turma_id = p_turma_id
    and ur.aluno_numero = p_aluno_numero
    and ur.ime_email is null
  limit 1;

  delete from public.user_roles
  where turma_id = p_turma_id
    and aluno_numero = p_aluno_numero
    and ime_email is null
    and user_id <> auth.uid();

  insert into public.user_roles (
    user_id, email, username, role, turma_id, aluno_numero,
    must_change_password, accepted_terms_at, ime_email, ime_verified_at
  )
  values (
    auth.uid(), v_email, coalesce(nullif(trim(v_legacy_username), ''), v_nome),
    coalesce(v_legacy_role, 'viewer'), p_turma_id, p_aluno_numero,
    false, v_now, v_email, v_now
  )
  on conflict (user_id) do update
    set email = excluded.email,
        username = excluded.username,
        role = excluded.role,
        turma_id = excluded.turma_id,
        aluno_numero = excluded.aluno_numero,
        must_change_password = false,
        accepted_terms_at = coalesce(public.user_roles.accepted_terms_at, v_now),
        ime_email = excluded.ime_email,
        ime_verified_at = coalesce(public.user_roles.ime_verified_at, v_now);

  update public.student_profiles
  set ativo_no_painel = true,
      updated_by = auth.uid(),
      updated_at = v_now
  where turma_id = p_turma_id
    and aluno_numero = p_aluno_numero;

  return jsonb_build_object(
    'turma_id', p_turma_id,
    'aluno_numero', p_aluno_numero,
    'nome_exibicao', v_nome,
    'ime_email', v_email
  );
end;
$$;

grant execute on function public.claim_student_google_account(text, integer) to authenticated;
