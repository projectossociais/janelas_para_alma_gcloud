"""A ficha de encaminhamento em PDF enviada à clínica com cada pedido."""

import io
from dataclasses import replace
from datetime import UTC, datetime

from pypdf import PdfReader

from app.services.ficha_encaminhamento import (
    LOGOTIPO_JPA,
    LOGOTIPOS_CLINICAS,
    FichaEncaminhamento,
    gerar_ficha_encaminhamento,
    referencia_do_agendamento,
)

FICHA = FichaEncaminhamento(
    referencia="JPA-3F9C2A7B",
    emitida_em=datetime(2026, 11, 7, 14, 32, tzinfo=UTC),
    clinica_nome="Óptica Optioptika",
    clinica_email="geral@optioptika.com",
    clinica_telefone="+244 931 240 304",
    clinica_cidade="Luanda",
    paciente_nome="Maria da Conceição Domingos",
    paciente_email="maria@example.com",
    paciente_telefone="+244 923 000 000",
    conta_registada=True,
    modalidade="online",
    horario_inicio=datetime(2026, 11, 16, 7, 30, tzinfo=UTC),  # 08:30 em Luanda
    duracao_minutos=30,
    motivo="Olho que desvia para dentro quando está cansado.",
    rastreio_associado=True,
)


def _texto(pdf: bytes) -> tuple[int, str]:
    leitor = PdfReader(io.BytesIO(pdf))
    return len(leitor.pages), " ".join(p.extract_text() for p in leitor.pages)


def test_uma_pagina_com_todos_os_dados_do_pedido() -> None:
    paginas, texto = _texto(gerar_ficha_encaminhamento(FICHA))
    assert paginas == 1
    for esperado in (
        "Ficha de Encaminhamento para Consulta",
        "JPA-3F9C2A7B",
        "www.janelasparaalma.com",
        "Online (teleconsulta por vídeo)",
        "segunda-feira, 16/11/2026",
        "08:30 (hora de Luanda)",
        "Maria da Conceição Domingos",
        "+244 923 000 000",
        "maria@example.com",
        "Olho que desvia para dentro",
        "Lei n.º 22/11",
        "não substitui um diagnóstico",
        "Olhar Alinhado, Comércio e Prestação de Serviços, Lda.",
        "NIF 5003659364",
        "Capital social 25.000,00 Kz",
        "não realiza actos clínicos",
    ):
        assert esperado in texto, esperado


def test_um_emoji_no_motivo_nunca_rebenta_a_geracao() -> None:
    pdf = gerar_ficha_encaminhamento(replace(FICHA, motivo="Dor nos olhos 😢 e visão dupla"))
    assert "visão dupla" in _texto(pdf)[1]


def test_clinica_sem_logotipo_mostra_o_nome() -> None:
    pdf = gerar_ficha_encaminhamento(replace(FICHA, clinica_nome="Clínica Nova Visão"))
    assert "Clínica Nova Visão" in _texto(pdf)[1]


def test_sem_motivo_diz_nao_indicado() -> None:
    assert "Não indicado" in _texto(gerar_ficha_encaminhamento(replace(FICHA, motivo="   ")))[1]


def test_logotipos_existem_no_pacote() -> None:
    assert LOGOTIPO_JPA.exists()
    assert all(caminho.exists() for caminho in LOGOTIPOS_CLINICAS.values())


def test_referencia_curta_e_estavel() -> None:
    assert referencia_do_agendamento("3f9c2a7b-1d4e-4c8a-9b2f-6a1e5d7c8b90") == "JPA-3F9C2A7B"


def test_motivo_no_tamanho_maximo_continua_numa_pagina() -> None:
    # O formulário aceita até 500 caracteres no motivo.
    paginas, _ = _texto(gerar_ficha_encaminhamento(replace(FICHA, motivo="Visão turva ao fim do dia. " * 18)))
    assert paginas == 1
