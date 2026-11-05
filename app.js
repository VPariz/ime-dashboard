/**
 * IME Analytics - Turma 2026
 * Interactive Dashboard Logic for GitHub Pages
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
    sortColumn: 'rankGeral',
    sortAsc: true,
    pageSize: 'ALL',
    currentPage: 1,
    disciplinasSearch: '',
    disciplinasCiclo: 'ALL',
    comparatorA: DATA.alunos[0]?.numero || null,
    comparatorB: DATA.alunos[1]?.numero || null,
    activeStudentModal: null
  };

  // References to Chart instances
  let chartCursosInstance = null;
  let chartEvolucaoInstance = null;
  let chartVinculoInstance = null;
  let chartDistribuicaoInstance = null;
  let chartModalInstance = null;
  let chartComparatorInstance = null;

  // Lucide Icons Helper
  function refreshIcons() {
    if (window.lucide && typeof window.lucide.createIcons === 'function') {
      window.lucide.createIcons();
    }
  }

  // Initial Lucide Icons run
  refreshIcons();

  // Course Color Helper
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

  // Formatting helpers
  function fmtNum(val) {
    if (val === null || val === undefined || isNaN(val)) return '-';
    return Number(val).toFixed(2);
  }

  // --- Filtering & Metrics Calculation ---
  function applyFilters() {
    filteredAlunos = DATA.alunos.filter(aluno => {
      // Course filter
      if (state.filterCurso !== 'ALL' && aluno.curso !== state.filterCurso) return false;
      // Vinculo filter
      if (state.filterVinculo !== 'ALL' && aluno.vinculo !== state.filterVinculo) return false;
      // Search filter
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
    updateCharts();
    renderRankingsTable();
    updateFilterResetButton();
  }

  function updateKPIs() {
    const total = filteredAlunos.length;
    document.getElementById('filteredStudentCount').textContent = `${total} de ${DATA.alunos.length}`;
    document.getElementById('kpiTotalAlunos').textContent = total;

    if (total === 0) {
      document.getElementById('kpiMediaGeral').textContent = '-';
      document.getElementById('kpiMediaGrad').textContent = '-';
      document.getElementById('kpiMediaMil').textContent = '-';
      document.getElementById('kpiCountAtiva').textContent = '0 Ativa';
      document.getElementById('kpiCountReserva').textContent = '0 Reserva';
      document.getElementById('kpiCountCG').textContent = '0 CG';
      return;
    }

    // Media Geral (80/20)
    const sumGeral = filteredAlunos.reduce((acc, a) => acc + (a.mediaGeral || 0), 0);
    const avgGeral = (sumGeral / total).toFixed(2);
    document.getElementById('kpiMediaGeral').textContent = avgGeral;

    // Media Graduação
    const sumGrad = filteredAlunos.reduce((acc, a) => acc + (a.mediaGraduacao || 0), 0);
    const avgGrad = (sumGrad / total).toFixed(2);
    document.getElementById('kpiMediaGrad').textContent = avgGrad;

    // Media Militar (students with militar grades)
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

    // Vinculos count in filtered set
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

    const top3 = [...filteredAlunos].sort((a, b) => a.rankGeral - b.rankGeral).slice(0, 3);
    
    if (top3.length === 0) {
      container.innerHTML = `<div class="col-span-3 text-center py-6 text-slate-500">Nenhum aluno encontrado para os filtros selecionados.</div>`;
      return;
    }

    const medals = [
      { rank: 1, icon: '🥇', label: '1º Lugar Geral', border: 'border-amber-500/40', glow: 'bg-amber-500/10', text: 'text-amber-400' },
      { rank: 2, icon: '🥈', label: '2º Lugar Geral', border: 'border-slate-400/40', glow: 'bg-slate-400/10', text: 'text-slate-300' },
      { rank: 3, icon: '🥉', label: '3º Lugar Geral', border: 'border-amber-700/40', glow: 'bg-amber-700/10', text: 'text-amber-600' }
    ];

    container.innerHTML = top3.map((aluno, idx) => {
      const m = medals[idx] || medals[2];
      return `
        <div class="glass-card p-4 rounded-2xl border ${m.border} cursor-pointer hover:scale-[1.02] transition" onclick="window.app.openStudentModal(${aluno.numero})">
          <div class="flex items-center justify-between mb-3">
            <span class="text-xs font-bold ${m.text} flex items-center gap-1.5 px-2.5 py-0.5 rounded-full ${m.glow}">
              <span>${m.icon}</span> ${m.label}
            </span>
            <span class="text-[11px] text-slate-400 font-mono-numbers">#${aluno.rankGeral} Geral</span>
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
              <span class="text-slate-400 text-[10px] uppercase font-bold block">CR Geral (80/20)</span>
              <span class="text-lg font-extrabold text-indigo-400 font-mono-numbers">${fmtNum(aluno.mediaGeral)}</span>
            </div>
            <div class="text-right">
              <span class="text-slate-400 text-[10px] uppercase font-bold block">CR Graduação</span>
              <span class="text-base font-bold text-slate-200 font-mono-numbers">${fmtNum(aluno.mediaGraduacao)}</span>
            </div>
          </div>
        </div>
      `;
    }).join('');

    refreshIcons();
  }

  // --- CHARTS INITIALIZATION ---
  function initCharts() {
    // 1. Chart Cursos (Horizontal Bar Chart)
    const ctxCursos = document.getElementById('chartCursos')?.getContext('2d');
    if (ctxCursos) {
      const labels = DATA.cursosSummary.map(c => c.curso);
      const dataGeral = DATA.cursosSummary.map(c => c.mediaGeral);
      const dataGrad = DATA.cursosSummary.map(c => c.mediaGraduacao);

      chartCursosInstance = new Chart(ctxCursos, {
        type: 'bar',
        data: {
          labels: labels,
          datasets: [
            {
              label: 'CR Geral (80/20)',
              data: dataGeral,
              backgroundColor: 'rgba(99, 102, 241, 0.85)',
              borderColor: '#6366f1',
              borderWidth: 1,
              borderRadius: 6
            },
            {
              label: 'CR Graduação',
              data: dataGrad,
              backgroundColor: 'rgba(59, 130, 246, 0.6)',
              borderColor: '#3b82f6',
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
              padding: 12,
              titleFont: { size: 12, weight: 'bold' },
              bodyFont: { size: 12 },
              borderWidth: 1,
              borderColor: 'rgba(255,255,255,0.1)'
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

    // 2. Chart Evolução Semestral
    const ctxEvolucao = document.getElementById('chartEvolucao')?.getContext('2d');
    if (ctxEvolucao) {
      const semestres = DATA.metadata.semestres;
      const mediaTurma = DATA.semestresSummary.map(s => s.mediaTurma);

      chartEvolucaoInstance = new Chart(ctxEvolucao, {
        type: 'line',
        data: {
          labels: semestres,
          datasets: [
            {
              label: 'Média Geral da Turma',
              data: mediaTurma,
              borderColor: '#10b981',
              backgroundColor: 'rgba(16, 185, 129, 0.12)',
              fill: true,
              tension: 0.35,
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
                  return `Média Turma: ${ctx.parsed.y.toFixed(2)}`;
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

    // 3. Chart Distribuição Vínculo (Donut)
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
            borderWidth: 3,
            hoverOffset: 4
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          cutout: '68%',
          plugins: {
            legend: {
              position: 'bottom',
              labels: {
                color: '#cbd5e1',
                font: { size: 11, weight: '600' },
                padding: 16
              }
            }
          }
        }
      });
    }

    // 4. Chart Distribuição de CRs (Histogram)
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
        const cr = a.mediaGeral;
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
          plugins: {
            legend: { display: false }
          },
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
  }

  function updateCharts() {
    // 1. Highlight / update chart Cursos
    if (chartCursosInstance) {
      if (state.filterCurso !== 'ALL') {
        const bgColors = DATA.cursosSummary.map(c => 
          c.curso === state.filterCurso ? 'rgba(245, 158, 11, 0.95)' : 'rgba(99, 102, 241, 0.35)'
        );
        const borderColors = DATA.cursosSummary.map(c => 
          c.curso === state.filterCurso ? '#f59e0b' : 'rgba(99, 102, 241, 0.3)'
        );
        chartCursosInstance.data.datasets[0].backgroundColor = bgColors;
        chartCursosInstance.data.datasets[0].borderColor = borderColors;
      } else {
        chartCursosInstance.data.datasets[0].backgroundColor = 'rgba(99, 102, 241, 0.85)';
        chartCursosInstance.data.datasets[0].borderColor = '#6366f1';
      }
      chartCursosInstance.update();
    }

    // 2. Trajetória Semestral
    if (chartEvolucaoInstance) {
      if (state.filterCurso !== 'ALL') {
        const courseBench = DATA.benchmarkCursosSemestre.filter(b => b.curso === state.filterCurso);
        const semestres = DATA.metadata.semestres;
        const courseData = semestres.map(s => {
          const found = courseBench.find(b => b.semestre === s);
          return found ? found.mediaCurso : null;
        });

        if (chartEvolucaoInstance.data.datasets.length === 1) {
          chartEvolucaoInstance.data.datasets.push({
            label: `Média ${state.filterCurso}`,
            data: courseData,
            borderColor: '#6366f1',
            backgroundColor: 'transparent',
            borderDash: [5, 5],
            pointBackgroundColor: '#6366f1',
            pointBorderColor: '#fff',
            pointRadius: 5,
            borderWidth: 2.5
          });
        } else {
          chartEvolucaoInstance.data.datasets[1].label = `Média ${state.filterCurso}`;
          chartEvolucaoInstance.data.datasets[1].data = courseData;
        }
      } else {
        if (chartEvolucaoInstance.data.datasets.length > 1) {
          chartEvolucaoInstance.data.datasets.pop();
        }
      }
      chartEvolucaoInstance.update();
    }
  }

  // --- TAB 2: RANKINGS TABLE ---
  function renderRankingsTable() {
    const tbody = document.getElementById('rankingTableBody');
    if (!tbody) return;

    // Sort filtered students
    const sorted = [...filteredAlunos].sort((a, b) => {
      let valA = a[state.sortColumn];
      let valB = b[state.sortColumn];

      if (valA === null || valA === undefined) valA = -9999;
      if (valB === null || valB === undefined) valB = -9999;

      if (typeof valA === 'string') {
        return state.sortAsc 
          ? valA.localeCompare(valB) 
          : valB.localeCompare(valA);
      }
      return state.sortAsc ? (valA - valB) : (valB - valA);
    });

    document.getElementById('tableResultsCount').textContent = `${sorted.length} alunos listados`;

    // Pagination
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
      return;
    }

    tbody.innerHTML = displayed.map(aluno => {
      let rankIcon = '';
      if (aluno.rankGeral === 1) rankIcon = '🥇 ';
      else if (aluno.rankGeral === 2) rankIcon = '🥈 ';
      else if (aluno.rankGeral === 3) rankIcon = '🥉 ';

      const milDisplay = aluno.vinculo === 'CG' 
        ? `<span class="text-slate-500 text-center block">-</span>` 
        : `<span class="font-mono-numbers text-slate-200">${fmtNum(aluno.mediaMilitar)}</span>`;

      return `
        <tr class="table-hover-row border-b border-slate-800/40">
          <td class="py-3 px-4 font-bold text-white font-mono-numbers">
            ${rankIcon}#${aluno.rankGeral}
          </td>
          <td class="py-3 px-3 text-slate-400 font-mono-numbers">
            #${aluno.rankGraduacao}
          </td>
          <td class="py-3 px-3 text-slate-400 font-mono-numbers">
            #${aluno.rankCurso}
          </td>
          <td class="py-3 px-4 font-bold text-slate-100 hover:text-indigo-400 cursor-pointer" onclick="window.app.openStudentModal(${aluno.numero})">
            ${aluno.nome}
          </td>
          <td class="py-3 px-3">
            ${getCourseBadge(aluno.curso)}
          </td>
          <td class="py-3 px-3">
            ${getVinculoBadge(aluno.vinculo)}
          </td>
          <td class="py-3 px-4 text-right font-extrabold text-indigo-400 font-mono-numbers text-sm">
            ${fmtNum(aluno.mediaGeral)}
          </td>
          <td class="py-3 px-4 text-right font-bold text-slate-300 font-mono-numbers">
            ${fmtNum(aluno.mediaGraduacao)}
          </td>
          <td class="py-3 px-4 text-right">
            ${milDisplay}
          </td>
          <td class="py-3 px-3 text-center text-slate-400 font-mono-numbers">
            ${aluno.disciplinasConcluidas}
          </td>
          <td class="py-3 px-3 text-right font-mono-numbers text-slate-400 text-[11px]">
            <span class="text-emerald-400">${fmtNum(aluno.maiorNota)}</span> / <span class="text-rose-400">${fmtNum(aluno.menorNota)}</span>
          </td>
          <td class="py-3 px-4 text-center">
            <button 
              class="px-2.5 py-1 text-[11px] font-semibold bg-indigo-600/20 hover:bg-indigo-600 border border-indigo-500/40 hover:border-indigo-500 text-indigo-300 hover:text-white rounded-lg transition"
              onclick="window.app.openStudentModal(${aluno.numero})"
            >
              Ver Ficha
            </button>
          </td>
        </tr>
      `;
    }).join('');

    refreshIcons();
  }

  function renderPaginationControls(total, limit) {
    const totalPages = Math.ceil(total / limit);
    const container = document.getElementById('paginationButtons');
    document.getElementById('pageInfo').textContent = `Página ${state.currentPage} de ${totalPages} (${total} alunos)`;

    let btns = '';
    for (let i = 1; i <= totalPages; i++) {
      const active = (i === state.currentPage) 
        ? 'bg-indigo-600 text-white font-bold' 
        : 'bg-slate-800 text-slate-300 hover:bg-slate-700';
      btns += `<button class="px-2.5 py-1 rounded-md text-xs ${active}" onclick="window.app.changePage(${i})">${i}</button>`;
    }
    container.innerHTML = btns;
  }

  // --- TAB 3: RAIO-X DE DISCIPLINAS ---
  function renderDisciplinasTab() {
    // 1. Top 10 Hardest (Lowest Averages)
    const topHard = [...DATA.disciplinas].slice(0, 10);
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

    // 2. Top 10 Easiest (Highest Averages)
    const topEasy = [...DATA.disciplinas].sort((a, b) => b.media - a.media).slice(0, 10);
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

    if (state.disciplinasCiclo !== 'ALL') {
      filtered = filtered.filter(d => d.ciclo === state.disciplinasCiclo);
    }

    if (state.disciplinasSearch.trim()) {
      const q = state.disciplinasSearch.toLowerCase();
      filtered = filtered.filter(d => d.nome.toLowerCase().includes(q) || d.codigo.toLowerCase().includes(q));
    }

    tbody.innerHTML = filtered.map(d => {
      const pct = Math.min(100, Math.max(0, (d.media / 10) * 100));
      let barColor = 'bg-rose-500';
      if (d.media >= 8.5) barColor = 'bg-emerald-500';
      else if (d.media >= 7.5) barColor = 'bg-blue-500';
      else if (d.media >= 7.0) barColor = 'bg-amber-500';

      return `
        <tr class="table-hover-row border-b border-slate-800/40">
          <td class="py-2.5 px-3 font-mono-numbers text-slate-400 text-[11px]">${d.codigo}</td>
          <td class="py-2.5 px-4 font-bold text-slate-200">${d.nome}</td>
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

  // --- TAB 4: COMPARADOR HEAD-TO-HEAD ---
  function initComparator() {
    const select1 = document.getElementById('selectAluno1');
    const select2 = document.getElementById('selectAluno2');
    if (!select1 || !select2) return;

    const options = DATA.alunos.map(a => `<option value="${a.numero}">#${a.rankGeral} ${a.nome} (${a.curso})</option>`).join('');
    select1.innerHTML = options;
    select2.innerHTML = options;

    if (state.comparatorA) select1.value = state.comparatorA;
    if (state.comparatorB) select2.value = state.comparatorB;

    select1.addEventListener('change', (e) => {
      state.comparatorA = parseInt(e.target.value);
      renderComparator();
    });

    select2.addEventListener('change', (e) => {
      state.comparatorB = parseInt(e.target.value);
      renderComparator();
    });

    renderComparator();
  }

  function renderComparator() {
    const a1 = DATA.alunos.find(a => a.numero === state.comparatorA) || DATA.alunos[0];
    const a2 = DATA.alunos.find(a => a.numero === state.comparatorB) || DATA.alunos[1];

    const cardsContainer = document.getElementById('comparatorComparisonCards');
    if (cardsContainer) {
      cardsContainer.innerHTML = [a1, a2].map((aluno, idx) => {
        const color = idx === 0 ? 'text-indigo-400' : 'text-emerald-400';
        const border = idx === 0 ? 'border-indigo-500/40' : 'border-emerald-500/40';
        return `
          <div class="glass-card p-5 rounded-2xl border ${border}">
            <div class="flex items-center justify-between mb-4">
              <div class="flex items-center gap-2">
                <span class="text-xs font-bold uppercase tracking-wider ${color}">Aluno ${idx + 1}</span>
              </div>
              <span class="text-xs font-mono-numbers text-slate-400">#${aluno.rankGeral} Geral</span>
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
                <span class="text-[10px] font-bold text-slate-400 uppercase block">CR Geral</span>
                <span class="text-base font-extrabold text-white font-mono-numbers">${fmtNum(aluno.mediaGeral)}</span>
              </div>
              <div class="p-2 rounded-xl bg-slate-900/60">
                <span class="text-[10px] font-bold text-slate-400 uppercase block">CR Grad</span>
                <span class="text-base font-extrabold text-blue-400 font-mono-numbers">${fmtNum(aluno.mediaGraduacao)}</span>
              </div>
              <div class="p-2 rounded-xl bg-slate-900/60">
                <span class="text-[10px] font-bold text-slate-400 uppercase block">CR Mil</span>
                <span class="text-base font-extrabold text-emerald-400 font-mono-numbers">${aluno.vinculo === 'CG' ? '-' : fmtNum(aluno.mediaMilitar)}</span>
              </div>
            </div>
          </div>
        `;
      }).join('');
    }

    // Chart Comparator
    const ctx = document.getElementById('chartComparator')?.getContext('2d');
    if (ctx) {
      if (chartComparatorInstance) chartComparatorInstance.destroy();

      const semestres = DATA.metadata.semestres;
      const getTrajectory = (aluno) => {
        return semestres.map(s => {
          const ev = aluno.evolucao.find(e => e.semestre === s);
          return ev ? ev.mediaSemestre : null;
        });
      };

      const dataA1 = getTrajectory(a1);
      const dataA2 = getTrajectory(a2);
      const dataTurma = DATA.semestresSummary.map(s => s.mediaTurma);

      chartComparatorInstance = new Chart(ctx, {
        type: 'line',
        data: {
          labels: semestres,
          datasets: [
            {
              label: a1.nome,
              data: dataA1,
              borderColor: '#6366f1',
              backgroundColor: '#6366f1',
              pointRadius: 5,
              borderWidth: 3,
              tension: 0.3
            },
            {
              label: a2.nome,
              data: dataA2,
              borderColor: '#10b981',
              backgroundColor: '#10b981',
              pointRadius: 5,
              borderWidth: 3,
              tension: 0.3
            },
            {
              label: 'Média da Turma',
              data: dataTurma,
              borderColor: '#64748b',
              backgroundColor: '#64748b',
              borderDash: [5, 5],
              pointRadius: 3,
              borderWidth: 2,
              tension: 0.3
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false }
          },
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

    document.getElementById('modalStudentRanks').textContent = `#${aluno.rankGeral} Geral • #${aluno.rankGraduacao} Graduação • #${aluno.rankCurso} no Curso`;

    document.getElementById('modalCrGeral').textContent = fmtNum(aluno.mediaGeral);
    document.getElementById('modalRankGeralLabel').textContent = `${aluno.rankGeral}º de 86 alunos`;

    document.getElementById('modalCrGrad').textContent = fmtNum(aluno.mediaGraduacao);
    document.getElementById('modalRankGradLabel').textContent = `${aluno.rankGraduacao}º de 86 alunos`;

    document.getElementById('modalCrMil').textContent = aluno.vinculo === 'CG' ? '-' : fmtNum(aluno.mediaMilitar);
    document.getElementById('modalDisciplinasCount').textContent = aluno.disciplinasConcluidas;
    document.getElementById('modalExtremes').innerHTML = `Max: <strong class="text-emerald-400 font-mono-numbers">${fmtNum(aluno.maiorNota)}</strong> | Min: <strong class="text-rose-400 font-mono-numbers">${fmtNum(aluno.menorNota)}</strong>`;

    document.getElementById('modalDiscTotalCount').textContent = `${aluno.disciplinas.length} matérias cursadas`;

    // Populate Disciplines Table with Parciais VE / VC / VF
    const discBody = document.getElementById('modalDisciplinasBody');
    discBody.innerHTML = aluno.disciplinas.map(d => {
      let deltaBadge = `<span class="text-slate-500 font-mono-numbers">-</span>`;
      if (d.delta !== null && d.delta !== undefined) {
        const sign = d.delta >= 0 ? '+' : '';
        const cls = d.delta >= 0 ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' : 'text-rose-400 bg-rose-500/10 border-rose-500/20';
        deltaBadge = `<span class="px-2 py-0.5 rounded text-[11px] font-bold font-mono-numbers border ${cls}">${sign}${d.delta.toFixed(2)}</span>`;
      }

      const sitCls = d.situacao === 'Aprovado' ? 'text-emerald-400' : (d.situacao === 'Matriculado' ? 'text-amber-400' : 'text-slate-400');

      return `
        <tr class="table-hover-row border-b border-slate-800/40">
          <td class="py-2 px-3 text-slate-400 font-mono-numbers">${d.semestre}</td>
          <td class="py-2 px-2 text-slate-400 font-mono-numbers text-[11px]">${d.codigo}</td>
          <td class="py-2 px-4 font-bold text-slate-200">
            ${d.nome}
            ${d.militar ? '<span class="ml-1.5 px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 text-[10px] font-semibold border border-emerald-500/20">Militar</span>' : ''}
          </td>
          <td class="py-2 px-2 text-center text-slate-400 font-mono-numbers">${d.ve !== null ? fmtNum(d.ve) : '-'}</td>
          <td class="py-2 px-2 text-center text-slate-400 font-mono-numbers">${d.vc !== null ? fmtNum(d.vc) : '-'}</td>
          <td class="py-2 px-2 text-center text-slate-400 font-mono-numbers">${d.vf !== null ? fmtNum(d.vf) : '-'}</td>
          <td class="py-2 px-3 text-right font-extrabold text-indigo-400 font-mono-numbers text-sm">${fmtNum(d.nf)}</td>
          <td class="py-2 px-3 text-right text-slate-400 font-mono-numbers">${fmtNum(d.mediaTurma)}</td>
          <td class="py-2 px-3 text-center">${deltaBadge}</td>
          <td class="py-2 px-3 text-center font-bold text-[11px] ${sitCls}">${d.situacao}</td>
        </tr>
      `;
    }).join('');

    // Render Student Evolution Chart in Modal
    const ctx = document.getElementById('chartModalStudent')?.getContext('2d');
    if (ctx) {
      if (chartModalInstance) chartModalInstance.destroy();

      const semestres = DATA.metadata.semestres;
      const studentVals = semestres.map(s => {
        const ev = aluno.evolucao.find(e => e.semestre === s);
        return ev ? ev.mediaSemestre : null;
      });
      const cursoVals = semestres.map(s => {
        const b = DATA.benchmarkCursosSemestre.find(bc => bc.curso === aluno.curso && bc.semestre === s);
        return b ? b.mediaCurso : null;
      });
      const turmaVals = DATA.semestresSummary.map(s => s.mediaTurma);

      chartModalInstance = new Chart(ctx, {
        type: 'line',
        data: {
          labels: semestres,
          datasets: [
            {
              label: aluno.nome,
              data: studentVals,
              borderColor: '#6366f1',
              backgroundColor: 'rgba(99, 102, 241, 0.1)',
              fill: true,
              pointRadius: 5,
              borderWidth: 3,
              tension: 0.35
            },
            {
              label: `Média ${aluno.curso}`,
              data: cursoVals,
              borderColor: '#10b981',
              pointRadius: 4,
              borderWidth: 2,
              borderDash: [4, 4],
              tension: 0.35
            },
            {
              label: 'Média da Turma',
              data: turmaVals,
              borderColor: '#64748b',
              pointRadius: 3,
              borderWidth: 1.5,
              borderDash: [2, 2],
              tension: 0.35
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

    modal.classList.remove('hidden');
    document.body.classList.add('overflow-hidden');
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
    const headers = ['Rank_Geral', 'Rank_Graduacao', 'Rank_Curso', 'Numero', 'Nome', 'Curso', 'Vinculo', 'CR_Geral_80_20', 'CR_Graduacao', 'CR_Militar', 'Disciplinas_Concluidas', 'Maior_Nota', 'Menor_Nota'];
    const rows = filteredAlunos.map(a => [
      a.rankGeral,
      a.rankGraduacao,
      a.rankCurso,
      a.numero,
      `"${a.nome}"`,
      `"${a.curso}"`,
      a.vinculo,
      a.mediaGeral,
      a.mediaGraduacao,
      a.mediaMilitar !== null ? a.mediaMilitar : '',
      a.disciplinasConcluidas,
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
  // Tabs Navigation
  document.querySelectorAll('#navTabs button').forEach(btn => {
    btn.addEventListener('click', () => {
      const targetTab = btn.getAttribute('data-tab');
      state.currentTab = targetTab;

      // Update button styles
      document.querySelectorAll('#navTabs button').forEach(b => {
        b.classList.remove('active', 'text-indigo-400', 'bg-indigo-500/10', 'border-indigo-500/30');
        b.classList.add('text-slate-400');
      });
      btn.classList.add('active', 'text-indigo-400', 'bg-indigo-500/10', 'border-indigo-500/30');
      btn.classList.remove('text-slate-400');

      // Show tab content
      document.querySelectorAll('.tab-content').forEach(section => section.classList.add('hidden'));
      const activeSection = document.getElementById(`tab-${targetTab}`);
      if (activeSection) {
        activeSection.classList.remove('hidden');
      }

      if (targetTab === 'disciplinas') {
        renderDisciplinasTab();
      } else if (targetTab === 'comparator') {
        initComparator();
      }

      refreshIcons();
    });
  });

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

  document.getElementById('filterCicloDisciplinas')?.addEventListener('change', (e) => {
    state.disciplinasCiclo = e.target.value;
    renderDisciplinasFullTable();
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
            <span class="font-bold text-indigo-400 font-mono-numbers">${fmtNum(a.mediaGeral)}</span>
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
    }
  };

  // Initial Run
  initCharts();
  applyFilters();
  renderDisciplinasTab();
});
