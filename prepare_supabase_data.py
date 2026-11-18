"""Converte o arquivo local data.js (window.IME_DATA = {...}) para data.json
pronto para upload no bucket privado do Supabase Storage.
"""

import json
from pathlib import Path


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
    dst.write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")

    size_mb = dst.stat().st_size / (1024 * 1024)
    alunos = len(payload.get("alunos", []))
    disciplinas = len(payload.get("disciplinas", []))
    print(f"Gerado com sucesso: {dst.name} ({size_mb:.2f} MB | {alunos} alunos | {disciplinas} disciplinas)")
    print("Proximo passo: envie data.json para o bucket privado 'ime-private' no Supabase Storage.")


if __name__ == "__main__":
    main()
