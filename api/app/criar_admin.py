"""Cria o primeiro administrador — o arranque a frio do painel.

    python -m app.criar_admin <email>

A base de dados nasce sem admins e ninguém se pode auto-registar como admin
(o schema de registo só aceita papéis não-privilegiados). Este comando é a
única forma de fazer o primeiro; a partir daí, um admin promove outros pelo
painel (`POST /admin/utilizadores/promover`).

A conta tem de já existir (registada normalmente). Corre contra a base de
dados apontada por `DATABASE_URL` — **nunca** correr contra produção sem
intenção explícita.
"""

import sys

from app.db import SessionLocal
from app.repositories.admin_repository import AdminRepository, SQLAlchemyAdminRepository


def promover_email_a_admin(repo: AdminRepository, email: str) -> tuple[int, str]:
    """Núcleo testável: devolve (código de saída, mensagem)."""
    alvo = repo.obter_por_email(email)
    if alvo is None:
        return 1, f"não há nenhuma conta com o email {email!r} — registe-a primeiro na app."
    if alvo.papel == "admin":
        return 0, f"{email} já é admin. Nada a fazer."
    repo.definir_papel(alvo.id, "admin")
    return 0, f"{email} é agora admin."


def main(argv: list[str]) -> int:
    if len(argv) != 1:
        print("uso: python -m app.criar_admin <email>", file=sys.stderr)
        return 2

    email = argv[0].strip().lower()
    sessao = SessionLocal()
    try:
        codigo, mensagem = promover_email_a_admin(SQLAlchemyAdminRepository(sessao), email)
    finally:
        sessao.close()
    print(mensagem, file=sys.stderr if codigo == 1 else sys.stdout)
    return codigo


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
