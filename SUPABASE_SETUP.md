# Configuração Multi-Turma, Login por Nome de Guerra e Escolhas Ao Vivo (Supabase)

Este projeto mantém **apenas o código-fonte e o Modo Demo fictício no GitHub**.  
Os dados reais (`data.js` / `data.json`) ficam fora do repositório e são acessados conforme o nível de acesso no **Supabase**:

| Papel (`role`) | Turmas visíveis | Notas (Semestre atual) | Lugares/Vagas (Eng., Estágio, OM) | Preferências (1ª–10ª opção) | Usuários & Reset de Senha |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **`super_admin`** (Você) | Todas (`28` a `31`+) | Edita + define semestre atual | Edita todas | Edita todas | Cria, promove `gestor` e reseta senhas |
| **`gestor`** (Admin da turma) | Apenas a sua | Edita/importa apenas semestre atual | Edita apenas da sua turma | Edita da sua turma | Não acessa |
| **`viewer`** (Aluno individual) | Apenas a sua | Somente leitura | Somente leitura (ao vivo) | Edita **apenas as suas** (ao vivo) | Troca a própria senha no 1º acesso |

---

## Passo 1 — Criar projeto e bucket privado no Supabase
1. Crie um projeto gratuito em [supabase.com](https://supabase.com/).
2. Em **Storage -> New bucket**, crie **`ime-private`** com **Public bucket DESMARCADO** (privado).
3. Em **Authentication -> Sign In / Providers**, **desative** *"Allow new users to sign up"* (as contas dos alunos são criadas pelo Super Admin).
4. Em **Project Settings -> API**, copie:
   - **Project URL** (`https://xxxxx.supabase.co`)
   - **anon / public key** *(usada em `supabase-config.js`)*
   - **service_role key** *(NUNCA coloque no frontend — usada apenas no script local ou na Edge Function)*

---

## Passo 2 — Aplicar o Schema, RLS e Realtime
1. Abra **SQL Editor -> New query** no Supabase.
2. Execute todo o arquivo [supabase_schema.sql](supabase_schema.sql).

Isso cria:
- Tabelas `turmas`, `user_roles` (com `username`, `aluno_numero` e `must_change_password`), `allowed_emails`, `career_vagas` e `career_preferences`.
- Políticas **RLS** isolando cada turma e garantindo que `viewer` altere apenas as próprias preferências.
- Publicação **Realtime** em `career_vagas` e `career_preferences` para atualização ao vivo.

---

## Passo 3 — Gerar e Subir os Arquivos das Turmas
No seu PC:

```bash
python prepare_supabase_data.py
```

No Supabase (**Storage -> `ime-private`**):
- Suba `data.json` em `turma_28/data.json`.
- Suba `starter_turmas/turma_29_data.json` em `turma_29/data.json`, `turma_30_data.json` em `turma_30/data.json` e `turma_31_data.json` em `turma_31/data.json`.

---

## Passo 4 — Criar sua conta `super_admin` e os logins dos alunos
1. Em **Authentication -> Users -> Add user**, crie sua conta pessoal (com **Auto Confirm** marcado) e promova no SQL Editor:

```sql
insert into public.user_roles (user_id, email, username, role, turma_id, must_change_password)
select id, email, 'Super Admin', 'super_admin', null, false
from auth.users where email = 'SEU_EMAIL@exemplo.com'
on conflict (user_id) do update set role = 'super_admin', turma_id = null, must_change_password = false;
```

2. **Criar logins de todos os alunos no padrão `Nome_Guerra Turma` / `senha_Nome_Guerra_Turma`:**
   - **Pelo terminal local (mais rápido):**
     ```powershell
     $env:SUPABASE_URL="https://SEU_PROJETO.supabase.co"
     $env:SUPABASE_SERVICE_ROLE_KEY="SUA_SERVICE_ROLE_KEY"
     python manage_supabase_users.py preview --turma turma_28 --file data.json
     python manage_supabase_users.py provision --turma turma_28 --file data.json
     ```
   - **Pelo próprio painel do site (com botão Resetar Senha em 1 clique):**
     Publique a Edge Function [supabase/functions/admin-users/index.ts](supabase/functions/admin-users/index.ts):
     ```bash
     supabase functions deploy admin-users --no-verify-jwt
     ```
     *(A função valida o JWT e exige `role = 'super_admin'` internamente).*

3. **Resetar senha caso um aluno perca:**
   - Clique em **Resetar Senha** no painel **Gestão & Notas -> Administração Geral** (se a Edge Function estiver ativa), **ou** rode no terminal:
     ```powershell
     python manage_supabase_users.py reset --login "Pedro Silva 29"
     ```

---

## Passo 5 — Conectar Frontend e Keep-Alive (evitar pausa de 7 dias)
1. Preencha `url` e `anonKey` em [supabase-config.js](supabase-config.js).
2. No GitHub (**Settings -> Secrets and variables -> Actions**), crie os 2 Secrets:
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
   
   O workflow [.github/workflows/supabase-keep-alive.yml](.github/workflows/supabase-keep-alive.yml) fará um ping automático a cada 3 dias para impedir que o plano gratuito pause por inatividade.

---

## Passo 6 — Meu Painel, Avatares Comprimidos, Calendário e Cache Free Tier
Ao executar o [supabase_schema.sql](supabase_schema.sql) atualizado (idempotente — pode rodar novamente sobre um banco existente), são criadas automaticamente:
- **`student_current_grades`**: notas pessoais do semestre atual (2 a 7 VEs com peso individual, VC e VF), isoladas por RLS para o próprio aluno (não alteram o ranking oficial).
- **`student_subturmas`**: escolha de `Turma A` / `Turma B` (1º ano `1.1–1.2`) ou `Turma A` / `Turma B` / `Turma C` (2º ano `2.1–2.2`).
- **`calendar_events`**: provas, trabalhos, listas e anotações de estudo compartilhadas por `(turma_id, semestre, grupo_academico)`, com suporte a anotações privadas (`is_private = true`) e atualização em tempo real via Supabase Realtime.
- **`student_avatars` + Storage `ime-private/avatars/<turma_id>/<aluno_numero>.webp`**: fotos de perfil comprimidas no navegador para `256×256` WebP (`<= 60 KB`, teto `150 KB`, bloqueio de SVG/HTML). Alunos sobem a própria foto; múltiplos **Gestores** por turma podem subir fotos dos colegas da própria turma; **Super Admin** em qualquer turma. Sem foto, exibe a inicial do 1º nome com 0 requisições ao Storage.
- **Cache inteligente (IndexedDB + `bump_my_turma_version`)**: o cliente guarda o `data.json` da turma no IndexedDB indexado por `turmas.updated_at`. Quando um Gestor publica novas notas, o RPC `bump_my_turma_version` atualiza o timestamp e invalida o cache automaticamente, economizando Egress no plano gratuito.
