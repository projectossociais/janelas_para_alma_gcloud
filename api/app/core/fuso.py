"""Dia do calendário de Luanda, para regras "uma vez por dia" (lembretes,
bónus de assiduidade). Angola não tem hora de Verão: WAT é sempre UTC+1; um
offset fixo evita depender da base de dados de fusos (tzdata) no Windows."""

from datetime import UTC, date, datetime, timedelta, timezone

FUSO_LUANDA = timezone(timedelta(hours=1))


def dia_em_luanda(momento: datetime) -> date:
    return momento.astimezone(FUSO_LUANDA).date()


def inicio_do_dia_em_luanda(momento: datetime) -> datetime:
    """Meia-noite desse dia em Luanda, em UTC."""
    local = momento.astimezone(FUSO_LUANDA)
    return local.replace(hour=0, minute=0, second=0, microsecond=0).astimezone(UTC)
