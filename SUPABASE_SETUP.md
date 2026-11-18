# Configuração Multi-Turma com Papéis (`viewer`, `gestor`, `super_admin`)

Este projeto mantém **apenas o código-fonte e um Modo Demo fictício no GitHub**.  
Os dados reais ficam fora do repositório e são acessados conforme o nível de acesso do login no **Supabase**:

| Papel (`role`) | Acesso | Pode editar notas? |
| :--- | :--- | :--- |
| **`viewer`** | Apenas a sua turma | Não (somente leitura via RLS) |
| **`gestor`** | Apenas a sua turma | Sim — **somente o semestre atual** definido para a turma |
| **`super_admin`** | Todas as turmas | Sim + cria turmas, troca semestre atual e gerencia usuários |

---

## Passo 1 — Criar projeto e bucket privado no Supabase
1. Crie um projeto gratuito em [supabase.com](https://supabase.com/).
2. Em **Storage -> New bucket**, crie o bucket **`ime-private`** com **Public bucket DESMARCADO** (privado).
3. Em **Project Settings -> API**, copie a **Project URL** e a **anon / public key**.

---

## Passo 2 — Aplicar o Schema + Regras RLS
1. Abra **SQL Editor -> New query** no Supabase.
2. Copie e execute todo o conteúdo de [supabase_schema.sql](supabase_schema.sql).

Isso cria:
- Tabelas `turmas`, `user_roles` e `allowed_emails` (com RLS).
- Regras no bucket `ime-private` isolando cada turma em sua própria pasta (`turma_28/data.json`, `turma_29/data.json`, etc.).
- Turma inicial `turma_28` (`Turma 28`, semestre atual `3.2`).

---

## Passo 3 — Gerar e Subir `data.json` da Turma 28
No seu PC, gere o JSON limpo a partir do `data.js` local:

```bash
python prepare_supabase_data.py
```

Depois, no Supabase:
1. Entre em **Storage -> `ime-private`**.
2. Clique em **Create folder** com nome **`turma_28`**.
3. Entre na pasta `turma_28` e faça upload do `data.json` gerado (`turma_28/data.json`).

---

## Passo 4 — Criar os Logins
### Jeito A: Logins compartilhados por turma (mais rápido)
1. Em **Authentication -> Sign In / Providers**, desative **"Allow new users to sign up"**.
2. Em **Authentication -> Users -> Add user**, crie as contas desejadas (ex.: seu e-mail de Super Admin, `gestor.t28@...`, `turma28@...`).
3. No **SQL Editor**, associe o papel e a turma de cada conta:

```sql
-- Seu usuário como Super Admin (vê todas as turmas)
insert into public.user_roles (user_id, email, role, turma_id)
select id, email, 'super_admin', null from auth.users where email = 'SEU_EMAIL@exemplo.com'
on conflict (user_id) do update set role = 'super_admin', turma_id = null;

-- Gestor da Turma 28
insert into public.user_roles (user_id, email, role, turma_id)
select id, email, 'gestor', 'turma_28' from auth.users where email = 'gestor.t28@exemplo.com'
on conflict (user_id) do update set role = 'gestor', turma_id = 'turma_28';

-- Visualizador da Turma 28
insert into public.user_roles (user_id, email, role, turma_id)
select id, email, 'viewer', 'turma_28' from auth.users where email = 'turma28@exemplo.com'
on conflict (user_id) do update set role = 'viewer', turma_id = 'turma_28';
```

### Jeito B: Login individual por aluno (usando Whitelist)
1. Mantenha **"Allow new users to sign up"** ativo no Supabase.
2. Pelo painel **Gestão -> Super Admin** dentro do próprio site (ou via SQL em `public.allowed_emails`), adicione os e-mails autorizados de cada turma.
3. Cada aluno clica em **"Primeiro Acesso (Criar Senha)"** na tela inicial para definir a própria senha. Quem não estiver em `allowed_emails` é bloqueado pelo banco.

---

## Passo 5 — Conectar ao Frontend
Edite [supabase-config.js](supabase-config.js) com sua `url` e `anonKey`:

```js
window.SUPABASE_CONFIG = {
  url: 'https://SEU_PROJETO.supabase.co',
  anonKey: 'SUA_ANON_KEY_PUBLICA',
  bucket: 'ime-private',
  objectPath: 'turma_28/data.json'
};
```
