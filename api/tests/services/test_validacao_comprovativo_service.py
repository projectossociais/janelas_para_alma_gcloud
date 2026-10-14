"""`ValidacaoComprovativoService` -- dinheiro e acesso, sem base de dados:
repositório e storage falsos (CLAUDE.md §7/§8). Os PDFs são reais (bytes
que o pypdf abre), gerados por `pdf_falso.py` com dados fictícios."""

from dataclasses import replace
from datetime import UTC, datetime, timedelta
from decimal import Decimal

import pytest

from app.repositories.comprovativos_pagamento_repository import (
    ComprovativoDuplicadoError,
    ComprovativoRegisto,
    NovoComprovativo,
)
from app.services.validacao_comprovativo_service import (
    ChaveDeComprovativoInvalidaError,
    ComprovativoJaContaError,
    ConfigPagamento,
    DecisaoInvalidaError,
    FicheiroNaoEnviadoError,
    ValidacaoComprovativoService,
    ValidacaoIndisponivelError,
    formatar_kz,
)
from tests.services.pdf_falso import (
    IBAN_OFICIAL,
    NOME_OFICIAL,
    TELEFONE_OFICIAL,
    criar_pdf,
    linhas_bai,
    linhas_express,
)

# 14/10/2026 09:30 em Luanda.
AGORA = datetime(2026, 10, 14, 8, 30, tzinfo=UTC)
UTILIZADOR = "u-1"


class RepositorioFalso:
    """Em memória, com os mesmos índices únicos parciais da base de dados
    (hash e referência únicos entre os que não estão `rejeitado`) e a
    validade do Premium por utilizador."""

    def __init__(self) -> None:
        self.registos: dict[str, ComprovativoRegisto] = {}
        self.premium: dict[str, datetime | None] = {}
        self.falhar_proximo_commit_por_duplicado = False

    def _activos(self, excepto: str | None = None):
        return [r for r in self.registos.values() if r.estado != "rejeitado" and r.id != excepto]

    def _verificar_unicos(self, reg: ComprovativoRegisto) -> None:
        if self.falhar_proximo_commit_por_duplicado:
            self.falhar_proximo_commit_por_duplicado = False
            raise ComprovativoDuplicadoError
        if reg.estado == "rejeitado":
            return
        for outro in self._activos(excepto=reg.id):
            if outro.hash_sha256 == reg.hash_sha256 or (
                reg.referencia_transacao and outro.referencia_transacao == reg.referencia_transacao
            ):
                raise ComprovativoDuplicadoError

    def estado_por_hash(self, hash_sha256):
        return next((r.estado for r in self._activos() if r.hash_sha256 == hash_sha256), None)

    def estado_por_referencia(self, referencia):
        return next(
            (r.estado for r in self._activos() if r.referencia_transacao == referencia), None
        )

    def _ajustar(self, utilizador_id, ajustar):
        nova = ajustar(self.premium.get(utilizador_id))
        self.premium[utilizador_id] = nova
        return nova

    def registar(self, dados: NovoComprovativo, ajustar_premium=None) -> ComprovativoRegisto:
        reg = ComprovativoRegisto(
            id=f"c-{len(self.registos) + 1}",
            utilizador_id=dados.utilizador_id,
            utilizador_email=f"{dados.utilizador_id}@example.com",
            utilizador_nome=None,
            estado=dados.estado,
            referencia_transacao=dados.referencia_transacao,
            hash_sha256=dados.hash_sha256,
            montante_kz=dados.montante_kz,
            origem=dados.origem,
            destinatario_detectado=dados.destinatario_detectado,
            data_transacao=dados.data_transacao,
            metadados_pdf=dados.metadados_pdf,
            texto_extraido=dados.texto_extraido,
            chave_ficheiro=dados.chave_ficheiro,
            motivo_codigo=dados.motivo_codigo,
            motivo=dados.motivo,
            premium_expira_em=None,
            decidido_por=None,
            decidido_em=None,
            criado_em=AGORA,
        )
        self._verificar_unicos(reg)
        if ajustar_premium is not None:
            reg = replace(reg, premium_expira_em=self._ajustar(dados.utilizador_id, ajustar_premium))
        self.registos[reg.id] = reg
        return reg

    def obter(self, comprovativo_id):
        return self.registos.get(comprovativo_id)

    def listar(self, estado=None, limite=200):
        return [r for r in self.registos.values() if estado is None or r.estado == estado]

    def decidir(
        self, comprovativo_id, estado, admin_id, quando, motivo_codigo=None, motivo=None, ajustar_premium=None
    ):
        reg = replace(
            self.registos[comprovativo_id],
            estado=estado,
            decidido_por=admin_id,
            decidido_em=quando,
            motivo_codigo=motivo_codigo,
            motivo=motivo,
        )
        self._verificar_unicos(reg)
        if ajustar_premium is not None:
            nova = self._ajustar(reg.utilizador_id, ajustar_premium)
            if estado == "aprovado":
                reg = replace(reg, premium_expira_em=nova)
        self.registos[comprovativo_id] = reg
        return reg


class StorageFalso:
    def __init__(self) -> None:
        self.ficheiros: dict[str, bytes] = {}

    def url_de_upload(self, chave, content_type):
        return f"https://r2.example/put/{chave}?ct={content_type}"

    def ler_bytes(self, chave, limite):
        conteudo = self.ficheiros.get(chave)
        return None if conteudo is None else conteudo[: limite + 1]

    def url_de_leitura(self, chave):
        return f"https://r2.example/get/{chave}"


class NotificadorFalso:
    def __init__(self) -> None:
        self.mensagens: list[tuple[str, str]] = []

    def notificar(self, titulo, mensagem):
        self.mensagens.append((titulo, mensagem))


CONFIG = ConfigPagamento(
    preco_kz=Decimal(15000),
    iban=IBAN_OFICIAL,
    telefone=TELEFONE_OFICIAL,
    palavras_nome=NOME_OFICIAL,
    max_dias=3,
    auto_aprovacao=True,
)


@pytest.fixture
def ambiente():
    repo, storage, notificador = RepositorioFalso(), StorageFalso(), NotificadorFalso()
    relogio = {"agora": AGORA}
    servico = ValidacaoComprovativoService(
        repo, storage, CONFIG, notificador, relogio=lambda: relogio["agora"]
    )
    return servico, repo, storage, notificador, relogio


def _enviar(storage: StorageFalso, conteudo: bytes, utilizador: str = UTILIZADOR, nome: str = "a") -> str:
    chave = f"comprovativos-pagamento/{utilizador}/{nome}.pdf"
    storage.ficheiros[chave] = conteudo
    return chave


def _servico_com(config: ConfigPagamento, repo=None, storage=None, notificador=None):
    return ValidacaoComprovativoService(
        repo or RepositorioFalso(), storage or StorageFalso(), config, notificador, relogio=lambda: AGORA
    )


# --- os cinco cenários pedidos ------------------------------------------------


def test_comprovativo_bai_valido_aprova_e_da_30_dias_de_premium(ambiente) -> None:
    servico, repo, storage, notificador, _ = ambiente
    chave = _enviar(storage, criar_pdf(linhas_bai()))

    reg = servico.validar(UTILIZADOR, chave)

    assert reg.estado == "aprovado"
    assert reg.referencia_transacao == "202610140001234"
    assert reg.montante_kz == Decimal("15000.00")
    assert reg.origem == "bai_directo"
    assert reg.data_transacao == datetime(2026, 10, 14, 8, 25, tzinfo=UTC)
    assert reg.premium_expira_em == AGORA + timedelta(days=30)
    assert repo.premium[UTILIZADOR] == AGORA + timedelta(days=30)
    assert reg.metadados_pdf["Producer"] == "BAI Directo"
    assert "N.º de Operação" in reg.texto_extraido
    assert notificador.mensagens == []


def test_o_mesmo_ficheiro_pela_segunda_vez_e_bloqueado_pelo_hash(ambiente) -> None:
    servico, repo, storage, *_ = ambiente
    conteudo = criar_pdf(linhas_bai())
    servico.validar(UTILIZADOR, _enviar(storage, conteudo, nome="a"))

    # O mesmo ficheiro, até por outra conta.
    reg = servico.validar("u-2", _enviar(storage, conteudo, utilizador="u-2", nome="b"))

    assert reg.estado == "rejeitado"
    assert reg.motivo_codigo == "comprovativo_ja_utilizado"
    assert reg.motivo == "Este comprovativo já foi utilizado anteriormente."
    assert "u-2" not in repo.premium


def test_a_mesma_operacao_noutro_ficheiro_e_bloqueada_pela_referencia(ambiente) -> None:
    servico, repo, storage, *_ = ambiente
    servico.validar(UTILIZADOR, _enviar(storage, criar_pdf(linhas_bai()), nome="a"))
    # Mesma operação, ficheiro diferente (outro gerador → outros bytes, outro hash).
    outro_ficheiro = criar_pdf(linhas_bai(), creator="BAI Directo Web")

    reg = servico.validar(UTILIZADOR, _enviar(storage, outro_ficheiro, nome="b"))

    assert reg.estado == "rejeitado"
    assert reg.motivo_codigo == "transacao_ja_utilizada"
    assert reg.motivo == "Esta transação bancária já foi validada anteriormente."
    assert repo.premium[UTILIZADOR] == AGORA + timedelta(days=30)  # não somou outra vez


def test_valor_de_5000_kz_e_bloqueado_por_valor_insuficiente(ambiente) -> None:
    servico, repo, storage, *_ = ambiente
    reg = servico.validar(UTILIZADOR, _enviar(storage, criar_pdf(linhas_bai(montante="5.000,00 Kz"))))

    assert reg.estado == "rejeitado"
    assert reg.motivo_codigo == "valor_insuficiente"
    assert "5.000,00 Kz" in reg.motivo and "15.000,00 Kz" in reg.motivo
    assert UTILIZADOR not in repo.premium


def test_comprovativo_para_outro_iban_e_bloqueado_por_destinatario(ambiente) -> None:
    servico, repo, storage, *_ = ambiente
    linhas = [
        linha.replace("Maria Exemplo Titular", "Outra Pessoa")
        for linha in linhas_bai(iban="AO06 0040 0000 9999 8888 7777 6")
    ]
    reg = servico.validar(UTILIZADOR, _enviar(storage, criar_pdf(linhas)))

    assert reg.estado == "rejeitado"
    assert reg.motivo_codigo == "destinatario_invalido"
    assert reg.motivo == "O destinatário do comprovativo não corresponde à conta oficial do projeto."
    assert UTILIZADOR not in repo.premium


@pytest.mark.parametrize(
    ("producer", "creator", "ferramenta"),
    [
        ("Canva", "Canva", "Canva"),
        ("iLovePDF", "BAI Directo", "iLovePDF"),
        ("Skia/PDF m120", "Microsoft® Word for Microsoft 365", "Microsoft Word"),
        ("LibreOffice 7.6", None, "LibreOffice"),
        ("Smallpdf.com", None, "Smallpdf"),
    ],
)
def test_pdf_feito_num_editor_e_bloqueado_por_edicao_suspeita(ambiente, producer, creator, ferramenta) -> None:
    servico, repo, storage, *_ = ambiente
    reg = servico.validar(
        UTILIZADOR, _enviar(storage, criar_pdf(linhas_bai(), producer=producer, creator=creator))
    )

    assert reg.estado == "rejeitado"
    assert reg.motivo_codigo == "edicao_suspeita"
    assert ferramenta in reg.motivo
    assert UTILIZADOR not in repo.premium


# --- camada 1: ficheiro -------------------------------------------------------


def test_ficheiro_que_nao_e_pdf_e_rejeitado(ambiente) -> None:
    servico, _, storage, *_ = ambiente
    reg = servico.validar(UTILIZADOR, _enviar(storage, b"\x89PNG\r\n\x1a\n" + b"0" * 100))
    assert (reg.estado, reg.motivo_codigo) == ("rejeitado", "ficheiro_invalido")


def test_pdf_corrompido_e_rejeitado_como_ficheiro_invalido(ambiente) -> None:
    servico, _, storage, *_ = ambiente
    reg = servico.validar(UTILIZADOR, _enviar(storage, b"%PDF-1.4\nlixo sem estrutura"))
    assert (reg.estado, reg.motivo_codigo) == ("rejeitado", "ficheiro_invalido")


def test_ficheiro_acima_de_5_mb_e_rejeitado(ambiente) -> None:
    servico, _, storage, *_ = ambiente
    grande = criar_pdf(linhas_bai()) + b"%" + b"0" * (5 * 1024 * 1024)
    reg = servico.validar(UTILIZADOR, _enviar(storage, grande))
    assert (reg.estado, reg.motivo_codigo) == ("rejeitado", "ficheiro_grande")


def test_reenvio_de_um_comprovativo_em_revisao_diz_que_esta_em_analise(ambiente) -> None:
    servico, _, storage, *_ = ambiente
    sem_referencia = [linha for linha in linhas_bai() if "Operação:" not in linha]
    conteudo = criar_pdf(sem_referencia)
    assert servico.validar(UTILIZADOR, _enviar(storage, conteudo, nome="a")).estado == "revisao_manual"

    reg = servico.validar(UTILIZADOR, _enviar(storage, conteudo, nome="b"))
    assert (reg.estado, reg.motivo_codigo) == ("rejeitado", "comprovativo_em_analise")


def test_uma_tentativa_rejeitada_nao_impede_o_reenvio_do_mesmo_ficheiro(ambiente) -> None:
    """O índice único é parcial: só os que contam bloqueiam o hash."""
    servico, _, storage, _, _relogio = ambiente
    conteudo = criar_pdf(linhas_bai(data="09/10/2026 09:25"))
    assert servico.validar(UTILIZADOR, _enviar(storage, conteudo, nome="a")).motivo_codigo == "comprovativo_antigo"

    # A mesma tentativa, outra vez, continua a ser avaliada (e rejeitada pelo motivo real).
    reg = servico.validar(UTILIZADOR, _enviar(storage, conteudo, nome="b"))
    assert reg.motivo_codigo == "comprovativo_antigo"


# --- camada 2: adulteração ----------------------------------------------------


def test_pdf_sem_texto_pede_o_original_em_vez_de_imagem(ambiente) -> None:
    servico, _, storage, *_ = ambiente
    reg = servico.validar(UTILIZADOR, _enviar(storage, criar_pdf([" "])))
    assert (reg.estado, reg.motivo_codigo) == ("rejeitado", "sem_texto")
    assert "PDF original" in reg.motivo


def test_texto_invisivel_por_cima_de_imagem_e_rejeitado(ambiente) -> None:
    servico, _, storage, *_ = ambiente
    reg = servico.validar(UTILIZADOR, _enviar(storage, criar_pdf(linhas_bai(), texto_invisivel=True)))
    assert (reg.estado, reg.motivo_codigo) == ("rejeitado", "texto_oculto")


def test_pdf_regravado_depois_de_emitido_vai_para_revisao_manual(ambiente) -> None:
    servico, repo, storage, notificador, _ = ambiente
    reg = servico.validar(
        UTILIZADOR, _enviar(storage, criar_pdf(linhas_bai(), actualizacao_incremental=True))
    )
    assert reg.estado == "revisao_manual"
    assert "gravado outra vez" in reg.motivo
    assert UTILIZADOR not in repo.premium
    assert len(notificador.mensagens) == 1


def test_moddate_muito_depois_da_criacao_vai_para_revisao_manual(ambiente) -> None:
    servico, _, storage, *_ = ambiente
    pdf = criar_pdf(
        linhas_bai(), criado_em=datetime(2026, 10, 14, 9, 30), modificado_em=datetime(2026, 10, 14, 11, 0)
    )
    reg = servico.validar(UTILIZADOR, _enviar(storage, pdf))
    assert reg.estado == "revisao_manual"
    assert "modificado depois de emitido" in reg.motivo


def test_gerador_fora_da_lista_configurada_vai_para_revisao(ambiente) -> None:
    _, repo, storage, *_ = ambiente
    servico = _servico_com(replace(CONFIG, producers_confiaveis=("jasperreports",)), repo, storage)
    reg = servico.validar(UTILIZADOR, _enviar(storage, criar_pdf(linhas_bai())))
    assert reg.estado == "revisao_manual"
    assert "gerador do PDF" in reg.motivo


def test_gerador_da_lista_configurada_aprova(ambiente) -> None:
    _, repo, storage, *_ = ambiente
    servico = _servico_com(replace(CONFIG, producers_confiaveis=("bai directo",)), repo, storage)
    assert servico.validar(UTILIZADOR, _enviar(storage, criar_pdf(linhas_bai()))).estado == "aprovado"


# --- camada 3: conteúdo -------------------------------------------------------


def test_comprovativo_do_express_com_o_telefone_oficial_aprova(ambiente) -> None:
    servico, _repo, storage, *_ = ambiente
    reg = servico.validar(
        UTILIZADOR, _enviar(storage, criar_pdf(linhas_express(), producer="EMIS", creator="Multicaixa Express"))
    )
    assert reg.estado == "aprovado", reg.motivo
    assert reg.origem == "multicaixa_express"
    assert reg.destinatario_detectado == TELEFONE_OFICIAL
    assert reg.referencia_transacao == "MCX88776655"
    assert reg.montante_kz == Decimal("15000.00")


@pytest.mark.parametrize("montante", ["KZ 15,000.00", "15000,00 Kz", "15 000,00 AOA", "20.000,00 Kz"])
def test_formatos_angolanos_de_montante_suficiente_aprovam(ambiente, montante) -> None:
    servico, _, storage, *_ = ambiente
    reg = servico.validar(UTILIZADOR, _enviar(storage, criar_pdf(linhas_bai(montante=montante))))
    assert reg.estado == "aprovado", reg.motivo


def test_iban_sem_prefixo_do_pais_conta_como_destinatario(ambiente) -> None:
    servico, _, storage, *_ = ambiente
    reg = servico.validar(
        UTILIZADOR, _enviar(storage, criar_pdf(linhas_bai(iban="0040 0000 1234 5678 9012 3")))
    )
    assert reg.estado == "aprovado", reg.motivo


def test_so_o_nome_do_titular_chega_como_destinatario(ambiente) -> None:
    _, repo, storage, *_ = ambiente
    servico = _servico_com(replace(CONFIG, iban="", telefone=""), repo, storage)
    reg = servico.validar(UTILIZADOR, _enviar(storage, criar_pdf(linhas_bai())))
    assert reg.estado == "aprovado", reg.motivo
    assert reg.destinatario_detectado == NOME_OFICIAL


def test_montante_de_dois_meses_ou_mais_vai_para_revisao(ambiente) -> None:
    """O automático só dá 30 dias -- quem pagou o plano anual não pode perder o resto."""
    servico, repo, storage, *_ = ambiente
    reg = servico.validar(UTILIZADOR, _enviar(storage, criar_pdf(linhas_bai(montante="150.000,00 Kz"))))
    assert reg.estado == "revisao_manual"
    assert UTILIZADOR not in repo.premium


def test_sem_numero_de_operacao_vai_para_revisao_e_avisa_os_admins(ambiente) -> None:
    servico, repo, storage, notificador, _ = ambiente
    sem_referencia = [linha for linha in linhas_bai() if "Operação:" not in linha]
    reg = servico.validar(UTILIZADOR, _enviar(storage, criar_pdf(sem_referencia)))

    assert reg.estado == "revisao_manual"
    assert "número da operação" in reg.motivo
    assert UTILIZADOR not in repo.premium
    _titulo, mensagem = notificador.mensagens[0]
    assert "u-1@example.com" in mensagem


def test_comprovativo_com_mais_de_3_dias_e_rejeitado(ambiente) -> None:
    servico, _, storage, *_ = ambiente
    reg = servico.validar(UTILIZADOR, _enviar(storage, criar_pdf(linhas_bai(data="10/10/2026 18:00"))))
    assert (reg.estado, reg.motivo_codigo) == ("rejeitado", "comprovativo_antigo")


def test_comprovativo_de_ha_3_dias_ainda_e_aceite(ambiente) -> None:
    servico, _, storage, *_ = ambiente
    reg = servico.validar(UTILIZADOR, _enviar(storage, criar_pdf(linhas_bai(data="11/10/2026 08:00"))))
    assert reg.estado == "aprovado", reg.motivo


def test_data_no_futuro_e_rejeitada(ambiente) -> None:
    servico, _, storage, *_ = ambiente
    reg = servico.validar(UTILIZADOR, _enviar(storage, criar_pdf(linhas_bai(data="15/10/2026 09:00"))))
    assert (reg.estado, reg.motivo_codigo) == ("rejeitado", "data_futura")


@pytest.mark.parametrize("estado", ["Transferência agendada para 20/10/2026", "Operação pendente", "Não efectuada"])
def test_operacao_nao_concluida_e_rejeitada(ambiente, estado) -> None:
    servico, _, storage, *_ = ambiente
    reg = servico.validar(UTILIZADOR, _enviar(storage, criar_pdf(linhas_bai(estado=estado))))
    assert (reg.estado, reg.motivo_codigo) == ("rejeitado", "operacao_nao_concluida")


def test_sem_indicacao_de_estado_vai_para_revisao(ambiente) -> None:
    servico, _, storage, *_ = ambiente
    reg = servico.validar(UTILIZADOR, _enviar(storage, criar_pdf(linhas_bai(estado="Obrigado."))))
    assert reg.estado == "revisao_manual"


def test_aprovacao_automatica_desligada_manda_tudo_para_revisao(ambiente) -> None:
    _, repo, storage, *_ = ambiente
    servico = _servico_com(replace(CONFIG, auto_aprovacao=False), repo, storage)
    reg = servico.validar(UTILIZADOR, _enviar(storage, criar_pdf(linhas_bai())))
    assert reg.estado == "revisao_manual"
    assert UTILIZADOR not in repo.premium


# --- camada 4: Premium e corrida ----------------------------------------------


def test_renovar_antes_do_fim_soma_30_dias_a_validade_actual(ambiente) -> None:
    servico, repo, storage, *_ = ambiente
    repo.premium[UTILIZADOR] = AGORA + timedelta(days=10)
    reg = servico.validar(UTILIZADOR, _enviar(storage, criar_pdf(linhas_bai())))
    assert reg.premium_expira_em == AGORA + timedelta(days=40)


def test_premium_ja_expirado_conta_30_dias_a_partir_de_agora(ambiente) -> None:
    servico, repo, storage, *_ = ambiente
    repo.premium[UTILIZADOR] = AGORA - timedelta(days=5)
    reg = servico.validar(UTILIZADOR, _enviar(storage, criar_pdf(linhas_bai())))
    assert reg.premium_expira_em == AGORA + timedelta(days=30)


def test_corrida_apanhada_pelo_indice_unico_fica_rejeitada_sem_premium(ambiente) -> None:
    servico, repo, storage, *_ = ambiente
    repo.falhar_proximo_commit_por_duplicado = True
    reg = servico.validar(UTILIZADOR, _enviar(storage, criar_pdf(linhas_bai())))
    assert (reg.estado, reg.motivo_codigo) == ("rejeitado", "comprovativo_ja_utilizado")
    assert UTILIZADOR not in repo.premium


# --- fronteiras -----------------------------------------------------------------


def test_chave_de_outro_utilizador_e_recusada(ambiente) -> None:
    servico, _, storage, *_ = ambiente
    chave = _enviar(storage, criar_pdf(linhas_bai()), utilizador="u-2")
    with pytest.raises(ChaveDeComprovativoInvalidaError):
        servico.validar(UTILIZADOR, chave)


@pytest.mark.parametrize("chave", ["comprovativos/abc.pdf", "comprovativos-pagamento/u-1/../u-2/a.pdf"])
def test_chave_fora_do_prefixo_do_proprio_e_recusada(ambiente, chave) -> None:
    servico, *_ = ambiente
    with pytest.raises(ChaveDeComprovativoInvalidaError):
        servico.validar(UTILIZADOR, chave)


def test_ficheiro_que_nao_chegou_ao_storage(ambiente) -> None:
    servico, *_ = ambiente
    with pytest.raises(FicheiroNaoEnviadoError):
        servico.validar(UTILIZADOR, "comprovativos-pagamento/u-1/nada.pdf")


def test_sem_conta_de_destino_configurada_nunca_valida_nada() -> None:
    servico = _servico_com(replace(CONFIG, iban="", telefone="", palavras_nome=""))
    with pytest.raises(ValidacaoIndisponivelError):
        servico.preparar_upload(UTILIZADOR)
    with pytest.raises(ValidacaoIndisponivelError):
        servico.validar(UTILIZADOR, "comprovativos-pagamento/u-1/a.pdf")


def test_preparar_upload_assina_uma_chave_do_proprio_utilizador(ambiente) -> None:
    servico, *_ = ambiente
    preparado = servico.preparar_upload(UTILIZADOR)
    assert preparado.chave.startswith("comprovativos-pagamento/u-1/")
    assert preparado.chave.endswith(".pdf")
    assert "application/pdf" in preparado.url_de_upload


def test_falha_a_avisar_os_admins_nao_perde_o_registo(ambiente) -> None:
    _, repo, storage, *_ = ambiente

    class NotificadorPartido:
        def notificar(self, titulo, mensagem):
            raise RuntimeError("sem rede")

    servico = _servico_com(CONFIG, repo, storage, NotificadorPartido())
    sem_referencia = [linha for linha in linhas_bai() if "Operação:" not in linha]
    reg = servico.validar(UTILIZADOR, _enviar(storage, criar_pdf(sem_referencia)))
    assert reg.estado == "revisao_manual"
    assert reg.id in repo.registos


# --- decisões do admin ----------------------------------------------------------


def _em_revisao(servico, storage) -> ComprovativoRegisto:
    sem_referencia = [linha for linha in linhas_bai() if "Operação:" not in linha]
    return servico.validar(UTILIZADOR, _enviar(storage, criar_pdf(sem_referencia), nome="rev"))


def test_admin_aprova_uma_revisao_manual_e_da_premium(ambiente) -> None:
    servico, repo, storage, *_ = ambiente
    reg = servico.aprovar_manualmente(_em_revisao(servico, storage).id, "admin-1")
    assert (reg.estado, reg.decidido_por) == ("aprovado", "admin-1")
    assert repo.premium[UTILIZADOR] == AGORA + timedelta(days=30)


def test_admin_aprova_um_rejeitado_por_engano(ambiente) -> None:
    servico, repo, storage, *_ = ambiente
    antigo = servico.validar(UTILIZADOR, _enviar(storage, criar_pdf(linhas_bai(data="09/10/2026 09:25"))))
    reg = servico.aprovar_manualmente(antigo.id, "admin-1")
    assert reg.estado == "aprovado"
    assert repo.premium[UTILIZADOR] == AGORA + timedelta(days=30)


def test_admin_nao_aprova_um_rejeitado_cuja_operacao_ja_conta(ambiente) -> None:
    servico, repo, storage, *_ = ambiente
    servico.validar(UTILIZADOR, _enviar(storage, criar_pdf(linhas_bai()), nome="a"))
    duplicado = servico.validar(UTILIZADOR, _enviar(storage, criar_pdf(linhas_bai()), nome="b"))
    with pytest.raises(ComprovativoJaContaError):
        servico.aprovar_manualmente(duplicado.id, "admin-1")
    assert repo.premium[UTILIZADOR] == AGORA + timedelta(days=30)


def test_admin_nao_aprova_duas_vezes(ambiente) -> None:
    servico, _, storage, *_ = ambiente
    aprovado = servico.validar(UTILIZADOR, _enviar(storage, criar_pdf(linhas_bai())))
    with pytest.raises(DecisaoInvalidaError):
        servico.aprovar_manualmente(aprovado.id, "admin-1")


def test_admin_rejeita_uma_revisao_manual(ambiente) -> None:
    servico, repo, storage, *_ = ambiente
    reg = servico.rejeitar_manualmente(_em_revisao(servico, storage).id, "admin-1", "não entrou no extracto")
    assert (reg.estado, reg.motivo) == ("rejeitado", "não entrou no extracto")
    assert UTILIZADOR not in repo.premium


def test_revogar_tira_os_30_dias_deste_comprovativo_e_continua_a_bloquear(ambiente) -> None:
    servico, repo, storage, *_ = ambiente
    conteudo = criar_pdf(linhas_bai())
    aprovado = servico.validar(UTILIZADOR, _enviar(storage, conteudo, nome="a"))

    reg = servico.revogar(aprovado.id, "admin-1", "não está no extracto")

    assert reg.estado == "revogado"
    assert repo.premium[UTILIZADOR] is None
    # O ficheiro revogado não pode ser reaproveitado.
    assert servico.validar(UTILIZADOR, _enviar(storage, conteudo, nome="b")).motivo_codigo == "comprovativo_ja_utilizado"


def test_revogar_nao_apaga_dias_pagos_por_outro_comprovativo(ambiente) -> None:
    servico, repo, storage, *_ = ambiente
    repo.premium[UTILIZADOR] = AGORA + timedelta(days=20)  # outro pagamento
    aprovado = servico.validar(UTILIZADOR, _enviar(storage, criar_pdf(linhas_bai())))
    assert repo.premium[UTILIZADOR] == AGORA + timedelta(days=50)

    servico.revogar(aprovado.id, "admin-1", "fraude")
    assert repo.premium[UTILIZADOR] == AGORA + timedelta(days=20)


def test_so_se_revoga_um_aprovado(ambiente) -> None:
    servico, _, storage, *_ = ambiente
    with pytest.raises(DecisaoInvalidaError):
        servico.revogar(_em_revisao(servico, storage).id, "admin-1", "x" * 5)


def test_formatar_kz() -> None:
    assert formatar_kz(Decimal(15000)) == "15.000,00 Kz"
    assert formatar_kz(Decimal("1234567.5")) == "1.234.567,50 Kz"
