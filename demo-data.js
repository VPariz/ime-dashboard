/**
 * Datasets 100% fictícios para o Modo Demo / Portfólio público no GitHub (Turmas 28 a 31).
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

  const ALL_SEMESTRES = ['1.1', '1.2', '2.1', '2.2', '3.1', '3.2'];
  const SEMESTRES_NOMES = {
    '1.1': '1º Semestre (1.1)',
    '1.2': '2º Semestre (1.2)',
    '2.1': '3º Semestre (2.1)',
    '2.2': '4º Semestre (2.2)',
    '3.1': '5º Semestre (3.1)',
    '3.2': '6º Semestre (3.2)'
  };

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
    { sem: '3.2', ord: 6, cod: 'D321', nome: 'SISTEMAS AVANÇADOS I', tipo: 'Profissional', militar: false },
    { sem: '3.2', ord: 6, cod: 'D322', nome: 'MODELAGEM APLICADA', tipo: 'Profissional', militar: false },
    { sem: '3.2', ord: 6, cod: 'M302', nome: 'INSTRUÇÃO MILITAR VI', tipo: 'Militar', militar: true }
  ];

  const r2 = (v) => Math.round(v * 100) / 100;
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

  function buildDemoTurma({ id, nome, curSem, qtdAlunos, seedInit, baseNum }) {
    const semIdx = ALL_SEMESTRES.indexOf(curSem);
    const semestres = ALL_SEMESTRES.slice(0, semIdx >= 0 ? semIdx + 1 : 1);
    const sNomes = {};
    semestres.forEach(s => {
      sNomes[s] = s === curSem ? `${SEMESTRES_NOMES[s]} Parcial` : SEMESTRES_NOMES[s];
    });

    if (qtdAlunos === 0) {
      return {
        metadata: {
          titulo: `Dashboard de Desempenho Acadêmico e Militar • ${nome} (Demo)`,
          turma: nome,
          semestreAtual: curSem,
          totalAlunos: 0,
          totalDisciplinas: 0,
          mediaGraduacaoTurma: 0,
          mediaGeralTurma: 0,
          mediaMilitarTurma: 0,
          cursos: [...CURSOS],
          semestres,
          semestresNomes: sNomes,
          vinculos: { Ativa: 0, Reserva: 0, CG: 0 }
        },
        cursosComparativo: [],
        semestresBenchmark: [],
        disciplinas: [],
        alunos: []
      };
    }

    let seed = seedInit;
    function rand() {
      seed = (seed * 1664525 + 1013904223) % 4294967296;
      return seed / 4294967296;
    }

    const catalogoTurma = CATALOGO_BASICO.filter(m => semestres.includes(m.sem));
    const tag = id.replace('turma_', 'T');
    const alunos = Array.from({ length: qtdAlunos }, (_, idx) => {
      const nStr = String(idx + 1).padStart(2, '0');
      const alunoNome = `ALUNO ${tag} DEMO ${nStr}`;
      const curso = CURSOS[idx % CURSOS.length];
      const vinculo = idx % 7 === 0 ? 'Reserva' : (idx % 9 === 0 ? 'CG' : 'Ativa');
      const baseLevel = 6.4 + (idx % 10) * 0.25 + (rand() - 0.5) * 0.7;

      const disciplinas = catalogoTurma.map(mat => {
        const isParcial = mat.sem === curSem;
        const ve = r2(clamp(baseLevel + (rand() - 0.5) * 2.2 - (isParcial ? (idx % 4) * 0.45 : 0), 3.0, 9.8));
        const vc = r2(clamp(baseLevel + (rand() - 0.5) * 2.0 - (isParcial ? (idx % 3) * 0.5 : 0), 3.2, 9.9));
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
          situacao: isParcial ? 'Em Andamento (Parcial)' : 'Aprovado',
          mediaTurma: 7.5,
          delta: 0
        };
      });

      const gradFechadas = disciplinas.filter(d => !d.militar && !d.isParcial && d.nf !== null);
      const milFechadas = disciplinas.filter(d => d.militar && !d.isParcial && d.nf !== null);
      const parcialCur = disciplinas.filter(d => d.semestre === curSem && !d.militar);

      const mediaGraduacao = r2(gradFechadas.reduce((s, d) => s + d.nf, 0) / Math.max(1, gradFechadas.length));
      const mediaMilitar = r2(milFechadas.reduce((s, d) => s + d.nf, 0) / Math.max(1, milFechadas.length));
      const mediaGeral = vinculo === 'CG' ? mediaGraduacao : r2(0.8 * mediaGraduacao + 0.2 * mediaMilitar);
      const media32 = r2(parcialCur.reduce((s, d) => s + d.notaEfetiva, 0) / Math.max(1, parcialCur.length));

      const evolucao = [];
      let cumSum = 0;
      let cumCount = 0;
      semestres.forEach((sem, sOrd) => {
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

      const notasValidas = disciplinas.filter(d => d.notaEfetiva !== null).map(d => d.notaEfetiva);
      return {
        numero: baseNum + idx,
        nome: alunoNome,
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

    [...alunos].sort((a, b) => b.mediaGraduacao - a.mediaGraduacao).forEach((a, i) => { a.rankGraduacao = i + 1; });
    [...alunos].sort((a, b) => b.mediaGeral - a.mediaGeral).forEach((a, i) => { a.rankGeral = i + 1; });
    CURSOS.forEach(c => {
      alunos.filter(a => a.curso === c).sort((a, b) => b.mediaGraduacao - a.mediaGraduacao).forEach((a, i) => { a.rankCurso = i + 1; });
    });

    const discMap = new Map();
    alunos.forEach(a => {
      a.disciplinas.forEach(d => {
        if (!discMap.has(d.codigo)) discMap.set(d.codigo, []);
        discMap.get(d.codigo).push(d);
      });
    });

    const disciplinas = catalogoTurma.map(mat => {
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
        isParcial: mat.sem === curSem,
        qtdAlunos: vals.length,
        media: avg,
        desvioPadrao: r2(Math.sqrt(variance)),
        menorNota: r2(Math.min(...vals)),
        maiorNota: r2(Math.max(...vals))
      };
    });

    const semestresBenchmark = semestres.map(sem => {
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
        isParcial: sem === curSem
      };
    });

    const cursosComparativo = CURSOS.map(curso => {
      const members = alunos.filter(a => a.curso === curso);
      const semestresObj = {};
      const semestresCumObj = {};
      semestres.forEach(sem => {
        const mS = members.length ? r2(members.reduce((s, a) => s + a.evolucao.find(e => e.semestre === sem).mediaGradSemestre, 0) / members.length) : 0;
        const mC = members.length ? r2(members.reduce((s, a) => s + a.evolucao.find(e => e.semestre === sem).mediaGradCumulativo, 0) / members.length) : 0;
        semestresObj[sem] = mS;
        semestresCumObj[sem] = mC;
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
        mediaGraduacao: sorted.length ? r2(members.reduce((s, a) => s + a.mediaGraduacao, 0) / members.length) : 0,
        mediaGeral: sorted.length ? r2(members.reduce((s, a) => s + a.mediaGeral, 0) / members.length) : 0,
        semestres: semestresObj,
        semestresCumulativo: semestresCumObj,
        melhorAluno: sorted[0]?.nome || '-',
        maiorCR: sorted[0]?.mediaGraduacao ?? 0,
        menorCR: sorted[sorted.length - 1]?.mediaGraduacao ?? 0
      };
    });

    return {
      metadata: {
        titulo: `Dashboard de Desempenho Acadêmico e Militar • ${nome} (Demo)`,
        turma: nome,
        semestreAtual: curSem,
        totalAlunos: alunos.length,
        totalDisciplinas: disciplinas.length,
        mediaGraduacaoTurma: r2(alunos.reduce((s, a) => s + a.mediaGraduacao, 0) / alunos.length),
        mediaGeralTurma: r2(alunos.reduce((s, a) => s + a.mediaGeral, 0) / alunos.length),
        mediaMilitarTurma: r2(alunos.reduce((s, a) => s + a.mediaMilitar, 0) / alunos.length),
        cursos: [...CURSOS],
        semestres,
        semestresNomes: sNomes,
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
  }

  window.IME_DEMO_TURMAS = {
    turma_28: buildDemoTurma({ id: 'turma_28', nome: 'Turma 28', curSem: '3.2', qtdAlunos: 30, seedInit: 20281118, baseNum: 90001 }),
    turma_29: buildDemoTurma({ id: 'turma_29', nome: 'Turma 29', curSem: '2.2', qtdAlunos: 25, seedInit: 20291118, baseNum: 91001 }),
    turma_30: buildDemoTurma({ id: 'turma_30', nome: 'Turma 30', curSem: '1.2', qtdAlunos: 20, seedInit: 20301118, baseNum: 92001 }),
    turma_31: buildDemoTurma({ id: 'turma_31', nome: 'Turma 31', curSem: '1.1', qtdAlunos: 0, seedInit: 20311118, baseNum: 93001 })
  };

  window.IME_DEMO_DATA = window.IME_DEMO_TURMAS.turma_28;
})();
