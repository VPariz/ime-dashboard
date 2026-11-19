"""Converte o arquivo local data.js ou data.json (Turma 28) para data.json + data.json.gz
e gera JSONs iniciais (.json e .json.gz) em starter_turmas/ para as Turmas 29, 30 e 31.
Se existir starter_turmas/turma_XX_alunos.txt (gitignored), já pré-cadastra os alunos.
"""

import gzip
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

TURMAS_EXTRA = [
    ("turma_29", "Turma 29", "2.2", ["1.1", "1.2", "2.1", "2.2"], 29000),
    ("turma_30", "Turma 30", "1.2", ["1.1", "1.2"], 30000),
    ("turma_31", "Turma 31", "1.1", ["1.1"], 31000),
]


def sem_label(sem: str) -> str:
    ano, per = (int(x) for x in sem.split("."))
    ordem = ano * 2 - (1 if per == 1 else 0)
    return f"{ordem}º Semestre ({sem})"


def anonymize_dataset_payload(payload: dict) -> dict:
    """Substitui nome e nomeGuerra por 'Aluno #<numero>' mantendo numero, notas, curso e vínculo."""
    name_to_anon: dict[str, str] = {}
    for aluno in payload.get("alunos", []):
        num = int(aluno["numero"])
        anon_label = f"Aluno #{num}"
        raw_nome = str(aluno.get("nome") or "").strip()
        raw_guerra = str(aluno.get("nomeGuerra") or "").strip()
        if raw_nome:
            name_to_anon[raw_nome.upper()] = anon_label
        if raw_guerra:
            name_to_anon[raw_guerra.upper()] = anon_label
        aluno["nome"] = anon_label
        if "nomeGuerra" in aluno:
            aluno["nomeGuerra"] = anon_label

    for comp in payload.get("cursosComparativo", []):
        best = str(comp.get("melhorAluno") or "").strip()
        if best and best != "-":
            comp["melhorAluno"] = name_to_anon.get(best.upper(), "Aluno Anônimo")

    return payload


def build_alunos_from_txt(txt_path: Path, base_num: int, sem_ord: int) -> list[dict]:
    if not txt_path.exists():
        return []
    names = [line.strip() for line in txt_path.read_text(encoding="utf-8").splitlines() if line.strip()]
    curso_padrao = "Ciclo Básico" if sem_ord <= 4 else CURSOS_PADRAO[0]
    alunos = []
    for idx, _nome in enumerate(names, start=1):
        num = base_num + idx
        alunos.append({
            "numero": num,
            "nome": f"Aluno #{num}",
            "curso": curso_padrao,
            "cg": False,
            "reserva": False,
            "vinculo": "Ativa",
            "mediaGraduacao": 0,
            "mediaGeral": 0,
            "mediaMilitar": 0,
            "media32": None,
            "concluidas": 0,
            "matriculadas": 0,
            "totalDisciplinas": 0,
            "maiorNota": 0,
            "menorNota": 0,
            "evolucao": [],
            "disciplinas": [],
            "rankGraduacao": idx,
            "rankGeral": idx,
            "rankCurso": idx,
        })
    return alunos


def write_json_and_gzip(dst: Path, payload: dict) -> tuple[int, int]:
    anonymize_dataset_payload(payload)
    raw_bytes = json.dumps(payload, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    dst.write_bytes(raw_bytes)
    gz_dst = dst.with_name(f"{dst.name}.gz")
    gz_bytes = gzip.compress(raw_bytes, compresslevel=9)
    gz_dst.write_bytes(gz_bytes)
    return len(raw_bytes), len(gz_bytes)


def main() -> None:
    base_dir = Path(__file__).resolve().parent
    src_js = base_dir / "data.js"
    dst = base_dir / "data.json"

    if src_js.exists():
        raw = src_js.read_text(encoding="utf-8")
        start = raw.find("{")
        end = raw.rfind("}")
        if start == -1 or end == -1 or end <= start:
            raise ValueError("Não foi possível localizar o objeto JSON dentro de data.js")
        payload = json.loads(raw[start : end + 1])
    elif dst.exists():
        payload = json.loads(dst.read_text(encoding="utf-8"))
    else:
        raise FileNotFoundError(f"Nenhum dataset fonte encontrado ({src_js} ou {dst})")

    payload.setdefault("metadata", {})
    payload["metadata"]["turma"] = "Turma 28"
    payload["metadata"]["semestreAtual"] = "3.2"

    raw_len, gz_len = write_json_and_gzip(dst, payload)
    print(
        f"Turma 28 -> {dst.name} ({raw_len / 1024:.0f} KB) + {dst.name}.gz ({gz_len / 1024:.0f} KB) | "
        f"{len(payload.get('alunos', []))} alunos"
    )

    starter_dir = base_dir / "starter_turmas"
    starter_dir.mkdir(exist_ok=True)
    for tid, tname, cur_sem, sems, base_num in TURMAS_EXTRA:
        ano, per = (int(x) for x in cur_sem.split("."))
        sem_ord = ano * 2 - (1 if per == 1 else 0)
        alunos = build_alunos_from_txt(starter_dir / f"{tid}_alunos.txt", base_num, sem_ord)
        cursos_meta = ["Ciclo Básico"] if (alunos and sem_ord <= 4) else payload["metadata"].get("cursos", CURSOS_PADRAO)
        obj = {
            "metadata": {
                "titulo": f"Dashboard de Desempenho Acadêmico e Militar • {tname}",
                "turma": tname,
                "semestreAtual": cur_sem,
                "totalAlunos": len(alunos),
                "totalDisciplinas": 0,
                "mediaGraduacaoTurma": 0,
                "mediaGeralTurma": 0,
                "mediaMilitarTurma": 0,
                "cursos": cursos_meta,
                "semestres": sems,
                "semestresNomes": {s: sem_label(s) for s in sems},
                "vinculos": {"Ativa": len(alunos), "Reserva": 0, "CG": 0},
            },
            "cursosComparativo": [],
            "semestresBenchmark": [],
            "disciplinas": [],
            "alunos": alunos,
        }
        out = starter_dir / f"{tid}_data.json"
        s_raw, s_gz = write_json_and_gzip(out, obj)
        print(
            f"{tname} (sem. {cur_sem} | {len(alunos)} alunos) -> starter_turmas/{out.name} "
            f"({s_raw / 1024:.1f} KB) + .gz ({s_gz / 1024:.1f} KB)"
        )


if __name__ == "__main__":
    main()
