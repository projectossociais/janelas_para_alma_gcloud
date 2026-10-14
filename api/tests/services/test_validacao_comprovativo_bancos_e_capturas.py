"""Comprovativos de **qualquer banco angolano** para a conta do projecto no
BAI, e **capturas de ecrã** lidas por OCR -- `ValidacaoComprovativoService`
com repositório, storage e OCR falsos (o OCR falso devolve o texto que está
"na imagem"; o Tesseract real corre em `test_validacao_comprovativo_ocr_real.py`)."""

from dataclasses import replace
from datetime import timedelta
from decimal import Decimal

import pytest
from PIL import Image

from tests.services.pdf_falso import (
    criar_pdf,
    desenhar_ecra,
    desfocar,
    em_bytes,
    linhas_bai,
    linhas_express,
)
from tests.services.test_validacao_comprovativo_service import (
    AGORA,
    CONFIG,
    UTILIZADOR,
    OcrFalso,
    _enviar,
    _servico_com,
    montar_ambiente,
)


@pytest.fixture
def ocr() -> OcrFalso:
    return OcrFalso()


@pytest.fixture
def ambiente(ocr):
    return montar_ambiente(ocr)


# --- outros bancos -------------------------------------------------------------


def linhas_outro_banco(
    emissor: str,
    iban_destino: str = "AO06 0040 0000 1234 5678 9012 3",
    operacao: str = "BNK2026101400077",
    rotulo_operacao: str = "N.º de Operação",
    estado: str = "Transferência realizada",
    data: str = "14/10/2026 08:55",
) -> list[str]:
    """Transferência interbancária emitida por outro banco para o nosso BAI."""
    return [
        emissor,
        "Comprovativo de Transferência Interbancária",
        f"{rotulo_operacao}: {operacao}",
        f"Data da Operação: {data}",
        "Banco Destino: BAI - Banco Angolano de Investimentos",
        "Beneficiário: Maria Exemplo Titular",
        f"IBAN Destino: {iban_destino}",
        "Montante: 15.000,00 AOA",
        estado,
    ]


@pytest.mark.parametrize(
    ("emissor", "origem"),
    [
        ("BFA - Banco de Fomento Angola · BFA Net", "bfa"),
        ("Banco BIC · BIC Net Empresas", "bic"),
        ("Banco Millennium Atlântico · Atlântico Directo", "atlantico"),
        ("Banco Sol · Sol Net", "banco_sol"),
        ("Standard Bank Angola", "standard_bank"),
        ("Banco Keve", "keve"),
        ("Access Bank Angola", "access_bank"),
        ("BNI - Banco de Negócios Internacional", "bni"),
        ("Banco Caixa Geral Angola", "caixa_angola"),
    ],
)
def test_transferencia_de_outro_banco_para_o_nosso_bai_aprova(ambiente, emissor, origem) -> None:
    servico, repo, storage, *_ = ambiente
    reg = servico.validar(UTILIZADOR, _enviar(storage, criar_pdf(linhas_outro_banco(emissor), producer="iText")))

    assert reg.estado == "aprovado", reg.motivo
    # O BAI aparece como banco de destino, mas quem emitiu foi o outro banco.
    assert reg.origem == origem
    assert repo.premium[UTILIZADOR] == AGORA + timedelta(days=30)


def test_codigo_swift_bic_nao_e_confundido_com_o_banco_bic(ambiente) -> None:
    servico, _, storage, *_ = ambiente
    linhas = linhas_bai() + ["BIC/SWIFT: BAIPAOLU"]
    assert servico.validar(UTILIZADOR, _enviar(storage, criar_pdf(linhas))).origem == "bai_directo"


@pytest.mark.parametrize(
    "iban",
    [
        "AO06004000001234567890123",  # tudo junto
        "AO06.0040.0000.1234.5678.9012.3",  # com pontos
        "0040 0000 1234 5678 9012 3",  # NBA, sem AO06
        "004000001234567890123",  # NBA tudo junto
    ],
)
def test_iban_de_destino_em_qualquer_formato(ambiente, iban) -> None:
    servico, _, storage, *_ = ambiente
    reg = servico.validar(UTILIZADOR, _enviar(storage, criar_pdf(linhas_outro_banco("Banco BIC", iban_destino=iban))))
    assert reg.estado == "aprovado", reg.motivo


def test_so_o_numero_da_conta_conta_como_destinatario(ambiente) -> None:
    servico, _, storage, *_ = ambiente
    linhas = [
        linha.replace("IBAN Destino: AO06 0040 0000 1234 5678 9012 3", "Conta Destino: 12345678901")
        for linha in linhas_outro_banco("BFA")
    ]
    linhas = [linha for linha in linhas if "Maria" not in linha]
    reg = servico.validar(UTILIZADOR, _enviar(storage, criar_pdf(linhas)))
    assert reg.estado == "aprovado", reg.motivo


def test_iban_de_outra_conta_no_bai_continua_rejeitado(ambiente) -> None:
    servico, _, storage, *_ = ambiente
    linhas = [
        linha for linha in linhas_outro_banco("BFA", iban_destino="AO06 0040 0000 9999 8888 7777 6")
        if "Maria" not in linha
    ]
    reg = servico.validar(UTILIZADOR, _enviar(storage, criar_pdf(linhas)))
    assert (reg.estado, reg.motivo_codigo) == ("rejeitado", "destinatario_invalido")


@pytest.mark.parametrize(
    ("rotulo", "valor"),
    [
        ("Ref. Operação", "RO2026101455"),
        ("Nº Documento", "DOC00998877"),
        ("Código de Operação", "COP7766554433"),
        ("Comprovativo Nº", "202610140099"),
        ("N.º de Controlo", "CTL55443322"),
        ("Autenticação Bancária", "AB12CD34EF56"),
        ("Id. Transação", "TX-2026-00981"),
    ],
)
def test_rotulos_de_referencia_dos_varios_bancos(ambiente, rotulo, valor) -> None:
    servico, _, storage, *_ = ambiente
    linhas = linhas_outro_banco("BFA", operacao=valor, rotulo_operacao=rotulo)
    reg = servico.validar(UTILIZADOR, _enviar(storage, criar_pdf(linhas)))
    assert reg.estado == "aprovado", reg.motivo
    assert reg.referencia_transacao == valor


@pytest.mark.parametrize(
    "estado",
    ["Operação Processada", "Transferência Liquidada", "Transferência Enviada", "Pagamento Efectuado", "Executada"],
)
def test_estados_de_sucesso_dos_varios_bancos(ambiente, estado) -> None:
    servico, _, storage, *_ = ambiente
    reg = servico.validar(UTILIZADOR, _enviar(storage, criar_pdf(linhas_outro_banco("BFA", estado=estado))))
    assert reg.estado == "aprovado", reg.motivo


@pytest.mark.parametrize("estado", ["Estado: Aceite", "Transferência registada", "Em processamento", "Pendente"])
def test_interbancaria_ainda_em_processamento_vai_para_revisao_por_omissao(ambiente, estado) -> None:
    servico, repo, storage, *_ = ambiente
    reg = servico.validar(UTILIZADOR, _enviar(storage, criar_pdf(linhas_outro_banco("BFA", estado=estado))))
    assert reg.estado == "revisao_manual"
    assert "em processamento" in reg.motivo
    assert UTILIZADOR not in repo.premium


def test_interbancaria_em_processamento_aprova_com_a_flag_se_for_de_hoje(ambiente) -> None:
    _, repo, storage, *_ = ambiente
    servico = _servico_com(replace(CONFIG, aceitar_interbancario_pendente=True), repo, storage)
    reg = servico.validar(UTILIZADOR, _enviar(storage, criar_pdf(linhas_outro_banco("BFA", estado="Estado: Aceite"))))
    assert reg.estado == "aprovado", reg.motivo


def test_interbancaria_em_processamento_de_ontem_vai_para_revisao_mesmo_com_a_flag(ambiente) -> None:
    _, _, storage, *_ = ambiente
    servico = _servico_com(replace(CONFIG, aceitar_interbancario_pendente=True), storage=storage)
    linhas = linhas_outro_banco("BFA", estado="Em processamento", data="13/10/2026 17:00")
    assert servico.validar(UTILIZADOR, _enviar(storage, criar_pdf(linhas))).estado == "revisao_manual"


# --- capturas de ecrã -------------------------------------------------------------


def _captura(ocr, linhas: list[str], formato: str = "PNG", **kwargs) -> bytes:
    """Uma captura de ecrã real (bytes de PNG/JPEG) e o OCR falso a "ler" o
    mesmo texto que está desenhado nela."""
    ocr.texto = "\n".join(linhas)
    return em_bytes(desenhar_ecra(linhas), formato, **kwargs)


def test_captura_de_ecra_do_express_aprova_e_da_30_dias(ambiente, ocr) -> None:
    servico, repo, storage, *_ = ambiente
    reg = servico.validar(UTILIZADOR, _enviar(storage, _captura(ocr, linhas_express()), nome="ecra.png"))

    assert reg.estado == "aprovado", reg.motivo
    assert ocr.chamadas == 1
    assert reg.origem == "multicaixa_express"
    assert reg.referencia_transacao == "MCX88776655"
    assert reg.hash_perceptual and len(reg.hash_perceptual) == 64
    assert reg.metadados_ficheiro["tipo"] == "png"
    assert reg.metadados_ficheiro["ocr_confianca"] == 95.0
    assert "Transacção" in reg.texto_extraido
    assert repo.premium[UTILIZADOR] == AGORA + timedelta(days=30)


@pytest.mark.parametrize("formato", ["JPEG", "WEBP"])
def test_captura_de_ecra_da_app_de_outro_banco_em_jpeg_ou_webp(ambiente, ocr, formato) -> None:
    servico, _, storage, *_ = ambiente
    reg = servico.validar(UTILIZADOR, _enviar(storage, _captura(ocr, linhas_outro_banco("BFA Net"), formato)))
    assert reg.estado == "aprovado", reg.motivo
    assert reg.origem == "bfa"
    assert reg.metadados_ficheiro["tipo"] == formato.lower()


def test_a_mesma_captura_duas_vezes_e_bloqueada(ambiente, ocr) -> None:
    servico, _, storage, *_ = ambiente
    conteudo = _captura(ocr, linhas_express())
    servico.validar(UTILIZADOR, _enviar(storage, conteudo, nome="a"))

    reg = servico.validar("u-2", _enviar(storage, conteudo, utilizador="u-2", nome="b"))
    assert (reg.estado, reg.motivo_codigo) == ("rejeitado", "comprovativo_ja_utilizado")


def test_a_mesma_captura_cortada_e_bloqueada_pelo_numero_da_operacao(ambiente, ocr) -> None:
    """Cortar 2 píxeis muda o SHA-256 -- o número da operação lido por OCR
    continua a ser o mesmo, e esse é único."""
    servico, repo, storage, *_ = ambiente
    img = desenhar_ecra(linhas_express())
    ocr.texto = "\n".join(linhas_express())
    servico.validar(UTILIZADOR, _enviar(storage, em_bytes(img), nome="a"))

    cortada = em_bytes(img.crop((2, 2, img.width - 2, img.height - 2)), "JPEG")
    reg = servico.validar(UTILIZADOR, _enviar(storage, cortada, nome="b"))

    assert (reg.estado, reg.motivo_codigo) == ("rejeitado", "transacao_ja_utilizada")
    assert repo.premium[UTILIZADOR] == AGORA + timedelta(days=30)


def test_captura_cortada_com_o_numero_mal_lido_vai_para_revisao(ambiente, ocr) -> None:
    """O OCR troca um dígito na segunda leitura: a referência já não bate,
    mas a imagem é a mesma (hash perceptual) e a referência quase igual."""
    servico, repo, storage, *_ = ambiente
    img = desenhar_ecra(linhas_express())
    ocr.texto = "\n".join(linhas_express())
    servico.validar(UTILIZADOR, _enviar(storage, em_bytes(img), nome="a"))

    ocr.texto = "\n".join(linhas_express(transaccao="MCX88776656"))
    cortada = em_bytes(img.crop((3, 3, img.width - 1, img.height - 1)))
    reg = servico.validar(UTILIZADOR, _enviar(storage, cortada, nome="b"))

    assert reg.estado == "revisao_manual"
    assert "quase igual" in reg.motivo
    assert repo.premium[UTILIZADOR] == AGORA + timedelta(days=30)  # não somou outra vez


def test_outra_captura_legitima_do_mesmo_ecra_da_app_aprova(ambiente, ocr) -> None:
    """Duas capturas diferentes do mesmo ecrã do Express têm hashes
    perceptuais quase iguais (só mudam os números) -- uma renovação no mês
    seguinte não pode cair em revisão por isso."""
    servico, repo, storage, *_ = ambiente
    servico.validar(UTILIZADOR, _enviar(storage, _captura(ocr, linhas_express()), nome="a"))

    segunda = linhas_express(transaccao="MCX11223344", data="2026-10-14 09:20:00")
    reg = servico.validar(UTILIZADOR, _enviar(storage, _captura(ocr, segunda), nome="b"))

    assert reg.estado == "aprovado", reg.motivo
    assert repo.premium[UTILIZADOR] == AGORA + timedelta(days=60)


def test_captura_desfocada_vai_para_revisao_e_avisa_os_admins(ambiente, ocr) -> None:
    servico, repo, storage, notificador, _ = ambiente
    ocr.texto, ocr.confianca = "M~LT1CA X3 ...", 18.0
    reg = servico.validar(UTILIZADOR, _enviar(storage, em_bytes(desfocar(desenhar_ecra(linhas_express())))))

    assert reg.estado == "revisao_manual"
    assert "desfocada" in reg.motivo
    assert UTILIZADOR not in repo.premium
    assert len(notificador.mensagens) == 1


def test_ocr_indisponivel_vai_para_revisao(ambiente, ocr) -> None:
    servico, repo, storage, *_ = ambiente
    ocr.falhar = True
    reg = servico.validar(UTILIZADOR, _enviar(storage, em_bytes(desenhar_ecra(linhas_express()))))
    assert reg.estado == "revisao_manual"
    assert UTILIZADOR not in repo.premium


def test_sem_motor_de_ocr_vai_para_revisao(ambiente) -> None:
    _, repo, storage, *_ = ambiente
    servico = _servico_com(CONFIG, repo, storage, ocr=None)
    reg = servico.validar(UTILIZADOR, _enviar(storage, em_bytes(desenhar_ecra(linhas_express()))))
    assert reg.estado == "revisao_manual"


@pytest.mark.parametrize(
    ("formato", "software", "ferramenta"),
    [("JPEG", "Adobe Photoshop 25.0 (Windows)", "Photoshop"), ("PNG", "GIMP 2.10.36", "GIMP"), ("JPEG", "Canva", "Canva"), ("WEBP", "Snapseed 2.0", "Snapseed")],
)
def test_captura_com_assinatura_de_editor_e_rejeitada(ambiente, ocr, formato, software, ferramenta) -> None:
    servico, repo, storage, *_ = ambiente
    reg = servico.validar(UTILIZADOR, _enviar(storage, _captura(ocr, linhas_express(), formato, software=software)))
    assert (reg.estado, reg.motivo_codigo) == ("rejeitado", "edicao_suspeita")
    assert ferramenta in reg.motivo
    assert ocr.chamadas == 0  # nem chega a ler
    assert UTILIZADOR not in repo.premium


def test_valor_baixo_lido_por_ocr_vai_para_revisao_em_vez_de_rejeitar(ambiente, ocr) -> None:
    """O OCR pode ter perdido o "1" de 15.000 -- quem acabou de pagar não é
    rejeitado por uma leitura; uma pessoa confirma."""
    servico, repo, storage, *_ = ambiente
    reg = servico.validar(UTILIZADOR, _enviar(storage, _captura(ocr, linhas_express(montante="5.000,00 Kz"))))
    assert reg.estado == "revisao_manual"
    assert "inferior a 15.000,00 Kz (lido na imagem)" in reg.motivo
    assert UTILIZADOR not in repo.premium


def test_destinatario_errado_lido_por_ocr_vai_para_revisao(ambiente, ocr) -> None:
    servico, _, storage, *_ = ambiente
    reg = servico.validar(UTILIZADOR, _enviar(storage, _captura(ocr, linhas_express(telefone="+244 911 222 333"))))
    assert reg.estado == "revisao_manual"
    assert "destinatário" in reg.motivo


def test_ocr_com_letras_no_lugar_de_digitos_continua_a_reconhecer_o_destino(ambiente, ocr) -> None:
    servico, _, storage, *_ = ambiente
    reg = servico.validar(UTILIZADOR, _enviar(storage, _captura(ocr, linhas_express(telefone="+244 923 OOO lll"))))
    assert reg.estado == "aprovado", reg.motivo


def test_captura_de_transferencia_agendada_continua_rejeitada(ambiente, ocr) -> None:
    servico, _, storage, *_ = ambiente
    linhas = linhas_express() + ["Transferência agendada para 20/10/2026"]
    reg = servico.validar(UTILIZADOR, _enviar(storage, _captura(ocr, linhas)))
    assert (reg.estado, reg.motivo_codigo) == ("rejeitado", "operacao_nao_concluida")


def test_aprovacao_automatica_de_imagens_desligada(ambiente, ocr) -> None:
    _, repo, storage, *_ = ambiente
    servico = _servico_com(replace(CONFIG, auto_aprovar_imagens=False), repo, storage, ocr=ocr)
    reg = servico.validar(UTILIZADOR, _enviar(storage, _captura(ocr, linhas_express())))
    assert reg.estado == "revisao_manual"
    assert "capturas de ecrã" in reg.motivo
    # Um PDF com texto continua a aprovar sozinho.
    assert servico.validar(UTILIZADOR, _enviar(storage, criar_pdf(linhas_bai()), nome="pdf")).estado == "aprovado"


def test_pdf_que_e_so_uma_captura_de_ecra_e_lido_por_ocr(ambiente, ocr) -> None:
    servico, _, storage, *_ = ambiente
    ocr.texto = "\n".join(linhas_express())
    pdf = criar_pdf([], producer="Android 14", creator=None, imagem=desenhar_ecra(linhas_express()))

    reg = servico.validar(UTILIZADOR, _enviar(storage, pdf))

    assert reg.estado == "aprovado", reg.motivo
    assert ocr.chamadas == 1
    assert reg.hash_perceptual


def test_imagem_gigante_e_recusada_antes_de_descodificar(ambiente, ocr) -> None:
    servico, _, storage, *_ = ambiente
    gigante = Image.new("1", (6000, 5000))
    reg = servico.validar(UTILIZADOR, _enviar(storage, em_bytes(gigante)))
    assert (reg.estado, reg.motivo_codigo) == ("rejeitado", "imagem_invalida")
    assert ocr.chamadas == 0


def test_montante_em_formato_angolano_numa_captura(ambiente, ocr) -> None:
    servico, _, storage, *_ = ambiente
    reg = servico.validar(UTILIZADOR, _enviar(storage, _captura(ocr, linhas_express(montante="KZ 15,000.00"))))
    assert reg.montante_kz == Decimal("15000.00")
