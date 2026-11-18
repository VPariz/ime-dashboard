# Configuração de Login Privado (Supabase + GitHub Pages)

Este projeto mantém **apenas o código-fonte e um Modo Demo fictício no GitHub**.  
Os dados reais (`data.js` / `data.json`) ficam bloqueados no `.gitignore` e são baixados apenas após autenticação via **Supabase Auth + Storage privado com RLS**.

---

## Passo 1 — Criar projeto gratuito no Supabase
1. Acesse [supabase.com](https://supabase.com/) e crie um projeto gratuito.
2. No menu esquerdo, vá em **Project Settings -> API** (ou **Data API / API Keys**).
3. Copie:
   - **Project URL** (`https://xxxxx.supabase.co`)
   - **anon / public key** *(nunca use a `service_role` key no frontend!)*

---

## Passo 2 — Criar Bucket Privado e Regra RLS
1. No menu esquerdo, vá em **Storage -> New bucket**.
2. Nome: `ime-private`
3. Deixe **Public bucket DESMARCADO** (bucket privado).
4. Vá em **SQL Editor -> New query** e execute:

```sql
create policy "Apenas autenticados leem ime-private"
on storage.objects
for select
to authenticated
using (bucket_id = 'ime-private');
```

---

## Passo 3 — Gerar e Subir `data.json`
No seu computador, dentro da pasta `ime-dashboard`, execute:

```bash
python prepare_supabase_data.py
```

Depois, abra o Supabase em **Storage -> ime-private -> Upload file** e envie o arquivo `data.json` gerado.

---

## Passo 4 — Criar Contas Autorizadas (e bloquear cadastro público)
1. Vá em **Authentication -> Sign In / Providers** e **desative** *"Allow new users to sign up"* (para que estranhos não consigam criar conta sozinhos).
2. Vá em **Authentication -> Users -> Add user -> Create new user** para cadastrar os e-mails/senhas autorizados (ou envie convites por e-mail).

---

## Passo 5 — Conectar ao Dashboard
Edite o arquivo [supabase-config.js](supabase-config.js) com sua URL e `anonKey`:

```js
window.SUPABASE_CONFIG = {
  url: 'https://SEU_PROJETO.supabase.co',
  anonKey: 'SUA_ANON_KEY_PUBLICA',
  bucket: 'ime-private',
  objectPath: 'data.json'
};
```

Faça `git commit` e `git push`. Mesmo com o repositório público no GitHub, visitantes verão apenas a tela de login e o **Modo Demo com dados fictícios**.
