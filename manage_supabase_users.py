"""Gerenciador local de contas dos alunos no Supabase Auth (somente Super Admin).

Gera logins no padrão:
  - Nome composto/completo: "Pedro Silva 29" -> senha_Pedro_Silva_29
  - Nome de guerra (1 palavra): "Papaleo 28" -> senha_Papaleo_28

Uso:
  # 1) Prévia local sem enviar nada (não precisa de chaves)
  python manage_supabase_users.py preview --turma turma_28 --file data.json

  # 2) Criar contas reais no Supabase Auth + user_roles (exige SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY)
  python manage_supabase_users.py provision --turma turma_28 --file data.json

  # 3) Resetar senha de um aluno que perdeu o acesso
  python manage_supabase_users.py reset --login "Papaleo 28"
"""

import argparse
import csv
import json
import os
import re
import sys
import unicodedata
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path


def strip_accents(text: str) -> str:
    return "".join(
        ch for ch in unicodedata.normalize("NFD", str(text or ""))
        if unicodedata.category(ch) != "Mn"
    )


def title_word(word: str) -> str:
    return word[:1].upper() + word[1:].lower() if word else ""


def build_default_credentials(nome: str, turma_id: str) -> dict:
    m = re.search(r"\d+", str(turma_id or ""))
    turma_num = m.group(0) if m else "28"
    words = [w for w in re.sub(r"[^a-zA-Z0-9\s]", " ", strip_accents(nome)).split() if w]
    if len(words) >= 2:
        selected = [title_word(words[0]), title_word(words[-1])]
    else:
        selected = [title_word(words[0] if words else "Aluno")]

    login_display = " ".join([*selected, turma_num])
    underscore = "_".join([*selected, turma_num])
    return {
        "username": login_display,
        "email": f"{underscore.lower()}@ime.local",
        "password": f"senha_{underscore}",
    }


def normalize_login_to_email(raw_login: str) -> str:
    s = str(raw_login or "").strip()
    if "@" in s:
        return s.lower()
    under = re.sub(r"\s+", "_", re.sub(r"[^a-zA-Z0-9\s_]", "", strip_accents(s)).strip())
    return f"{under.lower()}@ime.local"


def load_alunos(file_path: Path, full_names_csv: Path | None = None) -> list[dict]:
    raw = file_path.read_text(encoding="utf-8")
    start = raw.find("{")
    end = raw.rfind("}")
    data = json.loads(raw[start : end + 1])
    alunos = data.get("alunos", [])

    name_override = {}
    if full_names_csv and full_names_csv.exists():
        with full_names_csv.open("r", encoding="utf-8-sig", newline="") as f:
            reader = csv.DictReader(f)
            for row in reader:
                num = row.get("Matricula") or row.get("matricula") or row.get("numero")
                nome = row.get("NomeCompleto") or row.get("Nome") or row.get("nome")
                if num and nome:
                    name_override[int(str(num).strip())] = nome.strip()

    out = []
    for a in alunos:
        num = int(a["numero"])
        out.append({"numero": num, "nome": name_override.get(num, a["nome"])})
    return out


def sb_request(base_url: str, service_key: str, method: str, path: str, body: dict | list | None = None) -> dict | list:
    url = f"{base_url.rstrip('/')}{path}"
    data = json.dumps(body).encode("utf-8") if body is not None else None
    headers = {
        "apikey": service_key,
        "Authorization": f"Bearer {service_key}",
        "Content-Type": "application/json",
    }
    if path.startswith("/rest/v1/"):
        headers["Prefer"] = "resolution=merge-duplicates,return=representation"
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=20) as resp:
            text = resp.read().decode("utf-8")
            return json.loads(text) if text else {}
    except urllib.error.HTTPError as e:
        err_text = e.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"HTTP {e.code} em {path}: {err_text}") from e


def require_env() -> tuple[str, str]:
    url = os.environ.get("SUPABASE_URL", "").strip()
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "").strip()
    if not url or not key:
        print("Erro: defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no ambiente.", file=sys.stderr)
        sys.exit(1)
    return url, key


def cmd_preview(args: argparse.Namespace) -> None:
    alunos = load_alunos(Path(args.file), Path(args.csv) if args.csv else None)
    seen = set()
    rows = []
    for a in alunos:
        creds = build_default_credentials(a["nome"], args.turma)
        if creds["email"] in seen:
            base = re.sub(r"\s+(\d+)$", f" {a['numero']} \\1", creds["username"])
            under = base.replace(" ", "_")
            creds = {
                "username": base,
                "email": f"{under.lower()}@ime.local",
                "password": f"senha_{under}",
            }
        seen.add(creds["email"])
        rows.append((a["numero"], a["nome"], creds["username"], creds["password"], creds["email"]))

    print(f"Prévia de {len(rows)} credenciais para {args.turma}:")
    for r in rows[:20]:
        print(f"  Nº {r[0]} | {r[1]:<22} -> Login: {r[2]:<22} | Senha: {r[3]}")
    if len(rows) > 20:
        print(f"  ... (+{len(rows) - 20} alunos)")

    if args.out_csv:
        with Path(args.out_csv).open("w", encoding="utf-8", newline="") as f:
            w = csv.writer(f)
            w.writerow(["Matricula", "NomeDataset", "Login", "SenhaPadrao", "EmailInterno"])
            w.writerows(rows)
        print(f"Exportado em {args.out_csv} (NÃO suba este arquivo para o GitHub!).")


def cmd_provision(args: argparse.Namespace) -> None:
    url, key = require_env()
    alunos = load_alunos(Path(args.file), Path(args.csv) if args.csv else None)
    existing = sb_request(url, key, "GET", f"/rest/v1/user_roles?select=user_id,email,aluno_numero&turma_id=eq.{urllib.parse.quote(args.turma)}")
    by_num = {int(r["aluno_numero"]): r["user_id"] for r in existing if r.get("aluno_numero") is not None}
    used_emails = {str(r["email"]).lower() for r in existing if r.get("email")}

    created = 0
    skipped = 0
    for a in alunos:
        if a["numero"] in by_num:
            skipped += 1
            continue
        creds = build_default_credentials(a["nome"], args.turma)
        if creds["email"] in used_emails:
            base = re.sub(r"\s+(\d+)$", f" {a['numero']} \\1", creds["username"])
            under = base.replace(" ", "_")
            creds = {"username": base, "email": f"{under.lower()}@ime.local", "password": f"senha_{under}"}

        try:
            u = sb_request(url, key, "POST", "/auth/v1/admin/users", {
                "email": creds["email"],
                "password": creds["password"],
                "email_confirm": True,
                "user_metadata": {"username": creds["username"], "turma_id": args.turma, "aluno_numero": a["numero"]},
            })
            uid = u["id"]
            sb_request(url, key, "POST", "/rest/v1/user_roles?on_conflict=user_id", {
                "user_id": uid,
                "email": creds["email"],
                "username": creds["username"],
                "role": "viewer",
                "turma_id": args.turma,
                "aluno_numero": a["numero"],
                "must_change_password": True,
            })
            used_emails.add(creds["email"])
            created += 1
            print(f"[OK] {creds['username']} ({creds['password']})")
        except Exception as exc:
            skipped += 1
            print(f"[SKIP] Nº {a['numero']} {a['nome']}: {exc}", file=sys.stderr)

    print(f"Concluído: {created} criado(s), {skipped} ignorado(s).")


def cmd_reset(args: argparse.Namespace) -> None:
    url, key = require_env()
    email = normalize_login_to_email(args.login)
    rows = sb_request(url, key, "GET", f"/rest/v1/user_roles?select=user_id,email,username&email=eq.{urllib.parse.quote(email)}")
    if not rows:
        print(f"Usuário não encontrado para login '{args.login}' ({email}).", file=sys.stderr)
        sys.exit(1)

    target = rows[0]
    uid = target["user_id"]
    if args.password:
        next_pw = args.password
    else:
        uname = target.get("username") or args.login
        under = re.sub(r"\s+", "_", strip_accents(uname).strip())
        next_pw = f"senha_{under}"

    sb_request(url, key, "PUT", f"/auth/v1/admin/users/{uid}", {"password": next_pw})
    sb_request(url, key, "PATCH", f"/rest/v1/user_roles?user_id=eq.{uid}", {"must_change_password": True})
    print(f"Senha redefinida para {target.get('username') or email}: {next_pw} (troca obrigatória no próximo login).")


def main() -> None:
    p = argparse.ArgumentParser(description="Gerenciar contas de alunos no Supabase")
    sub = p.add_subparsers(dest="cmd", required=True)

    p_prev = sub.add_parser("preview", help="Ver logins e senhas padrão gerados localmente")
    p_prev.add_argument("--turma", required=True, help="Ex: turma_28")
    p_prev.add_argument("--file", required=True, help="Caminho para data.json ou data.js")
    p_prev.add_argument("--csv", help="CSV opcional (Matricula,NomeCompleto)")
    p_prev.add_argument("--out-csv", help="Salvar prévia em CSV local")
    p_prev.set_defaults(func=cmd_preview)

    p_prov = sub.add_parser("provision", help="Criar contas reais no Supabase Auth + user_roles")
    p_prov.add_argument("--turma", required=True, help="Ex: turma_28")
    p_prov.add_argument("--file", required=True, help="Caminho para data.json ou data.js")
    p_prov.add_argument("--csv", help="CSV opcional (Matricula,NomeCompleto)")
    p_prov.set_defaults(func=cmd_provision)

    p_res = sub.add_parser("reset", help="Resetar senha de um aluno (volta para senha padrão ou definida)")
    p_res.add_argument("--login", required=True, help='Login (ex: "Pedro Silva 29" ou "Papaleo 28") ou e-mail')
    p_res.add_argument("--password", help="Senha temporária opcional (se omitida, usa senha_Nome_Turma)")
    p_res.set_defaults(func=cmd_reset)

    args = p.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
