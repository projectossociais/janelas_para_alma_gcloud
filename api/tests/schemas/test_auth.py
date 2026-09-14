"""Testes da política de força de password (AUTH-01) — única implementação
partilhada por registo, mudar-password e redefinir-password (ver
schemas/auth.py, schemas/conta.py). Nunca testada directamente antes: as
regras de comprimento, letra e número tinham zero cobertura própria, só o
caminho feliz por acidente através dos testes de registo.
"""

import pytest
from pydantic import ValidationError

from app.schemas.auth import UtilizadorCriar, validar_password_forte


def test_aceita_uma_password_com_letra_numero_e_comprimento_suficiente() -> None:
    assert validar_password_forte("password123") == "password123"


def test_recusa_password_demasiado_curta() -> None:
    with pytest.raises(ValueError, match="pelo menos 8 caracteres"):
        validar_password_forte("abc123")


def test_recusa_password_so_com_numeros() -> None:
    with pytest.raises(ValueError, match="pelo menos uma letra"):
        validar_password_forte("12345678")


def test_recusa_password_so_com_letras() -> None:
    with pytest.raises(ValueError, match="pelo menos um número"):
        validar_password_forte("abcdefgh")


def test_utilizador_criar_recusa_password_fraca_com_422() -> None:
    with pytest.raises(ValidationError):
        UtilizadorCriar(email="ana@example.com", password="12345678")


def test_utilizador_criar_aceita_password_conforme() -> None:
    utilizador = UtilizadorCriar(email="ana@example.com", password="password123")
    assert utilizador.password == "password123"
