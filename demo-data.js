/**
 * Dataset 100% fictício para o Modo Demo / Portfólio público no GitHub.
 * Não contém nenhum dado real de alunos ou notas.
 */
(function () {
  const CURSOS = [
    'Computação',
    'Mecânica de Automóveis',
    'Química',
    'Elétrica',
    'Materiais',
    'Cartografia',
    'Mecânica de Armamento',
    'Fortificação e Construção',
    'Eletrônica',
    'Comunicações'
  ];

  const SEMESTRES = ['1.1', '1.2', '2.1', '2.2', '3.1', '3.2'];
  const SEMESTRES_NOMES = {
    '1.1': '1º Semestre (1.1)',
    '1.2': '2º Semestre (1.2)',
    '2.1': '3º Semestre (2.1)',
    '2.2': '4º Semestre (2.2)',
    '3.1': '5º Semestre (3.1)',
    '3.2': '6º Semestre (3.2 Parcial)'
  };

  const NOMES_FICTICIOS = [
    'ALUNO DEMO 01', 'ALUNO DEMO 02', 'ALUNO DEMO 03', 'ALUNO DEMO 04', 'ALUNO DEMO 05',
    'ALUNO DEMO 06', 'ALUNO DEMO 07', 'ALUNO DEMO 08', 'ALUNO DEMO 09', 'ALUNO DEMO 10',
    'ALUNO DEMO 11', 'ALUNO DEMO 12', 'ALUNO DEMO 13', 'ALUNO DEMO 14', 'ALUNO DEMO 15',
    'ALUNO DEMO 16', 'ALUNO DEMO 17', 'ALUNO DEMO 18', 'ALUNO DEMO 19', 'ALUNO DEMO 20',
    'ALUNO DEMO 21', 'ALUNO DEMO 22', 'ALUNO DEMO 23', 'ALUNO DEMO 24', 'ALUNO DEMO 25',
    'ALUNO DEMO 26', 'ALUNO DEMO 27', 'ALUNO DEMO 28', 'ALUNO DEMO 29', 'ALUNO DEMO 30'
  ];

  const CATALOGO_BASICO = [
    { sem: '1.1', ord: 1, cod: 'D101', nome: 'CÁLCULO I', tipo: 'Básico', militar: false },
    { sem: '1.1', ord: 1, cod: 'D102', nome: 'FÍSICA I', tipo: 'Básico', militar: false },
    { sem: '1.1', ord: 1, cod: 'D103', nome: 'ÁLGEBRA LINEAR I', tipo: 'Básico', militar: false },
    { sem: '1.1', ord: 1, cod: 'M101', nome: 'INSTRUÇÃO MILITAR I', tipo: 'Militar', militar: true },
    { sem: '1.2', ord: 2, cod: 'D104', nome: 'CÁLCULO II', tipo: 'Básico', militar: false },
    { sem: '1.2', ord: 2, cod: 'D105', nome: 'FÍSICA II', tipo: 'Básico', militar: false },
    { sem: '1.2', ord: 2, cod: 'M102', nome: 'INSTRUÇÃO MILITAR II', tipo: 'Militar', militar: true },
    { sem: '2.1', ord: 3, cod: 'D201', nome: 'CÁLCULO III', tipo: 'Básico', militar: false },
    { sem: '2.1', ord: 3, cod: 'D202', nome: 'MECÂNICA GERAL', tipo: 'Básico', militar: false },
    { sem: '2.1', ord: 3, cod: 'M201', nome: 'INSTRUÇÃO MILITAR III', tipo: 'Militar', militar: true },
    { sem: '2.2', ord: 4, cod: 'D203', nome: 'PROBABILIDADE', tipo: 'Básico', militar: false },
    { sem: '2.2', ord: 4, cod: 'D204', nome: 'FENÔMENOS DE TRANSPORTE', tipo: 'Básico', militar: false },
    { sem: '2.2', ord: 4, cod: 'M202', nome: 'INSTRUÇÃO MILITAR IV', tipo: 'Militar', militar: true },
    { sem: '3.1', ord: 5, cod: 'D301', nome: 'ENGENHARIA ECONÔMICA', tipo: 'Profissional', militar: false },
    { sem: '3.1', ord: 5, cod: 'D302', nome: 'PROJETO INTEGRADO I', tipo: 'Profissional', militar: false },
    { sem: '3.1', ord: 5, cod: 'M301', nome: 'INSTRUÇÃO MILITAR V', tipo: 'Militar', militar: true },
    { sem: '3.2', ord: 6, cod: 'D321', nome: 'SISTEMAS AVANÇADOS I', tipo: 'Profissional', militar: false, parcial: true },
    { sem: '3.2', ord: 6, cod: 'D322', nome: 'MODELAGEM APLICADA', tipo: 'Profissional', militar: false, parcial: true },
    { sem: '3.2', ord: 6, cod: 'M302', nome: 'INSTRUÇÃO MILITAR VI', tipo: 'Militar', militar: true, parcial: true }
  ];

  const r2 = (v) => Math.round(v * 100) / 100;
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

  // PRNG determinístico
  let seed = 20261118;
  function rand() {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  }

  const alunos = NOMES_FICTICIOS.map((nome, idx) => {
    const curso = CURSOS[idx % CURSOS.length];
    const vinculo = idx % 7 === 0 ? 'Reserva' : (idx % 9 === 0 ? 'CG' : 'Ativa');
    const baseLevel = 6.4 + (idx % 10) * 0.25 + (rand() - 0.5) * 0.7;

    const disciplinas = CATALOGO_BASICO.map((mat, mIdx) => {
      const isParcial = Boolean(mat.parcial);
      const ve = r2(clamp(baseLevel + (rand() - 0.5) * 2.2 - (mat.sem === '3.2' ? (idx % 4) * 0.45 : 0), 3.0, 9.8));
      const vc = r2(clamp(baseLevel + (rand() - 0.5) * 2.0 - (mat.sem === '3.2' ? (idx % 3) * 0.5 : 0), 3.2, 9.9));
      const vf = isParcial ? null : r2(clamp((ve + vc) / 2 + (rand() - 0.45) * 1.1, 4.2, 9.8));
      const nf = isParcial ? null : r2((ve + vc + 2 * vf) / 4);
      const notaEfetiva = isParcial ? r2((ve + vc) / 2) : nf;

      return {
        semestre: mat.sem,
        semestreOrdem: mat.ord,
        disciplina: `${mat.nome} (${mat.cod})`,
        nome: mat.nome,
        codigo: mat.cod,
        grupoEquivalente: mat.nome,
        tipo: mat.tipo,
        ciclo: mat.ord <= 4 ? 'Básico' : (mat.militar ? 'Militar' : 'Profissional'),
        militar: mat.militar,
        ve,
        vc,
        vf,
        med: nf,
        erp: null,
        ero: null,
        nf,
        notaEfetiva,
        isParcial,
        isPratica: false,
        mve: null,
        situacao: isParcial ? 'Matriculado' : 'Aprovado',
        mediaTurma: 7.5,
        delta: 0
      };
    });

    const gradFechadas = disciplinas.filter(d => !d.militar && !d.isParcial && d.nf !== null);
    const milFechadas = disciplinas.filter(d => d.militar && !d.isParcial && d.nf !== null);
    const parcial32 = disciplinas.filter(d => d.semestre === '3.2' && !d.militar);

    const mediaGraduacao = r2(gradFechadas.reduce((s, d) => s + d.nf, 0) / Math.max(1, gradFechadas.length));
    const mediaMilitar = r2(milFechadas.reduce((s, d) => s + d.nf, 0) / Math.max(1, milFechadas.length));
    const mediaGeral = vinculo === 'CG'
      ? mediaGraduacao
      : r2(0.8 * mediaGraduacao + 0.2 * mediaMilitar);
    const media32 = r2(parcial32.reduce((s, d) => s + d.notaEfetiva, 0) / Math.max(1, parcial32.length));

    const evolucao = [];
    let cumSum = 0;
    let cumCount = 0;
    SEMESTRES.forEach((sem, sOrd) => {
      const ds = disciplinas.filter(d => d.semestre === sem && !d.militar);
      const semAvg = r2(ds.reduce((s, d) => s + d.notaEfetiva, 0) / Math.max(1, ds.length));
      cumSum += ds.reduce((s, d) => s + d.notaEfetiva, 0);
      cumCount += ds.length;
      evolucao.push({
        semestre: sem,
        ordem: sOrd + 1,
        mediaGradSemestre: semAvg,
        mediaGradCumulativo: r2(cumSum / Math.max(1, cumCount)),
        qtdDisciplinasSemestre: ds.length,
        qtdDisciplinasCumulativo: cumCount,
        mediaTurmaGrad: 7.5,
        mediaTurmaCumulativa: 7.5,
        mediaCursoGrad: 7.5,
        mediaCursoCumulativa: 7.5
      });
    });

    const notasValidas = disciplinas.filter(d => d.nf !== null).map(d => d.nf);
    return {
      numero: 90001 + idx,
      nome,
      curso,
      cg: vinculo === 'CG',
      reserva: vinculo === 'Reserva',
      vinculo,
      mediaGraduacao,
      mediaGeral,
      mediaMilitar,
      media32,
      concluidas: disciplinas.filter(d => !d.isParcial).length,
      matriculadas: disciplinas.filter(d => d.isParcial).length,
      totalDisciplinas: disciplinas.length,
      maiorNota: Math.max(...notasValidas),
      menorNota: Math.min(...notasValidas),
      evolucao,
      disciplinas,
      rankGraduacao: 1,
      rankGeral: 1,
      rankCurso: 1
    };
  });

  // Ranks globais e por curso
  [...alunos].sort((a, b) => b.mediaGraduacao - a.mediaGraduacao).forEach((a, i) => { a.rankGraduacao = i + 1; });
  [...alunos].sort((a, b) => b.mediaGeral - a.mediaGeral).forEach((a, i) => { a.rankGeral = i + 1; });
  CURSOS.forEach(c => {
    alunos.filter(a => a.curso === c).sort((a, b) => b.mediaGraduacao - a.mediaGraduacao).forEach((a, i) => { a.rankCurso = i + 1; });
  });

  // Médias por disciplina + delta individual
  const discMap = new Map();
  alunos.forEach(a => {
    a.disciplinas.forEach(d => {
      if (!discMap.has(d.codigo)) discMap.set(d.codigo, []);
      discMap.get(d.codigo).push(d);
    });
  });

  const disciplinas = CATALOGO_BASICO.map(mat => {
    const entries = discMap.get(mat.cod) || [];
    const vals = entries.map(e => e.notaEfetiva);
    const avg = r2(vals.reduce((s, v) => s + v, 0) / Math.max(1, vals.length));
    const variance = vals.reduce((s, v) => s + Math.pow(v - avg, 2), 0) / Math.max(1, vals.length);
    entries.forEach(e => {
      e.mediaTurma = avg;
      e.delta = r2(e.notaEfetiva - avg);
    });
    return {
      codigo: mat.cod,
      disciplina: `${mat.nome} (${mat.cod})`,
      nome: mat.nome,
      grupoEquivalente: mat.nome,
      semestre: mat.sem,
      semestreOrdem: mat.ord,
      ciclo: mat.ord <= 4 ? 'Básico' : (mat.militar ? 'Militar' : 'Profissional'),
      tipo: mat.tipo,
      militar: mat.militar,
      isParcial: Boolean(mat.parcial),
      qtdAlunos: vals.length,
      media: avg,
      desvioPadrao: r2(Math.sqrt(variance)),
      menorNota: r2(Math.min(...vals)),
      maiorNota: r2(Math.max(...vals))
    };
  });

  // Benchmark por semestre e comparativo de cursos
  const semestresBenchmark = SEMESTRES.map(sem => {
    const sVals = alunos.map(a => a.evolucao.find(e => e.semestre === sem)?.mediaGradSemestre || 0);
    const cVals = alunos.map(a => a.evolucao.find(e => e.semestre === sem)?.mediaGradCumulativo || 0);
    const mSem = r2(sVals.reduce((s, v) => s + v, 0) / alunos.length);
    const mCum = r2(cVals.reduce((s, v) => s + v, 0) / alunos.length);
    alunos.forEach(a => {
      const ev = a.evolucao.find(e => e.semestre === sem);
      if (ev) {
        ev.mediaTurmaGrad = mSem;
        ev.mediaTurmaCumulativa = mCum;
      }
    });
    return {
      semestre: sem,
      mediaGraduacaoTurma: mSem,
      mediaGraduacaoTurmaCumulativa: mCum,
      qtdAlunos: alunos.length,
      isParcial: sem === '3.2'
    };
  });

  const cursosComparativo = CURSOS.map(curso => {
    const members = alunos.filter(a => a.curso === curso);
    const semestres = {};
    const semestresCumulativo = {};
    SEMESTRES.forEach(sem => {
      const mS = r2(members.reduce((s, a) => s + a.evolucao.find(e => e.semestre === sem).mediaGradSemestre, 0) / members.length);
      const mC = r2(members.reduce((s, a) => s + a.evolucao.find(e => e.semestre === sem).mediaGradCumulativo, 0) / members.length);
      semestres[sem] = mS;
      semestresCumulativo[sem] = mC;
      members.forEach(a => {
        const ev = a.evolucao.find(e => e.semestre === sem);
        if (ev) {
          ev.mediaCursoGrad = mS;
          ev.mediaCursoCumulativa = mC;
        }
      });
    });
    const sorted = [...members].sort((a, b) => b.mediaGraduacao - a.mediaGraduacao);
    return {
      curso,
      qtdAlunos: members.length,
      mediaGraduacao: r2(members.reduce((s, a) => s + a.mediaGraduacao, 0) / members.length),
      mediaGeral: r2(members.reduce((s, a) => s + a.mediaGeral, 0) / members.length),
      semestres,
      semestresCumulativo,
      melhorAluno: sorted[0].nome,
      maiorCR: sorted[0].mediaGraduacao,
      menorCR: sorted[sorted.length - 1].mediaGraduacao
    };
  });

  window.IME_DEMO_DATA = {
    metadata: {
      titulo: 'Dashboard de Desempenho Acadêmico e Militar • Modo Demo',
      turma: 'Demo Fictícia',
      totalAlunos: alunos.length,
      totalDisciplinas: disciplinas.length,
      mediaGraduacaoTurma: r2(alunos.reduce((s, a) => s + a.mediaGraduacao, 0) / alunos.length),
      mediaGeralTurma: r2(alunos.reduce((s, a) => s + a.mediaGeral, 0) / alunos.length),
      mediaMilitarTurma: r2(alunos.reduce((s, a) => s + a.mediaMilitar, 0) / alunos.length),
      cursos: CURSOS,
      semestres: SEMESTRES,
      semestresNomes: SEMESTRES_NOMES,
      vinculos: {
        Ativa: alunos.filter(a => a.vinculo === 'Ativa').length,
        Reserva: alunos.filter(a => a.vinculo === 'Reserva').length,
        CG: alunos.filter(a => a.vinculo === 'CG').length
      }
    },
    cursosComparativo,
    semestresBenchmark,
    disciplinas,
    alunos
  };
})();
