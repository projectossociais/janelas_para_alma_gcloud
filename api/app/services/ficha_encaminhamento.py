"""Ficha de encaminhamento em PDF, enviada à clínica parceira com cada pedido
de consulta (presencial ou online) feito na plataforma.

Diz à clínica quem pediu, para quando, porquê, e que o pedido chegou pela
Janelas Para a Alma -- com as marcas das duas partes e o aviso legal do
tratamento de dados (Lei n.º 22/11, de 17 de Junho: o motivo da consulta é um
dado de saúde, logo sensível).

Para acrescentar o logótipo de uma clínica nova: o PNG em
`app/assets/clinicas/` e uma linha em `LOGOTIPOS_CLINICAS`. Sem logótipo, a
ficha mostra o nome da clínica no lugar dele.
"""

from dataclasses import dataclass
from datetime import datetime
from pathlib import Path

from fpdf import FPDF

from app.core.fuso import FUSO_LUANDA

_ASSETS = Path(__file__).resolve().parent.parent / "assets"
LOGOTIPO_JPA = _ASSETS / "logo-janelas-para-a-alma.png"
LOGOTIPOS_CLINICAS = {
    "Óptica Optioptika": _ASSETS / "clinicas" / "optioptika.png",
}

SITE = "www.janelasparaalma.com"
EMAIL_JPA = "janelasparaalma18@gmail.com"
TELEFONE_JPA = "+244 926 969 819"

_NAVY = (10, 44, 76)
_TEAL = (23, 169, 139)
_TEAL_CLARO = (234, 246, 243)
_CINZA = (91, 107, 122)
_LINHA = (220, 226, 230)

_DIAS = ("segunda-feira", "terça-feira", "quarta-feira", "quinta-feira", "sexta-feira", "sábado", "domingo")
_MODALIDADES = {"presencial": "Presencial (na clínica)", "online": "Online (teleconsulta por vídeo)"}


@dataclass(frozen=True)
class FichaEncaminhamento:
    referencia: str
    emitida_em: datetime
    clinica_nome: str
    clinica_email: str
    clinica_telefone: str
    clinica_cidade: str | None
    paciente_nome: str
    paciente_email: str
    paciente_telefone: str
    conta_registada: bool
    modalidade: str
    horario_inicio: datetime
    duracao_minutos: int
    motivo: str | None
    rastreio_associado: bool


def referencia_do_agendamento(agendamento_id: str) -> str:
    return f"JPA-{agendamento_id.replace('-', '')[:8].upper()}"


def _texto(valor: str) -> str:
    """As fontes base do PDF só têm o alfabeto latino (cp1252): um emoji ou
    caracter fora dele no nome ou no motivo passa a "?" em vez de rebentar
    a geração -- e com ela o pedido do paciente."""
    return valor.encode("cp1252", errors="replace").decode("cp1252")


def _dia(momento: datetime) -> str:
    local = momento.astimezone(FUSO_LUANDA)
    return f"{_DIAS[local.weekday()]}, {local:%d/%m/%Y}"


def _hora(momento: datetime) -> str:
    return f"{momento.astimezone(FUSO_LUANDA):%H:%M}"


class _Documento(FPDF):
    def __init__(self) -> None:
        super().__init__(format="A4")
        self.core_fonts_encoding = "windows-1252"

    def footer(self) -> None:
        self.set_y(-16)
        self.set_draw_color(*_LINHA)
        self.line(self.l_margin, self.get_y(), self.w - self.r_margin, self.get_y())
        self.ln(2)
        self.set_font("helvetica", "", 7.5)
        self.set_text_color(*_CINZA)
        self.cell(
            0,
            4,
            _texto(f"Janelas Para a Alma  ·  {SITE}  ·  {EMAIL_JPA}  ·  {TELEFONE_JPA}  ·  Luanda, Angola"),
            align="L",
        )
        self.cell(0, 4, f"Página {self.page_no()} de {{nb}}", align="R", new_x="LMARGIN", new_y="NEXT")


def _seccao(pdf: FPDF, numero: int, titulo: str) -> None:
    pdf.ln(3)
    pdf.set_font("helvetica", "B", 10.5)
    pdf.set_text_color(*_NAVY)
    pdf.cell(0, 6, _texto(f"{numero}. {titulo.upper()}"), new_x="LMARGIN", new_y="NEXT")
    pdf.set_draw_color(*_TEAL)
    pdf.set_line_width(0.5)
    pdf.line(pdf.l_margin, pdf.get_y(), pdf.l_margin + 18, pdf.get_y())
    pdf.set_line_width(0.2)
    pdf.ln(1.5)


def _linha(pdf: FPDF, rotulo: str, valor: str, destaque: bool = False) -> None:
    largura_rotulo = 48
    y = pdf.get_y()
    pdf.set_font("helvetica", "", 9)
    pdf.set_text_color(*_CINZA)
    pdf.multi_cell(largura_rotulo, 5, _texto(rotulo), new_x="RIGHT", new_y="TOP")
    pdf.set_xy(pdf.l_margin + largura_rotulo, y)
    pdf.set_font("helvetica", "B" if destaque else "", 10 if destaque else 9.5)
    pdf.set_text_color(*_NAVY)
    pdf.multi_cell(0, 5, _texto(valor), new_x="LMARGIN", new_y="NEXT")
    pdf.set_draw_color(*_LINHA)
    pdf.line(pdf.l_margin, pdf.get_y() + 0.6, pdf.w - pdf.r_margin, pdf.get_y() + 0.6)
    pdf.ln(1.4)


def _cabecalho(pdf: FPDF, ficha: FichaEncaminhamento) -> None:
    topo = 12
    pdf.image(str(LOGOTIPO_JPA), x=pdf.l_margin, y=topo, h=15)
    logotipo_clinica = LOGOTIPOS_CLINICAS.get(ficha.clinica_nome)
    if logotipo_clinica is not None and logotipo_clinica.exists():
        pdf.image(str(logotipo_clinica), x=pdf.w - pdf.r_margin - 19, y=topo - 1, h=17)
    else:
        pdf.set_xy(pdf.w - pdf.r_margin - 70, topo + 4)
        pdf.set_font("helvetica", "B", 11)
        pdf.set_text_color(*_NAVY)
        pdf.cell(70, 6, _texto(ficha.clinica_nome), align="R")

    pdf.set_y(topo + 20)
    pdf.set_font("helvetica", "B", 16)
    pdf.set_text_color(*_NAVY)
    pdf.cell(0, 8, _texto("Ficha de Encaminhamento para Consulta"), new_x="LMARGIN", new_y="NEXT")
    pdf.set_font("helvetica", "", 9.5)
    pdf.set_text_color(*_CINZA)
    pdf.cell(
        0,
        5,
        _texto(f"Pedido recebido através da plataforma Janelas Para a Alma para {ficha.clinica_nome}"),
        new_x="LMARGIN",
        new_y="NEXT",
    )
    pdf.ln(4)

    # Faixa de identificação do pedido.
    y = pdf.get_y()
    largura = pdf.w - pdf.l_margin - pdf.r_margin
    pdf.set_fill_color(*_TEAL_CLARO)
    pdf.rect(pdf.l_margin, y, largura, 17, style="F")
    colunas = (
        ("Referência", ficha.referencia),
        ("Emitida em", f"{ficha.emitida_em.astimezone(FUSO_LUANDA):%d/%m/%Y %H:%M}"),
        ("Origem do pedido", SITE),
        ("Estado", "A aguardar confirmação"),
    )
    proporcoes = (0.19, 0.21, 0.32, 0.28)
    x = pdf.l_margin + 4
    for (rotulo, valor), proporcao in zip(colunas, proporcoes, strict=True):
        largura_coluna = (largura - 8) * proporcao
        pdf.set_xy(x, y + 3)
        pdf.set_font("helvetica", "", 7.5)
        pdf.set_text_color(*_CINZA)
        pdf.cell(largura_coluna, 4, _texto(rotulo.upper()))
        pdf.set_xy(x, y + 8)
        pdf.set_font("helvetica", "B", 9)
        pdf.set_text_color(*_NAVY)
        pdf.cell(largura_coluna, 5, _texto(valor))
        x += largura_coluna
    pdf.set_y(y + 17)


def gerar_ficha_encaminhamento(ficha: FichaEncaminhamento) -> bytes:
    pdf = _Documento()
    pdf.set_margins(18, 12, 18)
    pdf.set_auto_page_break(auto=True, margin=22)
    pdf.set_title(_texto(f"Ficha de encaminhamento {ficha.referencia}"))
    pdf.set_author("Janelas Para a Alma")
    pdf.set_creator(SITE)
    pdf.add_page()

    _cabecalho(pdf, ficha)

    _seccao(pdf, 1, "Consulta pedida")
    _linha(pdf, "Modalidade", _MODALIDADES.get(ficha.modalidade, ficha.modalidade), destaque=True)
    _linha(pdf, "Data", _dia(ficha.horario_inicio), destaque=True)
    _linha(pdf, "Hora", f"{_hora(ficha.horario_inicio)} (hora de Luanda)", destaque=True)
    _linha(pdf, "Duração prevista", f"{ficha.duracao_minutos} minutos")
    _linha(pdf, "Motivo indicado", ficha.motivo.strip() if ficha.motivo and ficha.motivo.strip() else "Não indicado")

    _seccao(pdf, 2, "Paciente")
    _linha(pdf, "Nome completo", ficha.paciente_nome, destaque=True)
    _linha(pdf, "Telefone", ficha.paciente_telefone)
    _linha(pdf, "Email", ficha.paciente_email)
    _linha(
        pdf,
        "Conta na plataforma",
        "Utilizador registado" if ficha.conta_registada else "Pedido feito sem conta",
    )
    _linha(
        pdf,
        "Rastreio digital",
        "Fez um rastreio visual na plataforma antes do pedido"
        if ficha.rastreio_associado
        else "Sem rastreio associado a este pedido",
    )

    _seccao(pdf, 3, "Clínica de destino")
    contactos = [ficha.clinica_cidade, ficha.clinica_telefone, ficha.clinica_email]
    _linha(pdf, ficha.clinica_nome, "  ·  ".join(c for c in contactos if c))

    _seccao(pdf, 4, "Próximos passos")
    pdf.set_font("helvetica", "", 9.5)
    pdf.set_text_color(*_NAVY)
    passos = (
        "Contacte o paciente pelo telefone ou email acima para confirmar a consulta.",
        ("Se não puder receber o paciente nesta data e hora, responda a este email para "
        "a equipa Janelas Para a Alma propor outro horário."),
        ("Consultas online: o paciente recebe o link da sala de vídeo depois de a consulta "
        "ser confirmada."),
        f"Indique a referência {ficha.referencia} em qualquer contacto sobre este pedido.",
    )
    for i, passo in enumerate(passos, start=1):
        pdf.cell(6, 5, f"{i}.")
        pdf.multi_cell(0, 5, _texto(passo), new_x="LMARGIN", new_y="NEXT")
        pdf.ln(0.4)

    # Avisos legais.
    pdf.ln(3)
    y = pdf.get_y()
    pdf.set_draw_color(*_LINHA)
    pdf.line(pdf.l_margin, y, pdf.w - pdf.r_margin, y)
    pdf.ln(2.5)
    pdf.set_font("helvetica", "B", 8)
    pdf.set_text_color(*_NAVY)
    pdf.cell(0, 4, _texto("DOCUMENTO CONFIDENCIAL — DADOS PESSOAIS E DE SAÚDE"), new_x="LMARGIN", new_y="NEXT")
    pdf.set_font("helvetica", "", 7.5)
    pdf.set_text_color(*_CINZA)
    avisos = (
        ("Os dados deste documento foram fornecidos pelo próprio paciente ao pedir a consulta na plataforma "
        "Janelas Para a Alma e são transmitidos à clínica de destino exclusivamente para a marcação e "
        "realização desta consulta, nos termos da Lei n.º 22/11, de 17 de Junho (Lei da Protecção de Dados "
        "Pessoais). O motivo da consulta é um dado de saúde: deve ser tratado com sigilo profissional, "
        "guardado com acesso restrito e não pode ser partilhado com terceiros nem usado para outros fins."),
        ("O rastreio digital da Janelas Para a Alma é uma ferramenta de triagem e não substitui um diagnóstico "
        "médico. A avaliação clínica é da exclusiva responsabilidade da clínica de destino."),
        "Documento gerado automaticamente pela plataforma; não requer assinatura.",
    )
    for aviso in avisos:
        pdf.multi_cell(0, 3.6, _texto(aviso), new_x="LMARGIN", new_y="NEXT")
        pdf.ln(1)

    return bytes(pdf.output())
