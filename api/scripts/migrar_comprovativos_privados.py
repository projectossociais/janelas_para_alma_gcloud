"""Migração única: copia os comprovativos antigos do bucket R2 **público**
para o privado (`R2_BUCKET_COMPROVATIVOS`) e passa as linhas de
`premium_requests`, `doacoes` e `pedidos_loja_jogo` a guardar a chave em vez
do URL público. Ver `app/services/migracao_comprovativos_service.py`.

    python -m scripts.migrar_comprovativos_privados                 # ensaio
    python -m scripts.migrar_comprovativos_privados --executar
    python -m scripts.migrar_comprovativos_privados --executar --apagar-publicos

Sem `--executar` só lista o que faria. `--apagar-publicos` apaga cada
original do bucket público logo depois de a linha já apontar para a cópia
privada. Pode correr-se várias vezes: só se listam linhas ainda por migrar.
Em produção, correr como Cloud Run Job (`infra/gcloud/08-migrar-comprovativos.sh`):
precisa de `DATABASE_URL` e das credenciais do R2, como a própria API.
"""

import argparse
import sys

from app.core.config import obter_settings
from app.db import SessionLocal
from app.repositories.comprovativos_repository import SQLAlchemyComprovativosRepository
from app.repositories.storage import R2CopiadorComprovativos
from app.services.migracao_comprovativos_service import MigracaoComprovativosService


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--executar", action="store_true", help="copiar e gravar (sem isto, é só um ensaio)")
    parser.add_argument("--apagar-publicos", action="store_true", help="apagar os originais do bucket público")
    args = parser.parse_args(argv)
    if args.apagar_publicos and not args.executar:
        parser.error("--apagar-publicos exige --executar")

    base_publica = obter_settings().r2_public_base_url
    if not base_publica:
        print("recusado: R2_PUBLIC_BASE_URL por configurar.", file=sys.stderr)
        return 1

    with SessionLocal() as sessao:
        servico = MigracaoComprovativosService(
            SQLAlchemyComprovativosRepository(sessao), R2CopiadorComprovativos(), base_publica
        )
        relatorio = servico.migrar(executar=args.executar, apagar_publicos=args.apagar_publicos)

    verbo = "migrados" if args.executar else "a migrar (ensaio)"
    print(f"{verbo}: {len(relatorio.migrados)}")
    for origem, registo_id, motivo in relatorio.ignorados:
        print(f"ignorado (não é um comprovativo nosso): {origem} {registo_id} {motivo}")
    for origem, registo_id, motivo in relatorio.falhados:
        print(f"FALHOU: {origem} {registo_id} {motivo}", file=sys.stderr)
    for chave in relatorio.por_apagar:
        print(f"por apagar do bucket público: {chave}", file=sys.stderr)
    return 1 if relatorio.falhados else 0


if __name__ == "__main__":
    sys.exit(main())
