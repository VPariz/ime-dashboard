/**
 * IME Analytics - Turma 2026
 * Interactive Dashboard Logic for GitHub Pages
 * Features: Média Semestral & Média Cumulativa, Comparador de Cursos, 3.2 Parcial
 */

document.addEventListener('DOMContentLoaded', () => {
  let dashboardBooted = false;

  const gateEl = document.getElementById('authGate');
  const shellEl = document.getElementById('appShell');
  const authSelectTheme = document.getElementById('authSelectTheme');
  const loginForm = document.getElementById('loginForm');
  const loginEmail = document.getElementById('loginEmail');
  const loginPassword = document.getElementById('loginPassword');
  const loginError = document.getElementById('loginError');
  const loginInfo = document.getElementById('loginInfo');
  const btnLoginSubmit = document.getElementById('btnLoginSubmit');
  const btnLoginSubmitText = document.getElementById('btnLoginSubmitText');
  const authHeadingTitle = document.getElementById('authHeadingTitle');
  const btnAuthTabSignIn = document.getElementById('btnAuthTabSignIn');
  const btnAuthTabSignUp = document.getElementById('btnAuthTabSignUp');
  const checkingBanner = document.getElementById('authCheckingBanner');
  const notConfiguredNote = document.getElementById('supabaseNotConfiguredNote');

  let authMode = 'signin'; // 'signin' | 'signup'

  function applyPreBootTheme(themeName) {
    const t = themeName || 'dark';
    document.body.setAttribute('data-theme', t);
    try { localStorage.setItem('ime_theme', t); } catch {}
    if (authSelectTheme && authSelectTheme.value !== t) authSelectTheme.value = t;
    const mainSel = document.getElementById('selectTheme');
    if (mainSel && mainSel.value !== t) mainSel.value = t;
  }

  applyPreBootTheme(localStorage.getItem('ime_theme') || 'dark');
  authSelectTheme?.addEventListener('change', (e) => applyPreBootTheme(e.target.value));
  if (window.lucide && typeof window.lucide.createIcons === 'function') {
    window.lucide.createIcons();
  }

  function showLoginError(msg) {
    if (loginInfo && msg) loginInfo.classList.add('hidden');
    if (!loginError) return;
    if (!msg) {
      loginError.classList.add('hidden');
      loginError.textContent = '';
      return;
    }
    loginError.textContent = msg;
    loginError.classList.remove('hidden');
  }

  function showLoginInfo(msg) {
    if (loginError && msg) loginError.classList.add('hidden');
    if (!loginInfo) return;
    if (!msg) {
      loginInfo.classList.add('hidden');
      loginInfo.textContent = '';
      return;
    }
    loginInfo.textContent = msg;
    loginInfo.classList.remove('hidden');
  }

  function setAuthTabMode(nextMode) {
    authMode = nextMode;
    showLoginError('');
    showLoginInfo('');
    const isSignUp = nextMode === 'signup';
    if (btnAuthTabSignIn) {
      btnAuthTabSignIn.className = isSignUp
        ? 'py-1.5 px-2 rounded-lg text-slate-400 hover:text-white transition'
        : 'py-1.5 px-2 rounded-lg bg-blue-600 text-white transition';
    }
    if (btnAuthTabSignUp) {
      btnAuthTabSignUp.className = isSignUp
        ? 'py-1.5 px-2 rounded-lg bg-emerald-600 text-white transition'
        : 'py-1.5 px-2 rounded-lg text-slate-400 hover:text-white transition';
    }
    if (authHeadingTitle) {
      authHeadingTitle.textContent = isSignUp ? 'Primeiro Acesso (Criar Senha)' : 'Entrar no Painel';
    }
    if (btnLoginSubmitText) {
      btnLoginSubmitText.textContent = isSignUp ? 'Criar Conta com E-mail Autorizado' : 'Entrar com Login';
    }
    if (loginPassword) {
      loginPassword.setAttribute('autocomplete', isSignUp ? 'new-password' : 'current-password');
    }
  }

  btnAuthTabSignIn?.addEventListener('click', () => setAuthTabMode('signin'));
  btnAuthTabSignUp?.addEventListener('click', () => setAuthTabMode('signup'));

  const sbCfg = window.SUPABASE_CONFIG || {};
  const isSupabaseConfigured = Boolean(
    sbCfg.url && sbCfg.anonKey && window.supabase && typeof window.supabase.createClient === 'function'
  );
  const sbClient = isSupabaseConfigured ? window.supabase.createClient(sbCfg.url, sbCfg.anonKey) : null;

  const DEFAULT_CURSOS_IME = [
    'Computação', 'Mecânica de Automóveis', 'Química', 'Elétrica', 'Materiais',
    'Cartografia', 'Mecânica de Armamento', 'Fortificação e Construção', 'Eletrônica', 'Comunicações'
  ];

  function buildSemesterOrder(sem) {
    const parts = String(sem || '').split('.');
    const ano = parseInt(parts[0], 10);
    const per = parseInt(parts[1], 10);
    if (isNaN(ano)) return 99;
    return ano * 2 - (per === 1 ? 1 : 0);
  }

  function createEmptyTurmaDataset(turmaObj, baseCursos = DEFAULT_CURSOS_IME) {
    const nome = turmaObj?.nome || 'Nova Turma';
    const curSem = turmaObj?.semestre_atual || '1.1';
    const maxOrd = buildSemesterOrder(curSem);
    const sems = ['1.1', '1.2', '2.1', '2.2', '3.1', '3.2'].filter(s => buildSemesterOrder(s) <= maxOrd);
    if (!sems.includes(curSem)) sems.push(curSem);
    const sNomes = {};
    sems.forEach(s => { sNomes[s] = `${buildSemesterOrder(s)}º Semestre (${s})`; });
    return {
      metadata: {
        titulo: `Dashboard de Desempenho Acadêmico e Militar • ${nome}`,
        turma: nome,
        semestreAtual: curSem,
        totalAlunos: 0,
        totalDisciplinas: 0,
        mediaGraduacaoTurma: 0,
        mediaGeralTurma: 0,
        mediaMilitarTurma: 0,
        cursos: [...baseCursos],
        semestres: sems,
        semestresNomes: sNomes,
        vinculos: { Ativa: 0, Reserva: 0, CG: 0 }
      },
      cursosComparativo: [],
      semestresBenchmark: [],
      disciplinas: [],
      alunos: []
    };
  }

  async function resolveSupabaseSessionAndLoad(sb, user) {
    const bucket = sbCfg.bucket || 'ime-private';
    let role = 'viewer';
    let userTurmaId = null;
    let turmas = [];

    // 1. Buscar papel na tabela user_roles (se existir)
    try {
      const { data: roleRow, error: roleErr } = await sb
        .from('user_roles')
        .select('role, turma_id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!roleErr && roleRow) {
        role = roleRow.role || 'viewer';
        userTurmaId = roleRow.turma_id || null;
      } else if (!roleErr && !roleRow) {
        // Caso schema multi-turma esteja ativo mas conta não tenha entrada em user_roles
        const { error: probeErr } = await sb.from('turmas').select('id').limit(1);
        if (!probeErr) {
          throw new Error('Sua conta ainda não possui papel atribuído em user_roles. Peça ao Super Admin.');
        }
      }
    } catch (err) {
      if (err.message?.includes('user_roles')) throw err;
    }

    // 2. Buscar turmas visíveis pelo usuário (RLS filtra automaticamente)
    try {
      const { data: turmaRows, error: turmaErr } = await sb
        .from('turmas')
        .select('*')
        .order('id', { ascending: true });
      if (!turmaErr && Array.isArray(turmaRows) && turmaRows.length > 0) {
        turmas = turmaRows;
      }
    } catch {
      turmas = [];
    }

    // Selecionar turma ativa
    let preferredTurmaId = null;
    try { preferredTurmaId = sessionStorage.getItem('ime_super_turma'); } catch {}
    let activeTurma = null;
    if (turmas.length > 0) {
      activeTurma = turmas.find(t => t.id === (role === 'super_admin' && preferredTurmaId ? preferredTurmaId : userTurmaId))
        || turmas[0];
    } else {
      activeTurma = {
        id: userTurmaId || 'turma_28',
        nome: 'Turma 28',
        semestre_atual: '3.2',
        storage_path: sbCfg.objectPath || 'turma_28/data.json'
      };
      turmas = [activeTurma];
    }

    // 3. Baixar JSON do bucket privado (fallback 'data.json' legado apenas para turma_28)
    const objectPath = activeTurma.storage_path || `${activeTurma.id}/data.json`;
    let { data, error } = await sb.storage.from(bucket).download(objectPath);
    if (error && activeTurma.id === 'turma_28' && objectPath !== 'data.json') {
      const fb = await sb.storage.from(bucket).download('data.json');
      if (!fb.error && fb.data) {
        data = fb.data;
        error = null;
      }
    }

    let parsed = null;
    let isStarterEmpty = false;
    if (error) {
      if (role === 'gestor' || role === 'super_admin') {
        parsed = createEmptyTurmaDataset(activeTurma);
        isStarterEmpty = true;
      } else {
        throw new Error(`A turma "${activeTurma.nome}" ainda não possui notas publicadas.`);
      }
    } else {
      const text = await data.text();
      parsed = JSON.parse(text);
      if (!parsed || !Array.isArray(parsed.alunos)) {
        throw new Error('Arquivo JSON inválido no bucket privado.');
      }
    }

    return {
      dataset: parsed,
      sessionMeta: {
        mode: 'supabase',
        email: user.email || 'Autenticado',
        role,
        userId: user.id,
        turma: activeTurma,
        turmas,
        semestreAtual: activeTurma.semestre_atual || parsed.metadata?.semestreAtual || '3.2',
        storagePath: objectPath,
        bucket,
        sb,
        isStarterEmpty
      }
    };
  }

  function parseLocalDatasetText(text) {
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start === -1 || end === -1 || end <= start) {
      throw new Error('Formato não reconhecido. Use data.js ou data.json válido.');
    }
    const parsed = JSON.parse(text.slice(start, end + 1));
    if (!parsed || !Array.isArray(parsed.alunos)) {
      throw new Error('O arquivo selecionado não contém o campo "alunos".');
    }
    return parsed;
  }

  if (!isSupabaseConfigured && notConfiguredNote) {
    notConfiguredNote.classList.remove('hidden');
  }

  // Tentativa automática de restaurar sessão Supabase
  (async () => {
    if (!sbClient) return;
    checkingBanner?.classList.remove('hidden');
    try {
      const { data: sessData } = await sbClient.auth.getSession();
      const session = sessData?.session;
      if (session?.user) {
        const res = await resolveSupabaseSessionAndLoad(sbClient, session.user);
        startDashboard(res.dataset, res.sessionMeta);
        return;
      }
    } catch (err) {
      showLoginError(`Sessão encontrada, mas falhou ao abrir dados: ${err.message}`);
    } finally {
      checkingBanner?.classList.add('hidden');
    }
  })();

  loginForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    showLoginError('');
    showLoginInfo('');
    if (!sbClient) {
      showLoginError('Configure url e anonKey em supabase-config.js antes de usar o login.');
      return;
    }
    const email = (loginEmail?.value || '').trim();
    const password = loginPassword?.value || '';
    if (!email || !password) return;

    const origHtml = btnLoginSubmit ? btnLoginSubmit.innerHTML : '';
    if (btnLoginSubmit) {
      btnLoginSubmit.disabled = true;
      btnLoginSubmit.textContent = authMode === 'signup' ? 'Criando acesso...' : 'Autenticando e baixando dados...';
    }

    try {
      if (authMode === 'signup') {
        const { data, error } = await sbClient.auth.signUp({ email, password });
        if (error) throw new Error(error.message);
        if (data?.session?.user) {
          const res = await resolveSupabaseSessionAndLoad(sbClient, data.session.user);
          startDashboard(res.dataset, res.sessionMeta);
          return;
        }
        showLoginInfo('Cadastro criado! Verifique seu e-mail para confirmar (ou faça login agora se a confirmação estiver desligada).');
        setAuthTabMode('signin');
      } else {
        const { data, error } = await sbClient.auth.signInWithPassword({ email, password });
        if (error) {
          throw new Error(error.message === 'Invalid login credentials'
            ? 'E-mail ou senha inválidos.'
            : error.message);
        }
        const res = await resolveSupabaseSessionAndLoad(sbClient, data.user);
        startDashboard(res.dataset, res.sessionMeta);
      }
    } catch (err) {
      showLoginError(err.message || 'Não foi possível concluir a autenticação.');
    } finally {
      if (btnLoginSubmit) {
        btnLoginSubmit.disabled = false;
        btnLoginSubmit.innerHTML = origHtml;
      }
    }
  });

  function launchDemoMode(requestedId = null) {
    const demoMap = window.IME_DEMO_TURMAS || {
      turma_28: window.IME_DEMO_DATA
    };
    const turmasMeta = [
      { id: 'turma_28', nome: 'Turma 28', semestre_atual: '3.2' },
      { id: 'turma_29', nome: 'Turma 29', semestre_atual: '2.2' },
      { id: 'turma_30', nome: 'Turma 30', semestre_atual: '1.2' },
      { id: 'turma_31', nome: 'Turma 31', semestre_atual: '1.1' }
    ].filter(t => Boolean(demoMap[t.id]));

    let activeId = requestedId;
    if (!activeId || !demoMap[activeId]) activeId = turmasMeta[0]?.id || 'turma_28';
    try { sessionStorage.setItem('ime_demo_turma', activeId); } catch {}
    const activeTurma = turmasMeta.find(t => t.id === activeId) || { id: 'turma_28', nome: 'Turma 28', semestre_atual: '3.2' };
    const ds = structuredClone(demoMap[activeId] || window.IME_DEMO_DATA);
    startDashboard(ds, {
      mode: 'demo',
      role: 'demo',
      turma: activeTurma,
      turmas: turmasMeta,
      semestreAtual: activeTurma.semestre_atual
    });
  }

  // Se o usuário trocou de turma dentro do Modo Demo, recarrega direto no Demo da turma escolhida
  try {
    const savedDemoTurma = sessionStorage.getItem('ime_demo_turma');
    if (savedDemoTurma && window.IME_DEMO_DATA) {
      launchDemoMode(savedDemoTurma);
    }
  } catch {}

  document.getElementById('btnEnterDemo')?.addEventListener('click', () => {
    if (!window.IME_DEMO_DATA) {
      showLoginError('Dataset Demo não encontrado.');
      return;
    }
    launchDemoMode('turma_28');
  });

  const localFileInput = document.getElementById('localDataFileInput');
  document.getElementById('btnTriggerLocalFile')?.addEventListener('click', () => {
    localFileInput?.click();
  });
  localFileInput?.addEventListener('change', (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    showLoginError('');
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = parseLocalDatasetText(String(reader.result || ''));
        const curSem = parsed.metadata?.semestreAtual || parsed.metadata?.semestres?.[parsed.metadata.semestres.length - 1] || '3.2';
        startDashboard(parsed, {
          mode: 'local',
          role: 'gestor',
          turma: { id: 'local', nome: parsed.metadata?.turma || 'Arquivo Local', semestre_atual: curSem },
          turmas: [{ id: 'local', nome: parsed.metadata?.turma || 'Arquivo Local', semestre_atual: curSem }],
          semestreAtual: curSem
        });
      } catch (err) {
        showLoginError(`Erro ao ler arquivo local: ${err.message}`);
      }
    };
    reader.readAsText(file, 'utf-8');
    e.target.value = '';
  });

  function startDashboard(DATA, sessionMeta = { mode: 'demo' }) {
    if (dashboardBooted || !DATA) return;
    dashboardBooted = true;
    window.IME_DATA = DATA;

    const USER_ROLE = sessionMeta.role || (sessionMeta.mode === 'demo' ? 'demo' : 'viewer');
    const IS_SUPER_ADMIN = USER_ROLE === 'super_admin';
    const CAN_MANAGE_GRADES = USER_ROLE === 'gestor' || USER_ROLE === 'super_admin' || sessionMeta.mode === 'demo';
    let CURRENT_SEM = sessionMeta.semestreAtual
      || DATA.metadata?.semestreAtual
      || DATA.metadata?.semestres?.[DATA.metadata.semestres.length - 1]
      || '3.2';
    const ACTIVE_TURMA = sessionMeta.turma || {
      id: 'turma_28',
      nome: DATA.metadata?.turma || 'Turma 28',
      semestre_atual: CURRENT_SEM,
      storage_path: 'turma_28/data.json'
    };
    const VISIBLE_TURMAS = sessionMeta.turmas || [ACTIVE_TURMA];

    gateEl?.classList.add('hidden');
    shellEl?.classList.remove('hidden');

    function getTurmaCareerStage(sem) {
      const ord = buildSemesterOrder(sem);
      if (ord <= 2) {
        return { key: 'none', enabled: false };
      }
      if (ord <= 5) {
        return {
          key: 'engenharia',
          enabled: true,
          tabLabel: 'Escolha de Engenharia',
          mobileLabel: 'Engenharia',
          heading: 'Escolha de Especialidade de Engenharia',
          badge: `Ativa + Reserva · Desbloqueado ${sem} (até 3.1)`,
          subtitle: 'Simule a classificação geral da turma e as vagas disponíveis por Engenharia (1ª a 10ª opção) antes da escolha no início do 3.1.',
          scopeMode: 'turma',
          scopeKey: 'TURMA_COMPLETA',
          vinculosAllowed: ['Ativa', 'Reserva'],
          itemPlaceholder: 'Ex: Computação, Eletrônica, Fortificação...',
          addBtnLabel: '+ Eng.',
          defaultCriterio: 'cumulativo',
          buildDefaultVagas: () => {
            const cursos = DATA.metadata?.cursos || DEFAULT_CURSOS_IME;
            const totalElegiveis = Math.max(20, DATA.alunos.filter(a => a.vinculo !== 'CG').length || DATA.alunos.length);
            const baseQtd = Math.max(2, Math.round(totalElegiveis / Math.max(1, cursos.length)));
            return cursos.map((c, i) => ({
              id: `eng_${i + 1}`,
              nome: c,
              qtd: baseQtd
            }));
          }
        };
      }
      if (ord <= 8) {
        return {
          key: 'estagio',
          enabled: true,
          tabLabel: 'Estágio',
          mobileLabel: 'Estágio',
          heading: 'Escolha de Vagas de Estágio por Engenharia',
          badge: `Somente Ativa · ${sem} – 4.2`,
          subtitle: 'Cadastre as vagas disponíveis, defina até 10 opções de preferência por aluno e calcule a alocação automática respeitando a classificação do curso.',
          scopeMode: 'curso',
          vinculosAllowed: ['Ativa'],
          itemPlaceholder: 'Ex: IMBEL, CTEx, IPqM...',
          addBtnLabel: '+ Vaga',
          defaultCriterio: 'cumulativo',
          buildDefaultVagas: (curso) => {
            const nAlunos = DATA.alunos.filter(a => a.curso === curso && a.vinculo === 'Ativa').length;
            const numLocais = Math.max(4, Math.min(8, Math.ceil(nAlunos / 2)));
            return Array.from({ length: numLocais }, (_, i) => ({
              id: `ph_${curso}_${i + 1}`,
              nome: `Local ${i + 1} (Placeholder)`,
              qtd: 2
            }));
          }
        };
      }
      return {
        key: 'om',
        enabled: true,
        tabLabel: 'Escolha de OM',
        mobileLabel: 'OM',
        heading: 'Escolha de Organização Militar (OM) por Engenharia',
        badge: `Somente Ativa · Escolha pós-5.2`,
        subtitle: 'Cadastre as vagas de Organização Militar (OM) por Engenharia, defina as preferências dos alunos da Ativa e simule a alocação pela classificação final.',
        scopeMode: 'curso',
        vinculosAllowed: ['Ativa'],
        itemPlaceholder: 'Ex: CTEx, CDS, DCT, 1º CTA, IMBEL...',
        addBtnLabel: '+ OM',
        defaultCriterio: 'geral',
        buildDefaultVagas: (curso) => {
          const nAlunos = DATA.alunos.filter(a => a.curso === curso && a.vinculo === 'Ativa').length;
          const numOMs = Math.max(4, Math.min(10, Math.max(4, nAlunos)));
          return Array.from({ length: numOMs }, (_, i) => ({
            id: `om_${curso}_${i + 1}`,
            nome: `OM ${i + 1} (Placeholder)`,
            qtd: 1
          }));
        }
      };
    }

    function getCareerStoreKey(stageKey) {
      if (sessionMeta.mode === 'demo') return `ime_career_demo_${ACTIVE_TURMA.id}_${stageKey}_v1`;
      return `ime_career_${ACTIVE_TURMA.id || 't28'}_${stageKey}_v1`;
    }

    function loadCareerStoreForStage(stage) {
      if (!stage?.enabled) return {};
      const key = getCareerStoreKey(stage.key);
      try {
        const raw = localStorage.getItem(key);
        if (raw) return JSON.parse(raw);
        if (stage.key === 'estagio') {
          const legacyKey = sessionMeta.mode === 'demo' ? 'ime_estagio_demo_v1' : `ime_estagio_${ACTIVE_TURMA.id || 'v1'}`;
          const legacyRaw = localStorage.getItem(legacyKey) || localStorage.getItem('ime_estagio_v1');
          if (legacyRaw) return JSON.parse(legacyRaw);
        }
      } catch {}
      return {};
    }

    let ACTIVE_CAREER_STAGE = getTurmaCareerStage(CURRENT_SEM);

    function updateMobileNavColumns() {
      const mobileNav = document.getElementById('mobileBottomNav');
      if (!mobileNav) return;
      const visibleBtns = mobileNav.querySelectorAll('.mobile-nav-btn:not(.hidden)').length;
      mobileNav.classList.remove('grid-cols-5', 'grid-cols-6', 'grid-cols-7', 'grid-cols-8');
      mobileNav.classList.add(`grid-cols-${Math.max(5, Math.min(8, visibleBtns))}`);
    }

    // Visibilidade da aba Gestão & Notas (apenas Gestor / Super Admin / Demo)
    if (CAN_MANAGE_GRADES) {
      document.getElementById('navTabGestaoBtn')?.classList.remove('hidden');
      document.getElementById('mobileNavGestaoBtn')?.classList.remove('hidden');
    }
    updateMobileNavColumns();

    // Header Turma Switcher (Super Admin ou prévia Multi-Turma em Modo Demo)
    const selectTurmaHeader = document.getElementById('selectTurmaHeader');
    const headerTurmaBadge = document.getElementById('headerTurmaBadge');
    const headerSemestreBadge = document.getElementById('headerSemestreBadge');
    if ((IS_SUPER_ADMIN || sessionMeta.mode === 'demo') && VISIBLE_TURMAS.length > 0 && selectTurmaHeader) {
      selectTurmaHeader.innerHTML = VISIBLE_TURMAS.map(t =>
        `<option value="${t.id}" ${t.id === ACTIVE_TURMA.id ? 'selected' : ''}>${t.nome} (${t.semestre_atual})</option>`
      ).join('');
      selectTurmaHeader.classList.remove('hidden');
      headerTurmaBadge?.classList.add('hidden');
      selectTurmaHeader.addEventListener('change', (e) => {
        try {
          if (sessionMeta.mode === 'demo') sessionStorage.setItem('ime_demo_turma', e.target.value);
          else sessionStorage.setItem('ime_super_turma', e.target.value);
        } catch {}
        window.location.reload();
      });
    } else if (headerTurmaBadge) {
      headerTurmaBadge.textContent = ACTIVE_TURMA.nome || DATA.metadata?.turma || 'Turma 28';
    }
    if (headerSemestreBadge) {
      headerSemestreBadge.textContent = `Sem. ${CURRENT_SEM}`;
    }

    // Header auth badge & logout/switch button
    const badgeEl = document.getElementById('authSessionBadge');
    const actionLabelEl = document.getElementById('authActionLabel');
    const btnAuthAction = document.getElementById('btnAuthAction');
    const roleLabelMap = {
      super_admin: '👑 Super Admin',
      gestor: '✏️ Gestor',
      viewer: '👁️ Turma',
      demo: '🧪 Demo (Portfólio)'
    };
    if (badgeEl) {
      badgeEl.classList.remove('hidden');
      if (sessionMeta.mode === 'supabase') {
        badgeEl.textContent = `${roleLabelMap[USER_ROLE] || USER_ROLE} • ${sessionMeta.email || ''}`;
        const colorCls = USER_ROLE === 'super_admin'
          ? 'border-purple-500/40 bg-purple-500/15 text-purple-300'
          : (USER_ROLE === 'gestor'
            ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-300'
            : 'border-sky-500/35 bg-sky-500/15 text-sky-300');
        badgeEl.className = `hidden sm:inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-[11px] font-bold border max-w-[210px] truncate ${colorCls}`;
        if (actionLabelEl) actionLabelEl.textContent = 'Sair';
      } else if (sessionMeta.mode === 'demo') {
        badgeEl.textContent = '🧪 Demo (Fictício)';
        badgeEl.className = 'hidden sm:inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-[11px] font-bold border border-amber-500/35 bg-amber-500/15 text-amber-300 max-w-[160px] truncate';
        if (actionLabelEl) actionLabelEl.textContent = 'Login';
      } else {
        badgeEl.textContent = '📁 Arquivo Local';
        badgeEl.className = 'hidden sm:inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-[11px] font-bold border border-sky-500/35 bg-sky-500/15 text-sky-300 max-w-[160px] truncate';
        if (actionLabelEl) actionLabelEl.textContent = 'Trocar';
      }
    }
    btnAuthAction?.addEventListener('click', async () => {
      try {
        sessionStorage.removeItem('ime_super_turma');
        sessionStorage.removeItem('ime_demo_turma');
      } catch {}
      if (sessionMeta.mode === 'supabase' && sessionMeta.sb) {
        try { await sessionMeta.sb.auth.signOut(); } catch {}
      }
      window.location.reload();
    });

    function syncDynamicDataLabels() {
      const tabRankingsLabel = document.getElementById('tabRankingsLabel');
      if (tabRankingsLabel) tabRankingsLabel.textContent = `Fichas dos Alunos (${DATA.alunos.length})`;
      const tabDisciplinasLabel = document.getElementById('tabDisciplinasLabel');
      if (tabDisciplinasLabel) tabDisciplinasLabel.textContent = `Raio-X de Disciplinas (${DATA.disciplinas.length})`;
      const tabVfLabel = document.getElementById('tabVfLabel');
      if (tabVfLabel) tabVfLabel.textContent = `VF ${CURRENT_SEM} (Risco & Metas)`;
      const lblAtiva = document.getElementById('lblVinculoAtiva');
      if (lblAtiva) lblAtiva.textContent = `Ativa (${DATA.alunos.filter(a => a.vinculo === 'Ativa').length})`;
      const lblReserva = document.getElementById('lblVinculoReserva');
      if (lblReserva) lblReserva.textContent = `Reserva (${DATA.alunos.filter(a => a.vinculo === 'Reserva').length})`;
      const lblCg = document.getElementById('lblVinculoCg');
      if (lblCg) lblCg.textContent = `CG (${DATA.alunos.filter(a => a.vinculo === 'CG').length})`;
      if (headerSemestreBadge) headerSemestreBadge.textContent = `Sem. ${CURRENT_SEM}`;

      // Atualizar opções e contagens no filtro de cursos dinamicamente
      const filterCursoSel = document.getElementById('filterCurso');
      if (filterCursoSel) {
        const prevVal = filterCursoSel.value || 'ALL';
        const cursos = [...new Set([
          ...(DATA.metadata?.cursos || []),
          ...DATA.alunos.map(a => a.curso).filter(Boolean)
        ])];
        const se3Cnt = DATA.alunos.filter(a => ['Eletrônica', 'Elétrica', 'Comunicações'].includes(a.curso)).length;
        const se4Cnt = DATA.alunos.filter(a => ['Mecânica de Armamento', 'Mecânica de Automóveis'].includes(a.curso)).length;
        const seHtml = (se3Cnt > 0 || se4Cnt > 0) ? `
          <optgroup label="Seções de Ensino (SE)">
            ${se3Cnt > 0 ? `<option value="SE3">SE3 — Eletrônica, Elétrica, Comunicações (${se3Cnt})</option>` : ''}
            ${se4Cnt > 0 ? `<option value="SE4">SE4 — Mec. Armamento e Automóveis (${se4Cnt})</option>` : ''}
          </optgroup>` : '';
        const espHtml = cursos.map(c => {
          const cnt = DATA.alunos.filter(a => a.curso === c).length;
          return `<option value="${c}">${c} (${cnt})</option>`;
        }).join('');
        filterCursoSel.innerHTML = `<option value="ALL">Todas (${cursos.length})</option>${seHtml}<optgroup label="Especialidades / Ciclos">${espHtml}</optgroup>`;
        const stillExists = [...filterCursoSel.options].some(o => o.value === prevVal);
        filterCursoSel.value = stillExists ? prevVal : 'ALL';
      }
    }
    syncDynamicDataLabels();

    let filteredAlunos = [...DATA.alunos];
  
    // App State
    const state = {
      currentTab: 'overview',
      filterCurso: 'ALL',
      includedVinculos: new Set(['Ativa', 'Reserva', 'CG']),
      vfRiskFilter: 'ALL',
      vfSearch: '',
      tableSearch: '',
      sortColumn: 'rankGraduacao',
      sortAsc: true,
      pageSize: 'ALL',
      currentPage: 1,
      disciplinasSearch: '',
      disciplinasSemestre: 'ALL',
      disciplinasCurso: 'ALL',
      comparatorA: DATA.alunos[0]?.numero || null,
      comparatorB: DATA.alunos[1]?.numero || null,
      comparatorInitialized: false,
      comparatorSemester: 'ALL',
      comparatorOnlyCommon: false,
      comparatorSubjectSearch: '',
      comparatorTypeFilter: 'ALL',
      comparatorSubjectSort: 'semestre',
      courseA: DATA.metadata.cursos?.[0] || 'Computação',
      courseB: DATA.metadata.cursos?.[1] || DATA.metadata.cursos?.[0] || 'Eletrônica',
      activeCoursesInChart: new Set(DATA.metadata.cursos),
      activeStudentModal: null,
      modalSemesterFilter: 'ALL',
      
      // Metric Modes: 'semestral' | 'cumulativo'
      overviewMetric: 'semestral',
      courseMetric: 'semestral',
      modalMetric: 'semestral',
      comparatorMetric: 'semestral',

      // Device & View Modes
      theme: localStorage.getItem('ime_theme') || 'dark',
      deviceMode: 'auto',
      rankingView: 'cards',
      courseView: 'table',
      modalDisciplineView: 'cards',

      // Escolha de Engenharia (2.1-3.1) / Estágio (3.2-4.2) / Escolha de OM (5.1+)
      estagioCurso: DATA.metadata.cursos[0] || 'Computação',
      estagioCriterio: ACTIVE_CAREER_STAGE?.defaultCriterio || 'cumulativo',
      estagioExpandedAluno: null,
      estagioInitialized: false,
      estagioData: loadCareerStoreForStage(ACTIVE_CAREER_STAGE)
    };

  // Chart instances
  let chartCursosInstance = null;
  let chartEvolucaoInstance = null;
  let chartVinculoInstance = null;
  let chartDistribuicaoInstance = null;
  let chartCursosEvolucaoInstance = null;
  let chartCourseH2HInstance = null;
  let chartComparatorInstance = null;
  let chartModalInstance = null;

  // Lucide helper
  function refreshIcons() {
    if (window.lucide && typeof window.lucide.createIcons === 'function') {
      window.lucide.createIcons();
    }
  }

  refreshIcons();

  // Course Color Mapping & Badges
  const courseColors = {
    'Computação': '#3b82f6',
    'Fortificação e Construção': '#f59e0b',
    'Cartografia': '#10b981',
    'Eletrônica': '#a855f7',
    'Química': '#ec4899',
    'Comunicações': '#0ea5e9',
    'Mecânica de Armamento': '#ef4444',
    'Mecânica de Automóveis': '#f97316',
    'Elétrica': '#eab308',
    'Materiais': '#14b8a6',
    'Ciclo Básico': '#38bdf8'
  };

  const courseClassMap = {
    'Computação': 'badge-computacao',
    'Fortificação e Construção': 'badge-fortificacao',
    'Cartografia': 'badge-cartografia',
    'Eletrônica': 'badge-eletronica',
    'Química': 'badge-quimica',
    'Comunicações': 'badge-comunicacoes',
    'Mecânica de Armamento': 'badge-armamento',
    'Mecânica de Automóveis': 'badge-automoveis',
    'Elétrica': 'badge-eletrica',
    'Materiais': 'badge-materiais',
    'Ciclo Básico': 'badge-comunicacoes'
  };

  const SE_GROUPS = {
    SE3: {
      curso: 'SE3 (Eletrônica, Elétrica, Com.)',
      short: 'SE3',
      cursos: ['Eletrônica', 'Elétrica', 'Comunicações'],
      color: '#a855f7'
    },
    SE4: {
      curso: 'SE4 (Mec. Armamento e Auto.)',
      short: 'SE4',
      cursos: ['Mecânica de Armamento', 'Mecânica de Automóveis'],
      color: '#ef4444'
    }
  };

  const courseToSE = {
    'Eletrônica': 'SE3',
    'Elétrica': 'SE3',
    'Comunicações': 'SE3',
    'Mecânica de Armamento': 'SE4',
    'Mecânica de Automóveis': 'SE4'
  };

  function matchesCourseFilter(curso, filterVal) {
    if (filterVal === 'ALL') return true;
    if (SE_GROUPS[filterVal]) return SE_GROUPS[filterVal].cursos.includes(curso);
    return curso === filterVal;
  }

  function getVinculoScopedAlunos() {
    return DATA.alunos.filter(a => state.includedVinculos.has(a.vinculo));
  }

  function computeCourseStats(cursoLabel, members, isSEGroup = false, short = null) {
    if (!members.length) {
      const emptySem = {};
      DATA.metadata.semestres.forEach(s => { emptySem[s] = null; });
      return {
        curso: cursoLabel,
        short: short || cursoLabel,
        qtdAlunos: 0,
        mediaGraduacao: null,
        mediaGeral: null,
        menorCR: null,
        maiorCR: null,
        melhorAluno: '-',
        semestres: { ...emptySem },
        semestresCumulativo: { ...emptySem },
        isSEGroup
      };
    }

    const avg = (arr) => arr.length ? Math.round((arr.reduce((s, v) => s + v, 0) / arr.length) * 100) / 100 : null;
    const semestres = {};
    const semestresCumulativo = {};
    DATA.metadata.semestres.forEach(sem => {
      const sVals = members.map(a => a.evolucao.find(e => e.semestre === sem)?.mediaGradSemestre).filter(v => v !== null && v !== undefined);
      const cVals = members.map(a => a.evolucao.find(e => e.semestre === sem)?.mediaGradCumulativo).filter(v => v !== null && v !== undefined);
      semestres[sem] = avg(sVals);
      semestresCumulativo[sem] = avg(cVals);
    });

    const sorted = [...members].sort((a, b) => b.mediaGraduacao - a.mediaGraduacao);
    return {
      curso: cursoLabel,
      short: short || cursoLabel,
      qtdAlunos: members.length,
      mediaGraduacao: avg(members.map(a => a.mediaGraduacao)),
      mediaGeral: avg(members.map(a => a.mediaGeral)),
      menorCR: sorted[sorted.length - 1]?.mediaGraduacao ?? null,
      maiorCR: sorted[0]?.mediaGraduacao ?? null,
      melhorAluno: sorted[0]?.nome ?? '-',
      semestres,
      semestresCumulativo,
      isSEGroup
    };
  }

  function getScopedCursosComparativo() {
    const scoped = getVinculoScopedAlunos();
    return DATA.metadata.cursos.map(curso => {
      const members = scoped.filter(a => a.curso === curso);
      return computeCourseStats(curso, members, false);
    });
  }

  function getScopedSemestresBenchmark() {
    const scoped = getVinculoScopedAlunos();
    const avg = (arr) => arr.length ? Math.round((arr.reduce((s, v) => s + v, 0) / arr.length) * 100) / 100 : null;
    return DATA.metadata.semestres.map(sem => {
      const sVals = scoped.map(a => a.evolucao.find(e => e.semestre === sem)?.mediaGradSemestre).filter(v => v !== null && v !== undefined);
      const cVals = scoped.map(a => a.evolucao.find(e => e.semestre === sem)?.mediaGradCumulativo).filter(v => v !== null && v !== undefined);
      return {
        semestre: sem,
        mediaGraduacaoTurma: avg(sVals),
        mediaGraduacaoTurmaCumulativa: avg(cVals),
        qtdAlunos: sVals.length,
        isParcial: (sem === CURRENT_SEM)
      };
    });
  }

  function getGroupCourseObj(seKey) {
    const grp = SE_GROUPS[seKey];
    if (!grp) return null;
    const members = getVinculoScopedAlunos().filter(a => grp.cursos.includes(a.curso));
    return computeCourseStats(grp.curso, members, true, grp.short);
  }

  function getCourseBadge(curso) {
    if (curso === 'SE3' || curso === SE_GROUPS.SE3.curso) {
      return `<span class="px-2.5 py-0.5 rounded-full text-[11px] font-bold whitespace-nowrap bg-purple-500/20 text-purple-300 border border-purple-500/40">${curso}</span>`;
    }
    if (curso === 'SE4' || curso === SE_GROUPS.SE4.curso) {
      return `<span class="px-2.5 py-0.5 rounded-full text-[11px] font-bold whitespace-nowrap bg-rose-500/20 text-rose-300 border border-rose-500/40">${curso}</span>`;
    }
    const cls = courseClassMap[curso] || 'badge-computacao';
    const se = courseToSE[curso];
    const seTag = se ? ` <span class="opacity-70 text-[10px]">· ${se}</span>` : '';
    return `<span class="px-2.5 py-0.5 rounded-full text-[11px] font-semibold whitespace-nowrap ${cls}">${curso}${seTag}</span>`;
  }

  function getVinculoBadge(vinculo) {
    let cls = 'badge-ativa';
    if (vinculo === 'Reserva') cls = 'badge-reserva';
    if (vinculo === 'CG') cls = 'badge-cg';
    return `<span class="px-2 py-0.5 rounded-full text-[11px] font-bold ${cls}">${vinculo}</span>`;
  }

  function fmtNum(val) {
    if (val === null || val === undefined || isNaN(val)) return '-';
    return Number(val).toFixed(2);
  }

  function calcVfNecessaria(d) {
    if (!d || d.nf !== null || d.vf !== null || d.isPratica) return null;
    const ve = d.mve ?? d.ve;
    const vc = d.vc;
    const hasVe = (ve !== null && ve !== undefined);
    const hasVc = (vc !== null && vc !== undefined);
    if (!hasVe && !hasVc) return null;

    if (hasVe && hasVc) {
      const paraMedia5 = (20 - ve - vc) / 2;
      const precisa = Math.max(4.0, paraMedia5);
      const precisaArred = Math.round(precisa * 100) / 100;
      const limitadaPorMinimo = paraMedia5 <= 4.0;
      return {
        tipo: 'exact',
        valor: precisaArred,
        limitadaPorMinimo,
        label: `VF ≥ ${precisaArred.toFixed(2)}`,
        detalhe: limitadaPorMinimo
          ? `Mínimo 4,00 na VF (média fica ${((ve + vc + 8) / 4).toFixed(2)})`
          : `Para fechar média 5,00 (VE×1 + VC×1 + VF×2)`
      };
    }

    if (hasVe) {
      const faltaConjunto = Math.max(0, 20 - ve);
      return {
        tipo: 'partial',
        valor: null,
        label: `VC+2×VF ≥ ${faltaConjunto.toFixed(2)}`,
        detalhe: `Aguardando VC (e VF ≥ 4,00)`
      };
    }

    const faltaConjunto = Math.max(0, 20 - vc);
    return {
      tipo: 'partial',
      valor: null,
      label: `VE+2×VF ≥ ${faltaConjunto.toFixed(2)}`,
      detalhe: `Aguardando VE (e VF ≥ 4,00)`
    };
  }

  function getVfColorStyle(vfInfo) {
    if (!vfInfo || vfInfo.tipo !== 'exact') {
      return {
        text: 'text-slate-300',
        pill: 'bg-slate-800 text-slate-300 border-slate-700',
        cardBorder: 'border-slate-800/80'
      };
    }
    const v = vfInfo.valor;
    if (v <= 4.0) {
      return {
        text: 'text-emerald-400',
        pill: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
        cardBorder: 'border-emerald-500/25'
      };
    }
    if (v <= 5.0) {
      return {
        text: 'text-sky-400',
        pill: 'bg-sky-500/15 text-sky-300 border-sky-500/30',
        cardBorder: 'border-sky-500/25'
      };
    }
    if (v <= 6.0) {
      return {
        text: 'text-amber-300',
        pill: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
        cardBorder: 'border-amber-500/30'
      };
    }
    return {
      text: 'text-rose-400',
      pill: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
      cardBorder: 'border-rose-500/35'
    };
  }

  function classifyDisciplineCourse(d, cursosArr) {
    if (d.militar) return 'Militar';
    if (cursosArr.length >= 8) return 'Básico (Comum)';
    const allSE3 = cursosArr.length > 1 && cursosArr.every(c => SE_GROUPS.SE3.cursos.includes(c));
    if (allSE3) return 'SE3 (Comum)';
    const allSE4 = cursosArr.length > 1 && cursosArr.every(c => SE_GROUPS.SE4.cursos.includes(c));
    if (allSE4) return 'SE4 (Comum)';
    return cursosArr.join(' · ');
  }

  function recomputeDerivedClientFields() {
    const discVfAgg = new Map();
    const discCoursesMap = new Map();
    DATA.alunos.forEach(aluno => {
      const exactList = [];
      (aluno.disciplinas || []).forEach(d => {
        const dKey = `${d.codigo}||${d.disciplina}||${d.semestre}`;
        if (!discCoursesMap.has(dKey)) discCoursesMap.set(dKey, new Set());
        discCoursesMap.get(dKey).add(aluno.curso);

        if (d.semestre !== CURRENT_SEM) return;
        const vfInfo = calcVfNecessaria(d);
        if (vfInfo && vfInfo.tipo === 'exact') {
          exactList.push({
            nome: d.nome,
            codigo: d.codigo,
            valor: vfInfo.valor,
            militar: d.militar
          });
          if (!discVfAgg.has(dKey)) discVfAgg.set(dKey, []);
          discVfAgg.get(dKey).push(vfInfo.valor);
        }
      });
      exactList.sort((a, b) => b.valor - a.valor);
      aluno.vfRiskSubjects = exactList;
      if (exactList.length > 0) {
        aluno.maxVf32 = exactList[0].valor;
        aluno.avgVf32 = Math.round((exactList.reduce((s, x) => s + x.valor, 0) / exactList.length) * 100) / 100;
        aluno.vfRiskCount = exactList.filter(x => x.valor > 5.0).length;
        aluno.vfRiskLevel = aluno.maxVf32 > 6.0
          ? 'risk'
          : (aluno.maxVf32 > 5.0 ? 'warn' : (aluno.maxVf32 > 4.0 ? 'mid' : 'safe'));
      } else {
        aluno.maxVf32 = null;
        aluno.avgVf32 = null;
        aluno.vfRiskCount = 0;
        aluno.vfRiskLevel = 'none';
      }
    });

    DATA.disciplinas.forEach(d => {
      const dKey = `${d.codigo}||${d.disciplina}||${d.semestre}`;
      const cursosArr = [...(discCoursesMap.get(dKey) || [])].sort();
      d.cursos = cursosArr;
      d.cursoLabel = classifyDisciplineCourse(d, cursosArr);

      const vals = discVfAgg.get(dKey);
      if (vals && vals.length) {
        d.vfMediaNec = Math.round((vals.reduce((s, v) => s + v, 0) / vals.length) * 100) / 100;
        d.vfEmRisco = vals.filter(v => v > 5.0).length;
        d.vfRiscoAlto = vals.filter(v => v > 6.0).length;
      } else {
        d.vfMediaNec = null;
        d.vfEmRisco = 0;
        d.vfRiscoAlto = 0;
      }
    });
  }

  recomputeDerivedClientFields();

  function computeDynamicBounds(datasets, minSpan = 1.0, pad = 0.2) {
    const vals = [];
    datasets.forEach(ds => {
      const arr = Array.isArray(ds) ? ds : (ds?.data || []);
      arr.forEach(v => {
        if (typeof v === 'number' && !isNaN(v)) vals.push(v);
      });
    });
    if (!vals.length) return { min: 6.0, max: 9.5, stepSize: 0.5 };
    let minV = Math.min(...vals);
    let maxV = Math.max(...vals);
    if (maxV - minV < minSpan) {
      const mid = (minV + maxV) / 2;
      minV = mid - minSpan / 2;
      maxV = mid + minSpan / 2;
    }
    const min = Math.max(0, Math.floor((minV - pad) * 4) / 4);
    const max = Math.min(10, Math.ceil((maxV + pad) * 4) / 4);
    const span = max - min;
    const stepSize = span <= 1.75 ? 0.25 : (span <= 3.5 ? 0.5 : 1.0);
    return { min, max, stepSize };
  }

  // Helper for metric button group styling
  function updateToggleButtons(containerId, activeMetric, activeClass = 'bg-blue-600') {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.querySelectorAll('button').forEach(btn => {
      if (btn.getAttribute('data-metric') === activeMetric) {
        btn.className = `px-3 py-1 text-xs font-bold rounded-lg ${activeClass} text-white transition`;
      } else {
        btn.className = `px-3 py-1 text-xs font-bold rounded-lg text-slate-400 hover:text-white transition`;
      }
    });
  }

  // --- Device Detection & Responsive View Management ---
  function isMobileDevice() {
    return window.innerWidth <= 768 || /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  }

  function applyDeviceMode(mode) {
    state.deviceMode = mode;
    const isMobile = mode === 'mobile' || (mode === 'auto' && isMobileDevice());

    if (isMobile) {
      document.body.classList.add('is-mobile');
      document.body.classList.remove('is-desktop');
      state.rankingView = 'cards';
      state.modalDisciplineView = 'cards';
      state.courseView = 'cards';
    } else {
      document.body.classList.remove('is-mobile');
      document.body.classList.add('is-desktop');
      state.rankingView = 'table';
      state.modalDisciplineView = 'table';
      state.courseView = 'table';
    }

    // Update Device Switcher Buttons in Header
    const btnMobile = document.getElementById('btnModeMobile');
    const btnDesktop = document.getElementById('btnModeDesktop');
    if (btnMobile && btnDesktop) {
      if (isMobile) {
        btnMobile.className = 'px-2.5 py-1 text-xs font-bold rounded-lg bg-blue-600 text-white transition flex items-center gap-1.5 shadow-sm';
        btnDesktop.className = 'px-2.5 py-1 text-xs font-bold rounded-lg text-slate-400 hover:text-white transition flex items-center gap-1.5';
      } else {
        btnDesktop.className = 'px-2.5 py-1 text-xs font-bold rounded-lg bg-blue-600 text-white transition flex items-center gap-1.5 shadow-sm';
        btnMobile.className = 'px-2.5 py-1 text-xs font-bold rounded-lg text-slate-400 hover:text-white transition flex items-center gap-1.5';
      }
    }

    renderRankingsTable();
    if (state.currentTab === 'cursos') {
      renderCourseMatrixTable();
    }
    if (state.activeStudentModal) {
      renderModalDisciplinesTable();
    }
    if (state.currentTab === 'comparator') {
      renderStudentComparator();
    }
    if (state.currentTab === 'disciplinas') {
      renderDisciplinasFullTable();
    }
    refreshIcons();
  }

  // --- Filtering & Metrics Calculation ---
  function applyFilters() {
    filteredAlunos = DATA.alunos.filter(aluno => {
      if (!matchesCourseFilter(aluno.curso, state.filterCurso)) return false;
      if (!state.includedVinculos.has(aluno.vinculo)) return false;
      if (state.tableSearch.trim()) {
        const query = state.tableSearch.toLowerCase();
        const matchesName = aluno.nome.toLowerCase().includes(query);
        const matchesNum = String(aluno.numero).includes(query);
        const matchesCurso = aluno.curso.toLowerCase().includes(query);
        if (!matchesName && !matchesNum && !matchesCurso) return false;
      }
      return true;
    });

    updateKPIs();
    renderPodium();
    renderOverviewVfBanner();
    updateOverviewCharts();
    renderRankingsTable();
    if (state.currentTab === 'cursos') {
      updateCourseEvolutionChart();
      renderCourseMatrixTable();
      renderCourseHeadToHead();
    } else if (state.currentTab === 'vf') {
      renderVfTab();
    } else if (state.currentTab === 'disciplinas') {
      renderDisciplinasTab();
    } else if (state.currentTab === 'comparator') {
      renderStudentComparator();
    } else if (state.currentTab === 'estagio') {
      renderEstagioTab();
    }
    updateFilterResetButton();
  }

  function updateKPIs() {
    const total = filteredAlunos.length;
    document.getElementById('filteredStudentCount').textContent = `${total} de ${DATA.alunos.length}`;
    document.getElementById('kpiTotalAlunos').textContent = total;

    if (total === 0) {
      document.getElementById('kpiMediaGrad').textContent = '-';
      document.getElementById('kpiMediaGeral').textContent = '-';
      document.getElementById('kpiMediaMil').textContent = '-';
      document.getElementById('kpiCountAtiva').textContent = '0 Ativa';
      document.getElementById('kpiCountReserva').textContent = '0 Reserva';
      document.getElementById('kpiCountCG').textContent = '0 CG';
      return;
    }

    const sumGrad = filteredAlunos.reduce((acc, a) => acc + (a.mediaGraduacao || 0), 0);
    const avgGrad = (sumGrad / total).toFixed(2);
    document.getElementById('kpiMediaGrad').textContent = avgGrad;

    const sumGeral = filteredAlunos.reduce((acc, a) => acc + (a.mediaGeral || 0), 0);
    const avgGeral = (sumGeral / total).toFixed(2);
    document.getElementById('kpiMediaGeral').textContent = avgGeral;

    const milStudents = filteredAlunos.filter(a => a.mediaMilitar !== null && a.mediaMilitar !== undefined);
    if (milStudents.length > 0) {
      const sumMil = milStudents.reduce((acc, a) => acc + a.mediaMilitar, 0);
      const avgMil = (sumMil / milStudents.length).toFixed(2);
      document.getElementById('kpiMediaMil').textContent = avgMil;
      document.getElementById('kpiMilSubtext').textContent = `${milStudents.length} Alunos avaliados`;
    } else {
      document.getElementById('kpiMediaMil').textContent = '-';
      document.getElementById('kpiMilSubtext').textContent = 'Sem notas militares (CG)';
    }

    const countAtiva = filteredAlunos.filter(a => a.vinculo === 'Ativa').length;
    const countReserva = filteredAlunos.filter(a => a.vinculo === 'Reserva').length;
    const countCG = filteredAlunos.filter(a => a.vinculo === 'CG').length;

    document.getElementById('kpiCountAtiva').textContent = `${countAtiva} Ativa`;
    document.getElementById('kpiCountReserva').textContent = `${countReserva} Reserva`;
    document.getElementById('kpiCountCG').textContent = `${countCG} CG`;
  }

  function updateFilterResetButton() {
    const btnReset = document.getElementById('btnResetFilters');
    const isFiltered = (state.filterCurso !== 'ALL' || state.includedVinculos.size !== 3 || state.tableSearch !== '');
    if (isFiltered) {
      btnReset.classList.remove('hidden');
      btnReset.classList.add('flex');
    } else {
      btnReset.classList.add('hidden');
      btnReset.classList.remove('flex');
    }
  }

  // --- TAB 1: VISÃO GERAL ---
  function renderOverviewVfBanner() {
    const el = document.getElementById('overviewVfBanner');
    if (!el) return;

    const safe = filteredAlunos.filter(a => a.vfRiskLevel === 'safe').length;
    const mid = filteredAlunos.filter(a => a.vfRiskLevel === 'mid').length;
    const warn = filteredAlunos.filter(a => a.vfRiskLevel === 'warn').length;
    const risk = filteredAlunos.filter(a => a.vfRiskLevel === 'risk').length;

    el.innerHTML = `
      <div class="flex items-center gap-2.5">
        <span class="w-8 h-8 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center shrink-0">
          <i data-lucide="target" class="w-4 h-4 text-amber-400"></i>
        </span>
        <div>
          <div class="text-xs font-bold text-slate-100">Situação na VF do ${CURRENT_SEM} (mín. 4,00 e média ≥ 5,00)</div>
          <div class="text-[11px] text-slate-400">Clique em uma faixa para abrir os cartões direto na aba VF ${CURRENT_SEM}</div>
        </div>
      </div>
      <div class="flex flex-wrap items-center gap-2 text-xs font-bold font-mono-numbers">
        <button data-goto-vf="safe" class="px-2.5 py-1 rounded-xl border border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 transition">≤ 4.00 (${safe})</button>
        <button data-goto-vf="mid" class="px-2.5 py-1 rounded-xl border border-sky-500/30 bg-sky-500/10 hover:bg-sky-500/20 text-sky-300 transition">4.01–5.00 (${mid})</button>
        <button data-goto-vf="warn" class="px-2.5 py-1 rounded-xl border border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 transition">5.01–6.00 (${warn})</button>
        <button data-goto-vf="risk" class="px-2.5 py-1 rounded-xl border border-rose-500/30 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 transition">&gt; 6.00 (${risk})</button>
      </div>
    `;

    el.querySelectorAll('button[data-goto-vf]').forEach(btn => {
      btn.addEventListener('click', () => {
        state.vfRiskFilter = btn.getAttribute('data-goto-vf');
        switchTab('vf');
      });
    });
  }

  function renderPodium() {
    const container = document.getElementById('podiumContainer');
    if (!container) return;

    const top3 = [...filteredAlunos].sort((a, b) => a.rankGraduacao - b.rankGraduacao).slice(0, 3);
    
    if (top3.length === 0) {
      if (DATA.alunos.length === 0) {
        container.innerHTML = `<div class="col-span-3 glass-panel p-6 rounded-2xl border border-amber-500/30 text-center space-y-2">
          <div class="text-sm font-bold text-amber-300">${escapeHtml(ACTIVE_TURMA.nome)} (Semestre ${escapeHtml(CURRENT_SEM)}) ainda sem notas lançadas</div>
          <p class="text-xs text-slate-400">${CAN_MANAGE_GRADES ? 'Acesse a aba <strong>Gestão &amp; Notas</strong> para importar uma planilha (.xlsx/.csv) ou cadastrar os alunos.' : 'Aguardando o gestor publicar os primeiros dados desta turma.'}</p>
        </div>`;
      } else {
        container.innerHTML = `<div class="col-span-3 text-center py-6 text-slate-500">Nenhum aluno encontrado para os filtros selecionados.</div>`;
      }
      return;
    }

    const medals = [
      { rank: 1, icon: '🥇', label: '1º Lugar Graduação', border: 'border-blue-500/50', glow: 'bg-blue-500/10', text: 'text-blue-400' },
      { rank: 2, icon: '🥈', label: '2º Lugar Graduação', border: 'border-slate-400/50', glow: 'bg-slate-400/10', text: 'text-slate-300' },
      { rank: 3, icon: '🥉', label: '3º Lugar Graduação', border: 'border-amber-700/50', glow: 'bg-amber-700/10', text: 'text-amber-500' }
    ];

    container.innerHTML = top3.map((aluno, idx) => {
      const m = medals[idx] || medals[2];
      return `
        <div class="glass-card p-4 rounded-2xl border ${m.border} cursor-pointer hover:scale-[1.02] transition" onclick="window.app.openStudentModal(${aluno.numero})">
          <div class="flex items-center justify-between mb-3">
            <span class="text-xs font-bold ${m.text} flex items-center gap-1.5 px-2.5 py-0.5 rounded-full ${m.glow}">
              <span>${m.icon}</span> ${m.label}
            </span>
            <span class="text-[11px] text-slate-400 font-mono-numbers">#${aluno.rankGraduacao} Grad</span>
          </div>
          <div class="flex items-center gap-3">
            <div class="w-12 h-12 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center font-extrabold text-white text-base">
              ${aluno.nome.substring(0, 2).toUpperCase()}
            </div>
            <div class="flex-1 min-w-0">
              <h4 class="font-extrabold text-sm text-white truncate">${aluno.nome}</h4>
              <div class="flex items-center gap-2 mt-1">
                ${getCourseBadge(aluno.curso)}
                ${getVinculoBadge(aluno.vinculo)}
              </div>
            </div>
          </div>
          <div class="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs">
            <div>
              <span class="text-blue-400 text-[10px] uppercase font-bold block">CR Graduação (Principal)</span>
              <span class="text-xl font-extrabold text-blue-400 font-mono-numbers">${fmtNum(aluno.mediaGraduacao)}</span>
            </div>
            <div class="text-right">
              <span class="text-slate-400 text-[10px] uppercase font-bold block">CR Geral (80/20)</span>
              <span class="text-base font-bold text-slate-300 font-mono-numbers">${fmtNum(aluno.mediaGeral)}</span>
            </div>
          </div>
        </div>
      `;
    }).join('');

    refreshIcons();
  }

  function initOverviewCharts() {
    // 1. Chart Cursos (Horizontal Bar Chart)
    const ctxCursos = document.getElementById('chartCursos')?.getContext('2d');
    if (ctxCursos) {
      const sortedCursos = [...DATA.cursosComparativo].sort((a, b) => b.mediaGraduacao - a.mediaGraduacao);
      const labels = sortedCursos.map(c => c.curso);
      const dataGrad = sortedCursos.map(c => c.mediaGraduacao);
      const dataGeral = sortedCursos.map(c => c.mediaGeral);
      const xBounds = computeDynamicBounds([dataGrad, dataGeral], 0.8, 0.15);

      chartCursosInstance = new Chart(ctxCursos, {
        type: 'bar',
        data: {
          labels: labels,
          datasets: [
            {
              label: 'CR Graduação (Principal)',
              data: dataGrad,
              backgroundColor: 'rgba(59, 130, 246, 0.85)',
              borderColor: '#3b82f6',
              borderWidth: 1,
              borderRadius: 6
            },
            {
              label: 'CR Geral (80/20)',
              data: dataGeral,
              backgroundColor: 'rgba(99, 102, 241, 0.45)',
              borderColor: '#6366f1',
              borderWidth: 1,
              borderRadius: 6
            }
          ]
        },
        options: {
          indexAxis: 'y',
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              backgroundColor: 'rgba(15, 23, 42, 0.95)',
              padding: 12
            }
          },
          scales: {
            x: {
              min: xBounds.min,
              max: xBounds.max,
              grid: { color: 'rgba(255, 255, 255, 0.05)' },
              ticks: {
                color: '#94a3b8',
                stepSize: xBounds.stepSize,
                callback: (v) => Number(v).toFixed(2),
                font: { family: 'JetBrains Mono' }
              }
            },
            y: {
              grid: { display: false },
              ticks: { color: '#e2e8f0', font: { weight: '600', size: 11 } }
            }
          }
        }
      });
    }

    // 2. Chart Evolução da Turma (Semestral vs Cumulativa)
    const ctxEvolucao = document.getElementById('chartEvolucao')?.getContext('2d');
    if (ctxEvolucao) {
      const semestres = DATA.metadata.semestres;
      const mediaTurma = (state.overviewMetric === 'semestral')
        ? DATA.semestresBenchmark.map(s => s.mediaGraduacaoTurma)
        : DATA.semestresBenchmark.map(s => s.mediaGraduacaoTurmaCumulativa);

      const label = (state.overviewMetric === 'semestral')
        ? 'Média de Graduação da Turma (Semestral)'
        : 'CR de Graduação Cumulativo da Turma';

      const evolBounds = computeDynamicBounds([mediaTurma], 0.8, 0.2);

      chartEvolucaoInstance = new Chart(ctxEvolucao, {
        type: 'line',
        data: {
          labels: semestres.map(s => s === '3.2' ? '3.2 (Parcial)' : s),
          datasets: [
            {
              label: label,
              data: mediaTurma,
              borderColor: '#10b981',
              backgroundColor: 'rgba(16, 185, 129, 0.12)',
              fill: true,
              tension: 0.3,
              pointBackgroundColor: '#10b981',
              pointBorderColor: '#fff',
              pointRadius: 5,
              pointHoverRadius: 7,
              borderWidth: 3
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          interaction: { mode: 'index', intersect: false },
          plugins: {
            legend: { display: false },
            tooltip: {
              backgroundColor: 'rgba(15, 23, 42, 0.95)',
              padding: 12,
              callbacks: {
                label: function(ctx) {
                  return `${ctx.dataset.label}: ${ctx.parsed.y !== null ? ctx.parsed.y.toFixed(2) : '-'}`;
                }
              }
            }
          },
          scales: {
            y: {
              min: evolBounds.min,
              max: evolBounds.max,
              grid: { color: 'rgba(255, 255, 255, 0.05)' },
              ticks: {
                color: '#94a3b8',
                stepSize: evolBounds.stepSize,
                callback: (v) => Number(v).toFixed(2),
                font: { family: 'JetBrains Mono' }
              }
            },
            x: {
              grid: { color: 'rgba(255, 255, 255, 0.03)' },
              ticks: { color: '#cbd5e1', font: { weight: '600' } }
            }
          }
        }
      });
    }

    // 3. Chart Distribuição Vínculo
    const ctxVinculo = document.getElementById('chartVinculo')?.getContext('2d');
    if (ctxVinculo) {
      chartVinculoInstance = new Chart(ctxVinculo, {
        type: 'doughnut',
        data: {
          labels: ['Ativa', 'Reserva', 'CG'],
          datasets: [{
            data: [DATA.metadata.vinculos.Ativa, DATA.metadata.vinculos.Reserva, DATA.metadata.vinculos.CG],
            backgroundColor: [
              'rgba(16, 185, 129, 0.85)',
              'rgba(59, 130, 246, 0.85)',
              'rgba(245, 158, 11, 0.85)'
            ],
            borderColor: '#0b0f19',
            borderWidth: 3
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          cutout: '68%',
          plugins: {
            legend: {
              position: 'bottom',
              labels: { color: '#cbd5e1', font: { size: 11, weight: '600' } }
            }
          }
        }
      });
    }

    // 4. Chart Distribuição Faixas CR Graduação
    const ctxDist = document.getElementById('chartDistribuicao')?.getContext('2d');
    if (ctxDist) {
      const ranges = {
        '>= 9.0 (Excelente)': 0,
        '8.5 - 8.99 (Muito Bom)': 0,
        '8.0 - 8.49 (Bom)': 0,
        '7.5 - 7.99 (Regular Alto)': 0,
        '7.0 - 7.49 (Regular)': 0,
        '< 7.0 (Atenção)': 0
      };

      DATA.alunos.forEach(a => {
        const cr = a.mediaGraduacao;
        if (cr >= 9.0) ranges['>= 9.0 (Excelente)']++;
        else if (cr >= 8.5) ranges['8.5 - 8.99 (Muito Bom)']++;
        else if (cr >= 8.0) ranges['8.0 - 8.49 (Bom)']++;
        else if (cr >= 7.5) ranges['7.5 - 7.99 (Regular Alto)']++;
        else if (cr >= 7.0) ranges['7.0 - 7.49 (Regular)']++;
        else ranges['< 7.0 (Atenção)']++;
      });

      chartDistribuicaoInstance = new Chart(ctxDist, {
        type: 'bar',
        data: {
          labels: Object.keys(ranges),
          datasets: [{
            label: 'Alunos',
            data: Object.values(ranges),
            backgroundColor: [
              'rgba(16, 185, 129, 0.8)',
              'rgba(59, 130, 246, 0.8)',
              'rgba(99, 102, 241, 0.8)',
              'rgba(245, 158, 11, 0.8)',
              'rgba(249, 115, 22, 0.8)',
              'rgba(239, 68, 68, 0.8)'
            ],
            borderRadius: 6
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            y: {
              grid: { color: 'rgba(255, 255, 255, 0.05)' },
              ticks: { color: '#94a3b8', font: { family: 'JetBrains Mono' } }
            },
            x: {
              grid: { display: false },
              ticks: { color: '#cbd5e1', font: { size: 10 } }
            }
          }
        }
      });
    }

    // Metric toggle for Overview
    document.querySelectorAll('#toggleOverviewMetric button').forEach(btn => {
      btn.addEventListener('click', () => {
        state.overviewMetric = btn.getAttribute('data-metric');
        updateToggleButtons('toggleOverviewMetric', state.overviewMetric, 'bg-emerald-600');
        const subtitle = (state.overviewMetric === 'semestral')
          ? 'Média de Graduação por semestre (1.1 ao 3.2)'
          : 'CR de Graduação Cumulativo acumulado até cada período';
        document.getElementById('overviewEvolucaoSubtitle').textContent = subtitle;
        updateOverviewCharts();
      });
    });
  }

  function updateOverviewCharts() {
    const scopedCursos = getScopedCursosComparativo();
    const scopedBench = getScopedSemestresBenchmark();

    if (chartCursosInstance) {
      const sortedCursos = [...scopedCursos]
        .filter(c => c.qtdAlunos > 0)
        .sort((a, b) => (b.mediaGraduacao ?? 0) - (a.mediaGraduacao ?? 0));
      const labels = sortedCursos.map(c => c.curso);
      const dataGrad = sortedCursos.map(c => c.mediaGraduacao);
      const dataGeral = sortedCursos.map(c => c.mediaGeral);
      const xBounds = computeDynamicBounds([dataGrad, dataGeral], 0.8, 0.15);

      chartCursosInstance.data.labels = labels;
      chartCursosInstance.data.datasets[0].data = dataGrad;
      chartCursosInstance.data.datasets[1].data = dataGeral;
      chartCursosInstance.data.datasets[0].backgroundColor = labels.map(c =>
        state.filterCurso === 'ALL' || matchesCourseFilter(c, state.filterCurso)
          ? 'rgba(59, 130, 246, 0.85)'
          : 'rgba(59, 130, 246, 0.18)'
      );
      chartCursosInstance.data.datasets[1].backgroundColor = labels.map(c =>
        state.filterCurso === 'ALL' || matchesCourseFilter(c, state.filterCurso)
          ? 'rgba(99, 102, 241, 0.5)'
          : 'rgba(99, 102, 241, 0.1)'
      );
      chartCursosInstance.options.scales.x.min = xBounds.min;
      chartCursosInstance.options.scales.x.max = xBounds.max;
      chartCursosInstance.options.scales.x.ticks.stepSize = xBounds.stepSize;
      chartCursosInstance.update();
    }

    if (chartVinculoInstance) {
      chartVinculoInstance.data.datasets[0].data = [
        filteredAlunos.filter(a => a.vinculo === 'Ativa').length,
        filteredAlunos.filter(a => a.vinculo === 'Reserva').length,
        filteredAlunos.filter(a => a.vinculo === 'CG').length
      ];
      chartVinculoInstance.update();
    }

    if (chartDistribuicaoInstance) {
      const ranges = [0, 0, 0, 0, 0, 0];
      filteredAlunos.forEach(a => {
        const cr = a.mediaGraduacao;
        if (cr >= 9.0) ranges[0]++;
        else if (cr >= 8.5) ranges[1]++;
        else if (cr >= 8.0) ranges[2]++;
        else if (cr >= 7.5) ranges[3]++;
        else if (cr >= 7.0) ranges[4]++;
        else ranges[5]++;
      });
      chartDistribuicaoInstance.data.datasets[0].data = ranges;
      chartDistribuicaoInstance.update();
    }

    if (!chartEvolucaoInstance) return;

    const semestres = DATA.metadata.semestres;
    const isSem = (state.overviewMetric === 'semestral');

    const cohortData = isSem
      ? scopedBench.map(s => s.mediaGraduacaoTurma)
      : scopedBench.map(s => s.mediaGraduacaoTurmaCumulativa);

    const cohortLabel = isSem ? 'Média de Graduação (Semestral)' : 'CR Cumulativo (Turma)';

    chartEvolucaoInstance.data.datasets[0].label = cohortLabel;
    chartEvolucaoInstance.data.datasets[0].data = cohortData;

    if (state.filterCurso !== 'ALL') {
      const courseObj = SE_GROUPS[state.filterCurso]
        ? getGroupCourseObj(state.filterCurso)
        : scopedCursos.find(c => c.curso === state.filterCurso);
      const courseData = semestres.map(s => {
        if (!courseObj) return null;
        return isSem ? courseObj.semestres[s] : courseObj.semestresCumulativo[s];
      });

      const displayColor = SE_GROUPS[state.filterCurso]?.color || courseColors[state.filterCurso] || '#3b82f6';
      const courseLabel = isSem ? `Média Semestral ${state.filterCurso}` : `CR Cumulativo ${state.filterCurso}`;

      if (chartEvolucaoInstance.data.datasets.length === 1) {
        chartEvolucaoInstance.data.datasets.push({
          label: courseLabel,
          data: courseData,
          borderColor: displayColor,
          backgroundColor: 'transparent',
          borderDash: [5, 5],
          pointBackgroundColor: displayColor,
          pointBorderColor: '#fff',
          pointRadius: 5,
          borderWidth: 2.5
        });
      } else {
        chartEvolucaoInstance.data.datasets[1].label = courseLabel;
        chartEvolucaoInstance.data.datasets[1].data = courseData;
        chartEvolucaoInstance.data.datasets[1].borderColor = displayColor;
        chartEvolucaoInstance.data.datasets[1].pointBackgroundColor = displayColor;
      }
    } else {
      if (chartEvolucaoInstance.data.datasets.length > 1) {
        chartEvolucaoInstance.data.datasets.pop();
      }
    }
    const yBounds = computeDynamicBounds(chartEvolucaoInstance.data.datasets, 0.8, 0.2);
    chartEvolucaoInstance.options.scales.y.min = yBounds.min;
    chartEvolucaoInstance.options.scales.y.max = yBounds.max;
    chartEvolucaoInstance.options.scales.y.ticks.stepSize = yBounds.stepSize;
    chartEvolucaoInstance.update();
  }

  // --- TAB 2: COMPARADOR DE CURSOS (EVOLUÇÃO) ---
  function initCursosComparisonTab() {
    renderCourseTogglePills();
    renderCourseEvolutionMultiLineChart();
    renderCourseMatrixTable();
    initCourseHeadToHead();

    document.getElementById('btnSelectSE3Courses')?.addEventListener('click', () => {
      state.activeCoursesInChart = new Set([...SE_GROUPS.SE3.cursos, 'SE3']);
      renderCourseTogglePills();
      updateCourseEvolutionChart();
    });

    document.getElementById('btnSelectSE4Courses')?.addEventListener('click', () => {
      state.activeCoursesInChart = new Set([...SE_GROUPS.SE4.cursos, 'SE4']);
      renderCourseTogglePills();
      updateCourseEvolutionChart();
    });

    document.getElementById('btnSelectAllCourses')?.addEventListener('click', () => {
      state.activeCoursesInChart = new Set(DATA.metadata.cursos);
      renderCourseTogglePills();
      updateCourseEvolutionChart();
    });

    document.getElementById('btnClearCourses')?.addEventListener('click', () => {
      state.activeCoursesInChart = new Set();
      renderCourseTogglePills();
      updateCourseEvolutionChart();
    });

    // Toggle metric for courses (Semestral vs Cumulativo)
    document.querySelectorAll('#toggleCourseMetric button').forEach(btn => {
      btn.addEventListener('click', () => {
        state.courseMetric = btn.getAttribute('data-metric');
        updateToggleButtons('toggleCourseMetric', state.courseMetric, 'bg-blue-600');
        updateCourseEvolutionChart();
        renderCourseMatrixTable();
        renderCourseHeadToHead();
      });
    });
  }

  function renderCourseTogglePills() {
    const container = document.getElementById('courseTogglePills');
    if (!container) return;

    const pillItems = [
      ...DATA.cursosComparativo.map(c => ({ id: c.curso, label: c.curso, color: courseColors[c.curso] || '#3b82f6' })),
      { id: 'SE3', label: 'SE3 (Consolidado)', color: SE_GROUPS.SE3.color },
      { id: 'SE4', label: 'SE4 (Consolidado)', color: SE_GROUPS.SE4.color }
    ];

    container.innerHTML = pillItems.map(item => {
      const active = state.activeCoursesInChart.has(item.id);
      const border = active ? `border-color: ${item.color};` : 'border-color: rgba(255,255,255,0.1); opacity: 0.5;';
      const bg = active ? `background-color: ${item.color}22;` : 'background-color: transparent;';

      return `
        <button 
          class="course-pill px-3 py-1 rounded-xl text-xs font-bold border transition flex items-center gap-1.5"
          style="${border} ${bg} color: ${item.color};"
          data-course="${item.id}"
          onclick="window.app.toggleCourseInChart('${item.id}')"
        >
          <span class="w-2 h-2 rounded-full" style="background-color: ${item.color};"></span>
          <span>${item.label}</span>
        </button>
      `;
    }).join('');
  }

  function buildCourseChartDatasets(semestres, isSem) {
    const scopedBench = getScopedSemestresBenchmark();
    const scopedCursos = getScopedCursosComparativo();
    const cohortData = isSem
      ? scopedBench.map(b => b.mediaGraduacaoTurma)
      : scopedBench.map(b => b.mediaGraduacaoTurmaCumulativa);

    const cohortLabel = isSem ? 'Média da Turma (Semestral)' : 'CR Cumulativo Turma';

    const datasets = [
      {
        label: cohortLabel,
        data: cohortData,
        borderColor: '#94a3b8',
        backgroundColor: 'transparent',
        borderDash: [6, 6],
        pointRadius: 4,
        borderWidth: 2,
        order: 99
      }
    ];

    scopedCursos.forEach(c => {
      if (c.qtdAlunos > 0 && state.activeCoursesInChart.has(c.curso)) {
        const color = courseColors[c.curso] || '#3b82f6';
        const vals = isSem
          ? semestres.map(s => c.semestres[s])
          : semestres.map(s => c.semestresCumulativo[s]);

        datasets.push({
          label: c.curso,
          data: vals,
          borderColor: color,
          backgroundColor: color,
          pointBackgroundColor: color,
          pointBorderColor: '#fff',
          pointRadius: 5,
          borderWidth: 2.5,
          tension: 0.25
        });
      }
    });

    ['SE3', 'SE4'].forEach(seKey => {
      if (state.activeCoursesInChart.has(seKey)) {
        const grp = getGroupCourseObj(seKey);
        if (!grp) return;
        const color = SE_GROUPS[seKey].color;
        const vals = isSem
          ? semestres.map(s => grp.semestres[s])
          : semestres.map(s => grp.semestresCumulativo[s]);

        datasets.push({
          label: `${seKey} (Consolidado)`,
          data: vals,
          borderColor: color,
          backgroundColor: color,
          borderDash: [3, 3],
          pointBackgroundColor: color,
          pointBorderColor: '#fff',
          pointRadius: 5,
          borderWidth: 3,
          tension: 0.25
        });
      }
    });

    return datasets;
  }

  function renderCourseEvolutionMultiLineChart() {
    const ctx = document.getElementById('chartCursosEvolucao')?.getContext('2d');
    if (!ctx) return;

    const semestres = DATA.metadata.semestres;
    const labels = semestres.map(s => s === '3.2' ? '3.2 (Parcial)' : `Sem. ${s}`);
    const isSem = (state.courseMetric === 'semestral');
    const datasets = buildCourseChartDatasets(semestres, isSem);
    const yBounds = computeDynamicBounds(datasets, 1.0, 0.2);

    chartCursosEvolucaoInstance = new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: datasets
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: {
            position: 'top',
            labels: { color: '#cbd5e1', font: { size: 11, weight: '600' }, boxWidth: 12 }
          },
          tooltip: {
            backgroundColor: 'rgba(15, 23, 42, 0.95)',
            padding: 12,
            callbacks: {
              label: (ctx) => `${ctx.dataset.label}: ${ctx.parsed.y !== null ? ctx.parsed.y.toFixed(2) : '-'}`
            }
          }
        },
        scales: {
          y: {
            min: yBounds.min,
            max: yBounds.max,
            grid: { color: 'rgba(255, 255, 255, 0.05)' },
            ticks: {
              color: '#94a3b8',
              stepSize: yBounds.stepSize,
              callback: (v) => Number(v).toFixed(2),
              font: { family: 'JetBrains Mono' }
            }
          },
          x: {
            grid: { color: 'rgba(255, 255, 255, 0.03)' },
            ticks: { color: '#cbd5e1', font: { weight: '600' } }
          }
        }
      }
    });
  }

  function updateCourseEvolutionChart() {
    if (!chartCursosEvolucaoInstance) return;

    const semestres = DATA.metadata.semestres;
    const isSem = (state.courseMetric === 'semestral');
    const datasets = buildCourseChartDatasets(semestres, isSem);
    const yBounds = computeDynamicBounds(datasets, 1.0, 0.2);
    chartCursosEvolucaoInstance.data.datasets = datasets;
    chartCursosEvolucaoInstance.options.scales.y.min = yBounds.min;
    chartCursosEvolucaoInstance.options.scales.y.max = yBounds.max;
    chartCursosEvolucaoInstance.options.scales.y.ticks.stepSize = yBounds.stepSize;
    chartCursosEvolucaoInstance.update();
  }

  function getCoursesWithSE() {
    const se3 = getGroupCourseObj('SE3');
    const se4 = getGroupCourseObj('SE4');
    return [...getScopedCursosComparativo().filter(c => c.qtdAlunos > 0), ...(se3 && se3.qtdAlunos > 0 ? [se3] : []), ...(se4 && se4.qtdAlunos > 0 ? [se4] : [])];
  }

  function renderCourseCards() {
    const container = document.getElementById('courseCardsContainer');
    if (!container) return;

    const isSem = (state.courseMetric === 'semestral');

    container.innerHTML = getCoursesWithSE().map(c => {
      const src = isSem ? c.semestres : c.semestresCumulativo;
      const highlight = c.isSEGroup ? 'border-purple-500/30 bg-slate-900/80' : 'border-slate-800';
      return `
        <div class="glass-panel p-4 rounded-2xl border ${highlight} space-y-3 shadow-md">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              ${getCourseBadge(c.curso)}
              <span class="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-semibold font-mono-numbers">${c.qtdAlunos} alunos</span>
            </div>
            <div class="text-right">
              <span class="text-[10px] text-slate-400 uppercase font-semibold block">Média Graduação</span>
              <span class="text-lg font-black text-blue-400 font-mono-numbers">${fmtNum(c.mediaGraduacao)}</span>
            </div>
          </div>

          <div class="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-1.5 text-xs">
            <div class="flex items-center justify-between text-slate-300">
              <span class="text-slate-400 flex items-center gap-1">🥇 1º Lugar:</span>
              <span class="font-bold text-slate-200 truncate max-w-[170px]">${c.melhorAluno}</span>
            </div>
            <div class="flex items-center justify-between text-slate-300">
              <span class="text-slate-400">Faixa de CR:</span>
              <span class="font-mono-numbers">
                <span class="text-rose-400 font-bold">${fmtNum(c.menorCR)}</span> a <span class="text-emerald-400 font-bold">${fmtNum(c.maiorCR)}</span>
              </span>
            </div>
          </div>

          <div>
            <span class="text-[10px] text-slate-400 uppercase font-semibold block mb-1">
              ${isSem ? 'Médias por Período' : 'CR Acumulado até o Período'}
            </span>
            <div class="grid grid-cols-6 gap-1 text-center">
              <div class="p-1 rounded-lg bg-slate-900 border border-slate-800">
                <span class="text-[9px] text-slate-400 block font-semibold">1.1</span>
                <span class="font-bold text-xs font-mono-numbers text-slate-200">${fmtNum(src['1.1'])}</span>
              </div>
              <div class="p-1 rounded-lg bg-slate-900 border border-slate-800">
                <span class="text-[9px] text-slate-400 block font-semibold">1.2</span>
                <span class="font-bold text-xs font-mono-numbers text-slate-200">${fmtNum(src['1.2'])}</span>
              </div>
              <div class="p-1 rounded-lg bg-slate-900 border border-slate-800">
                <span class="text-[9px] text-slate-400 block font-semibold">2.1</span>
                <span class="font-bold text-xs font-mono-numbers text-slate-200">${fmtNum(src['2.1'])}</span>
              </div>
              <div class="p-1 rounded-lg bg-slate-900 border border-slate-800">
                <span class="text-[9px] text-slate-400 block font-semibold">2.2</span>
                <span class="font-bold text-xs font-mono-numbers text-slate-200">${fmtNum(src['2.2'])}</span>
              </div>
              <div class="p-1 rounded-lg bg-slate-900 border border-slate-800">
                <span class="text-[9px] text-slate-400 block font-semibold">3.1</span>
                <span class="font-bold text-xs font-mono-numbers text-slate-200">${fmtNum(src['3.1'])}</span>
              </div>
              <div class="p-1 rounded-lg bg-slate-900 border border-amber-500/30 bg-amber-500/10">
                <span class="text-[9px] text-amber-400 block font-bold">3.2</span>
                <span class="font-bold text-xs font-mono-numbers text-amber-400">${fmtNum(src['3.2'])}</span>
              </div>
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  function renderCourseMatrixTable() {
    const tbody = document.getElementById('courseComparisonTableBody');
    if (!tbody) return;

    const isSem = (state.courseMetric === 'semestral');
    const subtitle = document.getElementById('courseMatrixSubtitle');
    if (subtitle) {
      subtitle.textContent = isSem 
        ? 'Médias de graduação por semestre (médias isoladas de cada período) e destaques por curso'
        : 'CR de Graduação Cumulativo acumulado até cada período (evolução do histórico) e destaques por curso';
    }

    tbody.innerHTML = getCoursesWithSE().map(c => {
      const src = isSem ? c.semestres : c.semestresCumulativo;
      const rowCls = c.isSEGroup ? 'table-hover-row border-b border-slate-800/60 bg-slate-900/60' : 'table-hover-row border-b border-slate-800/40';
      return `
        <tr class="${rowCls}">
          <td class="py-3 px-4 font-bold text-white">
            ${getCourseBadge(c.curso)}
          </td>
          <td class="py-3 px-3 text-center text-slate-400 font-mono-numbers">${c.qtdAlunos}</td>
          <td class="py-3 px-4 text-right font-extrabold text-blue-400 font-mono-numbers text-sm">${fmtNum(c.mediaGraduacao)}</td>
          <td class="py-3 px-3 text-right font-mono-numbers text-slate-300">${fmtNum(src['1.1'])}</td>
          <td class="py-3 px-3 text-right font-mono-numbers text-slate-300">${fmtNum(src['1.2'])}</td>
          <td class="py-3 px-3 text-right font-mono-numbers text-slate-300">${fmtNum(src['2.1'])}</td>
          <td class="py-3 px-3 text-right font-mono-numbers text-slate-300">${fmtNum(src['2.2'])}</td>
          <td class="py-3 px-3 text-right font-mono-numbers text-slate-300">${fmtNum(src['3.1'])}</td>
          <td class="py-3 px-3 text-right font-mono-numbers text-amber-400 font-bold">${fmtNum(src['3.2'])}</td>
          <td class="py-3 px-4 text-right font-mono-numbers text-slate-400 text-[11px]">
            <span class="text-rose-400">${fmtNum(c.menorCR)}</span> / <span class="text-emerald-400">${fmtNum(c.maiorCR)}</span>
          </td>
          <td class="py-3 px-4 font-bold text-slate-200">
            🥇 ${c.melhorAluno}
          </td>
        </tr>
      `;
    }).join('');

    renderCourseCards();

    // Toggle Visibility (Cards vs Table)
    const cardsEl = document.getElementById('courseCardsContainer');
    const tableEl = document.getElementById('courseTableContainer');
    if (cardsEl && tableEl) {
      if (state.courseView === 'cards') {
        cardsEl.classList.remove('hidden');
        tableEl.classList.add('hidden');
      } else {
        cardsEl.classList.add('hidden');
        tableEl.classList.remove('hidden');
      }
    }

    // Toggle button styling
    const toggleEl = document.getElementById('toggleCourseView');
    if (toggleEl) {
      toggleEl.querySelectorAll('button').forEach(btn => {
        if (btn.getAttribute('data-cview') === state.courseView) {
          btn.className = 'px-2.5 py-1 text-xs font-bold rounded-lg bg-blue-600 text-white transition flex items-center gap-1 shadow-sm';
        } else {
          btn.className = 'px-2.5 py-1 text-xs font-bold rounded-lg text-slate-400 hover:text-white transition flex items-center gap-1';
        }
      });
    }

    refreshIcons();
  }

  function initCourseHeadToHead() {
    const selA = document.getElementById('selectCourseA');
    const selB = document.getElementById('selectCourseB');
    if (!selA || !selB) return;

    const opts = [
      ...DATA.metadata.cursos.map(c => `<option value="${c}">${c}${courseToSE[c] ? ` (${courseToSE[c]})` : ''}</option>`),
      `<option value="SE3">SE3 — Eletrônica, Elétrica, Comunicações</option>`,
      `<option value="SE4">SE4 — Mec. Armamento e Automóveis</option>`
    ].join('');
    selA.innerHTML = opts;
    selB.innerHTML = opts;

    selA.value = state.courseA;
    selB.value = state.courseB;

    selA.addEventListener('change', (e) => {
      state.courseA = e.target.value;
      renderCourseHeadToHead();
    });

    selB.addEventListener('change', (e) => {
      state.courseB = e.target.value;
      renderCourseHeadToHead();
    });

    renderCourseHeadToHead();
  }

  function renderCourseHeadToHead() {
    const scopedCursos = getScopedCursosComparativo();
    const findCourseOrSE = (val, fallbackIdx) => {
      if (SE_GROUPS[val] && DATA.alunos.some(a => SE_GROUPS[val].cursos.includes(a.curso))) {
        return getGroupCourseObj(val);
      }
      return scopedCursos.find(c => c.curso === val) || scopedCursos[fallbackIdx] || scopedCursos[0];
    };
    const cA = findCourseOrSE(state.courseA, 0);
    const cB = findCourseOrSE(state.courseB, 1);

    const cardsContainer = document.getElementById('courseHeadToHeadCards');
    if (!cA || !cB) {
      if (cardsContainer) cardsContainer.innerHTML = `<div class="col-span-2 p-4 text-xs text-slate-400">Nenhuma especialidade disponível para comparação.</div>`;
      return;
    }
    if (cardsContainer) {
      cardsContainer.innerHTML = [cA, cB].map((c, idx) => {
        const color = idx === 0 ? 'text-blue-400' : 'text-emerald-400';
        const border = idx === 0 ? 'border-blue-500/40' : 'border-emerald-500/40';
        return `
          <div class="glass-card p-4 rounded-xl border ${border} space-y-3">
            <div class="flex items-center justify-between">
              <span class="text-xs font-bold uppercase ${color}">Especialidade ${idx === 0 ? 'A' : 'B'}</span>
              <span class="text-xs font-mono-numbers text-slate-400">${c.qtdAlunos} Alunos</span>
            </div>
            <div class="flex items-center justify-between">
              <h4 class="font-extrabold text-base text-white">${c.curso}</h4>
              <span class="text-lg font-extrabold ${color} font-mono-numbers">${fmtNum(c.mediaGraduacao)}</span>
            </div>
            <div class="pt-2 border-t border-slate-800 text-xs flex justify-between text-slate-400">
              <span>Top 1: <strong class="text-slate-200">${c.melhorAluno}</strong></span>
              <span>Maior CR: <strong class="text-emerald-400 font-mono-numbers">${fmtNum(c.maiorCR)}</strong></span>
            </div>
          </div>
        `;
      }).join('');
    }

    const ctx = document.getElementById('chartCourseHeadToHead')?.getContext('2d');
    if (ctx) {
      if (chartCourseH2HInstance) chartCourseH2HInstance.destroy();

      const semestres = DATA.metadata.semestres;
      const isSem = (state.courseMetric === 'semestral');
      const valsA = isSem ? semestres.map(s => cA.semestres[s]) : semestres.map(s => cA.semestresCumulativo[s]);
      const valsB = isSem ? semestres.map(s => cB.semestres[s]) : semestres.map(s => cB.semestresCumulativo[s]);
      const h2hBounds = computeDynamicBounds([valsA, valsB], 0.8, 0.2);

      chartCourseH2HInstance = new Chart(ctx, {
        type: 'bar',
        data: {
          labels: semestres.map(s => s === '3.2' ? '3.2 (Parcial)' : `Sem. ${s}`),
          datasets: [
            {
              label: cA.curso,
              data: valsA,
              backgroundColor: 'rgba(59, 130, 246, 0.85)',
              borderRadius: 6
            },
            {
              label: cB.curso,
              data: valsB,
              backgroundColor: 'rgba(16, 185, 129, 0.85)',
              borderRadius: 6
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          interaction: { mode: 'index', intersect: false },
          plugins: {
            legend: { position: 'top', labels: { color: '#cbd5e1', font: { weight: 'bold' } } },
            tooltip: {
              backgroundColor: 'rgba(15, 23, 42, 0.95)',
              padding: 12,
              callbacks: {
                label: (ctx) => `${ctx.dataset.label}: ${ctx.parsed.y !== null ? ctx.parsed.y.toFixed(2) : '-'}`
              }
            }
          },
          scales: {
            y: {
              min: h2hBounds.min,
              max: h2hBounds.max,
              grid: { color: 'rgba(255, 255, 255, 0.05)' },
              ticks: {
                color: '#94a3b8',
                stepSize: h2hBounds.stepSize,
                callback: (v) => Number(v).toFixed(2),
                font: { family: 'JetBrains Mono' }
              }
            },
            x: {
              grid: { display: false },
              ticks: { color: '#cbd5e1' }
            }
          }
        }
      });
    }
  }

  // --- TAB 3: RANKINGS TABLE & CARDS ---
  function renderRankingCards(displayed) {
    const container = document.getElementById('rankingCardsContainer');
    if (!container) return;

    if (displayed.length === 0) {
      container.innerHTML = `<div class="col-span-full py-8 text-center text-slate-500 glass-panel rounded-2xl border border-slate-800">Nenhum aluno encontrado para os filtros selecionados.</div>`;
      return;
    }

    container.innerHTML = displayed.map(aluno => {
      let rankBadge = `#${aluno.rankGraduacao}`;
      let posBorder = 'border-slate-700 bg-slate-800/80 text-slate-200';
      if (aluno.rankGraduacao === 1) {
        rankBadge = '🥇 1º';
        posBorder = 'border-amber-400/50 bg-amber-500/10 text-amber-300';
      } else if (aluno.rankGraduacao === 2) {
        rankBadge = '🥈 2º';
        posBorder = 'border-slate-300/50 bg-slate-400/10 text-slate-200';
      } else if (aluno.rankGraduacao === 3) {
        rankBadge = '🥉 3º';
        posBorder = 'border-amber-600/50 bg-amber-700/10 text-amber-400';
      }

      const m32 = aluno.media32 !== null ? fmtNum(aluno.media32) : '-';
      let vfBadge = '';
      if (aluno.maxVf32 !== null) {
        const vfCls = aluno.vfRiskLevel === 'risk'
          ? 'bg-rose-500/15 text-rose-300 border-rose-500/30'
          : (aluno.vfRiskLevel === 'warn'
            ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
            : (aluno.vfRiskLevel === 'mid'
              ? 'bg-sky-500/15 text-sky-300 border-sky-500/30'
              : 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'));
        vfBadge = `<span class="px-2 py-0.5 rounded border text-[10px] font-bold font-mono-numbers ${vfCls}">Máx VF: ${fmtNum(aluno.maxVf32)}</span>`;
      }

      return `
        <div class="ranking-card glass-panel p-4 rounded-2xl border border-slate-800 space-y-3 cursor-pointer hover:border-blue-500/50 shadow-lg relative overflow-hidden" onclick="window.app.openStudentModal(${aluno.numero})">
          <div class="flex items-start justify-between gap-2">
            <div class="flex items-start gap-3 min-w-0">
              <div class="shrink-0 w-11 h-11 rounded-xl flex items-center justify-center font-extrabold text-sm border ${posBorder} shadow-sm font-mono-numbers">
                ${rankBadge}
              </div>
              <div class="min-w-0">
                <h4 class="font-bold text-slate-100 text-sm leading-snug hover:text-blue-400 transition truncate">
                  ${aluno.nome}
                </h4>
                <div class="flex items-center gap-1.5 mt-1 flex-wrap">
                  <span class="text-[11px] font-mono text-slate-400 font-semibold">#${aluno.numero}</span>
                  ${getCourseBadge(aluno.curso)}
                  ${getVinculoBadge(aluno.vinculo)}
                </div>
              </div>
            </div>

            <div class="text-right shrink-0">
              <span class="text-[10px] uppercase font-bold tracking-wider text-slate-400 block">CR Grad</span>
              <span class="text-xl font-black text-blue-400 font-mono-numbers">${fmtNum(aluno.mediaGraduacao)}</span>
            </div>
          </div>

          <div class="grid grid-cols-3 gap-2 p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80 text-center">
            <div>
              <span class="block text-[10px] text-slate-400 uppercase font-semibold">Geral</span>
              <span class="font-bold text-slate-200 text-xs font-mono-numbers">#${aluno.rankGeral}</span>
            </div>
            <div>
              <span class="block text-[10px] text-slate-400 uppercase font-semibold">No Curso</span>
              <span class="font-bold text-indigo-400 text-xs font-mono-numbers">#${aluno.rankCurso}</span>
            </div>
            <div>
              <span class="block text-[10px] text-slate-400 uppercase font-semibold">CR 3.2 (6º)</span>
              <span class="font-bold text-amber-400 text-xs font-mono-numbers">${m32}</span>
            </div>
          </div>

          <div class="flex items-center justify-between text-xs pt-1 text-slate-400 border-t border-slate-800/60 gap-2 flex-wrap">
            <div class="font-mono-numbers text-[11px] flex items-center gap-1.5 flex-wrap">
              <span>Maior: <strong class="text-emerald-400">${fmtNum(aluno.maiorNota)}</strong></span>
              <span class="text-slate-600">•</span>
              <span>Menor: <strong class="text-rose-400">${fmtNum(aluno.menorNota)}</strong></span>
              ${vfBadge}
            </div>
            <span class="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-400">
              Ver Ficha <i data-lucide="chevron-right" class="w-3.5 h-3.5"></i>
            </span>
          </div>
        </div>
      `;
    }).join('');
  }

  function renderVfTab() {
    const panel = document.getElementById('vfRiskRadarPanel');
    const discPanel = document.getElementById('vfDisciplinesPanel');
    if (!panel) return;

    const q = (state.vfSearch || '').trim().toLowerCase();
    const baseAlumnos = q
      ? filteredAlunos.filter(a => a.nome.toLowerCase().includes(q) || a.curso.toLowerCase().includes(q) || String(a.numero).includes(q))
      : filteredAlunos;

    const riskList = baseAlumnos.filter(a => a.vfRiskLevel === 'risk').sort((a, b) => b.maxVf32 - a.maxVf32);
    const warnList = baseAlumnos.filter(a => a.vfRiskLevel === 'warn').sort((a, b) => b.maxVf32 - a.maxVf32);
    const midList = baseAlumnos.filter(a => a.vfRiskLevel === 'mid').sort((a, b) => b.maxVf32 - a.maxVf32);
    const safeList = baseAlumnos.filter(a => a.vfRiskLevel === 'safe').sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));

    const pillCls = (key, activeBorder, activeBg, baseText) => {
      const active = state.vfRiskFilter === key;
      return active
        ? `${activeBorder} ${activeBg} ${baseText} ring-2 ring-offset-1 ring-offset-slate-900`
        : `border-slate-800 bg-slate-900/60 hover:bg-slate-800/80 ${baseText}`;
    };

    const visibleList = (
      state.vfRiskFilter === 'risk' ? riskList :
      state.vfRiskFilter === 'warn' ? warnList :
      state.vfRiskFilter === 'mid' ? midList :
      state.vfRiskFilter === 'safe' ? safeList :
      [...baseAlumnos].sort((a, b) => (b.maxVf32 ?? -1) - (a.maxVf32 ?? -1) || a.nome.localeCompare(b.nome, 'pt-BR'))
    );

    const cardStyleFor = (lvl) => {
      if (lvl === 'risk') return { border: 'border-rose-500/35 bg-rose-500/5', badge: 'text-rose-400', tag: 'bg-rose-500/15 text-rose-300 border-rose-500/30' };
      if (lvl === 'warn') return { border: 'border-amber-500/30 bg-amber-500/5', badge: 'text-amber-300', tag: 'bg-amber-500/15 text-amber-300 border-amber-500/30' };
      if (lvl === 'mid') return { border: 'border-sky-500/25 bg-sky-500/5', badge: 'text-sky-300', tag: 'bg-sky-500/15 text-sky-300 border-sky-500/30' };
      return { border: 'border-emerald-500/20 bg-emerald-500/5', badge: 'text-emerald-400', tag: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' };
    };

    panel.innerHTML = `
      <div class="flex flex-wrap items-center gap-2 text-xs font-bold pt-2 border-t border-slate-800/80">
        <button data-vfrisk="ALL" class="px-3 py-1.5 rounded-xl border transition ${state.vfRiskFilter === 'ALL' ? 'border-blue-500 bg-blue-500/20 text-blue-300 ring-2 ring-offset-1 ring-offset-slate-900' : 'border-slate-700 bg-slate-900 text-slate-400 hover:text-white'}">
          Todos (${baseAlumnos.length})
        </button>
        <button data-vfrisk="safe" class="px-3 py-1.5 rounded-xl border transition font-mono-numbers ${pillCls('safe', 'border-emerald-500', 'bg-emerald-500/20', 'text-emerald-300')}">
          Tranquilos ≤ 4.00 (${safeList.length})
        </button>
        <button data-vfrisk="mid" class="px-3 py-1.5 rounded-xl border transition font-mono-numbers ${pillCls('mid', 'border-sky-500', 'bg-sky-500/20', 'text-sky-300')}">
          4.01–5.00 (${midList.length})
        </button>
        <button data-vfrisk="warn" class="px-3 py-1.5 rounded-xl border transition font-mono-numbers ${pillCls('warn', 'border-amber-500', 'bg-amber-500/20', 'text-amber-300')}">
          Atenção 5.01–6.00 (${warnList.length})
        </button>
        <button data-vfrisk="risk" class="px-3 py-1.5 rounded-xl border transition font-mono-numbers ${pillCls('risk', 'border-rose-500', 'bg-rose-500/20', 'text-rose-300')}">
          Risco &gt; 6.00 (${riskList.length})
        </button>
        <span class="ml-auto text-[11px] text-slate-400 font-normal">Exibindo ${visibleList.length} aluno(s)</span>
      </div>

      ${visibleList.length > 0 ? `
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 pt-2">
          ${visibleList.map(a => {
            const st = cardStyleFor(a.vfRiskLevel);
            const subs = a.vfRiskSubjects || [];
            const above4 = subs.filter(s => s.valor > 4.0);
            const preview = (above4.length > 0 ? above4 : subs).slice(0, 4);
            const extraCount = subs.length - preview.length;
            return `
              <button onclick="window.app.openStudentModal(${a.numero})" class="text-left p-3.5 rounded-2xl border ${st.border} hover:border-blue-500/60 transition space-y-2 flex flex-col justify-between">
                <div class="space-y-1.5 w-full">
                  <div class="flex items-start justify-between gap-2">
                    <div class="min-w-0">
                      <div class="text-xs font-extrabold text-slate-100 truncate">${a.nome}</div>
                      <div class="text-[10px] text-slate-400 truncate mt-0.5">${a.curso} · #${a.rankGraduacao}</div>
                    </div>
                    <div class="text-right shrink-0">
                      <span class="text-xs font-extrabold font-mono-numbers block ${st.badge}">${a.maxVf32 !== null ? `Máx ${fmtNum(a.maxVf32)}` : '-'}</span>
                      <span class="text-[10px] text-slate-400 font-mono-numbers">${a.avgVf32 !== null ? `Méd ${fmtNum(a.avgVf32)}` : ''}</span>
                    </div>
                  </div>
                  <div class="space-y-1 pt-1.5 border-t border-slate-800/70">
                    ${preview.map(s => {
                      const sCls = s.valor > 6.0 ? 'text-rose-400' : (s.valor > 5.0 ? 'text-amber-300' : (s.valor > 4.0 ? 'text-sky-300' : 'text-emerald-400'));
                      return `
                        <div class="flex items-center justify-between gap-2 text-[11px]">
                          <span class="text-slate-300 truncate">${s.nome}</span>
                          <span class="font-mono-numbers font-bold shrink-0 ${sCls}">${fmtNum(s.valor)}</span>
                        </div>
                      `;
                    }).join('')}
                    ${extraCount > 0 ? `<div class="text-[10px] text-slate-500">+ ${extraCount} matéria(s) · clique para ver ficha</div>` : ''}
                    ${subs.length === 0 ? `<div class="text-[11px] text-slate-500">Sem matérias pendentes com VE+VC</div>` : ''}
                  </div>
                </div>
              </button>
            `;
          }).join('')}
        </div>
      ` : `
        <div class="py-8 text-center text-xs text-slate-400 border-t border-slate-800/80">
          Nenhum aluno encontrado nesta faixa de VF para os filtros atuais.
        </div>
      `}
    `;

    panel.querySelectorAll('button[data-vfrisk]').forEach(btn => {
      btn.addEventListener('click', () => {
        state.vfRiskFilter = btn.getAttribute('data-vfrisk');
        renderVfTab();
      });
    });

    if (discPanel) {
      // Compute VF pressure per current semester discipline using currently filtered students
      const scopedDiscMap = new Map();
      filteredAlunos.forEach(a => {
        (a.disciplinas || []).forEach(d => {
          if (d.semestre !== CURRENT_SEM) return;
          const vfInfo = calcVfNecessaria(d);
          if (!vfInfo || vfInfo.tipo !== 'exact') return;
          const k = `${d.codigo}||${d.disciplina}||${d.semestre}`;
          if (!scopedDiscMap.has(k)) {
            const meta = DATA.disciplinas.find(x => x.codigo === d.codigo && x.semestre === d.semestre);
            scopedDiscMap.set(k, {
              codigo: d.codigo,
              nome: d.nome,
              cursoLabel: meta?.cursoLabel || a.curso,
              vals: [],
              notas: []
            });
          }
          scopedDiscMap.get(k).vals.push(vfInfo.valor);
          if (d.notaEfetiva !== null) scopedDiscMap.get(k).notas.push(d.notaEfetiva);
        });
      });

      const discs32 = [...scopedDiscMap.values()].map(item => {
        const avgVf = item.vals.reduce((s, v) => s + v, 0) / item.vals.length;
        const avgNota = item.notas.length ? item.notas.reduce((s, v) => s + v, 0) / item.notas.length : null;
        return {
          codigo: item.codigo,
          nome: item.nome,
          cursoLabel: item.cursoLabel,
          qtdAlunos: item.vals.length,
          media: avgNota,
          vfMediaNec: Math.round(avgVf * 100) / 100,
          vfEmRisco: item.vals.filter(v => v > 5.0).length,
          vfRiscoAlto: item.vals.filter(v => v > 6.0).length
        };
      }).sort((a, b) => b.vfMediaNec - a.vfMediaNec || b.vfEmRisco - a.vfEmRisco);

      discPanel.innerHTML = discs32.map(d => {
        const high = d.vfEmRisco > 0;
        return `
          <div class="p-3 rounded-xl bg-slate-900/70 border ${high ? 'border-amber-500/30' : 'border-slate-800'} flex items-center justify-between gap-3">
            <div class="min-w-0">
              <div class="text-xs font-bold text-slate-100 truncate" title="${d.nome}">${d.nome}</div>
              <div class="text-[10px] text-slate-400 mt-0.5 truncate">${d.cursoLabel} · ${d.qtdAlunos} al. · méd ${fmtNum(d.media)}</div>
            </div>
            <div class="text-right shrink-0 font-mono-numbers">
              <div class="text-xs font-extrabold ${d.vfMediaNec > 5.0 ? 'text-rose-400' : (d.vfMediaNec > 4.2 ? 'text-amber-300' : 'text-emerald-400')}">VF ${fmtNum(d.vfMediaNec)}</div>
              <div class="text-[10px] ${high ? 'text-amber-300 font-bold' : 'text-slate-500'}">${d.vfEmRisco} &gt; 5.00${d.vfRiscoAlto > 0 ? ` · ${d.vfRiscoAlto} &gt; 6.00` : ''}</div>
            </div>
          </div>
        `;
      }).join('') || `<div class="col-span-full text-xs text-slate-400">Nenhuma disciplina do 3.2 com VE+VC pendente de VF para este filtro.</div>`;
    }

    refreshIcons();
  }

  function renderRankingsTable() {
    const tbody = document.getElementById('rankingTableBody');
    if (!tbody) return;

    const sorted = [...filteredAlunos].sort((a, b) => {
      let valA = a[state.sortColumn];
      let valB = b[state.sortColumn];

      const nullA = (valA === null || valA === undefined);
      const nullB = (valB === null || valB === undefined);
      if (nullA && nullB) return 0;
      if (nullA) return 1;
      if (nullB) return -1;

      if (typeof valA === 'string') {
        return state.sortAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
      }
      return state.sortAsc ? (valA - valB) : (valB - valA);
    });

    document.getElementById('tableResultsCount').textContent = `${sorted.length} alunos listados`;

    let displayed = sorted;
    if (state.pageSize !== 'ALL') {
      const limit = parseInt(state.pageSize);
      const start = (state.currentPage - 1) * limit;
      displayed = sorted.slice(start, start + limit);
      renderPaginationControls(sorted.length, limit);
    } else {
      document.getElementById('pageInfo').textContent = `Exibindo todos os ${sorted.length} alunos`;
      document.getElementById('paginationButtons').innerHTML = '';
    }

    if (displayed.length === 0) {
      tbody.innerHTML = `<tr><td colspan="13" class="py-8 text-center text-slate-500">Nenhum aluno encontrado para os filtros selecionados.</td></tr>`;
    } else {
      tbody.innerHTML = displayed.map(aluno => {
        let rankIcon = '';
        if (aluno.rankGraduacao === 1) rankIcon = '🥇 ';
        else if (aluno.rankGraduacao === 2) rankIcon = '🥈 ';
        else if (aluno.rankGraduacao === 3) rankIcon = '🥉 ';

        const m32 = aluno.media32 !== null ? fmtNum(aluno.media32) : '-';
        let maxVfCell = '<span class="text-slate-500">-</span>';
        if (aluno.maxVf32 !== null) {
          const vfColor = aluno.vfRiskLevel === 'risk'
            ? 'text-rose-400 font-extrabold'
            : (aluno.vfRiskLevel === 'warn'
              ? 'text-amber-300 font-bold'
              : (aluno.vfRiskLevel === 'mid' ? 'text-sky-300 font-semibold' : 'text-emerald-400 font-semibold'));
          maxVfCell = `<span class="${vfColor}" title="${aluno.vfRiskSubjects[0]?.nome || ''}">${fmtNum(aluno.maxVf32)}</span>`;
        }

        return `
          <tr class="table-hover-row border-b border-slate-800/40 cursor-pointer" onclick="window.app.openStudentModal(${aluno.numero})">
            <td class="py-3 px-4 font-bold text-white font-mono-numbers">
              ${rankIcon}#${aluno.rankGraduacao}
            </td>
            <td class="py-3 px-3 text-slate-400 font-mono-numbers">
              #${aluno.rankGeral}
            </td>
            <td class="py-3 px-3 text-slate-400 font-mono-numbers">
              #${aluno.rankCurso}
            </td>
            <td class="py-3 px-4 font-bold text-slate-100 hover:text-blue-400">
              ${aluno.nome}
            </td>
            <td class="py-3 px-3">
              ${getCourseBadge(aluno.curso)}
            </td>
            <td class="py-3 px-3">
              ${getVinculoBadge(aluno.vinculo)}
            </td>
            <td class="py-3 px-4 text-right font-extrabold text-blue-400 font-mono-numbers text-sm">
              ${fmtNum(aluno.mediaGraduacao)}
            </td>
            <td class="py-3 px-4 text-right font-bold text-slate-300 font-mono-numbers">
              ${fmtNum(aluno.mediaGeral)}
            </td>
            <td class="py-3 px-4 text-right font-mono-numbers text-amber-400 font-bold">
              ${m32}
            </td>
            <td class="py-3 px-3 text-right font-mono-numbers">
              ${maxVfCell}
            </td>
            <td class="py-3 px-3 text-center text-slate-400 font-mono-numbers">
              ${aluno.concluidas}
            </td>
            <td class="py-3 px-3 text-right font-mono-numbers text-slate-400 text-[11px]">
              <span class="text-emerald-400">${fmtNum(aluno.maiorNota)}</span> / <span class="text-rose-400">${fmtNum(aluno.menorNota)}</span>
            </td>
            <td class="py-3 px-4 text-center">
              <button 
                class="px-2.5 py-1 text-[11px] font-semibold bg-blue-600/20 hover:bg-blue-600 border border-blue-500/40 hover:border-blue-500 text-blue-300 hover:text-white rounded-lg transition"
                onclick="event.stopPropagation(); window.app.openStudentModal(${aluno.numero})"
              >
                Ver Ficha
              </button>
            </td>
          </tr>
        `;
      }).join('');
    }

    renderRankingCards(displayed);

    // Toggle Visibility (Cards vs Table)
    const cardsEl = document.getElementById('rankingCardsContainer');
    const tableEl = document.getElementById('rankingTableContainer');
    if (cardsEl && tableEl) {
      if (state.rankingView === 'cards') {
        cardsEl.classList.remove('hidden');
        tableEl.classList.add('hidden');
      } else {
        cardsEl.classList.add('hidden');
        tableEl.classList.remove('hidden');
      }
    }

    // Toggle button styling
    const toggleEl = document.getElementById('toggleRankingView');
    if (toggleEl) {
      toggleEl.querySelectorAll('button').forEach(btn => {
        if (btn.getAttribute('data-view') === state.rankingView) {
          btn.className = 'px-2.5 py-1 text-xs font-bold rounded-lg bg-blue-600 text-white transition flex items-center gap-1.5 shadow-sm';
        } else {
          btn.className = 'px-2.5 py-1 text-xs font-bold rounded-lg text-slate-400 hover:text-white transition flex items-center gap-1.5';
        }
      });
    }

    // Active sort header styling
    document.querySelectorAll('th[data-sort]').forEach(th => {
      const col = th.getAttribute('data-sort');
      const icon = th.querySelector('i[data-lucide]');
      if (col === state.sortColumn) {
        th.classList.add('text-blue-400');
        if (icon) icon.setAttribute('data-lucide', state.sortAsc ? 'arrow-up' : 'arrow-down');
      } else {
        th.classList.remove('text-blue-400');
        if (icon) icon.setAttribute('data-lucide', 'chevrons-up-down');
      }
    });

    refreshIcons();
  }

  function renderPaginationControls(total, limit) {
    const totalPages = Math.ceil(total / limit);
    const container = document.getElementById('paginationButtons');
    document.getElementById('pageInfo').textContent = `Página ${state.currentPage} de ${totalPages} (${total} alunos)`;

    let btns = '';
    for (let i = 1; i <= totalPages; i++) {
      const active = (i === state.currentPage) 
        ? 'bg-blue-600 text-white font-bold' 
        : 'bg-slate-800 text-slate-300 hover:bg-slate-700';
      btns += `<button class="px-2.5 py-1 rounded-md text-xs ${active}" onclick="window.app.changePage(${i})">${i}</button>`;
    }
    container.innerHTML = btns;
  }

  // --- TAB 4: RAIO-X DE DISCIPLINAS (168) ---
  function getScopedDisciplinas() {
    const cf = state.disciplinasCurso;
    const allVinculos = (state.includedVinculos.size === 3);
    if (cf === 'ALL' && allVinculos) return DATA.disciplinas;

    if (allVinculos && cf === 'MILITAR') {
      return DATA.disciplinas.filter(d => d.militar);
    }
    if (allVinculos && cf === 'COMUM_BASICO') {
      return DATA.disciplinas.filter(d => !d.militar && d.cursos && d.cursos.length >= 8);
    }

    // Recalculate stats using only students matching includedVinculos and selected course/SE
    const vinculoStudents = getVinculoScopedAlunos();
    const matchingStudents = (cf === 'ALL' || cf === 'MILITAR' || cf === 'COMUM_BASICO')
      ? vinculoStudents
      : vinculoStudents.filter(a => matchesCourseFilter(a.curso, cf));
    const aggMap = new Map();
    matchingStudents.forEach(a => {
      (a.disciplinas || []).forEach(d => {
        const meta = DATA.disciplinas.find(x => x.codigo === d.codigo && x.semestre === d.semestre && x.disciplina === d.disciplina);
        if (cf === 'MILITAR' && !d.militar) return;
        if (cf === 'COMUM_BASICO' && (d.militar || !meta || !meta.cursos || meta.cursos.length < 8)) return;
        const k = `${d.codigo}||${d.disciplina}||${d.semestre}`;
        if (!aggMap.has(k)) {
          aggMap.set(k, {
            ...(meta || {
              codigo: d.codigo,
              disciplina: d.disciplina,
              nome: d.nome,
              semestre: d.semestre,
              ciclo: d.ciclo,
              militar: d.militar,
              cursoLabel: a.curso
            }),
            grades: [],
            vfVals: []
          });
        }
        if (d.notaEfetiva !== null && d.notaEfetiva !== undefined) {
          aggMap.get(k).grades.push(d.notaEfetiva);
        }
        if (d.semestre === '3.2') {
          const vfInfo = calcVfNecessaria(d);
          if (vfInfo && vfInfo.tipo === 'exact') aggMap.get(k).vfVals.push(vfInfo.valor);
        }
      });
    });

    return [...aggMap.values()].map(item => {
      const grs = item.grades;
      const n = grs.length;
      const mean = n ? grs.reduce((s, v) => s + v, 0) / n : null;
      const dp = n > 1 ? Math.sqrt(grs.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / n) : (n ? 0 : null);
      const vfVals = item.vfVals;
      const vfMean = vfVals.length ? Math.round((vfVals.reduce((s, v) => s + v, 0) / vfVals.length) * 100) / 100 : null;
      return {
        ...item,
        qtdAlunos: n,
        media: mean !== null ? Math.round(mean * 100) / 100 : null,
        desvioPadrao: dp !== null ? Math.round(dp * 100) / 100 : null,
        menorNota: n ? Math.min(...grs) : null,
        maiorNota: n ? Math.max(...grs) : null,
        vfMediaNec: vfMean,
        vfEmRisco: vfVals.filter(v => v > 5.0).length,
        vfRiscoAlto: vfVals.filter(v => v > 6.0).length
      };
    }).sort((a, b) => (a.media ?? 999) - (b.media ?? 999));
  }

  function renderDisciplinasTab() {
    const scoped = getScopedDisciplinas();
    const minQtd = (state.disciplinasCurso === 'ALL' || state.disciplinasCurso === 'COMUM_BASICO' || state.disciplinasCurso === 'MILITAR') ? 5 : 1;
    const topHard = scoped.filter(d => d.media !== null && d.qtdAlunos >= minQtd).slice(0, 10);
    const listHard = document.getElementById('topHardDisciplinesList');
    if (listHard) {
      listHard.innerHTML = topHard.map((d, idx) => `
        <div class="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center justify-between gap-3 text-xs">
          <div class="flex items-center gap-2.5 min-w-0">
            <span class="w-5 h-5 rounded-md bg-rose-500/20 text-rose-400 font-bold flex items-center justify-center text-[10px] shrink-0 font-mono-numbers">
              ${idx + 1}
            </span>
            <div class="truncate">
              <span class="font-bold text-slate-100 block truncate">${d.nome}</span>
              <span class="text-[10px] text-slate-400">${d.codigo} • Sem. ${d.semestre} • ${d.cursoLabel || ''} • ${d.qtdAlunos} al.</span>
            </div>
          </div>
          <div class="text-right shrink-0">
            <span class="text-sm font-extrabold text-rose-400 font-mono-numbers">${fmtNum(d.media)}</span>
            <span class="text-[10px] text-slate-500 block">DP: ${fmtNum(d.desvioPadrao)}</span>
          </div>
        </div>
      `).join('') || `<div class="text-xs text-slate-500">Nenhuma disciplina para este filtro.</div>`;
    }

    const topEasy = [...scoped.filter(d => d.media !== null && d.qtdAlunos >= minQtd)].sort((a, b) => b.media - a.media).slice(0, 10);
    const listEasy = document.getElementById('topEasyDisciplinesList');
    if (listEasy) {
      listEasy.innerHTML = topEasy.map((d, idx) => `
        <div class="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center justify-between gap-3 text-xs">
          <div class="flex items-center gap-2.5 min-w-0">
            <span class="w-5 h-5 rounded-md bg-emerald-500/20 text-emerald-400 font-bold flex items-center justify-center text-[10px] shrink-0 font-mono-numbers">
              ${idx + 1}
            </span>
            <div class="truncate">
              <span class="font-bold text-slate-100 block truncate">${d.nome}</span>
              <span class="text-[10px] text-slate-400">${d.codigo} • Sem. ${d.semestre} • ${d.cursoLabel || ''} • ${d.qtdAlunos} al.</span>
            </div>
          </div>
          <div class="text-right shrink-0">
            <span class="text-sm font-extrabold text-emerald-400 font-mono-numbers">${fmtNum(d.media)}</span>
            <span class="text-[10px] text-slate-500 block">DP: ${fmtNum(d.desvioPadrao)}</span>
          </div>
        </div>
      `).join('') || `<div class="text-xs text-slate-500">Nenhuma disciplina para este filtro.</div>`;
    }

    renderDisciplinasFullTable();
    refreshIcons();
  }

  function renderDisciplinasFullTable() {
    const tbody = document.getElementById('disciplinasTableBody');
    const cardsEl = document.getElementById('disciplinasCardsContainer');
    const tableWrap = document.getElementById('disciplinasTableContainer');
    if (!tbody) return;

    let filtered = getScopedDisciplinas();

    if (state.disciplinasSemestre !== 'ALL') {
      filtered = filtered.filter(d => d.semestre === state.disciplinasSemestre);
    }

    if (state.disciplinasSearch.trim()) {
      const q = state.disciplinasSearch.toLowerCase();
      filtered = filtered.filter(d => d.nome.toLowerCase().includes(q) || d.codigo.toLowerCase().includes(q) || (d.cursoLabel || '').toLowerCase().includes(q));
    }

    tbody.innerHTML = filtered.map(d => {
      const is32 = (d.semestre === '3.2');
      const badge32 = is32 ? '<span class="ml-1.5 px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 text-[10px] font-bold border border-amber-500/20">3.2 Parcial</span>' : '';
      const vfRiskInfo = (is32 && d.vfMediaNec !== null)
        ? `<div class="text-[10px] mt-0.5 font-mono-numbers ${d.vfEmRisco > 0 ? 'text-amber-300' : 'text-emerald-400'}">VF nec. méd: ${fmtNum(d.vfMediaNec)}${d.vfEmRisco > 0 ? ` · <span class="text-rose-400 font-bold">${d.vfEmRisco} em risco (&gt;5.0)</span>` : ' · todos ≤ 5.0'}</div>`
        : '';

      const pct = d.media !== null ? Math.min(100, Math.max(0, (d.media / 10) * 100)) : 0;
      let barColor = 'bg-rose-500';
      if (d.media >= 8.5) barColor = 'bg-emerald-500';
      else if (d.media >= 7.5) barColor = 'bg-blue-500';
      else if (d.media >= 7.0) barColor = 'bg-amber-500';

      return `
        <tr class="table-hover-row border-b border-slate-800/40">
          <td class="py-2.5 px-3 font-mono-numbers text-slate-400 text-[11px]">${d.codigo}</td>
          <td class="py-2.5 px-4 font-bold text-slate-200">
            ${d.nome} ${badge32}${vfRiskInfo}
          </td>
          <td class="py-2.5 px-3 text-[11px] text-slate-300 font-semibold">${d.cursoLabel || '-'}</td>
          <td class="py-2.5 px-3 text-slate-400 font-mono-numbers">${d.semestre}</td>
          <td class="py-2.5 px-3 text-slate-400 text-[11px]">${d.ciclo}</td>
          <td class="py-2.5 px-3 text-center text-slate-400 font-mono-numbers">${d.qtdAlunos}</td>
          <td class="py-2.5 px-4 text-right font-extrabold text-slate-100 font-mono-numbers">${fmtNum(d.media)}</td>
          <td class="py-2.5 px-3 text-right text-slate-400 font-mono-numbers">${fmtNum(d.desvioPadrao)}</td>
          <td class="py-2.5 px-3 text-right font-mono-numbers text-slate-400 text-[11px]">
            <span class="text-rose-400">${fmtNum(d.menorNota)}</span> / <span class="text-emerald-400">${fmtNum(d.maiorNota)}</span>
          </td>
          <td class="py-2.5 px-4">
            <div class="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
              <div class="${barColor} h-1.5 rounded-full" style="width: ${pct}%"></div>
            </div>
          </td>
        </tr>
      `;
    }).join('') || `<tr><td colspan="10" class="py-8 text-center text-slate-500">Nenhuma disciplina encontrada.</td></tr>`;

    if (cardsEl && tableWrap) {
      const isMobile = document.body.classList.contains('is-mobile');
      if (isMobile) {
        cardsEl.classList.remove('hidden');
        tableWrap.classList.add('hidden');
        cardsEl.innerHTML = filtered.map(d => {
          const is32 = (d.semestre === '3.2');
          return `
            <div class="p-3.5 rounded-xl bg-slate-900/70 border border-slate-800 space-y-2">
              <div class="flex items-start justify-between gap-2">
                <div class="min-w-0">
                  <div class="flex items-center gap-1.5 flex-wrap text-[10px] text-slate-400 font-mono">
                    <span>${d.codigo}</span>
                    <span>• Sem. ${d.semestre}</span>
                    <span class="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 font-sans font-semibold">${d.cursoLabel || d.ciclo}</span>
                    ${is32 ? '<span class="px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 font-sans font-bold">3.2</span>' : ''}
                  </div>
                  <div class="text-xs font-bold text-slate-100 mt-1">${d.nome}</div>
                </div>
                <div class="text-right shrink-0">
                  <span class="text-[10px] text-slate-400 block">Média</span>
                  <span class="text-base font-extrabold text-blue-400 font-mono-numbers">${fmtNum(d.media)}</span>
                </div>
              </div>
              <div class="flex items-center justify-between text-[11px] text-slate-400 pt-1.5 border-t border-slate-800/70 font-mono-numbers">
                <span>${d.qtdAlunos} al. · DP ${fmtNum(d.desvioPadrao)}</span>
                <span><span class="text-rose-400">${fmtNum(d.menorNota)}</span> / <span class="text-emerald-400">${fmtNum(d.maiorNota)}</span></span>
              </div>
              ${is32 && d.vfMediaNec !== null ? `<div class="text-[11px] font-mono-numbers ${d.vfEmRisco > 0 ? 'text-amber-300' : 'text-emerald-400'}">VF nec. méd: ${fmtNum(d.vfMediaNec)}${d.vfEmRisco > 0 ? ` · ${d.vfEmRisco} em risco (>5.0)` : ''}</div>` : ''}
            </div>
          `;
        }).join('') || `<div class="py-6 text-center text-xs text-slate-500">Nenhuma disciplina encontrada.</div>`;
      } else {
        cardsEl.classList.add('hidden');
        tableWrap.classList.remove('hidden');
      }
    }
  }

  // --- TAB 5: COMPARADOR 1x1 ALUNOS ---
  function formatAlunoLabel(a) {
    return a ? `#${a.rankGraduacao} ${a.nome} (${a.curso})` : '';
  }

  function setupComparatorSearch(inputId, resultsId, stateKey) {
    const inp = document.getElementById(inputId);
    const res = document.getElementById(resultsId);
    if (!inp || !res) return;

    const renderMatches = (query) => {
      const q = (query || '').trim().toLowerCase();
      const matches = getVinculoScopedAlunos().filter(a => {
        if (!q) return true;
        const se = courseToSE[a.curso] || '';
        return a.nome.toLowerCase().includes(q) ||
          String(a.numero).includes(q) ||
          a.curso.toLowerCase().includes(q) ||
          se.toLowerCase().includes(q);
      });

      if (matches.length === 0) {
        res.innerHTML = `<div class="px-3 py-2.5 text-xs text-slate-500">Nenhum aluno encontrado.</div>`;
      } else {
        res.innerHTML = matches.map(a => {
          const isSelected = (state[stateKey] === a.numero);
          return `
            <button type="button" data-pick-aluno="${a.numero}" class="w-full text-left px-3 py-2 hover:bg-slate-800/90 flex items-center justify-between gap-2 text-xs transition ${isSelected ? 'bg-blue-500/10' : ''}">
              <div class="min-w-0">
                <span class="font-bold text-slate-100">${a.nome}</span>
                <span class="text-[11px] text-slate-400 ml-1.5">#${a.rankGraduacao} · ${a.curso}</span>
              </div>
              <span class="font-mono-numbers font-bold text-blue-400 shrink-0">${fmtNum(a.mediaGraduacao)}</span>
            </button>
          `;
        }).join('');

        res.querySelectorAll('button[data-pick-aluno]').forEach(btn => {
          btn.addEventListener('click', () => {
            const num = parseInt(btn.getAttribute('data-pick-aluno'), 10);
            state[stateKey] = num;
            res.classList.add('hidden');
            renderStudentComparator();
          });
        });
      }
      res.classList.remove('hidden');
    };

    inp.addEventListener('focus', () => {
      inp.select();
      renderMatches('');
    });

    inp.addEventListener('input', (e) => {
      renderMatches(e.target.value);
    });

    document.addEventListener('click', (e) => {
      if (!inp.contains(e.target) && !res.contains(e.target)) {
        if (!res.classList.contains('hidden')) {
          res.classList.add('hidden');
          const cur = DATA.alunos.find(a => a.numero === state[stateKey]);
          if (cur) inp.value = formatAlunoLabel(cur);
        }
      }
    });
  }

  function initStudentComparator() {
    const inp1 = document.getElementById('searchAluno1');
    const inp2 = document.getElementById('searchAluno2');
    if (!inp1 || !inp2) return;

    if (!state.comparatorInitialized) {
      state.comparatorInitialized = true;
      setupComparatorSearch('searchAluno1', 'resultsAluno1', 'comparatorA');
      setupComparatorSearch('searchAluno2', 'resultsAluno2', 'comparatorB');

      // Metric Toggle for Comparator
      document.querySelectorAll('#toggleComparatorMetric button').forEach(btn => {
        btn.addEventListener('click', () => {
          state.comparatorMetric = btn.getAttribute('data-metric');
          updateToggleButtons('toggleComparatorMetric', state.comparatorMetric, 'bg-blue-600');
          renderStudentComparator();
        });
      });

      // Swap A1 <-> A2
      document.getElementById('btnSwapComparator')?.addEventListener('click', () => {
        const tmp = state.comparatorA;
        state.comparatorA = state.comparatorB;
        state.comparatorB = tmp;
        renderStudentComparator();
      });

      const rerenderSubjects = () => {
        renderComparatorSubjects(
          DATA.alunos.find(a => a.numero === state.comparatorA) || DATA.alunos[0],
          DATA.alunos.find(a => a.numero === state.comparatorB) || DATA.alunos[1]
        );
      };

      // Only common subjects toggle
      const chkCommon = document.getElementById('chkComparatorOnlyCommon');
      if (chkCommon) {
        chkCommon.checked = state.comparatorOnlyCommon;
        chkCommon.addEventListener('change', (e) => {
          state.comparatorOnlyCommon = e.target.checked;
          rerenderSubjects();
        });
      }

      document.getElementById('comparatorSubjectSearch')?.addEventListener('input', (e) => {
        state.comparatorSubjectSearch = e.target.value;
        rerenderSubjects();
      });

      document.getElementById('comparatorTypeFilter')?.addEventListener('change', (e) => {
        state.comparatorTypeFilter = e.target.value;
        rerenderSubjects();
      });

      document.getElementById('comparatorSubjectSort')?.addEventListener('change', (e) => {
        state.comparatorSubjectSort = e.target.value;
        rerenderSubjects();
      });
    }

    renderStudentComparator();
  }

  function renderStudentComparator() {
    const a1 = DATA.alunos.find(a => a.numero === state.comparatorA) || DATA.alunos[0];
    const a2 = DATA.alunos.find(a => a.numero === state.comparatorB) || DATA.alunos[1];

    const cardsContainer = document.getElementById('comparatorComparisonCards');
    if (!a1 || !a2) {
      if (cardsContainer) {
        cardsContainer.innerHTML = `<div class="col-span-2 p-6 text-center text-xs text-slate-400">É necessário ter pelo menos 2 alunos cadastrados nesta turma para comparar 1x1.</div>`;
      }
      if (chartComparatorInstance) {
        chartComparatorInstance.destroy();
        chartComparatorInstance = null;
      }
      return;
    }

    const inp1 = document.getElementById('searchAluno1');
    const inp2 = document.getElementById('searchAluno2');
    if (inp1 && document.activeElement !== inp1) inp1.value = formatAlunoLabel(a1);
    if (inp2 && document.activeElement !== inp2) inp2.value = formatAlunoLabel(a2);

    if (cardsContainer) {
      cardsContainer.innerHTML = [a1, a2].map((aluno, idx) => {
        const color = idx === 0 ? 'text-blue-400' : 'text-emerald-400';
        const border = idx === 0 ? 'border-blue-500/40' : 'border-emerald-500/40';
        return `
          <div class="glass-card p-5 rounded-2xl border ${border}">
            <div class="flex items-center justify-between mb-4">
              <span class="text-xs font-bold uppercase tracking-wider ${color}">Aluno ${idx + 1}</span>
              <span class="text-xs font-mono-numbers text-slate-400">#${aluno.rankGraduacao} Graduação</span>
            </div>
            <div class="flex items-center gap-3 mb-4">
              <div class="w-12 h-12 rounded-xl bg-slate-800 flex items-center justify-center font-extrabold text-white text-lg">
                ${aluno.nome.substring(0, 2).toUpperCase()}
              </div>
              <div>
                <h3 class="font-extrabold text-base text-white">${aluno.nome}</h3>
                <div class="flex items-center gap-2 mt-1">
                  ${getCourseBadge(aluno.curso)}
                  ${getVinculoBadge(aluno.vinculo)}
                </div>
              </div>
            </div>
            <div class="grid grid-cols-3 gap-2 pt-3 border-t border-slate-800 text-center">
              <div class="p-2 rounded-xl bg-slate-900/60">
                <span class="text-[10px] font-bold text-blue-400 uppercase block">CR Graduação</span>
                <span class="text-base font-extrabold text-blue-400 font-mono-numbers">${fmtNum(aluno.mediaGraduacao)}</span>
              </div>
              <div class="p-2 rounded-xl bg-slate-900/60">
                <span class="text-[10px] font-bold text-slate-400 uppercase block">CR Geral</span>
                <span class="text-base font-extrabold text-slate-200 font-mono-numbers">${fmtNum(aluno.mediaGeral)}</span>
              </div>
              <div class="p-2 rounded-xl bg-slate-900/60">
                <span class="text-[10px] font-bold text-amber-400 uppercase block">3.2 (Parcial)</span>
                <span class="text-base font-extrabold text-amber-400 font-mono-numbers">${fmtNum(aluno.media32)}</span>
              </div>
            </div>
          </div>
        `;
      }).join('');
    }

    const ctx = document.getElementById('chartComparator')?.getContext('2d');
    if (ctx) {
      if (chartComparatorInstance) chartComparatorInstance.destroy();

      const semestres = DATA.metadata.semestres;
      const isSem = (state.comparatorMetric === 'semestral');

      const getTrajectory = (aluno) => {
        return semestres.map(s => {
          const ev = aluno.evolucao.find(e => e.semestre === s);
          if (!ev) return null;
          return isSem ? ev.mediaGradSemestre : ev.mediaGradCumulativo;
        });
      };

      const scopedBench = getScopedSemestresBenchmark();
      const dataA1 = getTrajectory(a1);
      const dataA2 = getTrajectory(a2);
      const dataTurma = isSem
        ? scopedBench.map(s => s.mediaGraduacaoTurma)
        : scopedBench.map(s => s.mediaGraduacaoTurmaCumulativa);

      const turmaLabel = isSem ? 'Média da Turma (Semestral)' : 'CR Cumulativo Turma';

      const subtitle = document.getElementById('comparatorSubtitle');
      if (subtitle) {
        subtitle.textContent = isSem
          ? `${a1.nome} vs ${a2.nome} vs Média da Turma (Médias Semestrais)`
          : `${a1.nome} vs ${a2.nome} vs Turma (CR Cumulativo Acumulado)`;
      }

      const compBounds = computeDynamicBounds([dataA1, dataA2, dataTurma], 0.8, 0.2);

      chartComparatorInstance = new Chart(ctx, {
        type: 'line',
        data: {
          labels: semestres.map(s => s === '3.2' ? '3.2 (Parcial)' : `Sem. ${s}`),
          datasets: [
            {
              label: a1.nome,
              data: dataA1,
              borderColor: '#3b82f6',
              backgroundColor: '#3b82f6',
              pointRadius: 5,
              borderWidth: 3,
              tension: 0.25
            },
            {
              label: a2.nome,
              data: dataA2,
              borderColor: '#10b981',
              backgroundColor: '#10b981',
              pointRadius: 5,
              borderWidth: 3,
              tension: 0.25
            },
            {
              label: turmaLabel,
              data: dataTurma,
              borderColor: '#64748b',
              backgroundColor: '#64748b',
              borderDash: [5, 5],
              pointRadius: 3,
              borderWidth: 2,
              tension: 0.25
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          interaction: { mode: 'index', intersect: false },
          plugins: {
            legend: { display: false },
            tooltip: {
              backgroundColor: 'rgba(15, 23, 42, 0.95)',
              padding: 12,
              callbacks: {
                label: (ctx) => `${ctx.dataset.label}: ${ctx.parsed.y !== null ? ctx.parsed.y.toFixed(2) : '-'}`
              }
            }
          },
          scales: {
            y: {
              min: compBounds.min,
              max: compBounds.max,
              grid: { color: 'rgba(255, 255, 255, 0.05)' },
              ticks: {
                color: '#94a3b8',
                stepSize: compBounds.stepSize,
                callback: (v) => Number(v).toFixed(2),
                font: { family: 'JetBrains Mono' }
              }
            },
            x: {
              grid: { color: 'rgba(255, 255, 255, 0.03)' },
              ticks: { color: '#cbd5e1', font: { weight: '600' } }
            }
          }
        }
      });
    }

    renderComparatorSubjects(a1, a2);
    refreshIcons();
  }

  function renderComparatorSubjects(a1, a2) {
    const semFilterEl = document.getElementById('comparatorSemesterFilter');
    const summaryEl = document.getElementById('comparatorSemesterSummary');
    const tbody = document.getElementById('comparatorSubjectsTableBody');
    const cardsEl = document.getElementById('comparatorSubjectsCards');
    const tableWrapEl = document.getElementById('comparatorSubjectsTableContainer');
    const th1 = document.getElementById('thCompAluno1');
    const th2 = document.getElementById('thCompAluno2');
    if (!semFilterEl || !tbody) return;

    if (th1) th1.textContent = a1.nome;
    if (th2) th2.textContent = a2.nome;

    const semestres = DATA.metadata.semestres;
    const pills = [
      { id: 'ALL', label: 'Todos os Semestres' },
      ...semestres.map(s => ({ id: s, label: s === '3.2' ? '3.2 (Parcial)' : `Sem. ${s}` }))
    ];

    semFilterEl.innerHTML = pills.map(p => {
      const active = state.comparatorSemester === p.id;
      const cls = active
        ? 'bg-indigo-600 text-white border-indigo-500 shadow-sm'
        : 'bg-slate-900/70 text-slate-400 border-slate-700/80 hover:text-white hover:bg-slate-800';
      return `<button data-csem="${p.id}" class="px-3 py-1.5 rounded-xl text-xs font-bold border transition ${cls}">${p.label}</button>`;
    }).join('');

    semFilterEl.querySelectorAll('button').forEach(btn => {
      btn.addEventListener('click', () => {
        state.comparatorSemester = btn.getAttribute('data-csem');
        renderComparatorSubjects(a1, a2);
      });
    });

    const filterSem = (d) => state.comparatorSemester === 'ALL' || d.semestre === state.comparatorSemester;
    const map1 = new Map();
    const map2 = new Map();
    const rowsMap = new Map();

    const addToMap = (discList, targetMap) => {
      discList.filter(filterSem).forEach(d => {
        const key = `${d.semestre}||${d.grupoEquivalente || d.nome}`;
        if (!targetMap.has(key)) targetMap.set(key, d);
        if (!rowsMap.has(key)) {
          rowsMap.set(key, {
            key,
            semestre: d.semestre,
            semestreOrdem: d.semestreOrdem,
            nome: d.grupoEquivalente || d.nome,
            militar: d.militar,
            isParcial: d.isParcial,
            mediaTurma: d.mediaTurma
          });
        } else if (rowsMap.get(key).mediaTurma == null && d.mediaTurma != null) {
          rowsMap.get(key).mediaTurma = d.mediaTurma;
        }
      });
    };

    addToMap(a1.disciplinas || [], map1);
    addToMap(a2.disciplinas || [], map2);

    const searchQ = (state.comparatorSubjectSearch || '').trim().toLowerCase();
    let rows = [...rowsMap.values()].filter(r => {
      if (state.comparatorOnlyCommon && !(map1.has(r.key) && map2.has(r.key))) return false;
      if (state.comparatorTypeFilter === 'grad' && r.militar) return false;
      if (state.comparatorTypeFilter === 'mil' && !r.militar) return false;
      if (searchQ && !r.nome.toLowerCase().includes(searchQ)) return false;
      return true;
    });

    rows.sort((x, y) => {
      const gx1 = map1.get(x.key)?.notaEfetiva ?? null;
      const gx2 = map2.get(x.key)?.notaEfetiva ?? null;
      const gy1 = map1.get(y.key)?.notaEfetiva ?? null;
      const gy2 = map2.get(y.key)?.notaEfetiva ?? null;

      if (state.comparatorSubjectSort === 'diff_desc') {
        const dx = (gx1 !== null && gx2 !== null) ? Math.abs(gx1 - gx2) : -1;
        const dy = (gy1 !== null && gy2 !== null) ? Math.abs(gy1 - gy2) : -1;
        if (dy !== dx) return dy - dx;
      } else if (state.comparatorSubjectSort === 'g1_desc') {
        if ((gy1 ?? -1) !== (gx1 ?? -1)) return (gy1 ?? -1) - (gx1 ?? -1);
      } else if (state.comparatorSubjectSort === 'g2_desc') {
        if ((gy2 ?? -1) !== (gx2 ?? -1)) return (gy2 ?? -1) - (gx2 ?? -1);
      } else if (state.comparatorSubjectSort === 'turma_desc') {
        if ((y.mediaTurma ?? -1) !== (x.mediaTurma ?? -1)) return (y.mediaTurma ?? -1) - (x.mediaTurma ?? -1);
      }

      if (x.semestreOrdem !== y.semestreOrdem) return x.semestreOrdem - y.semestreOrdem;
      return x.nome.localeCompare(y.nome, 'pt-BR');
    });

    let wins1 = 0, wins2 = 0, ties = 0;
    const grades1 = [], grades2 = [];

    const fmtSub = (d) => {
      if (!d) return '';
      const parts = [];
      const veVal = d.mve ?? d.ve;
      if (veVal !== null && veVal !== undefined) parts.push(`VE ${fmtNum(veVal)}`);
      if (d.vc !== null && d.vc !== undefined) parts.push(`VC ${fmtNum(d.vc)}`);
      if (d.vf !== null && d.vf !== undefined) parts.push(`VF ${fmtNum(d.vf)}`);
      const vfInfo = calcVfNecessaria(d);
      if (vfInfo && vfInfo.tipo === 'exact') {
        const st = getVfColorStyle(vfInfo);
        parts.push(`<span class="${st.text} font-bold">(${vfInfo.label})</span>`);
      }
      return parts.join(' · ');
    };

    const enriched = rows.map(r => {
      const d1 = map1.get(r.key);
      const d2 = map2.get(r.key);
      const g1 = d1?.notaEfetiva ?? null;
      const g2 = d2?.notaEfetiva ?? null;

      if (g1 !== null && (state.comparatorTypeFilter === 'mil' || !r.militar)) grades1.push(g1);
      if (g2 !== null && (state.comparatorTypeFilter === 'mil' || !r.militar)) grades2.push(g2);

      let diffHtml = '<span class="text-slate-500">-</span>';
      if (g1 !== null && g2 !== null) {
        const diff = Math.round((g1 - g2) * 100) / 100;
        if (diff > 0) {
          wins1++;
          diffHtml = `<span class="text-blue-400 font-bold">+${diff.toFixed(2)}</span>`;
        } else if (diff < 0) {
          wins2++;
          diffHtml = `<span class="text-emerald-400 font-bold">${diff.toFixed(2)}</span>`;
        } else {
          ties++;
          diffHtml = `<span class="text-slate-400 font-semibold">0.00</span>`;
        }
      }

      const badges = [];
      if (r.militar) badges.push('<span class="px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 text-[10px] font-bold">Militar</span>');
      if (r.isParcial) badges.push('<span class="px-1.5 py-0.5 rounded bg-indigo-500/15 text-indigo-300 text-[10px] font-bold">Parcial</span>');

      return {
        r, g1, g2,
        sub1: fmtSub(d1),
        sub2: fmtSub(d2),
        diffHtml,
        badgesHtml: badges.join('')
      };
    });

    tbody.innerHTML = enriched.map(({ r, g1, g2, sub1, sub2, diffHtml, badgesHtml }) => `
      <tr class="table-hover-row border-b border-slate-800/40">
        <td class="py-2.5 px-3 font-mono-numbers text-slate-400">${r.semestre}</td>
        <td class="py-2.5 px-4 text-slate-200 font-semibold">
          <div class="flex flex-wrap items-center gap-1.5">
            <span>${r.nome}</span>
            ${badgesHtml}
          </div>
        </td>
        <td class="py-2.5 px-3 text-right font-mono-numbers">
          <div class="font-bold ${g1 !== null && g2 !== null && g1 > g2 ? 'text-blue-400' : 'text-slate-200'}">${g1 !== null ? fmtNum(g1) : '-'}</div>
          ${sub1 ? `<div class="text-[10px] text-slate-500">${sub1}</div>` : ''}
        </td>
        <td class="py-2.5 px-3 text-right font-mono-numbers">
          <div class="font-bold ${g1 !== null && g2 !== null && g2 > g1 ? 'text-emerald-400' : 'text-slate-200'}">${g2 !== null ? fmtNum(g2) : '-'}</div>
          ${sub2 ? `<div class="text-[10px] text-slate-500">${sub2}</div>` : ''}
        </td>
        <td class="py-2.5 px-3 text-right font-mono-numbers">${diffHtml}</td>
        <td class="py-2.5 px-3 text-right font-mono-numbers text-slate-400">${fmtNum(r.mediaTurma)}</td>
      </tr>
    `).join('') || `<tr><td colspan="6" class="py-6 text-center text-slate-400">Nenhuma disciplina encontrada para o filtro selecionado.</td></tr>`;

    if (cardsEl && tableWrapEl) {
      const isMobile = document.body.classList.contains('is-mobile');
      if (isMobile) {
        cardsEl.classList.remove('hidden');
        tableWrapEl.classList.add('hidden');
        cardsEl.innerHTML = enriched.map(({ r, g1, g2, sub1, sub2, diffHtml, badgesHtml }) => `
          <div class="p-3.5 rounded-xl bg-slate-900/70 border border-slate-800 space-y-2">
            <div class="flex items-start justify-between gap-2">
              <div>
                <span class="text-[10px] font-mono-numbers font-bold text-slate-400">Sem. ${r.semestre} · Turma ${fmtNum(r.mediaTurma)}</span>
                <div class="text-xs font-bold text-slate-100 flex flex-wrap items-center gap-1.5 mt-0.5">
                  <span>${r.nome}</span>
                  ${badgesHtml}
                </div>
              </div>
              <div class="text-xs font-mono-numbers shrink-0">${diffHtml}</div>
            </div>
            <div class="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800/80 text-xs">
              <div class="p-2 rounded-lg bg-slate-950/60">
                <span class="text-[10px] text-blue-400 font-bold block truncate">${a1.nome}</span>
                <span class="font-extrabold font-mono-numbers ${g1 !== null && g2 !== null && g1 > g2 ? 'text-blue-400' : 'text-slate-200'}">${g1 !== null ? fmtNum(g1) : '-'}</span>
                ${sub1 ? `<span class="text-[10px] text-slate-500 block">${sub1}</span>` : ''}
              </div>
              <div class="p-2 rounded-lg bg-slate-950/60">
                <span class="text-[10px] text-emerald-400 font-bold block truncate">${a2.nome}</span>
                <span class="font-extrabold font-mono-numbers ${g1 !== null && g2 !== null && g2 > g1 ? 'text-emerald-400' : 'text-slate-200'}">${g2 !== null ? fmtNum(g2) : '-'}</span>
                ${sub2 ? `<span class="text-[10px] text-slate-500 block">${sub2}</span>` : ''}
              </div>
            </div>
          </div>
        `).join('') || `<div class="py-6 text-center text-xs text-slate-400">Nenhuma disciplina encontrada para o filtro selecionado.</div>`;
      } else {
        cardsEl.classList.add('hidden');
        tableWrapEl.classList.remove('hidden');
      }
    }

    if (summaryEl) {
      const avg1 = grades1.length ? grades1.reduce((s, v) => s + v, 0) / grades1.length : null;
      const avg2 = grades2.length ? grades2.reduce((s, v) => s + v, 0) / grades2.length : null;
      const scopeLabel = state.comparatorSemester === 'ALL' ? 'Todos os semestres' : `Semestre ${state.comparatorSemester}`;
      const avgTypeLabel = state.comparatorTypeFilter === 'mil' ? 'Média Militar' : 'Média Graduação';
      summaryEl.innerHTML = `
        <div class="p-3 rounded-xl bg-slate-900/60 border border-blue-500/20 flex items-center justify-between">
          <div>
            <span class="text-[10px] uppercase font-bold text-blue-400 block">${a1.nome} (${scopeLabel})</span>
            <span class="text-xs text-slate-400">${avgTypeLabel} (${grades1.length} disc.)</span>
          </div>
          <span class="text-lg font-extrabold text-blue-400 font-mono-numbers">${fmtNum(avg1)}</span>
        </div>
        <div class="p-3 rounded-xl bg-slate-900/60 border border-emerald-500/20 flex items-center justify-between">
          <div>
            <span class="text-[10px] uppercase font-bold text-emerald-400 block">${a2.nome} (${scopeLabel})</span>
            <span class="text-xs text-slate-400">${avgTypeLabel} (${grades2.length} disc.)</span>
          </div>
          <span class="text-lg font-extrabold text-emerald-400 font-mono-numbers">${fmtNum(avg2)}</span>
        </div>
        <div class="p-3 rounded-xl bg-slate-900/60 border border-slate-700/60 flex items-center justify-between">
          <div>
            <span class="text-[10px] uppercase font-bold text-indigo-400 block">Confronto Direto</span>
            <span class="text-xs text-slate-400">${wins1 + wins2 + ties} matérias em comum</span>
          </div>
          <div class="text-xs font-extrabold font-mono-numbers">
            <span class="text-blue-400">${wins1}</span>
            <span class="text-slate-500 mx-1">×</span>
            <span class="text-emerald-400">${wins2}</span>
            <span class="text-slate-500 ml-1.5 font-normal">(${ties} emp.)</span>
          </div>
        </div>
      `;
    }
  }

  // --- MODAL: FICHA COMPLETA DO ALUNO ---
  function openStudentModal(num) {
    const aluno = DATA.alunos.find(a => a.numero === num);
    if (!aluno) return;

    state.activeStudentModal = aluno;
    state.modalSemesterFilter = 'ALL';
    const modal = document.getElementById('studentModal');
    
    document.getElementById('modalStudentName').textContent = aluno.nome;
    document.getElementById('modalAvatar').textContent = aluno.nome.substring(0, 2).toUpperCase();
    document.getElementById('modalStudentNum').textContent = aluno.numero;
    document.getElementById('modalStudentCursoBadge').className = `text-xs px-2.5 py-0.5 rounded-full font-bold ${courseClassMap[aluno.curso] || 'badge-computacao'}`;
    document.getElementById('modalStudentCursoBadge').textContent = aluno.curso;

    let vCls = 'badge-ativa';
    if (aluno.vinculo === 'Reserva') vCls = 'badge-reserva';
    if (aluno.vinculo === 'CG') vCls = 'badge-cg';
    document.getElementById('modalStudentVinculoBadge').className = `text-xs px-2 py-0.5 rounded-full font-bold ${vCls}`;
    document.getElementById('modalStudentVinculoBadge').textContent = aluno.vinculo;

    document.getElementById('modalStudentRanks').textContent = `#${aluno.rankGraduacao} Graduação • #${aluno.rankGeral} Geral • #${aluno.rankCurso} no Curso`;

    document.getElementById('modalCrGrad').textContent = fmtNum(aluno.mediaGraduacao);
    document.getElementById('modalRankGradLabel').textContent = `${aluno.rankGraduacao}º de ${DATA.alunos.length} alunos`;

    document.getElementById('modalCrGeral').textContent = fmtNum(aluno.mediaGeral);
    document.getElementById('modalRankGeralLabel').textContent = `${aluno.rankGeral}º de ${DATA.alunos.length} alunos`;

    document.getElementById('modalCr32').textContent = fmtNum(aluno.media32);
    document.getElementById('modalDisciplinasCount').textContent = aluno.totalDisciplinas;
    document.getElementById('modalExtremes').innerHTML = `Max: <strong class="text-emerald-400 font-mono-numbers">${fmtNum(aluno.maiorNota)}</strong> | Min: <strong class="text-rose-400 font-mono-numbers">${fmtNum(aluno.menorNota)}</strong>`;

    renderModalDisciplinesTable();
    renderModalChart();

    modal.classList.remove('hidden');
    document.body.classList.add('overflow-hidden');
    refreshIcons();
  }

  function renderModalChart() {
    const aluno = state.activeStudentModal;
    if (!aluno) return;

    const ctx = document.getElementById('chartModalStudent')?.getContext('2d');
    if (!ctx) return;

    if (chartModalInstance) chartModalInstance.destroy();

    const semestres = DATA.metadata.semestres;
    const isSem = (state.modalMetric === 'semestral');

    const studentVals = semestres.map(s => {
      const ev = aluno.evolucao.find(e => e.semestre === s);
      if (!ev) return null;
      return isSem ? ev.mediaGradSemestre : ev.mediaGradCumulativo;
    });

    const scopedCursos = getScopedCursosComparativo();
    const scopedBench = getScopedSemestresBenchmark();
    const cursoVals = semestres.map(s => {
      const c = scopedCursos.find(cc => cc.curso === aluno.curso);
      if (!c) return null;
      return isSem ? c.semestres[s] : c.semestresCumulativo[s];
    });

    const turmaVals = isSem
      ? scopedBench.map(s => s.mediaGraduacaoTurma)
      : scopedBench.map(s => s.mediaGraduacaoTurmaCumulativa);

    const alunoLabel = isSem ? `${aluno.nome} (Semestral)` : `${aluno.nome} (CR Cumulativo)`;

    const modalBounds = computeDynamicBounds([studentVals, cursoVals, turmaVals], 0.8, 0.2);

    chartModalInstance = new Chart(ctx, {
      type: 'line',
      data: {
        labels: semestres.map(s => s === '3.2' ? '3.2 (Parcial)' : `Sem. ${s}`),
        datasets: [
          {
            label: alunoLabel,
            data: studentVals,
            borderColor: '#3b82f6',
            backgroundColor: 'rgba(59, 130, 246, 0.1)',
            fill: true,
            pointRadius: 5,
            borderWidth: 3,
            tension: 0.25
          },
          {
            label: `Média ${aluno.curso}`,
            data: cursoVals,
            borderColor: '#10b981',
            pointRadius: 4,
            borderWidth: 2,
            borderDash: [4, 4],
            tension: 0.25
          },
          {
            label: 'Média da Turma',
            data: turmaVals,
            borderColor: '#64748b',
            pointRadius: 3,
            borderWidth: 1.5,
            borderDash: [2, 2],
            tension: 0.25
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: 'rgba(15, 23, 42, 0.95)',
            padding: 12,
            callbacks: {
              label: (ctx) => `${ctx.dataset.label}: ${ctx.parsed.y !== null ? ctx.parsed.y.toFixed(2) : '-'}`
            }
          }
        },
        scales: {
          y: {
            min: modalBounds.min,
            max: modalBounds.max,
            grid: { color: 'rgba(255, 255, 255, 0.05)' },
            ticks: {
              color: '#94a3b8',
              stepSize: modalBounds.stepSize,
              callback: (v) => Number(v).toFixed(2),
              font: { family: 'JetBrains Mono' }
            }
          },
          x: {
            grid: { color: 'rgba(255, 255, 255, 0.03)' },
            ticks: { color: '#cbd5e1', font: { weight: '600' } }
          }
        }
      }
    });
  }

  function renderModalDisciplinesCards(discs) {
    const container = document.getElementById('modalDisciplinesCardsContainer');
    if (!container) return;

    if (discs.length === 0) {
      container.innerHTML = `<div class="py-6 text-center text-slate-500 text-xs">Nenhuma disciplina cadastrada neste período.</div>`;
      return;
    }

    container.innerHTML = discs.map(d => {
      let deltaBadge = `<span class="text-slate-500 font-mono-numbers text-xs">-</span>`;
      if (d.delta !== null && d.delta !== undefined) {
        const sign = d.delta >= 0 ? '+' : '';
        const cls = d.delta >= 0 ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' : 'text-rose-400 bg-rose-500/10 border-rose-500/20';
        deltaBadge = `<span class="px-2 py-0.5 rounded text-[11px] font-bold font-mono-numbers border ${cls}">${sign}${d.delta.toFixed(2)}</span>`;
      }

      let sitCls = 'text-slate-400';
      if (d.situacao === 'Aprovado') sitCls = 'text-emerald-400';
      else if (d.situacao.includes('Parcial')) sitCls = 'text-amber-400';
      else if (d.situacao === 'Reprovado') sitCls = 'text-rose-400';

      const is32 = d.semestre === '3.2';
      const semBadge = is32 
        ? `<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">Semestre 3.2</span>`
        : `<span class="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-800 text-slate-300 font-mono">Semestre ${d.semestre}</span>`;

      return `
        <div class="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800/90 space-y-2.5">
          <div class="flex items-start justify-between gap-2">
            <div class="min-w-0">
              <div class="flex items-center gap-1.5 flex-wrap">
                ${semBadge}
                <span class="text-[11px] font-mono text-slate-400 font-semibold">${d.codigo}</span>
                ${d.militar ? '<span class="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 text-[10px] font-semibold border border-emerald-500/20">Militar</span>' : (d.isPratica ? '<span class="px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-400 text-[10px] font-semibold border border-indigo-500/20">Prática (MVE)</span>' : '')}
              </div>
              <h5 class="font-bold text-slate-100 text-xs sm:text-sm mt-1 leading-snug">${d.nome}</h5>
            </div>
            <div class="text-right shrink-0">
              <span class="text-[10px] uppercase font-bold text-slate-400 block">Nota</span>
              <span class="text-base font-extrabold text-blue-400 font-mono-numbers">${d.notaEfetiva !== null ? fmtNum(d.notaEfetiva) : '-'}</span>
            </div>
          </div>

          <div class="flex items-center justify-between text-xs bg-slate-900/80 px-2.5 py-1.5 rounded-lg border border-slate-800/60 font-mono-numbers flex-wrap gap-2">
            <div class="text-slate-300 text-[11px] space-x-2">
              <span>VE: <strong class="text-slate-100">${d.ve !== null ? fmtNum(d.ve) : '-'}</strong></span>
              <span>VC: <strong class="text-slate-100">${d.vc !== null ? fmtNum(d.vc) : '-'}</strong></span>
              <span>VF: <strong class="text-slate-100">${d.vf !== null ? fmtNum(d.vf) : '-'}</strong></span>
            </div>
            <div class="flex items-center gap-2 text-[11px]">
              <span class="text-slate-400">Turma: ${fmtNum(d.mediaTurma)}</span>
              ${deltaBadge}
            </div>
          </div>

          <div class="flex items-center justify-between text-[11px] pt-0.5 flex-wrap gap-1.5">
            <span class="font-semibold ${sitCls}">● ${d.situacao}</span>
            ${(() => {
              const vfInfo = calcVfNecessaria(d);
              if (!vfInfo) return '';
              const st = getVfColorStyle(vfInfo);
              return `<span class="px-2 py-0.5 rounded-md border font-mono-numbers font-bold text-[10px] ${st.pill}" title="${vfInfo.detalhe}">🎯 ${vfInfo.label}</span>`;
            })()}
          </div>
        </div>
      `;
    }).join('');
  }

  function renderModalDisciplinesTable() {
    const aluno = state.activeStudentModal;
    if (!aluno) return;

    let discs = aluno.disciplinas;
    if (state.modalSemesterFilter !== 'ALL') {
      discs = discs.filter(d => d.semestre === state.modalSemesterFilter);
    }

    const discBody = document.getElementById('modalDisciplinasBody');
    if (discBody) {
      discBody.innerHTML = discs.map(d => {
        let deltaBadge = `<span class="text-slate-500 font-mono-numbers">-</span>`;
        if (d.delta !== null && d.delta !== undefined) {
          const sign = d.delta >= 0 ? '+' : '';
          const cls = d.delta >= 0 ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' : 'text-rose-400 bg-rose-500/10 border-rose-500/20';
          deltaBadge = `<span class="px-2 py-0.5 rounded text-[11px] font-bold font-mono-numbers border ${cls}">${sign}${d.delta.toFixed(2)}</span>`;
        }

        let sitCls = 'text-slate-400';
        if (d.situacao === 'Aprovado') sitCls = 'text-emerald-400';
        else if (d.situacao.includes('Parcial')) sitCls = 'text-amber-400';
        else if (d.situacao === 'Reprovado') sitCls = 'text-rose-400';

        const semBadge = d.semestre === '3.2' ? '<span class="text-amber-400 font-bold">3.2</span>' : d.semestre;

        const vfInfo = calcVfNecessaria(d);
        const vfPill = vfInfo
          ? `<div class="mt-0.5"><span class="inline-block px-1.5 py-0.5 rounded border font-mono-numbers text-[10px] font-bold ${getVfColorStyle(vfInfo).pill}" title="${vfInfo.detalhe}">🎯 ${vfInfo.label}</span></div>`
          : '';

        return `
          <tr class="table-hover-row border-b border-slate-800/40">
            <td class="py-2 px-3 text-slate-400 font-mono-numbers">${semBadge}</td>
            <td class="py-2 px-2 text-slate-400 font-mono-numbers text-[11px]">${d.codigo}</td>
            <td class="py-2 px-4 font-bold text-slate-200">
              ${d.nome}
              ${d.militar ? '<span class="ml-1.5 px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 text-[10px] font-semibold border border-emerald-500/20">Militar</span>' : (d.isPratica ? '<span class="ml-1.5 px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-400 text-[10px] font-semibold border border-indigo-500/20">Prática (MVE)</span>' : '')}
            </td>
            <td class="py-2 px-2 text-center text-slate-400 font-mono-numbers">${d.ve !== null ? fmtNum(d.ve) : '-'}</td>
            <td class="py-2 px-2 text-center text-slate-400 font-mono-numbers">${d.vc !== null ? fmtNum(d.vc) : '-'}</td>
            <td class="py-2 px-2 text-center text-slate-400 font-mono-numbers">${d.vf !== null ? fmtNum(d.vf) : '-'}</td>
            <td class="py-2 px-3 text-right font-extrabold text-blue-400 font-mono-numbers text-sm">${d.notaEfetiva !== null ? fmtNum(d.notaEfetiva) : '-'}</td>
            <td class="py-2 px-3 text-right text-slate-400 font-mono-numbers">${fmtNum(d.mediaTurma)}</td>
            <td class="py-2 px-3 text-center">${deltaBadge}</td>
            <td class="py-2 px-3 text-center font-bold text-[11px] ${sitCls}">${d.situacao}${vfPill}</td>
          </tr>
        `;
      }).join('');
    }

    const vfSummaryEl = document.getElementById('modalVfSummary');
    if (vfSummaryEl) {
      const abertas = discs
        .map((d, idx) => ({ d, idx, vfInfo: calcVfNecessaria(d) }))
        .filter(item => item.vfInfo !== null);
      if (abertas.length > 0) {
        vfSummaryEl.classList.remove('hidden');
        vfSummaryEl.innerHTML = `
          <div class="flex flex-wrap items-center justify-between gap-2">
            <span class="text-xs font-bold text-amber-300 flex items-center gap-1.5">
              🎯 Quanto falta na VF &amp; Simulador (mín. 4,00 na VF e média ≥ 5,00)
            </span>
            <span id="modalSimProjResult" class="text-[11px] text-slate-300 font-mono-numbers">Pesos: VE (1) · VC (1) · VF (2)</span>
          </div>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
            ${abertas.map(({ d, vfInfo }, i) => {
              const st = getVfColorStyle(vfInfo);
              const canSim = (vfInfo.tipo === 'exact');
              return `
                <div class="p-2 rounded-xl bg-slate-950/70 border ${st.cardBorder} flex items-center justify-between gap-2 text-xs">
                  <div class="min-w-0 flex-1">
                    <div class="font-bold text-slate-200 truncate" title="${d.nome}">${d.nome}</div>
                    <div class="text-[10px] text-slate-400">${vfInfo.detalhe}</div>
                  </div>
                  <div class="flex items-center gap-2 shrink-0">
                    <span class="font-extrabold font-mono-numbers ${st.text}">${vfInfo.label}</span>
                    ${canSim ? `<input type="number" min="0" max="10" step="0.1" placeholder="Sim." data-sim-code="${d.codigo}" data-sim-ve="${d.mve ?? d.ve}" data-sim-vc="${d.vc}" data-sim-mil="${d.militar ? 1 : 0}" class="modal-vf-sim-input w-14 px-1.5 py-1 text-[11px] text-center font-mono-numbers bg-slate-900 border border-slate-700 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500" title="Simular nota na VF" />` : ''}
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        `;

        const updateSimProjection = () => {
          const inputs = [...vfSummaryEl.querySelectorAll('.modal-vf-sim-input')];
          const simGrades = new Map();
          inputs.forEach(inp => {
            const raw = inp.value.trim();
            if (raw === '') return;
            const v = Math.min(10, Math.max(0, parseFloat(raw.replace(',', '.'))));
            if (!isNaN(v)) {
              const ve = parseFloat(inp.getAttribute('data-sim-ve'));
              const vc = parseFloat(inp.getAttribute('data-sim-vc'));
              const med = Math.round(((ve + vc + 2 * v) / 4) * 100) / 100;
              simGrades.set(inp.getAttribute('data-sim-code'), med);
            }
          });
          const projEl = document.getElementById('modalSimProjResult');
          if (!projEl) return;
          if (simGrades.size === 0) {
            projEl.innerHTML = 'Pesos: VE (1) · VC (1) · VF (2)';
            return;
          }
          // Projected current semester graduation average & overall graduation CR
          const grad32 = (aluno.disciplinas || []).filter(x => x.semestre === CURRENT_SEM && !x.militar);
          const vals32 = grad32.map(x => simGrades.has(x.codigo) ? simGrades.get(x.codigo) : x.notaEfetiva).filter(v => v !== null);
          const avg32 = vals32.length ? (vals32.reduce((s, v) => s + v, 0) / vals32.length) : null;

          const gradAll = (aluno.disciplinas || []).filter(x => !x.militar);
          const valsAll = gradAll.map(x => {
            if (x.semestre === CURRENT_SEM && simGrades.has(x.codigo)) return simGrades.get(x.codigo);
            return x.semestre !== CURRENT_SEM ? x.nf : x.notaEfetiva;
          }).filter(v => v !== null);
          const avgAll = valsAll.length ? (valsAll.reduce((s, v) => s + v, 0) / valsAll.length) : null;

          projEl.innerHTML = `<span class="text-blue-300 font-bold">Projeção ${CURRENT_SEM}: ${fmtNum(avg32)}</span> · <span class="text-emerald-300 font-bold">CR c/ ${CURRENT_SEM}: ${fmtNum(avgAll)}</span>`;
        };

        vfSummaryEl.querySelectorAll('.modal-vf-sim-input').forEach(inp => {
          inp.addEventListener('input', updateSimProjection);
        });
      } else {
        vfSummaryEl.classList.add('hidden');
        vfSummaryEl.innerHTML = '';
      }
    }

    renderModalDisciplinesCards(discs);

    // Toggle Modal View Visibility (Cards vs Table)
    const cardsEl = document.getElementById('modalDisciplinesCardsContainer');
    const tableEl = document.getElementById('modalDisciplinesTableContainer');
    if (cardsEl && tableEl) {
      if (state.modalDisciplineView === 'cards') {
        cardsEl.classList.remove('hidden');
        tableEl.classList.add('hidden');
      } else {
        cardsEl.classList.add('hidden');
        tableEl.classList.remove('hidden');
      }
    }

    // Toggle button styling
    const toggleEl = document.getElementById('toggleModalDisciplineView');
    if (toggleEl) {
      toggleEl.querySelectorAll('button').forEach(btn => {
        if (btn.getAttribute('data-mview') === state.modalDisciplineView) {
          btn.className = 'px-2 py-0.5 text-[11px] font-bold rounded-md bg-blue-600 text-white transition flex items-center gap-1 shadow-sm';
        } else {
          btn.className = 'px-2 py-0.5 text-[11px] font-bold rounded-md text-slate-400 hover:text-white transition flex items-center gap-1';
        }
      });
    }

    refreshIcons();
  }

  function closeStudentModal() {
    const modal = document.getElementById('studentModal');
    modal.classList.add('hidden');
    document.body.classList.remove('overflow-hidden');
    state.activeStudentModal = null;
  }

  // --- CSV EXPORT ---
  function exportFilteredCSV() {
    const headers = ['Rank_Graduacao', 'Rank_Geral', 'Rank_Curso', 'Numero', 'Nome', 'Curso', 'Vinculo', 'CR_Graduacao', 'CR_Geral_80_20', 'CR_32_Parcial', 'Disciplinas_Concluidas', 'Maior_Nota', 'Menor_Nota'];
    const rows = filteredAlunos.map(a => [
      a.rankGraduacao,
      a.rankGeral,
      a.rankCurso,
      a.numero,
      `"${a.nome}"`,
      `"${a.curso}"`,
      a.vinculo,
      a.mediaGraduacao,
      a.mediaGeral,
      a.media32 !== null ? a.media32 : '',
      a.concluidas,
      a.maiorNota,
      a.menorNota
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `ime_turma_2026_${state.filterCurso}_${[...state.includedVinculos].join('-')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  // --- EVENT LISTENERS ---
  // Unified Navigation Handler (Desktop Top Nav & Mobile Bottom Nav)
  function switchTab(targetTab) {
    state.currentTab = targetTab;

    // Desktop Tabs styling
    document.querySelectorAll('#navTabs button').forEach(b => {
      const isTarget = b.getAttribute('data-tab') === targetTab;
      if (isTarget) {
        b.classList.add('active', 'text-blue-400', 'bg-blue-500/10', 'border-blue-500/30');
        b.classList.remove('text-slate-400');
      } else {
        b.classList.remove('active', 'text-blue-400', 'bg-blue-500/10', 'border-blue-500/30');
        b.classList.add('text-slate-400');
      }
    });

    // Mobile Bottom Nav styling
    document.querySelectorAll('#mobileBottomNav button').forEach(b => {
      const isTarget = b.getAttribute('data-tab') === targetTab;
      if (isTarget) {
        b.classList.add('active', 'text-blue-400');
        b.classList.remove('text-slate-400');
      } else {
        b.classList.remove('active', 'text-blue-400');
        b.classList.add('text-slate-400');
      }
    });

    // Content sections visibility
    document.querySelectorAll('.tab-content').forEach(section => section.classList.add('hidden'));
    const activeSection = document.getElementById(`tab-${targetTab}`);
    if (activeSection) {
      activeSection.classList.remove('hidden');
    }

    if (targetTab === 'cursos') {
      if (!chartCursosEvolucaoInstance) {
        initCursosComparisonTab();
      } else {
        renderCourseMatrixTable();
      }
    } else if (targetTab === 'rankings') {
      renderRankingsTable();
    } else if (targetTab === 'vf') {
      renderVfTab();
    } else if (targetTab === 'disciplinas') {
      renderDisciplinasTab();
    } else if (targetTab === 'comparator') {
      initStudentComparator();
    } else if (targetTab === 'estagio') {
      if (!ACTIVE_CAREER_STAGE.enabled) return;
      initEstagioTab();
    } else if (targetTab === 'gestao') {
      if (!CAN_MANAGE_GRADES) return;
      initGestaoTab();
    }

    if (state.theme === 'light') applyTheme('light');
    refreshIcons();
  }

  // --- TAB CICLO DE CARREIRA: ESCOLHA DE ENGENHARIA (2.1-3.1) / ESTÁGIO (3.2-4.2) / OM (5.1+) ---
  function syncCareerStageTab({ reloadStore = false } = {}) {
    const prevKey = ACTIVE_CAREER_STAGE?.key;
    ACTIVE_CAREER_STAGE = getTurmaCareerStage(CURRENT_SEM);

    const navBtn = document.getElementById('navTabCareerBtn');
    const navLbl = document.getElementById('navTabCareerLabel');
    const mobBtn = document.getElementById('mobileNavCareerBtn');
    const mobLbl = document.getElementById('mobileNavCareerLabel');

    navBtn?.classList.toggle('hidden', !ACTIVE_CAREER_STAGE.enabled);
    mobBtn?.classList.toggle('hidden', !ACTIVE_CAREER_STAGE.enabled);
    updateMobileNavColumns();

    if (!ACTIVE_CAREER_STAGE.enabled) {
      if (state.currentTab === 'estagio') switchTab('overview');
      return;
    }

    if (navLbl) navLbl.textContent = ACTIVE_CAREER_STAGE.tabLabel;
    if (mobLbl) mobLbl.textContent = ACTIVE_CAREER_STAGE.mobileLabel;

    if (reloadStore || prevKey !== ACTIVE_CAREER_STAGE.key) {
      state.estagioData = loadCareerStoreForStage(ACTIVE_CAREER_STAGE);
      state.estagioCriterio = ACTIVE_CAREER_STAGE.defaultCriterio || 'cumulativo';
      state.estagioExpandedAluno = null;
    }

    const titleEl = document.getElementById('careerHeadingTitle');
    const badgeEl = document.getElementById('careerHeadingBadge');
    const subEl = document.getElementById('careerHeadingSubtitle');
    const cursoWrap = document.getElementById('careerCursoWrapper');
    const addBtn = document.getElementById('careerAddBtnLabel');
    const inpNome = document.getElementById('inputNovaVagaNome');
    const optCum = document.getElementById('optEstagioCumulativo');
    const selCrit = document.getElementById('selectEstagioCriterio');

    if (titleEl) titleEl.textContent = ACTIVE_CAREER_STAGE.heading;
    if (badgeEl) badgeEl.textContent = ACTIVE_CAREER_STAGE.badge;
    if (subEl) subEl.textContent = ACTIVE_CAREER_STAGE.subtitle;
    if (cursoWrap) cursoWrap.classList.toggle('hidden', ACTIVE_CAREER_STAGE.scopeMode === 'turma');
    if (addBtn) addBtn.textContent = ACTIVE_CAREER_STAGE.addBtnLabel;
    if (inpNome) inpNome.placeholder = ACTIVE_CAREER_STAGE.itemPlaceholder;
    if (optCum) optCum.textContent = `Cumulativa Graduação (c/ ${CURRENT_SEM})`;
    if (selCrit) selCrit.value = state.estagioCriterio;

    if (state.currentTab === 'estagio') {
      renderEstagioTab();
    }
  }

  function getActiveCareerScope() {
    if (!ACTIVE_CAREER_STAGE.enabled) return 'TURMA_COMPLETA';
    return ACTIVE_CAREER_STAGE.scopeMode === 'turma' ? 'TURMA_COMPLETA' : state.estagioCurso;
  }

  function getEstagioCursoStore(scopeKey) {
    if (!state.estagioData[scopeKey]) {
      const placeholders = ACTIVE_CAREER_STAGE.enabled
        ? ACTIVE_CAREER_STAGE.buildDefaultVagas(scopeKey)
        : [];
      state.estagioData[scopeKey] = { vagas: placeholders, prefs: {} };
    }
    return state.estagioData[scopeKey];
  }

  function getEstagioScore(aluno) {
    if (state.estagioCriterio === 'geral') return aluno.mediaGeral;
    if (state.estagioCriterio === 'cumulativo') {
      const evCur = (aluno.evolucao || []).find(e => e.semestre === CURRENT_SEM)
        || (aluno.evolucao || [])[(aluno.evolucao || []).length - 1];
      return evCur?.mediaGradCumulativo ?? aluno.mediaGraduacao;
    }
    return aluno.mediaGraduacao;
  }

  function getEstagioCriterioLabel() {
    if (state.estagioCriterio === 'geral') return 'CR Geral (80/20)';
    if (state.estagioCriterio === 'cumulativo') return `Cumulativa Graduação (c/ ${CURRENT_SEM})`;
    return 'CR Graduação (Consolidado)';
  }

  function getEstagioRankedAlunos(scopeKey) {
    if (!ACTIVE_CAREER_STAGE.enabled) return [];
    const allowedVinculos = ACTIVE_CAREER_STAGE.vinculosAllowed || ['Ativa'];
    return DATA.alunos
      .filter(a => {
        if (!allowedVinculos.includes(a.vinculo)) return false;
        if (ACTIVE_CAREER_STAGE.scopeMode === 'turma') return true;
        return a.curso === scopeKey;
      })
      .sort((a, b) => (getEstagioScore(b) ?? 0) - (getEstagioScore(a) ?? 0) || a.nome.localeCompare(b.nome, 'pt-BR'));
  }

  function setEstagioStatus(msg, isSaved = false) {
    const el = document.getElementById('estagioStatusMsg');
    if (!el) return;
    el.textContent = msg;
    el.className = isSaved
      ? 'text-xs text-emerald-400 font-bold'
      : 'text-xs text-amber-300 font-medium';
  }

  function saveEstagioData() {
    try {
      const key = getCareerStoreKey(ACTIVE_CAREER_STAGE.key);
      localStorage.setItem(key, JSON.stringify(state.estagioData));
      const now = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      setEstagioStatus(`Salvo no navegador às ${now}`, true);
    } catch {
      setEstagioStatus('Erro ao salvar no navegador.', false);
    }
  }

  function initEstagioTab() {
    if (!ACTIVE_CAREER_STAGE.enabled) {
      switchTab('overview');
      return;
    }
    const selCurso = document.getElementById('selectEstagioCurso');
    const selCrit = document.getElementById('selectEstagioCriterio');
    if (!selCurso) return;

    syncCareerStageTab();

    if (!state.estagioInitialized) {
      state.estagioInitialized = true;
      selCurso.innerHTML = DATA.metadata.cursos.map(c => `<option value="${c}">${c}</option>`).join('');
      selCurso.value = state.estagioCurso;
      if (selCrit) selCrit.value = state.estagioCriterio;

      selCurso.addEventListener('change', (e) => {
        state.estagioCurso = e.target.value;
        state.estagioExpandedAluno = null;
        renderEstagioTab();
      });

      selCrit?.addEventListener('change', (e) => {
        state.estagioCriterio = e.target.value;
        renderEstagioTab();
      });

      document.getElementById('btnEstagioCopy')?.addEventListener('click', async () => {
        const scopeKey = getActiveCareerScope();
        const store = getEstagioCursoStore(scopeKey);
        const ranked = getEstagioRankedAlunos(scopeKey);
        const remaining = new Map(store.vagas.map(v => [v.nome, v.qtd]));
        const headerScope = ACTIVE_CAREER_STAGE.scopeMode === 'turma' ? (ACTIVE_TURMA.nome || 'Turma') : scopeKey;
        const lines = [`*${ACTIVE_CAREER_STAGE.tabLabel} · ${headerScope} (${getEstagioCriterioLabel()})*`];
        ranked.forEach((a, idx) => {
          const prefs = (store.prefs[a.numero] || []).filter(Boolean);
          let chosen = 'Não alocado';
          for (let i = 0; i < prefs.length; i++) {
            if ((remaining.get(prefs[i]) || 0) > 0) {
              remaining.set(prefs[i], remaining.get(prefs[i]) - 1);
              chosen = `${prefs[i]} (${i + 1}ª op.)`;
              break;
            }
          }
          lines.push(`${idx + 1}º ${a.nome} → ${chosen}`);
        });
        try {
          await navigator.clipboard.writeText(lines.join('\n'));
          setEstagioStatus('Resultado copiado para a área de transferência!', true);
        } catch {
          setEstagioStatus('Não foi possível copiar automaticamente.');
        }
      });

      document.getElementById('formAddEstagioVaga')?.addEventListener('submit', (e) => {
        e.preventDefault();
        const inpNome = document.getElementById('inputNovaVagaNome');
        const inpQtd = document.getElementById('inputNovaVagaQtd');
        const nome = (inpNome?.value || '').trim();
        const qtd = Math.max(1, parseInt(inpQtd?.value || '1', 10) || 1);
        if (!nome) return;

        const store = getEstagioCursoStore(getActiveCareerScope());
        const existing = store.vagas.find(v => v.nome.toLowerCase() === nome.toLowerCase());
        if (existing) {
          existing.qtd += qtd;
        } else {
          store.vagas.push({
            id: `v_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            nome,
            qtd
          });
        }
        if (inpNome) inpNome.value = '';
        if (inpQtd) inpQtd.value = '1';
        setEstagioStatus('Alterações não salvas — clique em Salvar');
        renderEstagioTab();
      });

      document.getElementById('btnEstagioSalvar')?.addEventListener('click', saveEstagioData);

      document.getElementById('btnEstagioSimular')?.addEventListener('click', () => {
        renderEstagioResult();
        document.getElementById('estagioResultadoBody')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      });

      document.getElementById('btnEstagioExport')?.addEventListener('click', () => {
        const blob = new Blob([JSON.stringify(state.estagioData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${ACTIVE_CAREER_STAGE.key}_${ACTIVE_TURMA.id || 'ime'}_${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      });

      document.getElementById('inputEstagioImport')?.addEventListener('change', (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
          try {
            const parsed = JSON.parse(ev.target.result);
            if (parsed && typeof parsed === 'object') {
              state.estagioData = parsed;
              saveEstagioData();
              renderEstagioTab();
            }
          } catch {
            setEstagioStatus('Arquivo JSON inválido.');
          }
        };
        reader.readAsText(file);
        e.target.value = '';
      });
    }

    renderEstagioTab();
  }

  function renderEstagioTab() {
    if (!ACTIVE_CAREER_STAGE.enabled) return;
    const scopeKey = getActiveCareerScope();
    const store = getEstagioCursoStore(scopeKey);
    const ranked = getEstagioRankedAlunos(scopeKey);
    const vagasEl = document.getElementById('estagioVagasList');
    const resumoEl = document.getElementById('estagioVagasResumo');
    const alunosEl = document.getElementById('estagioAlunosList');

    const totalVagas = store.vagas.reduce((s, v) => s + (v.qtd || 0), 0);
    if (resumoEl) {
      const falta = totalVagas > 0 && totalVagas < ranked.length;
      resumoEl.innerHTML = `${totalVagas} vaga(s) em ${store.vagas.length} local(is) · ${ranked.length} alunos${falta ? ` <span class="text-rose-400">(-${ranked.length - totalVagas})</span>` : ''}`;
    }

    if (vagasEl) {
      if (store.vagas.length === 0) {
        vagasEl.innerHTML = `<div class="py-8 text-center text-xs text-slate-500 border border-dashed border-slate-800 rounded-xl">Nenhuma vaga cadastrada para ${curso}. Adicione acima (ex: IMBEL, CTEx...).</div>`;
      } else {
        vagasEl.innerHTML = store.vagas.map((v, idx) => `
          <div class="p-2 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center justify-between gap-2 text-xs">
            <input type="text" data-vaga-name="${idx}" value="${v.nome.replace(/"/g, '&quot;')}" class="flex-1 min-w-0 bg-slate-950/80 border border-slate-700/70 rounded-lg px-2.5 py-1.5 font-bold text-slate-100 text-xs focus:outline-none focus:ring-1 focus:ring-cyan-500" title="Editar nome do local" />
            <div class="flex items-center gap-1 shrink-0">
              <button data-vaga-dec="${idx}" class="w-7 h-7 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold flex items-center justify-center">-</button>
              <input type="number" min="1" max="99" data-vaga-qtd="${idx}" value="${v.qtd}" class="w-11 h-7 text-center font-mono-numbers font-bold text-cyan-300 bg-slate-950/80 border border-slate-700/70 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-cyan-500" title="Quantidade de vagas" />
              <button data-vaga-inc="${idx}" class="w-7 h-7 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold flex items-center justify-center">+</button>
              <button data-vaga-del="${idx}" class="ml-0.5 w-7 h-7 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition flex items-center justify-center" title="Remover vaga">
                <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
              </button>
            </div>
          </div>
        `).join('');

        vagasEl.querySelectorAll('input[data-vaga-name]').forEach(inp => {
          inp.addEventListener('change', () => {
            const i = parseInt(inp.getAttribute('data-vaga-name'), 10);
            const newName = inp.value.trim();
            if (!store.vagas[i]) return;
            if (!newName) {
              inp.value = store.vagas[i].nome;
              return;
            }
            const oldName = store.vagas[i].nome;
            if (oldName === newName) return;
            const dup = store.vagas.some((x, j) => j !== i && x.nome.toLowerCase() === newName.toLowerCase());
            if (dup) {
              inp.value = oldName;
              setEstagioStatus(`Já existe uma vaga chamada "${newName}".`);
              return;
            }
            store.vagas[i].nome = newName;
            Object.keys(store.prefs).forEach(num => {
              store.prefs[num] = (store.prefs[num] || []).map(p => (p === oldName ? newName : p));
            });
            setEstagioStatus('Alterações não salvas — clique em Salvar');
            renderEstagioTab();
          });
        });

        vagasEl.querySelectorAll('input[data-vaga-qtd]').forEach(inp => {
          inp.addEventListener('change', () => {
            const i = parseInt(inp.getAttribute('data-vaga-qtd'), 10);
            const val = Math.max(1, parseInt(inp.value || '1', 10) || 1);
            if (store.vagas[i]) {
              store.vagas[i].qtd = val;
              setEstagioStatus('Alterações não salvas — clique em Salvar');
              renderEstagioTab();
            }
          });
        });

        vagasEl.querySelectorAll('button[data-vaga-dec]').forEach(btn => {
          btn.addEventListener('click', () => {
            const i = parseInt(btn.getAttribute('data-vaga-dec'), 10);
            if (store.vagas[i] && store.vagas[i].qtd > 1) {
              store.vagas[i].qtd--;
              setEstagioStatus('Alterações não salvas — clique em Salvar');
              renderEstagioTab();
            }
          });
        });
        vagasEl.querySelectorAll('button[data-vaga-inc]').forEach(btn => {
          btn.addEventListener('click', () => {
            const i = parseInt(btn.getAttribute('data-vaga-inc'), 10);
            if (store.vagas[i]) {
              store.vagas[i].qtd++;
              setEstagioStatus('Alterações não salvas — clique em Salvar');
              renderEstagioTab();
            }
          });
        });
        vagasEl.querySelectorAll('button[data-vaga-del]').forEach(btn => {
          btn.addEventListener('click', () => {
            const i = parseInt(btn.getAttribute('data-vaga-del'), 10);
            const removed = store.vagas.splice(i, 1)[0];
            if (removed) {
              Object.keys(store.prefs).forEach(num => {
                store.prefs[num] = (store.prefs[num] || []).filter(name => name !== removed.nome);
              });
            }
            setEstagioStatus('Alterações não salvas — clique em Salvar');
            renderEstagioTab();
          });
        });
      }
    }

    if (alunosEl) {
      const vagaNames = store.vagas.map(v => v.nome);

      alunosEl.innerHTML = ranked.map((a, idx) => {
        const score = getEstagioScore(a);
        const prefs = store.prefs[a.numero] || [];
        const filled = prefs.filter(Boolean);
        const isExpanded = (state.estagioExpandedAluno === a.numero);

        const summaryText = filled.length > 0
          ? filled.slice(0, 3).map((p, i) => `${i + 1}ª ${p}`).join(' · ') + (filled.length > 3 ? ` (+${filled.length - 3})` : '')
          : 'Sem preferências definidas';

        return `
          <div class="rounded-xl bg-slate-900/70 border ${isExpanded ? 'border-cyan-500/50' : 'border-slate-800'} overflow-hidden">
            <button data-estagio-toggle="${a.numero}" class="w-full p-3 text-left flex items-center justify-between gap-3 hover:bg-slate-800/40 transition">
              <div class="flex items-center gap-3 min-w-0">
                <span class="w-7 h-7 rounded-lg bg-slate-800 text-cyan-300 font-extrabold text-xs flex items-center justify-center font-mono-numbers shrink-0">
                  ${idx + 1}º
                </span>
                <div class="min-w-0">
                  <div class="flex items-center gap-2 flex-wrap">
                    <span class="text-xs font-bold text-slate-100 truncate">${a.nome}</span>
                    <span class="text-[10px] font-mono-numbers text-blue-400 font-bold">${fmtNum(score)}</span>
                    ${getVinculoBadge(a.vinculo)}
                  </div>
                  <div class="text-[11px] text-slate-400 truncate mt-0.5">${summaryText}</div>
                </div>
              </div>
              <div class="flex items-center gap-2 shrink-0">
                <span class="px-2 py-0.5 rounded-full text-[10px] font-bold font-mono-numbers ${filled.length ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30' : 'bg-slate-800 text-slate-400'}">
                  ${filled.length}/10
                </span>
                <i data-lucide="${isExpanded ? 'chevron-up' : 'chevron-down'}" class="w-4 h-4 text-slate-400"></i>
              </div>
            </button>

            ${isExpanded ? `
              <div class="p-3 pt-2 border-t border-slate-800/80 bg-slate-950/50 space-y-2">
                ${vagaNames.length === 0 ? `
                  <div class="text-xs text-amber-300">Cadastre primeiro as vagas disponíveis na coluna ao lado (1. Vagas Disponíveis).</div>
                ` : `
                  <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    ${Array.from({ length: 10 }, (_, optIdx) => {
                      const curVal = prefs[optIdx] || '';
                      const usedElsewhere = new Set(prefs.filter((v, i) => v && i !== optIdx));
                      return `
                        <div class="flex items-center gap-1.5">
                          <span class="w-8 text-[11px] font-mono-numbers font-bold text-slate-400 shrink-0">${optIdx + 1}ª op.</span>
                          <select data-pref-aluno="${a.numero}" data-pref-idx="${optIdx}" class="flex-1 min-w-0 text-xs bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-slate-200 focus:outline-none focus:ring-1 focus:ring-cyan-500">
                            <option value="">— Nenhuma —</option>
                            ${vagaNames.map(vn => `<option value="${vn}" ${curVal === vn ? 'selected' : ''} ${usedElsewhere.has(vn) ? 'disabled' : ''}>${vn}${usedElsewhere.has(vn) ? ' (já escolhida)' : ''}</option>`).join('')}
                          </select>
                        </div>
                      `;
                    }).join('')}
                  </div>
                  <div class="flex justify-end pt-1">
                    <button data-pref-clear="${a.numero}" class="text-[11px] text-rose-400 hover:text-rose-300 font-semibold">Limpar opções deste aluno</button>
                  </div>
                `}
              </div>
            ` : ''}
          </div>
        `;
      }).join('');

      alunosEl.querySelectorAll('button[data-estagio-toggle]').forEach(btn => {
        btn.addEventListener('click', () => {
          const num = parseInt(btn.getAttribute('data-estagio-toggle'), 10);
          state.estagioExpandedAluno = (state.estagioExpandedAluno === num) ? null : num;
          renderEstagioTab();
        });
      });

      alunosEl.querySelectorAll('select[data-pref-aluno]').forEach(sel => {
        sel.addEventListener('change', (e) => {
          const num = parseInt(sel.getAttribute('data-pref-aluno'), 10);
          const optIdx = parseInt(sel.getAttribute('data-pref-idx'), 10);
          const arr = [...(store.prefs[num] || [])];
          while (arr.length <= optIdx) arr.push('');
          arr[optIdx] = e.target.value;
          store.prefs[num] = arr;
          setEstagioStatus('Alterações não salvas — clique em Salvar');
          renderEstagioTab();
        });
      });

      alunosEl.querySelectorAll('button[data-pref-clear]').forEach(btn => {
        btn.addEventListener('click', () => {
          const num = parseInt(btn.getAttribute('data-pref-clear'), 10);
          store.prefs[num] = [];
          setEstagioStatus('Alterações não salvas — clique em Salvar');
          renderEstagioTab();
        });
      });
    }

    renderEstagioResult();
    refreshIcons();
  }

  function renderEstagioResult() {
    const scopeKey = getActiveCareerScope();
    const store = getEstagioCursoStore(scopeKey);
    const ranked = getEstagioRankedAlunos(scopeKey);

    const tbody = document.getElementById('estagioResultadoBody');
    const ocupacaoEl = document.getElementById('estagioOcupacaoVagas');
    const kpisEl = document.getElementById('estagioResultadoKPIs');
    if (!tbody) return;

    const remaining = new Map(store.vagas.map(v => [v.nome, v.qtd]));
    const assignedByVaga = new Map(store.vagas.map(v => [v.nome, []]));

    let alocados = 0;
    let primeiraOpcao = 0;

    const rows = ranked.map((a, idx) => {
      const prefs = (store.prefs[a.numero] || []).filter(Boolean);
      let chosen = null;
      let chosenRank = null;

      for (let i = 0; i < prefs.length; i++) {
        const loc = prefs[i];
        if ((remaining.get(loc) || 0) > 0) {
          remaining.set(loc, remaining.get(loc) - 1);
          assignedByVaga.get(loc)?.push(`${idx + 1}º ${a.nome}`);
          chosen = loc;
          chosenRank = i + 1;
          alocados++;
          if (chosenRank === 1) primeiraOpcao++;
          break;
        }
      }

      const prefBadge = chosen
        ? `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold ${chosenRank === 1 ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30' : 'bg-blue-500/15 text-blue-300 border border-blue-500/30'}">${chosenRank}ª opção</span>`
        : `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-800 text-slate-400">${prefs.length ? 'Vagas esgotadas' : 'Sem escolha'}</span>`;

      const score = getEstagioScore(a);
      return `
        <tr class="table-hover-row border-b border-slate-800/40">
          <td class="py-2.5 px-2.5 sm:px-3 font-mono-numbers font-bold text-slate-300">${idx + 1}º</td>
          <td class="py-2.5 px-3 sm:px-4 font-bold text-slate-100">
            <div>${a.nome}</div>
            <div class="sm:hidden text-[10px] font-mono-numbers text-blue-400">CR ${fmtNum(score)}</div>
          </td>
          <td class="hidden sm:table-cell py-2.5 px-3 text-right font-mono-numbers text-blue-400 font-bold">${fmtNum(score)}</td>
          <td class="py-2.5 px-3 sm:px-4 font-bold ${chosen ? 'text-cyan-300' : 'text-slate-500'}">${chosen || 'Não alocado'}</td>
          <td class="py-2.5 px-2.5 sm:px-3 text-center">${prefBadge}</td>
        </tr>
      `;
    }).join('');

    tbody.innerHTML = rows || `<tr><td colspan="5" class="py-6 text-center text-slate-500">Nenhum aluno encontrado para este curso.</td></tr>`;

    if (kpisEl) {
      kpisEl.innerHTML = `
        <span class="px-2.5 py-1 rounded-xl bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-mono-numbers">Alocados: ${alocados}/${ranked.length}</span>
        <span class="px-2.5 py-1 rounded-xl bg-blue-500/15 text-blue-300 border border-blue-500/30 font-mono-numbers">1ª opção: ${primeiraOpcao}</span>
      `;
    }

    if (ocupacaoEl) {
      ocupacaoEl.innerHTML = store.vagas.map(v => {
        const ocupados = assignedByVaga.get(v.nome) || [];
        const rest = remaining.get(v.nome) || 0;
        return `
          <div class="p-3 rounded-xl bg-slate-900/70 border border-slate-800 space-y-1.5">
            <div class="flex items-center justify-between gap-2 text-xs">
              <span class="font-bold text-slate-100 truncate">${v.nome}</span>
              <span class="font-mono-numbers font-bold ${rest === 0 ? 'text-amber-300' : 'text-emerald-400'}">${ocupados.length}/${v.qtd} ocupadas</span>
            </div>
            <div class="text-[11px] text-slate-400">${ocupados.length ? ocupados.join(' · ') : 'Ninguém alocado ainda'}</div>
          </div>
        `;
      }).join('') || `<div class="p-4 rounded-xl border border-dashed border-slate-800 text-xs text-slate-500 text-center">Cadastre vagas para ver a ocupação.</div>`;
    }
  }

  // Attach tab click events to both desktop top nav and mobile bottom nav
  document.querySelectorAll('#navTabs button, #mobileBottomNav button').forEach(btn => {
    btn.addEventListener('click', () => {
      const targetTab = btn.getAttribute('data-tab');
      if (targetTab) {
        switchTab(targetTab);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    });
  });

  function applyTheme(themeName) {
    state.theme = themeName || 'dark';
    document.body.setAttribute('data-theme', state.theme);
    try {
      localStorage.setItem('ime_theme', state.theme);
    } catch {}

    const sel = document.getElementById('selectTheme');
    if (sel && sel.value !== state.theme) sel.value = state.theme;

    const isLight = (state.theme === 'light');
    const tickColor = isLight ? '#334155' : '#94a3b8';
    const labelColor = isLight ? '#0f172a' : '#cbd5e1';
    const gridColor = isLight ? 'rgba(15, 23, 42, 0.08)' : 'rgba(255, 255, 255, 0.05)';

    [
      chartCursosInstance,
      chartEvolucaoInstance,
      chartVinculoInstance,
      chartDistribuicaoInstance,
      chartCursosEvolucaoInstance,
      chartCourseH2HInstance,
      chartComparatorInstance,
      chartModalInstance
    ].forEach(ch => {
      if (!ch) return;
      if (ch.options?.scales) {
        Object.values(ch.options.scales).forEach(sc => {
          if (sc.ticks) sc.ticks.color = tickColor;
          if (sc.grid && sc.grid.display !== false) sc.grid.color = gridColor;
        });
      }
      if (ch.options?.plugins?.legend?.labels) {
        ch.options.plugins.legend.labels.color = labelColor;
      }
      ch.update();
    });
  }

  document.getElementById('btnToggleGlossary')?.addEventListener('click', () => {
    document.getElementById('glossaryPanel')?.classList.toggle('hidden');
  });
  document.getElementById('btnCloseGlossary')?.addEventListener('click', () => {
    document.getElementById('glossaryPanel')?.classList.add('hidden');
  });

  // Device Mode Switcher (Celular vs PC)
  document.getElementById('selectTheme')?.addEventListener('change', (e) => {
    applyTheme(e.target.value);
  });

  document.getElementById('btnModeMobile')?.addEventListener('click', () => {
    applyDeviceMode('mobile');
  });

  document.getElementById('btnModeDesktop')?.addEventListener('click', () => {
    applyDeviceMode('desktop');
  });

  window.addEventListener('resize', () => {
    if (state.deviceMode === 'auto') {
      applyDeviceMode('auto');
    }
  });

  // View Toggles: Cartões vs Tabela
  document.querySelectorAll('#toggleRankingView button').forEach(btn => {
    btn.addEventListener('click', () => {
      state.rankingView = btn.getAttribute('data-view') || 'cards';
      renderRankingsTable();
    });
  });

  document.querySelectorAll('#toggleCourseView button').forEach(btn => {
    btn.addEventListener('click', () => {
      state.courseView = btn.getAttribute('data-cview') || 'table';
      renderCourseMatrixTable();
    });
  });

  document.querySelectorAll('#toggleModalDisciplineView button').forEach(btn => {
    btn.addEventListener('click', () => {
      state.modalDisciplineView = btn.getAttribute('data-mview') || 'cards';
      renderModalDisciplinesTable();
    });
  });

  // Mobile Quick Search Drawer
  const btnMobileSearchToggle = document.getElementById('btnMobileSearchToggle');
  const mobileSearchDrawer = document.getElementById('mobileSearchDrawer');
  const btnCloseMobileSearch = document.getElementById('btnCloseMobileSearch');
  const mobileSearchInput = document.getElementById('mobileSearchInput');
  const mobileSearchResults = document.getElementById('mobileSearchResults');

  if (btnMobileSearchToggle && mobileSearchDrawer) {
    btnMobileSearchToggle.addEventListener('click', () => {
      const isHidden = mobileSearchDrawer.classList.contains('hidden');
      if (isHidden) {
        mobileSearchDrawer.classList.remove('hidden');
        if (mobileSearchInput) {
          mobileSearchInput.value = '';
          mobileSearchInput.focus();
        }
        if (mobileSearchResults) {
          mobileSearchResults.innerHTML = '';
          mobileSearchResults.classList.add('hidden');
        }
      } else {
        mobileSearchDrawer.classList.add('hidden');
      }
    });

    btnCloseMobileSearch?.addEventListener('click', () => {
      mobileSearchDrawer.classList.add('hidden');
    });

    mobileSearchInput?.addEventListener('input', (e) => {
      const q = e.target.value.trim().toLowerCase();
      if (!q) {
        mobileSearchResults.classList.add('hidden');
        return;
      }

      const matches = DATA.alunos.filter(a =>
        a.nome.toLowerCase().includes(q) ||
        String(a.numero).includes(q) ||
        a.curso.toLowerCase().includes(q)
      ).slice(0, 8);

      if (matches.length === 0) {
        mobileSearchResults.innerHTML = `<div class="px-4 py-3 text-slate-500 text-xs">Nenhum aluno encontrado</div>`;
      } else {
        mobileSearchResults.innerHTML = matches.map(a => `
          <div class="px-4 py-2.5 hover:bg-slate-800/80 active:bg-slate-800 cursor-pointer flex items-center justify-between text-xs transition" onclick="window.app.openStudentModal(${a.numero}); document.getElementById('mobileSearchDrawer').classList.add('hidden');">
            <div>
              <span class="font-bold text-white">${a.nome}</span>
              <div class="flex items-center gap-1.5 mt-0.5">
                <span class="text-slate-400 text-[11px] font-mono">#${a.numero}</span>
                <span class="text-slate-500">•</span>
                <span class="text-slate-400 text-[11px]">${a.curso}</span>
              </div>
            </div>
            <div class="text-right">
              <span class="text-[10px] text-slate-400 block uppercase font-semibold">CR Grad</span>
              <span class="font-bold text-blue-400 font-mono-numbers text-sm">${fmtNum(a.mediaGraduacao)}</span>
            </div>
          </div>
        `).join('');
      }
      mobileSearchResults.classList.remove('hidden');
    });
  }

  // Global Filter Events
  document.getElementById('filterCurso')?.addEventListener('change', (e) => {
    state.filterCurso = e.target.value;
    applyFilters();
  });

  document.querySelectorAll('.vinculo-chk').forEach(chk => {
    chk.addEventListener('change', () => {
      const v = chk.getAttribute('data-vinculo');
      if (chk.checked) {
        state.includedVinculos.add(v);
      } else {
        state.includedVinculos.delete(v);
      }
      state.currentPage = 1;
      applyFilters();
    });
  });

  document.getElementById('btnResetFilters')?.addEventListener('click', () => {
    state.filterCurso = 'ALL';
    state.includedVinculos = new Set(['Ativa', 'Reserva', 'CG']);
    state.vfRiskFilter = 'ALL';
    state.vfSearch = '';
    state.tableSearch = '';
    document.getElementById('filterCurso').value = 'ALL';
    document.querySelectorAll('.vinculo-chk').forEach(chk => { chk.checked = true; });
    const s1 = document.getElementById('globalSearchInput');
    const s2 = document.getElementById('tableSearchInput');
    const s3 = document.getElementById('vfSearchInput');
    if (s1) s1.value = '';
    if (s2) s2.value = '';
    if (s3) s3.value = '';
    applyFilters();
  });

  document.getElementById('vfSearchInput')?.addEventListener('input', (e) => {
    state.vfSearch = e.target.value;
    renderVfTab();
  });

  // Table Search & Page Size
  document.getElementById('tableSearchInput')?.addEventListener('input', (e) => {
    state.tableSearch = e.target.value;
    state.currentPage = 1;
    applyFilters();
  });

  document.getElementById('selectPageSize')?.addEventListener('change', (e) => {
    state.pageSize = e.target.value;
    state.currentPage = 1;
    renderRankingsTable();
  });

  // Table Headers Sorting
  const descFirstCols = new Set(['mediaGraduacao', 'mediaGeral', 'media32', 'maxVf32']);
  document.querySelectorAll('th[data-sort]').forEach(th => {
    th.addEventListener('click', () => {
      const col = th.getAttribute('data-sort');
      if (state.sortColumn === col) {
        state.sortAsc = !state.sortAsc;
      } else {
        state.sortColumn = col;
        state.sortAsc = !descFirstCols.has(col);
      }
      renderRankingsTable();
    });
  });

  // Disciplines Tab Filters
  document.getElementById('searchDisciplinasInput')?.addEventListener('input', (e) => {
    state.disciplinasSearch = e.target.value;
    renderDisciplinasFullTable();
  });

  document.getElementById('filterCursoDisciplinas')?.addEventListener('change', (e) => {
    state.disciplinasCurso = e.target.value;
    renderDisciplinasTab();
  });

  document.getElementById('filterSemestreDisciplinas')?.addEventListener('change', (e) => {
    state.disciplinasSemestre = e.target.value;
    renderDisciplinasFullTable();
  });

  // Modal Semester Filter Pills
  document.querySelectorAll('.modal-sem-pill').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.modal-sem-pill').forEach(b => {
        b.classList.remove('active', 'bg-blue-600', 'text-white', 'font-bold');
        b.classList.add('bg-slate-800', 'text-slate-300');
      });
      btn.classList.add('active', 'bg-blue-600', 'text-white', 'font-bold');
      btn.classList.remove('bg-slate-800', 'text-slate-300');
      state.modalSemesterFilter = btn.getAttribute('data-sem');
      renderModalDisciplinesTable();
    });
  });

  // Modal Metric Toggle (Semestral vs Cumulativo)
  document.querySelectorAll('#toggleModalMetric button').forEach(btn => {
    btn.addEventListener('click', () => {
      state.modalMetric = btn.getAttribute('data-metric');
      updateToggleButtons('toggleModalMetric', state.modalMetric, 'bg-blue-600');
      renderModalChart();
    });
  });

  // Global Quick Search Autocomplete
  const globalSearchInput = document.getElementById('globalSearchInput');
  const quickSearchResults = document.getElementById('quickSearchResults');
  if (globalSearchInput && quickSearchResults) {
    globalSearchInput.addEventListener('input', (e) => {
      const q = e.target.value.trim().toLowerCase();
      if (!q) {
        quickSearchResults.classList.add('hidden');
        return;
      }

      const matches = DATA.alunos.filter(a => 
        a.nome.toLowerCase().includes(q) || 
        String(a.numero).includes(q) ||
        a.curso.toLowerCase().includes(q)
      ).slice(0, 8);

      if (matches.length === 0) {
        quickSearchResults.innerHTML = `<div class="px-3 py-2 text-slate-500 text-xs">Nenhum aluno encontrado</div>`;
      } else {
        quickSearchResults.innerHTML = matches.map(a => `
          <div class="px-3 py-2 hover:bg-slate-800 cursor-pointer flex items-center justify-between text-xs" onclick="window.app.openStudentModal(${a.numero})">
            <div>
              <span class="font-bold text-white">${a.nome}</span>
              <span class="text-slate-400 text-[10px] ml-1.5">${a.curso}</span>
            </div>
            <span class="font-bold text-blue-400 font-mono-numbers">${fmtNum(a.mediaGraduacao)}</span>
          </div>
        `).join('');
      }

      quickSearchResults.classList.remove('hidden');
    });

    document.addEventListener('click', (e) => {
      if (!globalSearchInput.contains(e.target) && !quickSearchResults.contains(e.target)) {
        quickSearchResults.classList.add('hidden');
      }
    });
  }

  // Print Transcript & Compare Shortcut Buttons
  document.getElementById('btnCompareFromModal')?.addEventListener('click', () => {
    const aluno = state.activeStudentModal;
    if (!aluno) return;
    state.comparatorA = aluno.numero;
    if (state.comparatorB === aluno.numero) {
      const other = DATA.alunos.find(a => a.numero !== aluno.numero);
      if (other) state.comparatorB = other.numero;
    }
    closeStudentModal();
    switchTab('comparator');
  });

  document.getElementById('btnPrintModal')?.addEventListener('click', () => {
    window.print();
  });

  // Modal Close Events
  document.getElementById('btnCloseModal')?.addEventListener('click', closeStudentModal);
  document.getElementById('btnCloseModalFooter')?.addEventListener('click', closeStudentModal);
  document.getElementById('studentModal')?.addEventListener('click', (e) => {
    if (e.target.id === 'studentModal') closeStudentModal();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && state.activeStudentModal) {
      closeStudentModal();
    }
  });

  // Export CSV Event
  document.getElementById('btnExportCSV')?.addEventListener('click', exportFilteredCSV);

  // Global Expose for onclick handlers
  window.app = {
    openStudentModal,
    changePage: (page) => {
      state.currentPage = page;
      renderRankingsTable();
    },
    toggleCourseInChart: (curso) => {
      if (state.activeCoursesInChart.has(curso)) {
        state.activeCoursesInChart.delete(curso);
      } else {
        state.activeCoursesInChart.add(curso);
      }
      renderCourseTogglePills();
      updateCourseEvolutionChart();
    }
  };

  // ===========================================================================
  // TAB: GESTÃO DE NOTAS, IMPORTADOR MULTI-FORMATO & SUPER ADMIN
  // ===========================================================================
  let gestaoInitialized = false;
  let gestaoState = {
    selectedSemestre: CURRENT_SEM,
    viewMode: 'disciplina', // 'disciplina' | 'aluno'
    selectedDisciplinaKey: '',
    selectedAlunoNum: DATA.alunos[0]?.numero || null,
    search: '',
    dirty: false,
    importWorkbook: null,
    importSheetName: '',
    importRows: [],
    importHeaders: [],
    importJsonPayload: null,
    importFileType: null // 'sheet' | 'json'
  };

  const r2 = (v) => Math.round(v * 100) / 100;
  const escapeHtml = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const normStr = (s) => String(s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toUpperCase();
  const numOrNull = (val) => {
    if (val === null || val === undefined || val === '') return null;
    const n = typeof val === 'number' ? val : parseFloat(String(val).trim().replace(',', '.'));
    return isNaN(n) ? null : Math.max(0, Math.min(10, r2(n)));
  };
  function semOrder(sem) {
    const parts = String(sem || '').split('.');
    const ano = parseInt(parts[0], 10);
    const per = parseInt(parts[1], 10);
    if (isNaN(ano)) return 99;
    return ano * 2 - (per === 1 ? 1 : 0);
  }

  function ensureSemesterInMetadata(sem) {
    if (!DATA.metadata.semestres.includes(sem)) {
      DATA.metadata.semestres.push(sem);
      DATA.metadata.semestres.sort((a, b) => semOrder(a) - semOrder(b));
    }
    DATA.metadata.semestresNomes = DATA.metadata.semestresNomes || {};
    if (!DATA.metadata.semestresNomes[sem]) {
      DATA.metadata.semestresNomes[sem] = `${semOrder(sem)}º Semestre (${sem})`;
    }
  }

  function recomputeDisciplineEntry(d) {
    const ve = numOrNull(d.ve);
    const vc = numOrNull(d.vc);
    const vf = numOrNull(d.vf);
    const mve = numOrNull(d.mve);
    d.ve = ve;
    d.vc = vc;
    d.vf = vf;
    d.mve = mve;

    if (d.isPratica) {
      const val = mve ?? ve ?? numOrNull(d.nf);
      d.nf = val;
      d.notaEfetiva = val;
      d.isParcial = (val === null);
      d.situacao = val === null ? 'Em Andamento (Parcial)' : (val >= 5.0 ? 'Aprovado' : 'Reprovado');
      return;
    }

    if (vf !== null) {
      if (ve !== null && vc !== null) {
        d.med = r2((ve + vc + 2 * vf) / 4);
      }
      if (!d._manualNf) {
        d.nf = d.med ?? numOrNull(d.nf);
      } else {
        d.nf = numOrNull(d.nf);
      }
      d.notaEfetiva = d.nf;
      d.isParcial = (d.nf === null);
      if (d.nf === null) {
        d.situacao = 'Em Andamento (Parcial)';
      } else {
        d.situacao = (d.nf >= 5.0 && vf >= 4.0) ? 'Aprovado' : 'Reprovado';
      }
      return;
    }

    const manualNf = d._manualNf ? numOrNull(d.nf) : null;
    if (manualNf !== null) {
      d.nf = manualNf;
      d.notaEfetiva = manualNf;
      d.isParcial = false;
      d.situacao = manualNf >= 5.0 ? 'Aprovado' : 'Reprovado';
      return;
    }

    d.nf = null;
    d.med = null;
    d.isParcial = true;
    const partialVals = [mve ?? ve, vc].filter(v => v !== null);
    d.notaEfetiva = partialVals.length ? r2(partialVals.reduce((s, v) => s + v, 0) / partialVals.length) : null;
    d.situacao = 'Em Andamento (Parcial)';
  }

  function recalculateFullDataset({ skipGestaoRender = false } = {}) {
    ensureSemesterInMetadata(CURRENT_SEM);
    const semList = DATA.metadata.semestres;

    // 1. Recalcular notas do semestre atual (semestres históricos ficam intactos)
    const discAggMap = new Map();
    const existingMetaMap = new Map();
    (DATA.disciplinas || []).forEach(d => {
      existingMetaMap.set(`${d.codigo}||${d.semestre}`, d);
    });

    DATA.alunos.forEach(aluno => {
      (aluno.disciplinas || []).forEach(d => {
        if (d.semestre === CURRENT_SEM) {
          recomputeDisciplineEntry(d);
        }
        const key = `${d.codigo}||${d.semestre}`;
        if (!discAggMap.has(key)) {
          const prev = existingMetaMap.get(key);
          discAggMap.set(key, {
            codigo: d.codigo,
            disciplina: d.disciplina || `${d.nome} (${d.codigo})`,
            nome: d.nome,
            grupoEquivalente: d.grupoEquivalente || prev?.grupoEquivalente || d.nome,
            semestre: d.semestre,
            semestreOrdem: d.semestreOrdem || semOrder(d.semestre),
            ciclo: d.ciclo || prev?.ciclo || (d.militar ? 'Militar' : 'Profissional'),
            tipo: d.tipo || prev?.tipo || (d.militar ? 'Militar' : 'Profissional'),
            militar: Boolean(d.militar),
            isParcial: false,
            entries: []
          });
        }
        discAggMap.get(key).entries.push(d);
      });
    });

    // 2. Reconstruir catálogo DATA.disciplinas e atualizar mediaTurma / delta
    const newDisciplinas = [];
    discAggMap.forEach(group => {
      const vals = group.entries.map(e => e.notaEfetiva).filter(v => v !== null && !isNaN(v));
      const avg = vals.length ? r2(vals.reduce((s, v) => s + v, 0) / vals.length) : null;
      const variance = vals.length && avg !== null
        ? vals.reduce((s, v) => s + Math.pow(v - avg, 2), 0) / vals.length
        : 0;
      const anyParcial = group.entries.some(e => e.isParcial);
      group.entries.forEach(e => {
        e.mediaTurma = avg;
        e.delta = (e.notaEfetiva !== null && avg !== null) ? r2(e.notaEfetiva - avg) : null;
      });
      newDisciplinas.push({
        codigo: group.codigo,
        disciplina: group.disciplina,
        nome: group.nome,
        grupoEquivalente: group.grupoEquivalente,
        semestre: group.semestre,
        semestreOrdem: group.semestreOrdem,
        ciclo: group.ciclo,
        tipo: group.tipo,
        militar: group.militar,
        isParcial: anyParcial || group.semestre === CURRENT_SEM,
        qtdAlunos: group.entries.length,
        media: avg,
        desvioPadrao: r2(Math.sqrt(variance)),
        menorNota: vals.length ? r2(Math.min(...vals)) : null,
        maiorNota: vals.length ? r2(Math.max(...vals)) : null
      });
    });
    DATA.disciplinas = newDisciplinas;

    // 3. Recalcular médias individuais e evolução de cada aluno
    const avgArr = (arr) => arr.length ? r2(arr.reduce((s, v) => s + v, 0) / arr.length) : null;

    DATA.alunos.forEach(aluno => {
      const dis = aluno.disciplinas || [];
      const gradClosed = dis.filter(d => !d.militar && !d.isParcial && d.notaEfetiva !== null).map(d => d.notaEfetiva);
      const gradAll = dis.filter(d => !d.militar && d.notaEfetiva !== null).map(d => d.notaEfetiva);
      const milClosed = dis.filter(d => d.militar && !d.isParcial && d.notaEfetiva !== null).map(d => d.notaEfetiva);
      const milAll = dis.filter(d => d.militar && d.notaEfetiva !== null).map(d => d.notaEfetiva);
      const curSemVals = dis.filter(d => d.semestre === CURRENT_SEM && !d.militar && d.notaEfetiva !== null).map(d => d.notaEfetiva);
      const allValid = dis.map(d => d.notaEfetiva).filter(v => v !== null);

      const mGrad = avgArr(gradClosed) ?? avgArr(gradAll) ?? 0;
      const mMil = avgArr(milClosed) ?? avgArr(milAll) ?? mGrad;
      aluno.mediaGraduacao = mGrad;
      aluno.mediaMilitar = mMil;
      aluno.mediaGeral = aluno.cg ? mGrad : r2(0.8 * mGrad + 0.2 * mMil);
      aluno.media32 = avgArr(curSemVals);
      aluno.concluidas = dis.filter(d => !d.isParcial).length;
      aluno.matriculadas = dis.filter(d => d.isParcial).length;
      aluno.totalDisciplinas = dis.length;
      aluno.maiorNota = allValid.length ? r2(Math.max(...allValid)) : 0;
      aluno.menorNota = allValid.length ? r2(Math.min(...allValid)) : 0;

      let cumSum = 0;
      let cumCnt = 0;
      aluno.evolucao = semList.map((sem, idx) => {
        const semGrad = dis.filter(d => d.semestre === sem && !d.militar && d.notaEfetiva !== null);
        semGrad.forEach(d => { cumSum += d.notaEfetiva; cumCnt += 1; });
        return {
          semestre: sem,
          ordem: idx + 1,
          mediaGradSemestre: avgArr(semGrad.map(d => d.notaEfetiva)),
          mediaGradCumulativo: cumCnt > 0 ? r2(cumSum / cumCnt) : null,
          qtdDisciplinasSemestre: semGrad.length,
          qtdDisciplinasCumulativo: cumCnt,
          mediaTurmaGrad: null,
          mediaTurmaCumulativa: null,
          mediaCursoGrad: null,
          mediaCursoCumulativa: null
        };
      }).filter(ev => ev.qtdDisciplinasSemestre > 0 || ev.semestre === CURRENT_SEM);
    });

    // 4. Ranks globais e por curso
    [...DATA.alunos].sort((a, b) => b.mediaGraduacao - a.mediaGraduacao).forEach((a, i) => { a.rankGraduacao = i + 1; });
    [...DATA.alunos].sort((a, b) => b.mediaGeral - a.mediaGeral).forEach((a, i) => { a.rankGeral = i + 1; });
    (DATA.metadata.cursos || []).forEach(c => {
      DATA.alunos.filter(a => a.curso === c).sort((a, b) => b.mediaGraduacao - a.mediaGraduacao).forEach((a, i) => { a.rankCurso = i + 1; });
    });

    // 5. Benchmarks de semestre e cursos
    DATA.semestresBenchmark = semList.map(sem => {
      const sVals = DATA.alunos.map(a => a.evolucao.find(e => e.semestre === sem)?.mediaGradSemestre).filter(v => v !== null && v !== undefined);
      const cVals = DATA.alunos.map(a => a.evolucao.find(e => e.semestre === sem)?.mediaGradCumulativo).filter(v => v !== null && v !== undefined);
      const mTurmaSem = avgArr(sVals);
      const mTurmaCum = avgArr(cVals);
      DATA.alunos.forEach(a => {
        const ev = a.evolucao.find(e => e.semestre === sem);
        if (ev) {
          ev.mediaTurmaGrad = mTurmaSem;
          ev.mediaTurmaCumulativa = mTurmaCum;
        }
      });
      return {
        semestre: sem,
        mediaGraduacaoTurma: mTurmaSem,
        mediaGraduacaoTurmaCumulativa: mTurmaCum,
        qtdAlunos: sVals.length,
        isParcial: sem === CURRENT_SEM
      };
    });

    DATA.cursosComparativo = (DATA.metadata.cursos || []).map(curso => {
      const members = DATA.alunos.filter(a => a.curso === curso);
      const obj = computeCourseStats(curso, members, false);
      semList.forEach(sem => {
        members.forEach(a => {
          const ev = a.evolucao.find(e => e.semestre === sem);
          if (ev) {
            ev.mediaCursoGrad = obj.semestres[sem];
            ev.mediaCursoCumulativa = obj.semestresCumulativo[sem];
          }
        });
      });
      return obj;
    });

    DATA.metadata.totalAlunos = DATA.alunos.length;
    DATA.metadata.totalDisciplinas = DATA.disciplinas.length;
    DATA.metadata.semestreAtual = CURRENT_SEM;
    DATA.metadata.mediaGraduacaoTurma = avgArr(DATA.alunos.map(a => a.mediaGraduacao)) ?? 0;
    DATA.metadata.mediaGeralTurma = avgArr(DATA.alunos.map(a => a.mediaGeral)) ?? 0;
    DATA.metadata.mediaMilitarTurma = avgArr(DATA.alunos.map(a => a.mediaMilitar)) ?? 0;
    DATA.metadata.vinculos = {
      Ativa: DATA.alunos.filter(a => a.vinculo === 'Ativa').length,
      Reserva: DATA.alunos.filter(a => a.vinculo === 'Reserva').length,
      CG: DATA.alunos.filter(a => a.vinculo === 'CG').length
    };

    recomputeDerivedClientFields();
    syncDynamicDataLabels();
    applyFilters();
    renderDisciplinasTab();
    if (gestaoInitialized && !skipGestaoRender) {
      renderGestaoSelectors();
      renderGestaoGrid();
    }
  }

  function buildCleanPayloadForStorage() {
    const clone = structuredClone(DATA);
    clone.metadata.semestreAtual = CURRENT_SEM;
    clone.metadata.turma = ACTIVE_TURMA.nome || clone.metadata.turma;
    clone.disciplinas = (clone.disciplinas || []).map(({ cursos, cursoLabel, vfMediaNec, vfEmRisco, vfRiscoAlto, ...rest }) => rest);
    clone.alunos = (clone.alunos || []).map(({ vfRiskSubjects, maxVf32, avgVf32, vfRiskCount, vfRiskLevel, ...a }) => ({
      ...a,
      disciplinas: (a.disciplinas || []).map(({ _manualNf, ...d }) => d)
    }));
    return clone;
  }

  function setGestaoStatus(msg, type = 'info') {
    const el = document.getElementById('gestaoStatusBanner');
    if (!el) return;
    if (!msg) {
      el.classList.add('hidden');
      return;
    }
    const styles = {
      ok: 'p-3 rounded-xl text-xs font-semibold bg-emerald-500/15 border border-emerald-500/35 text-emerald-300',
      warn: 'p-3 rounded-xl text-xs font-semibold bg-amber-500/15 border border-amber-500/35 text-amber-300',
      err: 'p-3 rounded-xl text-xs font-semibold bg-rose-500/15 border border-rose-500/35 text-rose-300',
      info: 'p-3 rounded-xl text-xs font-semibold bg-sky-500/15 border border-sky-500/35 text-sky-300'
    };
    el.className = styles[type] || styles.info;
    el.textContent = msg;
    el.classList.remove('hidden');
  }

  function markGestaoDirty(isDirty = true) {
    gestaoState.dirty = isDirty;
    const b = document.getElementById('gestaoDirtyBadge');
    if (b) b.classList.toggle('hidden', !isDirty);
  }

  function renderGestaoSelectors() {
    ensureSemesterInMetadata(CURRENT_SEM);
    const pillsEl = document.getElementById('gestaoSemestrePills');
    if (pillsEl) {
      pillsEl.innerHTML = DATA.metadata.semestres.map(s => {
        const isCurrent = s === CURRENT_SEM;
        const isActive = s === gestaoState.selectedSemestre;
        const baseCls = isActive
          ? (isCurrent ? 'bg-emerald-600 text-white border-emerald-500' : 'bg-blue-600 text-white border-blue-500')
          : 'bg-slate-900 text-slate-300 border-slate-700 hover:bg-slate-800';
        return `<button type="button" data-gsem="${escapeHtml(s)}" class="gestao-sem-pill px-2.5 py-1 rounded-lg border font-bold text-xs transition flex items-center gap-1 ${baseCls}">
          <span>${isCurrent ? '🔓' : '🔒'} ${escapeHtml(s)}</span>
        </button>`;
      }).join('');
      pillsEl.querySelectorAll('.gestao-sem-pill').forEach(btn => {
        btn.addEventListener('click', () => {
          gestaoState.selectedSemestre = btn.getAttribute('data-gsem');
          renderGestaoSelectors();
          renderGestaoGrid();
        });
      });
    }

    const sem = gestaoState.selectedSemestre;
    const discSel = document.getElementById('gestaoDisciplinaSelect');
    if (discSel) {
      const discs = [];
      const seen = new Set();
      DATA.alunos.forEach(a => {
        (a.disciplinas || []).forEach(d => {
          if (d.semestre !== sem) return;
          const k = `${d.codigo}||${d.nome}`;
          if (!seen.has(k)) {
            seen.add(k);
            discs.push({ key: k, codigo: d.codigo, nome: d.nome });
          }
        });
      });
      discs.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
      if (!discs.some(d => d.key === gestaoState.selectedDisciplinaKey)) {
        gestaoState.selectedDisciplinaKey = discs[0]?.key || '';
      }
      discSel.innerHTML = discs.length
        ? discs.map(d => `<option value="${escapeHtml(d.key)}" ${d.key === gestaoState.selectedDisciplinaKey ? 'selected' : ''}>${escapeHtml(d.nome)} (${escapeHtml(d.codigo)})</option>`).join('')
        : `<option value="">Nenhuma disciplina em ${escapeHtml(sem)}</option>`;
    }

    const aluSel = document.getElementById('gestaoAlunoSelect');
    if (aluSel) {
      const sortedAl = [...DATA.alunos].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
      if (!sortedAl.some(a => String(a.numero) === String(gestaoState.selectedAlunoNum))) {
        gestaoState.selectedAlunoNum = sortedAl[0]?.numero || null;
      }
      aluSel.innerHTML = sortedAl.map(a =>
        `<option value="${a.numero}" ${String(a.numero) === String(gestaoState.selectedAlunoNum) ? 'selected' : ''}>${escapeHtml(a.nome)} (${escapeHtml(a.curso)})</option>`
      ).join('');
    }

    const newSubjCurso = document.getElementById('newSubjCurso');
    if (newSubjCurso) {
      newSubjCurso.innerHTML = `<option value="ALL">Toda a Turma (Comum)</option>` +
        (DATA.metadata.cursos || []).map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('');
    }
    const newStudCurso = document.getElementById('newStudCurso');
    if (newStudCurso) {
      newStudCurso.innerHTML = (DATA.metadata.cursos || []).map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('');
    }
  }

  function renderGestaoGrid() {
    const tbody = document.getElementById('gestaoGridBody');
    if (!tbody) return;

    const sem = gestaoState.selectedSemestre;
    const isEditable = (sem === CURRENT_SEM);
    document.getElementById('gestaoLockAlert')?.classList.toggle('hidden', isEditable);
    const lockSemSpan = document.getElementById('gestaoLockSemSpan');
    if (lockSemSpan) lockSemSpan.textContent = CURRENT_SEM;

    const addSubjBtn = document.getElementById('btnGestaoAddSubjectToggle');
    if (addSubjBtn) addSubjBtn.disabled = !isEditable;
    const lblCurSemBtn = document.getElementById('lblGestaoCurSemBtn');
    if (lblCurSemBtn) lblCurSemBtn.textContent = CURRENT_SEM;

    const q = normStr(gestaoState.search);
    const rows = [];

    if (gestaoState.viewMode === 'disciplina') {
      document.getElementById('thGestaoMainCol').textContent = 'Aluno / Curso';
      const [code, ...nameParts] = (gestaoState.selectedDisciplinaKey || '').split('||');
      const dName = nameParts.join('||');
      DATA.alunos.forEach(a => {
        const entry = (a.disciplinas || []).find(d => d.semestre === sem && d.codigo === code && (!dName || d.nome === dName));
        if (!entry) return;
        if (q && !normStr(`${a.nome} ${a.curso} ${a.numero}`).includes(q)) return;
        rows.push({ aluno: a, entry, label: a.nome, sub: `${a.curso} · Nº ${a.numero}` });
      });
      rows.sort((r1, r2) => r1.aluno.nome.localeCompare(r2.aluno.nome, 'pt-BR'));
    } else {
      document.getElementById('thGestaoMainCol').textContent = 'Disciplina';
      const aluno = DATA.alunos.find(a => String(a.numero) === String(gestaoState.selectedAlunoNum));
      if (aluno) {
        (aluno.disciplinas || []).filter(d => d.semestre === sem).forEach(entry => {
          if (q && !normStr(`${entry.nome} ${entry.codigo}`).includes(q)) return;
          rows.push({ aluno, entry, label: entry.nome, sub: `${entry.codigo} · ${entry.tipo || ''}` });
        });
      }
      rows.sort((r1, r2) => r1.entry.nome.localeCompare(r2.entry.nome, 'pt-BR'));
    }

    if (rows.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" class="py-8 text-center text-slate-500">Nenhum registro encontrado para ${escapeHtml(sem)}.</td></tr>`;
      return;
    }

    function formatRowStatusHtml(d) {
      if (d.nf !== null) {
        const sitCls = d.situacao === 'Aprovado'
          ? 'bg-emerald-500/15 text-emerald-300'
          : 'bg-rose-500/15 text-rose-300';
        return `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold ${sitCls}">${escapeHtml(d.situacao)}</span>`;
      }
      const vfInfo = calcVfNecessaria(d);
      if (vfInfo) {
        const vfStyle = getVfColorStyle(vfInfo);
        return `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold border ${vfStyle.pill}">${escapeHtml(vfInfo.label)}</span>`;
      }
      return `<span class="text-[11px] text-slate-400">Parcial (${fmtNum(d.notaEfetiva)})</span>`;
    }

    tbody.innerHTML = rows.map((row, idx) => {
      const d = row.entry;
      const disAttr = isEditable ? '' : 'disabled';
      const inpCls = `excel-cell w-16 text-center font-mono-numbers text-xs py-1 px-1.5 rounded-lg border ${
        isEditable
          ? 'bg-slate-900 border-slate-700 text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500'
          : 'bg-slate-950/60 border-slate-800/70 text-slate-500 cursor-not-allowed'
      }`;
      const statusHtml = formatRowStatusHtml(d);

      return `
        <tr class="hover:bg-slate-900/40 transition" data-row-idx="${idx}">
          <td class="py-2 px-3">
            <div class="font-bold text-slate-100 text-xs">${escapeHtml(row.label)}</div>
            <div class="text-[10px] text-slate-400">${escapeHtml(row.sub)}</div>
          </td>
          <td class="py-1.5 px-1.5 text-center"><input type="number" step="0.01" min="0" max="10" ${disAttr} data-row="${idx}" data-field="ve" value="${d.ve ?? ''}" class="${inpCls}"></td>
          <td class="py-1.5 px-1.5 text-center"><input type="number" step="0.01" min="0" max="10" ${disAttr} data-row="${idx}" data-field="vc" value="${d.vc ?? ''}" class="${inpCls}"></td>
          <td class="py-1.5 px-1.5 text-center"><input type="number" step="0.01" min="0" max="10" ${disAttr} data-row="${idx}" data-field="vf" value="${d.vf ?? ''}" class="${inpCls}"></td>
          <td class="py-1.5 px-1.5 text-center"><input type="number" step="0.01" min="0" max="10" ${disAttr} data-row="${idx}" data-field="mve" value="${d.mve ?? ''}" class="${inpCls}"></td>
          <td class="py-1.5 px-1.5 text-center"><input type="number" step="0.01" min="0" max="10" ${disAttr} data-row="${idx}" data-field="nf" value="${d.nf ?? ''}" placeholder="${d.notaEfetiva !== null ? fmtNum(d.notaEfetiva) : '-'}" class="${inpCls}"></td>
          <td class="py-2 px-3 text-center" id="gestaoRowStatus_${idx}">${statusHtml}</td>
        </tr>
      `;
    }).join('');

    if (!isEditable) return;

    const recalcRowAndSave = (inp) => {
      const rIdx = parseInt(inp.getAttribute('data-row'), 10);
      const field = inp.getAttribute('data-field');
      const target = rows[rIdx]?.entry;
      if (!target) return;
      const val = numOrNull(inp.value);
      if (field === 'nf') {
        target._manualNf = (val !== null);
        target.nf = val;
      } else {
        target[field] = val;
        if (field === 'vf' && val !== null) target._manualNf = false;
      }
      recomputeDisciplineEntry(target);
      if (field !== 'nf') {
        const nfCell = tbody.querySelector(`input[data-row="${rIdx}"][data-field="nf"]`);
        if (nfCell) {
          nfCell.value = target.nf ?? '';
          nfCell.placeholder = target.notaEfetiva !== null ? fmtNum(target.notaEfetiva) : '-';
        }
      }
      const statusCell = document.getElementById(`gestaoRowStatus_${rIdx}`);
      if (statusCell) statusCell.innerHTML = formatRowStatusHtml(target);
      markGestaoDirty(true);
      recalculateFullDataset({ skipGestaoRender: true });
    };

    tbody.querySelectorAll('.excel-cell').forEach(inp => {
      inp.addEventListener('change', () => recalcRowAndSave(inp));
      inp.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === 'ArrowUp') {
          e.preventDefault();
          recalcRowAndSave(inp);
          const rIdx = parseInt(inp.getAttribute('data-row'), 10);
          const field = inp.getAttribute('data-field');
          const nextIdx = e.key === 'ArrowUp' ? rIdx - 1 : rIdx + 1;
          const nextEl = tbody.querySelector(`input[data-row="${nextIdx}"][data-field="${field}"]`);
          if (nextEl) {
            nextEl.focus();
            nextEl.select();
          }
        }
      });
    });
  }

  function autoDetectMapping(headers) {
    const find = (patterns) => headers.find(h => {
      const n = normStr(h);
      return patterns.some(p => p instanceof RegExp ? p.test(n) : n === p || n.includes(p));
    }) || '';
    return {
      numero: find([/^MATRICULA$/, /^NUMERO$/, /^NUM$/, /^ID$/, /^RA$/]),
      nome: find([/^NOME/, /ALUNO/, /ESTUDANTE/]),
      codigo: find([/^COD/, /^CODIGO/]),
      disciplina: find([/DISCIPLINA/, /MATERIA/, /ASIGNATURA/, /^NOME_DISC/]),
      semestre: find([/SEMESTRE/, /^SEM$/]),
      curso: find([/CURSO/, /ESPECIALIDADE/, /^ENG/]),
      vinculo: find([/VINCULO/, /CATEGORIA/]),
      ve: find([/^VE$/, /^NOTA_VE/, /AVALIACAO VE/]),
      vc: find([/^VC$/, /^NOTA_VC/, /AVALIACAO VC/]),
      vf: find([/^VF$/, /^NOTA_VF/, /PROVA FINAL/]),
      nf: find([/^NF$/, /^NOTA_FINAL/, /^MEDIA_FINAL/]),
      mve: find([/^MVE$/, /PRATICA/])
    };
  }

  function loadImportSheetRows(sheetName) {
    const wb = gestaoState.importWorkbook;
    if (!wb || !window.XLSX) return;
    gestaoState.importSheetName = sheetName;
    const sheet = wb.Sheets[sheetName];
    const rows = window.XLSX.utils.sheet_to_json(sheet, { defval: '' });
    gestaoState.importRows = rows;
    const headers = rows.length ? Object.keys(rows[0]) : [];
    gestaoState.importHeaders = headers;

    const autoMap = autoDetectMapping(headers);
    const optionsHtml = `<option value="">-- Ignorar --</option>` + headers.map(h => `<option value="${escapeHtml(h)}">${escapeHtml(h)}</option>`).join('');
    document.querySelectorAll('.imp-col-map').forEach(sel => {
      const k = sel.getAttribute('data-map');
      sel.innerHTML = optionsHtml;
      if (autoMap[k]) sel.value = autoMap[k];
    });

    const previewWrap = document.getElementById('impPreviewTableWrap');
    if (previewWrap) {
      if (!rows.length) {
        previewWrap.innerHTML = `<div class="p-4 text-slate-400 text-xs">Planilha vazia.</div>`;
      } else {
        const sample = rows.slice(0, 5);
        previewWrap.innerHTML = `
          <table class="w-full text-left border-collapse">
            <thead class="bg-slate-900 text-slate-300"><tr>${headers.map(h => `<th class="py-1.5 px-2.5 border-b border-slate-800 whitespace-nowrap">${escapeHtml(h)}</th>`).join('')}</tr></thead>
            <tbody class="divide-y divide-slate-800/60">${sample.map(r => `<tr>${headers.map(h => `<td class="py-1.5 px-2.5 whitespace-nowrap text-slate-300">${escapeHtml(r[h])}</td>`).join('')}</tr>`).join('')}</tbody>
          </table>
        `;
      }
    }
    const report = document.getElementById('impMatchReport');
    if (report) report.textContent = `${rows.length} linhas detectadas na aba "${sheetName}". Apenas linhas de ${CURRENT_SEM} (ou sem coluna Semestre) serão aplicadas.`;
  }

  async function initSuperAdminPanel() {
    const panel = document.getElementById('superAdminPanel');
    if (!panel) return;
    if (!IS_SUPER_ADMIN && sessionMeta.mode !== 'demo') {
      panel.classList.add('hidden');
      return;
    }
    panel.classList.remove('hidden');
    document.getElementById('saDemoNotice')?.classList.toggle('hidden', sessionMeta.mode !== 'demo');

    const semInp = document.getElementById('saSemestreAtualInput');
    if (semInp) semInp.value = CURRENT_SEM;

    const wlTurmaSel = document.getElementById('saWlTurma');
    if (wlTurmaSel) {
      wlTurmaSel.innerHTML = VISIBLE_TURMAS.map(t => `<option value="${escapeHtml(t.id)}">${escapeHtml(t.nome)}</option>`).join('') +
        `<option value="">Todas (Super Admin)</option>`;
      wlTurmaSel.value = ACTIVE_TURMA.id;
    }

    const loadUsersList = async () => {
      const box = document.getElementById('saUsersList');
      if (!box) return;
      if (sessionMeta.mode !== 'supabase' || !sessionMeta.sb) {
        box.innerHTML = `<div class="p-3 text-slate-400">Modo Demo: conecte ao Supabase para listar e editar contas reais de <code>user_roles</code> e <code>allowed_emails</code>.</div>`;
        return;
      }
      box.innerHTML = `<div class="p-3 text-slate-400">Carregando usuários e whitelist...</div>`;
      try {
        const [{ data: roles }, { data: wl }] = await Promise.all([
          sessionMeta.sb.from('user_roles').select('*').order('email'),
          sessionMeta.sb.from('allowed_emails').select('*').order('email')
        ]);
        const activeRows = (roles || []).map(u => `
          <div class="p-2 flex items-center justify-between gap-2">
            <div class="min-w-0">
              <div class="font-semibold text-slate-100 truncate">${escapeHtml(u.email)}</div>
              <div class="text-[10px] text-emerald-400">Ativo • ${escapeHtml(u.role)} • ${escapeHtml(u.turma_id || 'Todas')}</div>
            </div>
            <button type="button" data-del-role="${escapeHtml(u.user_id)}" class="text-[10px] text-rose-400 hover:text-rose-300 px-2 py-0.5 rounded bg-rose-500/10">Remover</button>
          </div>
        `).join('');
        const wlRows = (wl || []).map(w => `
          <div class="p-2 flex items-center justify-between gap-2 bg-slate-900/40">
            <div class="min-w-0">
              <div class="font-semibold text-slate-200 truncate">${escapeHtml(w.email)}</div>
              <div class="text-[10px] text-amber-300">Whitelist • ${escapeHtml(w.role)} • ${escapeHtml(w.turma_id || 'Todas')}</div>
            </div>
            <button type="button" data-del-wl="${escapeHtml(w.email)}" class="text-[10px] text-rose-400 hover:text-rose-300 px-2 py-0.5 rounded bg-rose-500/10">Remover</button>
          </div>
        `).join('');
        box.innerHTML = (activeRows + wlRows) || `<div class="p-3 text-slate-500">Nenhum usuário listado em user_roles ou allowed_emails.</div>`;

        box.querySelectorAll('button[data-del-role]').forEach(btn => {
          btn.addEventListener('click', async () => {
            await sessionMeta.sb.from('user_roles').delete().eq('user_id', btn.getAttribute('data-del-role'));
            loadUsersList();
          });
        });
        box.querySelectorAll('button[data-del-wl]').forEach(btn => {
          btn.addEventListener('click', async () => {
            await sessionMeta.sb.from('allowed_emails').delete().eq('email', btn.getAttribute('data-del-wl'));
            loadUsersList();
          });
        });
      } catch (err) {
        box.innerHTML = `<div class="p-3 text-rose-300">Erro: ${escapeHtml(err.message)}</div>`;
      }
    };

    loadUsersList();
    document.getElementById('btnSaRefreshUsers')?.addEventListener('click', loadUsersList);

    document.getElementById('btnSaSaveSemestre')?.addEventListener('click', async () => {
      const nextSem = (document.getElementById('saSemestreAtualInput')?.value || '').trim();
      if (!nextSem) return;
      CURRENT_SEM = nextSem;
      gestaoState.selectedSemestre = nextSem;
      ensureSemesterInMetadata(nextSem);
      if (sessionMeta.mode === 'supabase' && sessionMeta.sb && IS_SUPER_ADMIN) {
        const { error } = await sessionMeta.sb.from('turmas').update({ semestre_atual: nextSem }).eq('id', ACTIVE_TURMA.id);
        if (error) {
          setGestaoStatus(`Erro ao atualizar semestre no banco: ${error.message}`, 'err');
          return;
        }
      }
      ACTIVE_TURMA.semestre_atual = nextSem;
      document.getElementById('gestaoSemestreLockPill').textContent = `Semestre Editável: ${nextSem}`;
      document.getElementById('impSemAtualLabel').textContent = nextSem;
      markGestaoDirty(true);
      syncCareerStageTab({ reloadStore: true });
      recalculateFullDataset();
      setGestaoStatus(`Semestre editável da turma atualizado para ${nextSem}!`, 'ok');
    });

    document.getElementById('btnSaCreateTurma')?.addEventListener('click', async () => {
      const id = (document.getElementById('saNewTurmaId')?.value || '').trim().toLowerCase().replace(/[^a-z0-9_-]/g, '_');
      const nome = (document.getElementById('saNewTurmaNome')?.value || '').trim();
      const sem = (document.getElementById('saNewTurmaSem')?.value || '1.1').trim();
      if (!id || !nome) {
        setGestaoStatus('Informe ID (ex: turma_29) e Nome da nova turma.', 'warn');
        return;
      }
      if (sessionMeta.mode !== 'supabase' || !sessionMeta.sb || !IS_SUPER_ADMIN) {
        setGestaoStatus(`Simulação Demo: nova turma "${nome}" (${id}, sem. ${sem}) seria criada no Supabase Storage (${id}/data.json).`, 'info');
        return;
      }
      const storagePath = `${id}/data.json`;
      const starterData = createEmptyTurmaDataset(
        { id, nome, semestre_atual: sem },
        DATA.metadata?.cursos || DEFAULT_CURSOS_IME
      );
      const { error: tErr } = await sessionMeta.sb.from('turmas').insert({
        id, nome, semestre_atual: sem, storage_path: storagePath
      });
      if (tErr) {
        setGestaoStatus(`Erro ao criar turma: ${tErr.message}`, 'err');
        return;
      }
      const blob = new Blob([JSON.stringify(starterData)], { type: 'application/json' });
      const { error: uErr } = await sessionMeta.sb.storage.from(sessionMeta.bucket).upload(storagePath, blob, {
        upsert: true, contentType: 'application/json'
      });
      if (uErr) {
        setGestaoStatus(`Turma criada, mas erro ao inicializar ${storagePath}: ${uErr.message}`, 'warn');
        return;
      }
      try { sessionStorage.setItem('ime_super_turma', id); } catch {}
      setGestaoStatus(`Turma "${nome}" criada! Recarregando para abrir a nova turma...`, 'ok');
      setTimeout(() => window.location.reload(), 900);
    });

    const addWhitelistEmails = async (emails) => {
      const role = document.getElementById('saWlRole')?.value || 'viewer';
      const turma_id = role === 'super_admin' ? null : (document.getElementById('saWlTurma')?.value || null);
      if (sessionMeta.mode !== 'supabase' || !sessionMeta.sb || !IS_SUPER_ADMIN) {
        setGestaoStatus(`Simulação Demo: ${emails.length} e-mail(s) autorizados como "${role}" (${turma_id || 'Todas'}).`, 'info');
        return;
      }
      const rows = emails.map(em => ({ email: em.trim().toLowerCase(), role, turma_id }));
      const { error } = await sessionMeta.sb.from('allowed_emails').upsert(rows, { onConflict: 'email' });
      if (error) {
        setGestaoStatus(`Erro ao salvar whitelist: ${error.message}`, 'err');
        return;
      }
      setGestaoStatus(`${rows.length} e-mail(s) pré-autorizado(s) com sucesso!`, 'ok');
      loadUsersList();
    };

    document.getElementById('btnSaAddWhitelist')?.addEventListener('click', () => {
      const em = (document.getElementById('saWlEmail')?.value || '').trim();
      if (!em || !em.includes('@')) return;
      addWhitelistEmails([em]);
      document.getElementById('saWlEmail').value = '';
    });

    document.getElementById('btnSaBatchWhitelist')?.addEventListener('click', () => {
      document.getElementById('saBatchBox')?.classList.toggle('hidden');
    });

    document.getElementById('btnSaSubmitBatch')?.addEventListener('click', () => {
      const raw = document.getElementById('saBatchEmailsText')?.value || '';
      const emails = raw.split(/[\n,;]+/).map(s => s.trim()).filter(s => s.includes('@'));
      if (!emails.length) return;
      addWhitelistEmails(emails);
      document.getElementById('saBatchEmailsText').value = '';
      document.getElementById('saBatchBox')?.classList.add('hidden');
    });
  }

  function initGestaoTab() {
    if (gestaoInitialized) {
      renderGestaoSelectors();
      renderGestaoGrid();
      return;
    }
    gestaoInitialized = true;

    const rolePill = document.getElementById('gestaoRolePill');
    if (rolePill) {
      rolePill.textContent = USER_ROLE === 'super_admin' ? 'Super Admin' : (USER_ROLE === 'gestor' ? 'Gestor da Turma' : 'Simulação Demo');
    }
    document.getElementById('gestaoSemestreLockPill').textContent = `Semestre Editável: ${CURRENT_SEM}`;
    document.getElementById('impSemAtualLabel').textContent = CURRENT_SEM;
    if (sessionMeta.mode !== 'supabase') {
      document.getElementById('btnGestaoPublishLabel').textContent = 'Aplicar & Exportar';
    }

    initSuperAdminPanel();
    renderGestaoSelectors();
    renderGestaoGrid();

    // Mode toggle (Por Disciplina vs Por Aluno)
    document.querySelectorAll('.gestao-mode-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const mode = btn.getAttribute('data-gmode');
        gestaoState.viewMode = mode;
        document.querySelectorAll('.gestao-mode-btn').forEach(b => {
          const active = b.getAttribute('data-gmode') === mode;
          b.className = active
            ? 'gestao-mode-btn active px-2.5 py-1 rounded-lg bg-blue-600 text-white transition'
            : 'gestao-mode-btn px-2.5 py-1 rounded-lg text-slate-400 hover:text-white transition';
        });
        document.getElementById('gestaoDisciplinaSelect')?.classList.toggle('hidden', mode !== 'disciplina');
        document.getElementById('gestaoAlunoSelect')?.classList.toggle('hidden', mode !== 'aluno');
        renderGestaoGrid();
      });
    });

    document.getElementById('gestaoDisciplinaSelect')?.addEventListener('change', (e) => {
      gestaoState.selectedDisciplinaKey = e.target.value;
      renderGestaoGrid();
    });
    document.getElementById('gestaoAlunoSelect')?.addEventListener('change', (e) => {
      gestaoState.selectedAlunoNum = e.target.value;
      renderGestaoGrid();
    });
    document.getElementById('gestaoSearchInput')?.addEventListener('input', (e) => {
      gestaoState.search = e.target.value;
      renderGestaoGrid();
    });

    // Inline Add Subject & Add Student
    document.getElementById('btnGestaoAddSubjectToggle')?.addEventListener('click', () => {
      document.getElementById('gestaoAddSubjectForm')?.classList.toggle('hidden');
    });
    document.getElementById('btnGestaoAddStudentToggle')?.addEventListener('click', () => {
      document.getElementById('gestaoAddStudentForm')?.classList.toggle('hidden');
    });

    document.getElementById('gestaoAddSubjectForm')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const codigo = (document.getElementById('newSubjCodigo')?.value || '').trim();
      const nome = (document.getElementById('newSubjNome')?.value || '').trim().toUpperCase();
      const targetCurso = document.getElementById('newSubjCurso')?.value || 'ALL';
      const tipoRaw = document.getElementById('newSubjTipo')?.value || 'Profissional';
      if (!codigo || !nome) return;

      const isMil = tipoRaw === 'Militar';
      const isPrat = tipoRaw === 'Prática';
      const tipo = isPrat ? 'Profissional' : tipoRaw;
      let count = 0;

      DATA.alunos.forEach(a => {
        if (targetCurso !== 'ALL' && a.curso !== targetCurso) return;
        const already = (a.disciplinas || []).some(d => d.semestre === CURRENT_SEM && d.codigo === codigo);
        if (already) return;
        a.disciplinas = a.disciplinas || [];
        a.disciplinas.push({
          semestre: CURRENT_SEM,
          semestreOrdem: semOrder(CURRENT_SEM),
          disciplina: `${nome} (${codigo})`,
          nome,
          codigo,
          grupoEquivalente: nome,
          tipo,
          ciclo: isMil ? 'Militar' : tipo,
          militar: isMil,
          ve: null, vc: null, vf: null, med: null, erp: null, ero: null, nf: null, notaEfetiva: null,
          isParcial: true, isPratica: isPrat, mve: null,
          situacao: 'Em Andamento (Parcial)',
          mediaTurma: null, delta: null
        });
        count++;
      });

      gestaoState.selectedSemestre = CURRENT_SEM;
      gestaoState.selectedDisciplinaKey = `${codigo}||${nome}`;
      markGestaoDirty(true);
      recalculateFullDataset();
      e.target.reset();
      document.getElementById('gestaoAddSubjectForm')?.classList.add('hidden');
      setGestaoStatus(`Disciplina "${nome}" adicionada em ${CURRENT_SEM} para ${count} aluno(s).`, 'ok');
    });

    document.getElementById('gestaoAddStudentForm')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const numero = parseInt(document.getElementById('newStudNumero')?.value, 10);
      const nome = (document.getElementById('newStudNome')?.value || '').trim().toUpperCase();
      const curso = document.getElementById('newStudCurso')?.value || (DATA.metadata.cursos?.[0] || 'Computação');
      const vinculo = document.getElementById('newStudVinculo')?.value || 'Ativa';
      if (!numero || !nome) return;
      if (DATA.alunos.some(a => Number(a.numero) === numero)) {
        setGestaoStatus(`Já existe um aluno com matrícula ${numero}.`, 'warn');
        return;
      }
      DATA.alunos.push({
        numero,
        nome,
        curso,
        cg: vinculo === 'CG',
        reserva: vinculo === 'Reserva',
        vinculo,
        mediaGraduacao: 0,
        mediaGeral: 0,
        mediaMilitar: 0,
        media32: null,
        concluidas: 0,
        matriculadas: 0,
        totalDisciplinas: 0,
        maiorNota: 0,
        menorNota: 0,
        evolucao: [],
        disciplinas: [],
        rankGraduacao: DATA.alunos.length + 1,
        rankGeral: DATA.alunos.length + 1,
        rankCurso: 1
      });
      gestaoState.selectedAlunoNum = numero;
      markGestaoDirty(true);
      recalculateFullDataset();
      e.target.reset();
      document.getElementById('gestaoAddStudentForm')?.classList.add('hidden');
      setGestaoStatus(`Aluno "${nome}" adicionado em ${curso}.`, 'ok');
    });

    // Download Excel Model (.xlsx) for CURRENT_SEM
    document.getElementById('btnGestaoDownloadModel')?.addEventListener('click', () => {
      if (!window.XLSX) {
        setGestaoStatus('Biblioteca Excel (SheetJS) não carregada.', 'err');
        return;
      }
      const rows = [];
      DATA.alunos.forEach(a => {
        (a.disciplinas || []).filter(d => d.semestre === CURRENT_SEM).forEach(d => {
          rows.push({
            Matricula: a.numero,
            Nome: a.nome,
            Curso: a.curso,
            Vinculo: a.vinculo,
            Semestre: d.semestre,
            Codigo: d.codigo,
            Disciplina: d.nome,
            VE: d.ve ?? '',
            VC: d.vc ?? '',
            VF: d.vf ?? '',
            MVE: d.mve ?? '',
            NF: d.nf ?? '',
            Situacao: d.situacao || ''
          });
        });
      });
      const ws = window.XLSX.utils.json_to_sheet(rows);
      const wb = window.XLSX.utils.book_new();
      window.XLSX.utils.book_append_sheet(wb, ws, `Notas_${CURRENT_SEM}`);
      window.XLSX.writeFile(wb, `modelo_notas_${ACTIVE_TURMA.id || 'turma'}_${CURRENT_SEM}.xlsx`);
    });

    // Export clean data.json
    document.getElementById('btnGestaoExportJson')?.addEventListener('click', () => {
      const payload = buildCleanPayloadForStorage();
      const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `data_${ACTIVE_TURMA.id || 'turma'}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    });

    // Publish to Supabase Storage (or notify Demo/Local)
    document.getElementById('btnGestaoPublish')?.addEventListener('click', async () => {
      recalculateFullDataset();
      if (sessionMeta.mode !== 'supabase' || !sessionMeta.sb) {
        markGestaoDirty(false);
        setGestaoStatus('Recalculado e aplicado no dashboard (Modo Demo/Local). Use "Baixar data.json" para guardar o arquivo atualizado.', 'ok');
        return;
      }
      const btn = document.getElementById('btnGestaoPublish');
      const lbl = document.getElementById('btnGestaoPublishLabel');
      const prev = lbl ? lbl.textContent : 'Salvar no Supabase';
      if (btn) btn.disabled = true;
      if (lbl) lbl.textContent = 'Enviando...';
      try {
        const payload = buildCleanPayloadForStorage();
        const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
        const { error } = await sessionMeta.sb.storage
          .from(sessionMeta.bucket)
          .upload(sessionMeta.storagePath, blob, { upsert: true, contentType: 'application/json' });
        if (error) throw new Error(error.message);
        markGestaoDirty(false);
        setGestaoStatus(`Dataset publicado com sucesso em "${sessionMeta.storagePath}"!`, 'ok');
      } catch (err) {
        setGestaoStatus(`Erro ao publicar no Supabase (verifique se seu usuário é Gestor/Super Admin desta turma): ${err.message}`, 'err');
      } finally {
        if (btn) btn.disabled = false;
        if (lbl) lbl.textContent = prev;
      }
    });

    // Multi-Format File Importer (.xlsx, .xls, .csv, .ods, .json, .js)
    const impInput = document.getElementById('gestaoImportFileInput');
    const impWs = document.getElementById('gestaoImportWorkspace');
    const sheetSel = document.getElementById('impSheetSelect');

    document.getElementById('btnImpCancel')?.addEventListener('click', () => {
      impWs?.classList.add('hidden');
      gestaoState.importWorkbook = null;
      gestaoState.importJsonPayload = null;
      if (impInput) impInput.value = '';
    });

    sheetSel?.addEventListener('change', (e) => loadImportSheetRows(e.target.value));

    impInput?.addEventListener('change', async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const ext = file.name.split('.').pop().toLowerCase();
      document.getElementById('impFileSummary').textContent = `Arquivo: ${file.name} (${(file.size / 1024).toFixed(1)} KB)`;

      if (ext === 'json' || ext === 'js') {
        const txt = await file.text();
        try {
          const parsed = parseLocalDatasetText(txt);
          gestaoState.importFileType = 'json';
          gestaoState.importJsonPayload = parsed;
          document.getElementById('impSpreadsheetMapper')?.classList.add('hidden');
          document.getElementById('impJsonOptions')?.classList.remove('hidden');
          document.getElementById('impPreviewTableWrap').innerHTML = '';
          sheetSel?.classList.add('hidden');
          document.getElementById('impSheetSelectLabel')?.classList.add('hidden');
          document.getElementById('impJsonInfo').textContent = `Dataset estruturado detectado: ${parsed.alunos.length} alunos e ${(parsed.disciplinas || []).length} disciplinas. Apenas notas de ${CURRENT_SEM} serão mescladas (trava ativa 🔒).`;
          document.getElementById('impSaFullReplaceWrap')?.classList.toggle('hidden', !IS_SUPER_ADMIN);
          document.getElementById('impMatchReport').textContent = 'Pronto para aplicar importação JSON.';
          impWs?.classList.remove('hidden');
        } catch (err) {
          setGestaoStatus(`Erro ao ler JSON/JS: ${err.message}`, 'err');
        }
        return;
      }

      if (!window.XLSX) {
        setGestaoStatus('SheetJS (xlsx) ainda não carregado. Verifique sua conexão.', 'err');
        return;
      }
      try {
        const buf = await file.arrayBuffer();
        const wb = window.XLSX.read(buf, { type: 'array' });
        gestaoState.importFileType = 'sheet';
        gestaoState.importWorkbook = wb;
        document.getElementById('impSpreadsheetMapper')?.classList.remove('hidden');
        document.getElementById('impJsonOptions')?.classList.add('hidden');

        const names = wb.SheetNames || [];
        if (sheetSel) {
          sheetSel.innerHTML = names.map(n => `<option value="${escapeHtml(n)}">${escapeHtml(n)}</option>`).join('');
          const showMulti = names.length > 1;
          sheetSel.classList.toggle('hidden', !showMulti);
          document.getElementById('impSheetSelectLabel')?.classList.toggle('hidden', !showMulti);
        }
        if (names.length > 0) loadImportSheetRows(names[0]);
        impWs?.classList.remove('hidden');
      } catch (err) {
        setGestaoStatus(`Não foi possível ler a planilha: ${err.message}`, 'err');
      }
    });

    document.getElementById('btnImpApply')?.addEventListener('click', () => {
      if (gestaoState.importFileType === 'json' && gestaoState.importJsonPayload) {
        const src = gestaoState.importJsonPayload;
        const fullReplace = IS_SUPER_ADMIN && document.getElementById('impSaFullReplace')?.checked;
        if (fullReplace) {
          DATA.alunos = structuredClone(src.alunos);
          DATA.disciplinas = structuredClone(src.disciplinas || []);
          if (src.metadata?.cursos?.length) DATA.metadata.cursos = [...src.metadata.cursos];
          if (src.metadata?.semestres?.length) DATA.metadata.semestres = [...src.metadata.semestres];
          markGestaoDirty(true);
          recalculateFullDataset();
          impWs?.classList.add('hidden');
          setGestaoStatus(`Dataset completo substituído pelo Super Admin (${DATA.alunos.length} alunos). Clique em "Salvar no Supabase" para publicar.`, 'ok');
          return;
        }
        // Merge ONLY CURRENT_SEM entries cleanly
        let updatedEntries = 0;
        const alunoMapByNum = new Map(DATA.alunos.map(a => [String(a.numero), a]));
        const alunoMapByName = new Map(DATA.alunos.map(a => [normStr(a.nome), a]));
        src.alunos.forEach(sa => {
          const target = alunoMapByNum.get(String(sa.numero)) || alunoMapByName.get(normStr(sa.nome));
          if (!target) return;
          (sa.disciplinas || []).filter(d => d.semestre === CURRENT_SEM).forEach(sd => {
            target.disciplinas = target.disciplinas || [];
            const idx = target.disciplinas.findIndex(td => td.semestre === CURRENT_SEM && td.codigo === sd.codigo);
            if (idx >= 0) target.disciplinas[idx] = { ...target.disciplinas[idx], ...structuredClone(sd) };
            else target.disciplinas.push(structuredClone(sd));
            updatedEntries++;
          });
        });
        markGestaoDirty(true);
        recalculateFullDataset();
        impWs?.classList.add('hidden');
        setGestaoStatus(`Importação JSON aplicada: ${updatedEntries} registros atualizados exclusivamente em ${CURRENT_SEM}.`, 'ok');
        return;
      }

      // Spreadsheet Apply
      const rows = gestaoState.importRows || [];
      if (!rows.length) return;
      const map = {};
      document.querySelectorAll('.imp-col-map').forEach(sel => {
        map[sel.getAttribute('data-map')] = sel.value;
      });
      if (!map.numero && !map.nome) {
        setGestaoStatus('Mapeie ao menos Matrícula ou Nome do Aluno para importar.', 'warn');
        return;
      }
      if (!map.codigo && !map.disciplina) {
        setGestaoStatus('Mapeie ao menos Código ou Nome da Disciplina para importar.', 'warn');
        return;
      }

      const createSubj = document.getElementById('impCreateMissingSubjects')?.checked;
      const createStud = document.getElementById('impCreateMissingStudents')?.checked;
      let updated = 0;
      let skippedLockedSem = 0;
      let skippedNotFound = 0;

      rows.forEach(r => {
        if (map.semestre && String(r[map.semestre] ?? '').trim() !== '') {
          const rowSem = String(r[map.semestre]).trim();
          if (rowSem !== CURRENT_SEM) {
            skippedLockedSem++;
            return;
          }
        }
        const numVal = map.numero ? String(r[map.numero] ?? '').trim() : '';
        const nameVal = map.nome ? String(r[map.nome] ?? '').trim() : '';
        if (!numVal && !nameVal) return;

        let aluno = (numVal && DATA.alunos.find(a => String(a.numero) === numVal))
          || (nameVal && DATA.alunos.find(a => normStr(a.nome) === normStr(nameVal)));

        if (!aluno && createStud && nameVal) {
          const newNum = parseInt(numVal, 10) || (99000 + DATA.alunos.length + 1);
          const cursoVal = (map.curso ? String(r[map.curso] ?? '').trim() : '') || (DATA.metadata.cursos?.[0] || 'Computação');
          const vincVal = (map.vinculo ? String(r[map.vinculo] ?? '').trim() : '') || 'Ativa';
          aluno = {
            numero: newNum,
            nome: nameVal.toUpperCase(),
            curso: DATA.metadata.cursos.includes(cursoVal) ? cursoVal : (DATA.metadata.cursos?.[0] || 'Computação'),
            cg: vincVal === 'CG',
            reserva: vincVal === 'Reserva',
            vinculo: ['Ativa', 'Reserva', 'CG'].includes(vincVal) ? vincVal : 'Ativa',
            mediaGraduacao: 0, mediaGeral: 0, mediaMilitar: 0, media32: null,
            concluidas: 0, matriculadas: 0, totalDisciplinas: 0, maiorNota: 0, menorNota: 0,
            evolucao: [], disciplinas: [], rankGraduacao: DATA.alunos.length + 1, rankGeral: DATA.alunos.length + 1, rankCurso: 1
          };
          DATA.alunos.push(aluno);
        }
        if (!aluno) {
          skippedNotFound++;
          return;
        }

        const codVal = map.codigo ? String(r[map.codigo] ?? '').trim() : '';
        const discNameRaw = map.disciplina ? String(r[map.disciplina] ?? '').trim() : '';
        if (!codVal && !discNameRaw) {
          skippedNotFound++;
          return;
        }

        aluno.disciplinas = aluno.disciplinas || [];
        let entry = aluno.disciplinas.find(d =>
          d.semestre === CURRENT_SEM &&
          ((codVal && d.codigo === codVal) || (discNameRaw && normStr(d.nome) === normStr(discNameRaw)))
        );

        if (!entry && createSubj) {
          const finalName = (discNameRaw || codVal).toUpperCase();
          const finalCod = codVal || normStr(finalName).slice(0, 6).replace(/\s+/g, '');
          const isPrat = Boolean(map.mve && numOrNull(r[map.mve]) !== null);
          entry = {
            semestre: CURRENT_SEM,
            semestreOrdem: semOrder(CURRENT_SEM),
            disciplina: `${finalName} (${finalCod})`,
            nome: finalName,
            codigo: finalCod,
            grupoEquivalente: finalName,
            tipo: 'Profissional',
            ciclo: 'Profissional',
            militar: false,
            ve: null, vc: null, vf: null, med: null, erp: null, ero: null, nf: null, notaEfetiva: null,
            isParcial: true, isPratica: isPrat, mve: null,
            situacao: 'Em Andamento (Parcial)', mediaTurma: null, delta: null
          };
          aluno.disciplinas.push(entry);
        }
        if (!entry) {
          skippedNotFound++;
          return;
        }

        if (map.ve && String(r[map.ve] ?? '').trim() !== '') entry.ve = numOrNull(r[map.ve]);
        if (map.vc && String(r[map.vc] ?? '').trim() !== '') entry.vc = numOrNull(r[map.vc]);
        if (map.vf && String(r[map.vf] ?? '').trim() !== '') {
          entry.vf = numOrNull(r[map.vf]);
          entry._manualNf = false;
        }
        if (map.mve && String(r[map.mve] ?? '').trim() !== '') entry.mve = numOrNull(r[map.mve]);
        if (map.nf && String(r[map.nf] ?? '').trim() !== '') {
          const nfVal = numOrNull(r[map.nf]);
          if (nfVal !== null) {
            entry.nf = nfVal;
            entry._manualNf = true;
          }
        }
        recomputeDisciplineEntry(entry);
        updated++;
      });

      markGestaoDirty(true);
      recalculateFullDataset();
      impWs?.classList.add('hidden');
      setGestaoStatus(
        `Importação aplicada em ${CURRENT_SEM}: ${updated} nota(s) atualizada(s)` +
        (skippedLockedSem ? ` · ${skippedLockedSem} linha(s) de semestres fechados ignoradas 🔒` : '') +
        (skippedNotFound ? ` · ${skippedNotFound} sem correspondência.` : '.'),
        updated > 0 ? 'ok' : 'warn'
      );
    });
  }

  // Initial Run
  applyDeviceMode('auto');
  syncCareerStageTab();
  initOverviewCharts();
  applyTheme(state.theme);
  applyFilters();
  renderDisciplinasTab();
  refreshIcons();
  } // end startDashboard
});
