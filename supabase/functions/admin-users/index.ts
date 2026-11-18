// Supabase Edge Function: admin-users
// Permite APENAS ao super_admin criar contas em lote (Nome + Turma) e resetar senhas
// usando SUPABASE_SERVICE_ROLE_KEY com segurança no servidor.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function stripAccents(str: string): string {
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function titleCase(word: string): string {
  if (!word) return '';
  return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
}

function buildDefaultCredentials(nome: string, turmaId: string) {
  const numMatch = String(turmaId || '').match(/\d+/);
  const turmaNum = numMatch ? numMatch[0] : '28';
  const cleanWords = stripAccents(String(nome || ''))
    .replace(/[^a-zA-Z0-9\s]/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  const selected = cleanWords.length >= 2
    ? [titleCase(cleanWords[0]), titleCase(cleanWords[cleanWords.length - 1])]
    : [titleCase(cleanWords[0] || 'Aluno')];

  const loginDisplay = [...selected, turmaNum].join(' ');
  const underscorePart = [...selected, turmaNum].join('_');
  const internalEmail = `${underscorePart.toLowerCase()}@ime.local`;
  const defaultPassword = `senha_${underscorePart}`;
  return { loginDisplay, internalEmail, defaultPassword };
}

function jsonResp(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    if (!supabaseUrl || !serviceKey) {
      return jsonResp({ error: 'Variáveis SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY ausentes.' }, 500);
    }

    const authHeader = req.headers.get('Authorization') || '';
    const token = authHeader.replace(/^Bearer\s+/i, '').trim();
    if (!token) {
      return jsonResp({ error: 'Token de autenticação ausente.' }, 401);
    }

    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // 1. Validar JWT e confirmar que o chamador é super_admin
    const { data: userData, error: userErr } = await admin.auth.getUser(token);
    if (userErr || !userData?.user) {
      return jsonResp({ error: 'Sessão inválida ou expirada.' }, 401);
    }

    const { data: callerRole, error: roleErr } = await admin
      .from('user_roles')
      .select('role')
      .eq('user_id', userData.user.id)
      .maybeSingle();

    if (roleErr || callerRole?.role !== 'super_admin') {
      return jsonResp({ error: 'Acesso negado: ação exclusiva do Super Admin.' }, 403);
    }

    const body = await req.json();
    const action = body?.action;

    // 2. Ação: provision_turma_users
    if (action === 'provision_turma_users') {
      const turmaId = String(body.turma_id || '').trim();
      const alunos = Array.isArray(body.alunos) ? body.alunos : [];
      if (!turmaId || alunos.length === 0) {
        return jsonResp({ error: 'Informe turma_id e lista de alunos.' }, 400);
      }

      const { data: existingRoles } = await admin
        .from('user_roles')
        .select('user_id, email, aluno_numero')
        .eq('turma_id', turmaId);

      const existingByNum = new Map<number, string>();
      const usedEmails = new Set<string>();
      (existingRoles || []).forEach((r) => {
        if (r.aluno_numero != null) existingByNum.set(Number(r.aluno_numero), r.user_id);
        if (r.email) usedEmails.add(String(r.email).toLowerCase());
      });

      const created: Array<{ numero: number; username: string; password: string; status: string }> = [];
      const skipped: Array<{ numero: number; nome: string; reason: string }> = [];

      for (const a of alunos) {
        const numero = Number(a.numero);
        const nome = String(a.nome || '').trim();
        if (!numero || !nome) continue;

        if (existingByNum.has(numero)) {
          skipped.push({ numero, nome, reason: 'já possui conta vinculada' });
          continue;
        }

        let creds = buildDefaultCredentials(nome, turmaId);
        if (usedEmails.has(creds.internalEmail)) {
          const suffix = String(numero);
          const base = creds.loginDisplay.replace(/\s+(\d+)$/, ` ${suffix} $1`);
          const under = base.replace(/\s+/g, '_');
          creds = {
            loginDisplay: base,
            internalEmail: `${under.toLowerCase()}@ime.local`,
            defaultPassword: `senha_${under}`,
          };
        }

        const { data: createdAuth, error: createErr } = await admin.auth.admin.createUser({
          email: creds.internalEmail,
          password: creds.defaultPassword,
          email_confirm: true,
          user_metadata: { username: creds.loginDisplay, turma_id: turmaId, aluno_numero: numero },
        });

        if (createErr || !createdAuth?.user) {
          skipped.push({ numero, nome, reason: createErr?.message || 'erro ao criar usuário' });
          continue;
        }

        const { error: upsertErr } = await admin.from('user_roles').upsert({
          user_id: createdAuth.user.id,
          email: creds.internalEmail,
          username: creds.loginDisplay,
          role: 'viewer',
          turma_id: turmaId,
          aluno_numero: numero,
          must_change_password: true,
        }, { onConflict: 'user_id' });

        if (upsertErr) {
          skipped.push({ numero, nome, reason: upsertErr.message });
          continue;
        }

        usedEmails.add(creds.internalEmail);
        created.push({
          numero,
          username: creds.loginDisplay,
          password: creds.defaultPassword,
          status: 'criado',
        });
      }

      return jsonResp({ ok: true, created_count: created.length, skipped_count: skipped.length, created, skipped });
    }

    // 3. Ação: reset_password
    if (action === 'reset_password') {
      const targetUserId = String(body.user_id || '').trim();
      if (!targetUserId) {
        return jsonResp({ error: 'Informe user_id.' }, 400);
      }

      const { data: targetRow, error: targetErr } = await admin
        .from('user_roles')
        .select('user_id, email, username, turma_id')
        .eq('user_id', targetUserId)
        .maybeSingle();

      if (targetErr || !targetRow) {
        return jsonResp({ error: 'Usuário não encontrado em user_roles.' }, 404);
      }

      let nextPassword = String(body.new_password || '').trim();
      if (!nextPassword) {
        if (targetRow.username) {
          const under = stripAccents(targetRow.username).trim().replace(/\s+/g, '_');
          nextPassword = `senha_${under}`;
        } else {
          const localPart = String(targetRow.email || 'usuario').split('@')[0];
          nextPassword = `senha_${localPart}`;
        }
      }

      const forceChange = body.force_change !== false;
      const { error: updAuthErr } = await admin.auth.admin.updateUserById(targetUserId, {
        password: nextPassword,
      });
      if (updAuthErr) {
        return jsonResp({ error: updAuthErr.message }, 400);
      }

      await admin
        .from('user_roles')
        .update({ must_change_password: forceChange })
        .eq('user_id', targetUserId);

      return jsonResp({
        ok: true,
        user_id: targetUserId,
        username: targetRow.username || targetRow.email,
        temp_password: nextPassword,
        must_change_password: forceChange,
      });
    }

    // 4. Ação: delete_user
    if (action === 'delete_user') {
      const targetUserId = String(body.user_id || '').trim();
      if (!targetUserId) return jsonResp({ error: 'Informe user_id.' }, 400);
      if (targetUserId === userData.user.id) {
        return jsonResp({ error: 'Você não pode remover sua própria conta de Super Admin.' }, 400);
      }
      const { error: delErr } = await admin.auth.admin.deleteUser(targetUserId);
      if (delErr) return jsonResp({ error: delErr.message }, 400);
      return jsonResp({ ok: true, deleted: targetUserId });
    }

    return jsonResp({ error: `Ação desconhecida: ${action}` }, 400);
  } catch (err) {
    return jsonResp({ error: err instanceof Error ? err.message : String(err) }, 500);
  }
});
