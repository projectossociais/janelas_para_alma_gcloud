"""Dados de teste **só para a base de dados local** (docker compose).

    docker compose exec api python -m scripts.dados_teste_locais

Cria (ou actualiza, pode correr-se várias vezes):
- a clínica parceira Óptica Optioptika, activa, presencial e online;
- disponibilidade semanal de segunda a sábado, 09:00-12:00 e 14:00-17:00 (hora de
  Luanda), nas duas modalidades, para a marcação ter horários reais;
- uma conta de teste já confirmada: teste@local.ao / Teste-local-2026

Recusa correr se `DATABASE_URL` não apontar para a base local: nunca produção.
"""

import sys
from datetime import time
from urllib.parse import urlparse

from sqlalchemy import delete, select

from app.core.config import obter_settings
from app.core.security import hash_password
from app.db import SessionLocal
from app.repositories.orm_models import AppRole, ClinicaParceira, DisponibilidadeClinica, Utilizador

HOSTS_LOCAIS = {"db", "localhost", "127.0.0.1"}
EMAIL_TESTE = "teste@local.ao"
PASSWORD_TESTE = "Teste-local-2026"
JANELAS = ((time(9, 0), time(12, 0)), (time(14, 0), time(17, 0)))


def e_base_local(database_url: str) -> bool:
    return urlparse(database_url.replace("+psycopg", "")).hostname in HOSTS_LOCAIS


def main() -> int:
    url = obter_settings().database_url
    if not e_base_local(url):
        print(f"recusado: DATABASE_URL não é local ({urlparse(url).hostname}).", file=sys.stderr)
        return 1

    sessao = SessionLocal()
    try:
        clinica = sessao.scalar(select(ClinicaParceira).where(ClinicaParceira.nome == "Óptica Optioptika"))
        if clinica is None:
            clinica = ClinicaParceira(
                nome="Óptica Optioptika",
                email_contacto="geral@optioptika.com",
                telefone_contacto="+244 931 240 304",
            )
            sessao.add(clinica)
        clinica.ativa = True
        clinica.cidade = "Luanda"
        clinica.modalidades_suportadas = ["presencial", "online"]
        sessao.flush()

        sessao.execute(delete(DisponibilidadeClinica).where(DisponibilidadeClinica.clinica_id == clinica.id))
        for dia in range(6):  # 0 = segunda ... 5 = sábado
            for inicio, fim in JANELAS:
                for modalidade in ("presencial", "online"):
                    sessao.add(
                        DisponibilidadeClinica(
                            clinica_id=clinica.id, dia_semana=dia, hora_inicio=inicio, hora_fim=fim, modalidade=modalidade
                        )
                    )

        utilizador = sessao.scalar(select(Utilizador).where(Utilizador.email == EMAIL_TESTE))
        if utilizador is None:
            utilizador = Utilizador(email=EMAIL_TESTE, password_hash=hash_password(PASSWORD_TESTE), papel=AppRole.estrabico)
            sessao.add(utilizador)
        utilizador.nome_completo = "Conta de Teste"
        utilizador.telefone = "923 000 000"
        utilizador.email_confirmado = True

        sessao.commit()
    finally:
        sessao.close()

    print("Pronto: clínica Óptica Optioptika com horários (seg-sáb, 09-12 e 14-17, hora de Luanda).")
    print(f"Conta de teste confirmada: {EMAIL_TESTE} / {PASSWORD_TESTE}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
