/**
 * IME Analytics - Turma 2026
 * Interactive Dashboard Logic for GitHub Pages
 * Features: Média Semestral & Média Cumulativa, Comparador de Cursos, 3.2 Parcial
 */

document.addEventListener('DOMContentLoaded', () => {
  if (!window.IME_DATA) {
    console.error('Dataset window.IME_DATA não encontrado.');
    return;
  }

  const DATA = window.IME_DATA;
  let filteredAlunos = [...DATA.alunos];
  
  // App State
  const state = {
    currentTab: 'overview',
    filterCurso: 'ALL',
    filterVinculo: 'ALL',
    tableSearch: '',
    sortColumn: 'rankGraduacao',
    sortAsc: true,
    pageSize: 'ALL',
    currentPage: 1,
    disciplinasSearch: '',
    disciplinasSemestre: 'ALL',
    comparatorA: DATA.alunos[0]?.numero || null,
    comparatorB: DATA.alunos[1]?.numero || null,
    courseA: 'Computação',
    courseB: 'Eletrônica',
    activeCoursesInChart: new Set(DATA.metadata.cursos),
    activeStudentModal: null,
    modalSemesterFilter: 'ALL',
    
    // Metric Modes: 'semestral' | 'cumulativo'
    overviewMetric: 'semestral',
    courseMetric: 'semestral',
    modalMetric: 'semestral',
    comparatorMetric: 'semestral',

    // Device & View Modes
    deviceMode: 'auto',
    rankingView: 'cards',
    courseView: 'table',
    modalDisciplineView: 'cards'
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
    'Materiais': '#14b8a6'
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
    'Materiais': 'badge-materiais'
  };

  function getCourseBadge(curso) {
    const cls = courseClassMap[curso] || 'badge-computacao';
    return `<span class="px-2.5 py-0.5 rounded-full text-[11px] font-semibold whitespace-nowrap ${cls}">${curso}</span>`;
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
    refreshIcons();
  }

  // --- Filtering & Metrics Calculation ---
  function applyFilters() {
    filteredAlunos = DATA.alunos.filter(aluno => {
      if (state.filterCurso !== 'ALL' && aluno.curso !== state.filterCurso) return false;
      if (state.filterVinculo !== 'ALL' && aluno.vinculo !== state.filterVinculo) return false;
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
    updateOverviewCharts();
    renderRankingsTable();
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
    const isFiltered = (state.filterCurso !== 'ALL' || state.filterVinculo !== 'ALL' || state.tableSearch !== '');
    if (isFiltered) {
      btnReset.classList.remove('hidden');
      btnReset.classList.add('flex');
    } else {
      btnReset.classList.add('hidden');
      btnReset.classList.remove('flex');
    }
  }

  // --- TAB 1: VISÃO GERAL ---
  function renderPodium() {
    const container = document.getElementById('podiumContainer');
    if (!container) return;

    const top3 = [...filteredAlunos].sort((a, b) => a.rankGraduacao - b.rankGraduacao).slice(0, 3);
    
    if (top3.length === 0) {
      container.innerHTML = `<div class="col-span-3 text-center py-6 text-slate-500">Nenhum aluno encontrado para os filtros selecionados.</div>`;
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
              min: 6.5,
              max: 9.0,
              grid: { color: 'rgba(255, 255, 255, 0.05)' },
              ticks: { color: '#94a3b8', font: { family: 'JetBrains Mono' } }
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
          plugins: {
            legend: { display: false },
            tooltip: {
              backgroundColor: 'rgba(15, 23, 42, 0.95)',
              padding: 12,
              callbacks: {
                label: function(ctx) {
                  return `${ctx.dataset.label}: ${ctx.parsed.y.toFixed(2)}`;
                }
              }
            }
          },
          scales: {
            y: {
              min: 6.5,
              max: 9.0,
              grid: { color: 'rgba(255, 255, 255, 0.05)' },
              ticks: { color: '#94a3b8', font: { family: 'JetBrains Mono' } }
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
    if (!chartEvolucaoInstance) return;

    const semestres = DATA.metadata.semestres;
    const isSem = (state.overviewMetric === 'semestral');

    const cohortData = isSem
      ? DATA.semestresBenchmark.map(s => s.mediaGraduacaoTurma)
      : DATA.semestresBenchmark.map(s => s.mediaGraduacaoTurmaCumulativa);

    const cohortLabel = isSem ? 'Média de Graduação (Semestral)' : 'CR Cumulativo (Turma)';

    chartEvolucaoInstance.data.datasets[0].label = cohortLabel;
    chartEvolucaoInstance.data.datasets[0].data = cohortData;

    if (state.filterCurso !== 'ALL') {
      const courseObj = DATA.cursosComparativo.find(c => c.curso === state.filterCurso);
      const courseData = semestres.map(s => {
        if (!courseObj) return null;
        return isSem ? courseObj.semestres[s] : courseObj.semestresCumulativo[s];
      });

      const courseLabel = isSem ? `Média Semestral ${state.filterCurso}` : `CR Cumulativo ${state.filterCurso}`;

      if (chartEvolucaoInstance.data.datasets.length === 1) {
        chartEvolucaoInstance.data.datasets.push({
          label: courseLabel,
          data: courseData,
          borderColor: courseColors[state.filterCurso] || '#3b82f6',
          backgroundColor: 'transparent',
          borderDash: [5, 5],
          pointBackgroundColor: courseColors[state.filterCurso] || '#3b82f6',
          pointBorderColor: '#fff',
          pointRadius: 5,
          borderWidth: 2.5
        });
      } else {
        chartEvolucaoInstance.data.datasets[1].label = courseLabel;
        chartEvolucaoInstance.data.datasets[1].data = courseData;
        chartEvolucaoInstance.data.datasets[1].borderColor = courseColors[state.filterCurso] || '#3b82f6';
        chartEvolucaoInstance.data.datasets[1].pointBackgroundColor = courseColors[state.filterCurso] || '#3b82f6';
      }
    } else {
      if (chartEvolucaoInstance.data.datasets.length > 1) {
        chartEvolucaoInstance.data.datasets.pop();
      }
    }
    chartEvolucaoInstance.update();
  }

  // --- TAB 2: COMPARADOR DE CURSOS (EVOLUÇÃO) ---
  function initCursosComparisonTab() {
    renderCourseTogglePills();
    renderCourseEvolutionMultiLineChart();
    renderCourseMatrixTable();
    initCourseHeadToHead();

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

    container.innerHTML = DATA.cursosComparativo.map(c => {
      const active = state.activeCoursesInChart.has(c.curso);
      const color = courseColors[c.curso] || '#3b82f6';
      const border = active ? `border-color: ${color};` : 'border-color: rgba(255,255,255,0.1); opacity: 0.5;';
      const bg = active ? `background-color: ${color}22;` : 'background-color: transparent;';

      return `
        <button 
          class="course-pill px-3 py-1 rounded-xl text-xs font-bold border transition flex items-center gap-1.5"
          style="${border} ${bg} color: ${color};"
          data-course="${c.curso}"
          onclick="window.app.toggleCourseInChart('${c.curso}')"
        >
          <span class="w-2 h-2 rounded-full" style="background-color: ${color};"></span>
          <span>${c.curso}</span>
        </button>
      `;
    }).join('');

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
  }

  function renderCourseEvolutionMultiLineChart() {
    const ctx = document.getElementById('chartCursosEvolucao')?.getContext('2d');
    if (!ctx) return;

    const semestres = DATA.metadata.semestres;
    const labels = semestres.map(s => s === '3.2' ? '3.2 (Parcial)' : `Sem. ${s}`);

    const isSem = (state.courseMetric === 'semestral');
    const cohortData = isSem
      ? DATA.semestresBenchmark.map(b => b.mediaGraduacaoTurma)
      : DATA.semestresBenchmark.map(b => b.mediaGraduacaoTurmaCumulativa);

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

    DATA.cursosComparativo.forEach(c => {
      if (state.activeCoursesInChart.has(c.curso)) {
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

    chartCursosEvolucaoInstance = new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: datasets
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'top',
            labels: { color: '#cbd5e1', font: { size: 11, weight: '600' }, boxWidth: 12 }
          },
          tooltip: {
            backgroundColor: 'rgba(15, 23, 42, 0.95)',
            padding: 12
          }
        },
        scales: {
          y: {
            min: 5.5,
            max: 9.5,
            grid: { color: 'rgba(255, 255, 255, 0.05)' },
            ticks: { color: '#94a3b8', font: { family: 'JetBrains Mono' } }
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

    const cohortData = isSem
      ? DATA.semestresBenchmark.map(b => b.mediaGraduacaoTurma)
      : DATA.semestresBenchmark.map(b => b.mediaGraduacaoTurmaCumulativa);

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

    DATA.cursosComparativo.forEach(c => {
      if (state.activeCoursesInChart.has(c.curso)) {
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

    chartCursosEvolucaoInstance.data.datasets = datasets;
    chartCursosEvolucaoInstance.update();
  }

  function renderCourseCards() {
    const container = document.getElementById('courseCardsContainer');
    if (!container) return;

    const isSem = (state.courseMetric === 'semestral');

    container.innerHTML = DATA.cursosComparativo.map(c => {
      const src = isSem ? c.semestres : c.semestresCumulativo;
      return `
        <div class="glass-panel p-4 rounded-2xl border border-slate-800 space-y-3 shadow-md">
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

    tbody.innerHTML = DATA.cursosComparativo.map(c => {
      const src = isSem ? c.semestres : c.semestresCumulativo;
      return `
        <tr class="table-hover-row border-b border-slate-800/40">
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

    const opts = DATA.metadata.cursos.map(c => `<option value="${c}">${c}</option>`).join('');
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
    const cA = DATA.cursosComparativo.find(c => c.curso === state.courseA) || DATA.cursosComparativo[0];
    const cB = DATA.cursosComparativo.find(c => c.curso === state.courseB) || DATA.cursosComparativo[1];

    const cardsContainer = document.getElementById('courseHeadToHeadCards');
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
          plugins: {
            legend: { position: 'top', labels: { color: '#cbd5e1', font: { weight: 'bold' } } }
          },
          scales: {
            y: {
              min: 5.0,
              max: 10.0,
              grid: { color: 'rgba(255, 255, 255, 0.05)' },
              ticks: { color: '#94a3b8', font: { family: 'JetBrains Mono' } }
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

          <div class="flex items-center justify-between text-xs pt-1 text-slate-400 border-t border-slate-800/60">
            <div class="font-mono-numbers text-[11px]">
              <span>Maior: <strong class="text-emerald-400">${fmtNum(aluno.maiorNota)}</strong></span>
              <span class="mx-1 text-slate-600">•</span>
              <span>Menor: <strong class="text-rose-400">${fmtNum(aluno.menorNota)}</strong></span>
            </div>
            <span class="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-400">
              Ver Ficha <i data-lucide="chevron-right" class="w-3.5 h-3.5"></i>
            </span>
          </div>
        </div>
      `;
    }).join('');
  }

  function renderRankingsTable() {
    const tbody = document.getElementById('rankingTableBody');
    if (!tbody) return;

    const sorted = [...filteredAlunos].sort((a, b) => {
      let valA = a[state.sortColumn];
      let valB = b[state.sortColumn];

      if (valA === null || valA === undefined) valA = -9999;
      if (valB === null || valB === undefined) valB = -9999;

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
      tbody.innerHTML = `<tr><td colspan="12" class="py-8 text-center text-slate-500">Nenhum aluno encontrado para os filtros selecionados.</td></tr>`;
    } else {
      tbody.innerHTML = displayed.map(aluno => {
        let rankIcon = '';
        if (aluno.rankGraduacao === 1) rankIcon = '🥇 ';
        else if (aluno.rankGraduacao === 2) rankIcon = '🥈 ';
        else if (aluno.rankGraduacao === 3) rankIcon = '🥉 ';

        const m32 = aluno.media32 !== null ? fmtNum(aluno.media32) : '-';

        return `
          <tr class="table-hover-row border-b border-slate-800/40">
            <td class="py-3 px-4 font-bold text-white font-mono-numbers">
              ${rankIcon}#${aluno.rankGraduacao}
            </td>
            <td class="py-3 px-3 text-slate-400 font-mono-numbers">
              #${aluno.rankGeral}
            </td>
            <td class="py-3 px-3 text-slate-400 font-mono-numbers">
              #${aluno.rankCurso}
            </td>
            <td class="py-3 px-4 font-bold text-slate-100 hover:text-blue-400 cursor-pointer" onclick="window.app.openStudentModal(${aluno.numero})">
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
            <td class="py-3 px-3 text-center text-slate-400 font-mono-numbers">
              ${aluno.concluidas}
            </td>
            <td class="py-3 px-3 text-right font-mono-numbers text-slate-400 text-[11px]">
              <span class="text-emerald-400">${fmtNum(aluno.maiorNota)}</span> / <span class="text-rose-400">${fmtNum(aluno.menorNota)}</span>
            </td>
            <td class="py-3 px-4 text-center">
              <button 
                class="px-2.5 py-1 text-[11px] font-semibold bg-blue-600/20 hover:bg-blue-600 border border-blue-500/40 hover:border-blue-500 text-blue-300 hover:text-white rounded-lg transition"
                onclick="window.app.openStudentModal(${aluno.numero})"
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
  function renderDisciplinasTab() {
    const topHard = DATA.disciplinas.filter(d => d.media !== null && d.qtdAlunos >= 5).slice(0, 10);
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
              <span class="text-[10px] text-slate-400">${d.codigo} • Sem. ${d.semestre} • ${d.qtdAlunos} alunos</span>
            </div>
          </div>
          <div class="text-right shrink-0">
            <span class="text-sm font-extrabold text-rose-400 font-mono-numbers">${fmtNum(d.media)}</span>
            <span class="text-[10px] text-slate-500 block">DP: ${fmtNum(d.desvioPadrao)}</span>
          </div>
        </div>
      `).join('');
    }

    const topEasy = [...DATA.disciplinas.filter(d => d.media !== null && d.qtdAlunos >= 5)].sort((a, b) => b.media - a.media).slice(0, 10);
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
              <span class="text-[10px] text-slate-400">${d.codigo} • Sem. ${d.semestre} • ${d.qtdAlunos} alunos</span>
            </div>
          </div>
          <div class="text-right shrink-0">
            <span class="text-sm font-extrabold text-emerald-400 font-mono-numbers">${fmtNum(d.media)}</span>
            <span class="text-[10px] text-slate-500 block">DP: ${fmtNum(d.desvioPadrao)}</span>
          </div>
        </div>
      `).join('');
    }

    renderDisciplinasFullTable();
    refreshIcons();
  }

  function renderDisciplinasFullTable() {
    const tbody = document.getElementById('disciplinasTableBody');
    if (!tbody) return;

    let filtered = DATA.disciplinas;

    if (state.disciplinasSemestre !== 'ALL') {
      filtered = filtered.filter(d => d.semestre === state.disciplinasSemestre);
    }

    if (state.disciplinasSearch.trim()) {
      const q = state.disciplinasSearch.toLowerCase();
      filtered = filtered.filter(d => d.nome.toLowerCase().includes(q) || d.codigo.toLowerCase().includes(q));
    }

    tbody.innerHTML = filtered.map(d => {
      const is32 = (d.semestre === '3.2');
      const badge32 = is32 ? '<span class="ml-1.5 px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 text-[10px] font-bold border border-amber-500/20">3.2 Parcial</span>' : '';

      const pct = d.media !== null ? Math.min(100, Math.max(0, (d.media / 10) * 100)) : 0;
      let barColor = 'bg-rose-500';
      if (d.media >= 8.5) barColor = 'bg-emerald-500';
      else if (d.media >= 7.5) barColor = 'bg-blue-500';
      else if (d.media >= 7.0) barColor = 'bg-amber-500';

      return `
        <tr class="table-hover-row border-b border-slate-800/40">
          <td class="py-2.5 px-3 font-mono-numbers text-slate-400 text-[11px]">${d.codigo}</td>
          <td class="py-2.5 px-4 font-bold text-slate-200">
            ${d.nome} ${badge32}
          </td>
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
    }).join('');
  }

  // --- TAB 5: COMPARADOR 1x1 ALUNOS ---
  function initStudentComparator() {
    const select1 = document.getElementById('selectAluno1');
    const select2 = document.getElementById('selectAluno2');
    if (!select1 || !select2) return;

    const options = DATA.alunos.map(a => `<option value="${a.numero}">#${a.rankGraduacao} ${a.nome} (${a.curso})</option>`).join('');
    select1.innerHTML = options;
    select2.innerHTML = options;

    if (state.comparatorA) select1.value = state.comparatorA;
    if (state.comparatorB) select2.value = state.comparatorB;

    select1.addEventListener('change', (e) => {
      state.comparatorA = parseInt(e.target.value);
      renderStudentComparator();
    });

    select2.addEventListener('change', (e) => {
      state.comparatorB = parseInt(e.target.value);
      renderStudentComparator();
    });

    // Metric Toggle for Comparator
    document.querySelectorAll('#toggleComparatorMetric button').forEach(btn => {
      btn.addEventListener('click', () => {
        state.comparatorMetric = btn.getAttribute('data-metric');
        updateToggleButtons('toggleComparatorMetric', state.comparatorMetric, 'bg-blue-600');
        renderStudentComparator();
      });
    });

    renderStudentComparator();
  }

  function renderStudentComparator() {
    const a1 = DATA.alunos.find(a => a.numero === state.comparatorA) || DATA.alunos[0];
    const a2 = DATA.alunos.find(a => a.numero === state.comparatorB) || DATA.alunos[1];

    const cardsContainer = document.getElementById('comparatorComparisonCards');
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

      const dataA1 = getTrajectory(a1);
      const dataA2 = getTrajectory(a2);
      const dataTurma = isSem
        ? DATA.semestresBenchmark.map(s => s.mediaGraduacaoTurma)
        : DATA.semestresBenchmark.map(s => s.mediaGraduacaoTurmaCumulativa);

      const turmaLabel = isSem ? 'Média da Turma (Semestral)' : 'CR Cumulativo Turma';

      const subtitle = document.getElementById('comparatorSubtitle');
      if (subtitle) {
        subtitle.textContent = isSem
          ? `${a1.nome} vs ${a2.nome} vs Média da Turma (Médias Semestrais)`
          : `${a1.nome} vs ${a2.nome} vs Turma (CR Cumulativo Acumulado)`;
      }

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
          plugins: { legend: { display: false } },
          scales: {
            y: {
              min: 5.0,
              max: 10.0,
              grid: { color: 'rgba(255, 255, 255, 0.05)' },
              ticks: { color: '#94a3b8', font: { family: 'JetBrains Mono' } }
            },
            x: {
              grid: { color: 'rgba(255, 255, 255, 0.03)' },
              ticks: { color: '#cbd5e1', font: { weight: '600' } }
            }
          }
        }
      });
    }

    refreshIcons();
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
    document.getElementById('modalRankGradLabel').textContent = `${aluno.rankGraduacao}º de 86 alunos`;

    document.getElementById('modalCrGeral').textContent = fmtNum(aluno.mediaGeral);
    document.getElementById('modalRankGeralLabel').textContent = `${aluno.rankGeral}º de 86 alunos`;

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

    const cursoVals = semestres.map(s => {
      const c = DATA.cursosComparativo.find(cc => cc.curso === aluno.curso);
      if (!c) return null;
      return isSem ? c.semestres[s] : c.semestresCumulativo[s];
    });

    const turmaVals = isSem
      ? DATA.semestresBenchmark.map(s => s.mediaGraduacaoTurma)
      : DATA.semestresBenchmark.map(s => s.mediaGraduacaoTurmaCumulativa);

    const alunoLabel = isSem ? `${aluno.nome} (Semestral)` : `${aluno.nome} (CR Cumulativo)`;

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
        plugins: { legend: { display: false } },
        scales: {
          y: {
            min: 5.0,
            max: 10.0,
            grid: { color: 'rgba(255, 255, 255, 0.05)' },
            ticks: { color: '#94a3b8', font: { family: 'JetBrains Mono' } }
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

          <div class="flex items-center justify-between text-[11px] pt-0.5">
            <span class="font-semibold ${sitCls}">● ${d.situacao}</span>
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
            <td class="py-2 px-3 text-center font-bold text-[11px] ${sitCls}">${d.situacao}</td>
          </tr>
        `;
      }).join('');
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
    link.setAttribute('download', `ime_turma_2026_${state.filterCurso}_${state.filterVinculo}.csv`);
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
    } else if (targetTab === 'disciplinas') {
      renderDisciplinasTab();
    } else if (targetTab === 'comparator') {
      initStudentComparator();
    }

    refreshIcons();
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

  // Device Mode Switcher (Celular vs PC)
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

  document.getElementById('filterVinculo')?.addEventListener('change', (e) => {
    state.filterVinculo = e.target.value;
    applyFilters();
  });

  document.getElementById('btnResetFilters')?.addEventListener('click', () => {
    state.filterCurso = 'ALL';
    state.filterVinculo = 'ALL';
    state.tableSearch = '';
    document.getElementById('filterCurso').value = 'ALL';
    document.getElementById('filterVinculo').value = 'ALL';
    const s1 = document.getElementById('globalSearchInput');
    const s2 = document.getElementById('tableSearchInput');
    if (s1) s1.value = '';
    if (s2) s2.value = '';
    applyFilters();
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
  document.querySelectorAll('th[data-sort]').forEach(th => {
    th.addEventListener('click', () => {
      const col = th.getAttribute('data-sort');
      if (state.sortColumn === col) {
        state.sortAsc = !state.sortAsc;
      } else {
        state.sortColumn = col;
        state.sortAsc = true;
      }
      renderRankingsTable();
    });
  });

  // Disciplines Tab Filters
  document.getElementById('searchDisciplinasInput')?.addEventListener('input', (e) => {
    state.disciplinasSearch = e.target.value;
    renderDisciplinasFullTable();
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

  // Print Transcript Button
  document.getElementById('btnPrintModal')?.addEventListener('click', () => {
    window.print();
  });

  // Modal Close Events
  document.getElementById('btnCloseModal')?.addEventListener('click', closeStudentModal);
  document.getElementById('btnCloseModalFooter')?.addEventListener('click', closeStudentModal);
  document.getElementById('studentModal')?.addEventListener('click', (e) => {
    if (e.target.id === 'studentModal') closeStudentModal();
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

  // Initial Run
  applyDeviceMode('auto');
  initOverviewCharts();
  applyFilters();
  renderDisciplinasTab();
});
