"""Converte o arquivo local data.js (Turma 28) para data.json e gera JSONs
iniciais vazios em starter_turmas/ para as Turmas 29, 30 e 31 (entrada 2027).
"""

import json
from pathlib import Path

CURSOS_PADRAO = [
    "Computação",
    "Mecânica de Automóveis",
    "Química",
    "Elétrica",
    "Materiais",
    "Cartografia",
    "Mecânica de Armamento",
    "Fortificação e Construção",
    "Eletrônica",
    "Comunicações",
]

TURMAS_VAZIAS = [
    ("turma_29", "Turma 29", "2.2", ["1.1", "1.2", "2.1", "2.2"]),
    ("turma_30", "Turma 30", "1.2", ["1.1", "1.2"]),
    ("turma_31", "Turma 31", "1.1", ["1.1"]),
]


def sem_label(sem: str) -> str:
    ano, per = (int(x) for x in sem.split("."))
    ordem = ano * 2 - (1 if per == 1 else 0)
    return f"{ordem}º Semestre ({sem})"


def main() -> None:
    base_dir = Path(__file__).resolve().parent
    src = base_dir / "data.js"
    dst = base_dir / "data.json"

    if not src.exists():
        raise FileNotFoundError(f"Arquivo não encontrado: {src}")

    raw = src.read_text(encoding="utf-8")
    start = raw.find("{")
    end = raw.rfind("}")
    if start == -1 or end == -1 or end <= start:
        raise ValueError("Não foi possível localizar o objeto JSON dentro de data.js")

    payload = json.loads(raw[start : end + 1])
    payload.setdefault("metadata", {})
    payload["metadata"]["turma"] = "Turma 28"
    payload["metadata"]["semestreAtual"] = "3.2"

    dst.write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    size_mb = dst.stat().st_size / (1024 * 1024)
    print(f"Turma 28 -> {dst.name} ({size_mb:.2f} MB | {len(payload.get('alunos', []))} alunos)")

    starter_dir = base_dir / "starter_turmas"
    starter_dir.mkdir(exist_ok=True)
    for tid, tname, cur_sem, sems in TURMAS_VAZIAS:
        empty_obj = {
            "metadata": {
                "titulo": f"Dashboard de Desempenho Acadêmico e Militar • {tname}",
                "turma": tname,
                "semestreAtual": cur_sem,
                "totalAlunos": 0,
                "totalDisciplinas": 0,
                "mediaGraduacaoTurma": 0,
                "mediaGeralTurma": 0,
                "mediaMilitarTurma": 0,
                "cursos": payload["metadata"].get("cursos", CURSOS_PADRAO),
                "semestres": sems,
                "semestresNomes": {s: sem_label(s) for s in sems},
                "vinculos": {"Ativa": 0, "Reserva": 0, "CG": 0},
            },
            "cursosComparativo": [],
            "semestresBenchmark": [],
            "disciplinas": [],
            "alunos": [],
        }
        out = starter_dir / f"{tid}_data.json"
        out.write_text(json.dumps(empty_obj, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
        print(f"{tname} (starter vazio, sem. {cur_sem}) -> starter_turmas/{out.name}")


if __name__ == "__main__":
    main()
