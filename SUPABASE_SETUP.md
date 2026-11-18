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
- Regras no bucket `ime-private` isolando cada turma em sua própria pasta (`turma_28/data.json` até `turma_31/data.json`).
- Turmas pré-cadastradas:
  - **`turma_28`** (`Turma 28` · semestre atual **`3.2`**)
  - **`turma_29`** (`Turma 29` · semestre atual **`2.2`**)
  - **`turma_30`** (`Turma 30` · semestre atual **`1.2`**)
  - **`turma_31`** (`Turma 31` · semestre atual **`1.1`**, entrada próximo ano)

---

## Passo 3 — Gerar e Subir `data.json` das Turmas
No seu PC, gere o JSON da Turma 28 e os JSONs iniciais de Turma 29–31:

```bash
python prepare_supabase_data.py
```

Depois, no Supabase:
1. Entre em **Storage -> `ime-private`**.
2. Crie a pasta **`turma_28`** e suba `data.json` (`turma_28/data.json`).
3. Para as turmas 29, 30 e 31, basta subir os arquivos de `starter_turmas/` como `turma_29/data.json`, `turma_30/data.json` e `turma_31/data.json` **ou** apenas logar como `super_admin` / `gestor` no dashboard e importar a primeira planilha na aba **Gestão & Notas** que ele cria o arquivo automaticamente no Storage.

---

## Passo 4 — Criar os Logins
### Jeito A: Logins compartilhados por turma (mais rápido)
1. Em **Authentication -> Sign In / Providers**, desative **"Allow new users to sign up"**.
2. Em **Authentication -> Users -> Add user**, crie o seu usuário Super Admin e os logins de `gestor` / `viewer` de cada turma (`turma_28` até `turma_31`).
3. No **SQL Editor**, associe o papel e a turma de cada conta:

```sql
-- Seu usuário como Super Admin (enxerga Turma 28, 29, 30 e 31)
insert into public.user_roles (user_id, email, role, turma_id)
select id, email, 'super_admin', null from auth.users where email = 'SEU_EMAIL@exemplo.com'
on conflict (user_id) do update set role = 'super_admin', turma_id = null;

-- Exemplo Gestor / Visualizador da Turma 28 (repita trocando turma_28 por turma_29, turma_30 ou turma_31)
insert into public.user_roles (user_id, email, role, turma_id)
select id, email, 'gestor', 'turma_28' from auth.users where email = 'gestor.t28@exemplo.com'
on conflict (user_id) do update set role = 'gestor', turma_id = 'turma_28';

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
