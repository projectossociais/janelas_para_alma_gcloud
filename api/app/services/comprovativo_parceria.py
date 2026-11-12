"""Comprovativo de registo em PDF, enviado à empresa (clínica, óptica,
organização) que preencheu o registo de parceiros.

Diz-lhe que o pedido foi recebido, com que referência, o que declarou e que
documentos entregou, e quem é a sociedade do outro lado. Não é um contrato:
o texto diz isso mesmo. Mesmo desenho e mesmas peças da ficha de
encaminhamento (`ficha_encaminhamento.py`).

Logótipo: usa o da Olhar Alinhado se existir em
`app/assets/logo-olhar-alinhado.png`; sem ele, o da plataforma. A morada da
sede e os nomes dos sócios nunca entram (CLAUDE.md §4.10).
"""

from datetime import datetime

from fpdf import FPDF

from app.core.fuso import FUSO_LUANDA
from app.repositories.candidatura_parceria_repository import DadosCandidaturaParceria
from app.services.ficha_encaminhamento import (
    _ASSETS,
    _CINZA,
    _LINHA,
    _NAVY,
    _TEAL_CLARO,
    CAPITAL_SOCIAL,
    FIRMA,
    LOGOTIPO_JPA,
    NIF,
    SITE,
    _Documento,
    _linha,
    _seccao,
    _texto,
)

LOGOTIPO_OLHAR_ALINHADO = _ASSETS / "logo-olhar-alinhado.png"

# Conservatória do Registo Comercial do Guiché Único da Empresa (certidão de
# 2026-10-01).
MATRICULA = "47643-26/261001"
OBJECTO_SOCIAL = (
    "Prestação de serviços digitais na área da saúde ocular através de plataforma online que "
    "disponibiliza programas terapêuticos de exercícios visuais com acompanhamento clínico "
    "especializado e acesso a teleconsultas médicas, bem como a comercialização de equipamentos visuais."
)

# Lista fechada -- validada no schema Pydantic. O rótulo é o que se lê no
# PDF e no email à equipa.
TIPOS_DE_PARCEIRO = {
    "clinica_oftalmologica": "Clínica oftalmológica",
    "optica": "Óptica",
    "hospital": "Hospital ou centro médico",
    "seguradora": "Seguradora",
    "empresa": "Empresa (responsabilidade social)",
    "ong": "ONG ou fundação",
    "instituicao_ensino": "Instituição de ensino",
    "outro": "Outra organização",
}


def _cabecalho(pdf: FPDF, referencia: str, recebido_em: datetime) -> None:
    topo = 12
    if LOGOTIPO_OLHAR_ALINHADO.exists():
        pdf.image(str(LOGOTIPO_OLHAR_ALINHADO), x=pdf.l_margin, y=topo - 2, h=19)
    else:
        pdf.image(str(LOGOTIPO_JPA), x=pdf.l_margin, y=topo, h=15)
        pdf.set_xy(pdf.w - pdf.r_margin - 100, topo + 4)
        pdf.set_font("helvetica", "B", 10)
        pdf.set_text_color(*_NAVY)
        pdf.cell(100, 6, _texto(FIRMA), align="R")

    pdf.set_y(topo + 20)
    pdf.set_font("helvetica", "B", 16)
    pdf.set_text_color(*_NAVY)
    pdf.cell(0, 8, _texto("Comprovativo de Registo de Parceiro"), new_x="LMARGIN", new_y="NEXT")
    pdf.set_font("helvetica", "", 9.5)
    pdf.set_text_color(*_CINZA)
    pdf.cell(
        0,
        5,
        _texto("Pedido de adesão à Rede de Parceiros Janelas Para a Alma, recebido em janelasparaalma.com"),
        new_x="LMARGIN",
        new_y="NEXT",
    )
    pdf.ln(4)

    y = pdf.get_y()
    largura = pdf.w - pdf.l_margin - pdf.r_margin
    pdf.set_fill_color(*_TEAL_CLARO)
    pdf.rect(pdf.l_margin, y, largura, 17, style="F")
    colunas = (
        ("Referência", referencia),
        ("Recebido em", f"{recebido_em.astimezone(FUSO_LUANDA):%d/%m/%Y %H:%M}"),
        ("Origem", SITE),
        ("Estado", "Em análise"),
    )
    x = pdf.l_margin + 4
    for (rotulo, valor), proporcao in zip(colunas, (0.2, 0.22, 0.33, 0.25), strict=True):
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


def gerar_comprovativo_parceria(referencia: str, recebido_em: datetime, dados: DadosCandidaturaParceria) -> bytes:
    pdf = _Documento()
    pdf.set_margins(18, 12, 18)
    pdf.set_auto_page_break(auto=True, margin=24)
    pdf.set_title(_texto(f"Comprovativo de registo de parceiro {referencia}"))
    pdf.set_author(_texto(f"{FIRMA} (Janelas Para a Alma)"))
    pdf.set_subject(_texto(f"Pedido de parceria de {dados.denominacao}"))
    pdf.set_creator(SITE)
    pdf.add_page()

    _cabecalho(pdf, referencia, recebido_em)

    _seccao(pdf, 1, "Entidade candidata")
    _linha(pdf, "Denominação social", dados.denominacao, destaque=True)
    _linha(pdf, "NIF", dados.nif, destaque=True)
    _linha(pdf, "Tipo de entidade", TIPOS_DE_PARCEIRO.get(dados.tipo, dados.tipo))
    _linha(pdf, "Localização", "  ·  ".join(filter(None, [dados.provincia, dados.morada])))
    if dados.website:
        _linha(pdf, "Website", dados.website)

    _seccao(pdf, 2, "Representante")
    _linha(pdf, "Nome e cargo", f"{dados.representante_nome}  ·  {dados.representante_cargo}", destaque=True)
    _linha(pdf, "Contactos", f"{dados.telefone}  ·  {dados.email}")
    if dados.mensagem:
        _linha(pdf, "Proposta de colaboração", dados.mensagem)

    _seccao(pdf, 3, "Documentos entregues")
    if dados.documentos:
        for i, documento in enumerate(dados.documentos, start=1):
            _linha(pdf, f"Documento {i}", documento.nome)
    else:
        _linha(pdf, "Documentos", "Nenhum documento enviado com o registo")

    _seccao(pdf, 4, "Quem recebe o pedido")
    _linha(pdf, "Sociedade", FIRMA, destaque=True)
    _linha(pdf, "NIF", NIF)
    _linha(pdf, "Matrícula", f"{MATRICULA}, Conservatória do Registo Comercial (Guiché Único da Empresa)")
    _linha(pdf, "Capital social", CAPITAL_SOCIAL)
    _linha(pdf, "Sede", "Luanda, Angola")
    _linha(pdf, "Objecto social", OBJECTO_SOCIAL)

    _seccao(pdf, 5, "Próximos passos")
    pdf.set_font("helvetica", "", 9.5)
    pdf.set_text_color(*_NAVY)
    passos = (
        "A nossa equipa analisa os dados e os documentos entregues.",
        "Entramos em contacto com o representante indicado para apresentar a proposta de parceria.",
        "Havendo acordo, as condições ficam escritas num protocolo assinado pelas duas partes.",
        f"Indique a referência {referencia} em qualquer contacto sobre este pedido.",
    )
    for i, passo in enumerate(passos, start=1):
        pdf.cell(6, 5, f"{i}.")
        pdf.multi_cell(0, 5, _texto(passo), align="L", new_x="LMARGIN", new_y="NEXT")
        pdf.ln(0.4)

    pdf.ln(3)
    y = pdf.get_y()
    pdf.set_draw_color(*_LINHA)
    pdf.line(pdf.l_margin, y, pdf.w - pdf.r_margin, y)
    pdf.ln(2.5)
    pdf.set_font("helvetica", "B", 8)
    pdf.set_text_color(*_NAVY)
    pdf.cell(0, 4, _texto("NATUREZA DESTE DOCUMENTO"), new_x="LMARGIN", new_y="NEXT")
    pdf.set_font("helvetica", "", 7.5)
    pdf.set_text_color(*_CINZA)
    avisos = (
        ("Este documento comprova apenas que o pedido de parceria foi recebido. Não constitui contrato, "
         "proposta vinculativa nem aceitação da parceria por nenhuma das partes."),
        (f"Os dados acima foram fornecidos pelo representante da entidade candidata, que declarou ter poderes "
         f"para a representar. São tratados por {FIRMA}, NIF {NIF}, exclusivamente para a análise e gestão "
         "deste pedido, nos termos da Lei n.º 22/11, de 17 de Junho (Lei da Protecção de Dados Pessoais)."),
        "Documento gerado automaticamente pela plataforma; não requer assinatura.",
    )
    for aviso in avisos:
        pdf.multi_cell(0, 3.5, _texto(aviso), align="L", new_x="LMARGIN", new_y="NEXT")
        pdf.ln(1)

    return bytes(pdf.output())
