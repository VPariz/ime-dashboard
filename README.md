# 🎓 Dashboard de Desempenho Acadêmico e Militar • IME (Turma 2026)

Dashboard executivo moderno, responsivo e de alta performance desenvolvido para análise detalhada do desempenho acadêmico e militar dos 86 alunos do Instituto Militar de Engenharia (IME).

Projetado especificamente para rodar **100% no navegador** (Client-Side) e ser hospedado gratuitamente no **GitHub Pages** sem necessidade de backend, Node.js ou banco de dados externo.

---

## 🚀 Funcionalidades

- **Cálculo Oficial Ponderado (80/20)**:
  - $\text{CR Geral} = 0.80 \times \text{Graduação} + 0.20 \times \text{Militar}$ (para Ativa e Reserva).
  - Alunos **CG** são avaliados com $100\%$ de Graduação militarmente desacoplada.
- **10 Especialidades de Engenharia Reais**:
  - Computação, Fortificação e Construção, Cartografia, Eletrônica, Química, Comunicações, Mecânica de Armamento, Mecânica de Automóveis, Elétrica e Materiais.
- **Filtros Globais em Tempo Real**:
  - Filtro por Especialidade, Vínculo (Ativa, Reserva, CG) e busca textual instantânea sem recarregar a página.
- **4 Cartões Executivos (KPIs)**:
  - CR Geral Médio, CR Graduação, CR Militar e contagem dinâmica de alunos selecionados.
- **Gráficos Interativos (Chart.js)**:
  - Média por Engenharia (barra horizontal ordenada).
  - Evolução Semestral (trajetória histórica 1.1 ao 2026.1).
  - Distribuição da Turma por Vínculo (donut).
  - Histograma de densidade de notas e faixas de rendimento.
- **Tabela Dinâmica dos 86 Alunos**:
  - Ordenação por qualquer coluna (clique no cabeçalho), busca instantânea, badges coloridos e paginação.
- **Ficha Individual do Aluno (Modal)**:
  - Clique em qualquer aluno para abrir seu histórico completo: CRs, posições relativas, gráfico de evolução pessoal comparado com a turma e curso, e todas as notas com indicador de Delta (+/- em relação à média da matéria).
- **Raio-X das 112 Disciplinas**:
  - Top 10 matérias mais difíceis (menores médias) vs Top 10 maiores médias.
  - Tabela com média histórica, desvio padrão e notas extremas (menor e maior nota).
- **Comparador 1x1 (Head-to-Head)**:
  - Seleção de dois alunos para confronto direto de médias, trajetória e disciplinas.
- **Exportação de Dados**:
  - Download imediato da visualização filtrada em arquivo CSV.

---

## 🛠️ Como Testar Localmente

Basta abrir o arquivo `index.html` diretamente em qualquer navegador (Google Chrome, Edge, Firefox, Safari):

```bash
# Opção 1: Abrir diretamente no navegador (dois cliques em index.html)

# Opção 2: Ou usando o servidor HTTP leve do Python
cd ime-dashboard
python -m http.server 8000
# Acesse no navegador: http://localhost:8000
```

---

## 🌐 Como Publicar no GitHub Pages (Passo a Passo)

1. Crie um novo repositório no seu GitHub (ex: `ime-dashboard` ou `turma-2026-dashboard`).
2. No seu terminal, dentro da pasta `ime-dashboard`, inicialize e envie os arquivos:

```bash
git init
git add .
git commit -m "feat: initial commit do dashboard IME para GitHub Pages"
git branch -M main
git remote add origin https://github.com/<SEU_USUARIO>/ime-dashboard.git
git push -u origin main
```

3. **Ativar o GitHub Pages**:
   - Acesse o repositório no GitHub: `https://github.com/<SEU_USUARIO>/ime-dashboard`
   - Clique em **Settings** (Configurações) -> no menu lateral esquerdo clique em **Pages**.
   - Em **Build and deployment** -> **Source**, selecione: **Deploy from a branch**.
   - Em **Branch**, selecione `main` e pasta `/ (root)`. Clique em **Save**.
   - Em 1 a 2 minutos seu dashboard estará online no link:
     `https://<SEU_USUARIO>.github.io/ime-dashboard/`

---

## 📁 Estrutura dos Arquivos

```text
ime-dashboard/
├── index.html        # Estrutura completa da interface, modais e layout
├── app.js            # Lógica dos filtros, renderização dos gráficos e modais
├── styles.css        # Tema dark executivo, glassmorphism e badges
├── data.js           # Base de dados estruturada dos 86 alunos e disciplinas
├── .gitignore        # Arquivos ignorados pelo Git
└── README.md         # Documentação e guia de implantação
```
