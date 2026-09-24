"""Semeia à mão a reserva de perguntas do jogo "Inclusivamente".

Desde 2026-09-24 já não é preciso: a migração Alembic `e5b1c8d2a4f7` semeia e
categoriza as perguntas no `alembic upgrade head` do deploy automático, e
`JogoService` semeia sozinho se um nível estiver vazio. Fica para quem
queira correr o seed fora desse fluxo -- os dados e a lógica vivem em
`app/repositories/reserva_perguntas_jogo.py` (idempotente: não duplica
nada e acerta a categoria das perguntas que já existem).

    python -m scripts.seed_maciço_perguntas

Corre contra a base de dados apontada por `DATABASE_URL` -- não corre
contra produção sem intenção explícita.
"""

from app.db import SessionLocal
from app.repositories.reserva_perguntas_jogo import PERGUNTAS, semear_perguntas

__all__ = ["PERGUNTAS", "main"]


def main() -> int:
    sessao = SessionLocal()
    try:
        resultado = semear_perguntas(sessao.connection())
        sessao.commit()
    finally:
        sessao.close()
    print(
        f"{resultado.inseridas} perguntas inseridas, {resultado.categorias_corrigidas} categorias corrigidas, "
        f"{resultado.inalteradas} já estavam em dia."
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
