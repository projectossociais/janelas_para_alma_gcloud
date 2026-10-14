"""Validação instantânea do comprovativo de pagamento do Premium (BAI Directo
e Multicaixa Express) -- lógica de dinheiro e de acesso, por isso vive num
service com testes e nunca confia num id vindo do corpo do pedido (CLAUDE.md
§3/§4/§10). Decidido pelo dono do projecto em 2026-10-14: substitui o envio
do comprovativo por email e a espera pela aprovação de um admin.

O utilizador envia o PDF original da app do banco directamente ao bucket
privado (URL de `PUT` assinado, como o avatar -- CLAUDE.md §4b) e pede a
validação com a chave. A API lê o ficheiro e passa-o por camadas:

1. **Ficheiro** -- é mesmo um PDF (`%PDF-`), até 5 MB; o SHA-256 dos bytes
   nunca pode já contar noutro comprovativo.
2. **Adulteração** -- /Producer e /Creator sem ferramentas de edição
   (Canva, Word, iLovePDF...), sem texto invisível por cima de uma imagem,
   com texto que se consiga ler (uma captura de ecrã em PDF não tem).
3. **Conteúdo** -- destinatário = conta oficial (IBAN, telefone Express ou
   nome do titular), montante >= preço, número da operação nunca usado,
   data dos últimos N dias e não no futuro, operação concluída.
4. **Gravação atómica** -- comprovativo aprovado e +30 dias de Premium na
   mesma transacção (somados à validade actual, se ainda houver).

O que é claramente errado (valor, conta, ficheiro, repetido) é **rejeitado**
com o motivo exacto. O que só não se conseguiu ler com certeza (um layout
novo do banco, um PDF regravado) vai para **revisão manual** e avisa os
admins -- nunca é aprovado por omissão.

O que isto não garante: um PDF forjado com cuidado (texto, metadados e
número de operação inventados) passa as camadas 1-3 -- só o extracto
bancário prova que o dinheiro entrou. Por isso cada aprovação automática fica
no painel para reconciliar e pode ser revogada, e `payment_auto_aprovacao`
desliga a aprovação automática de uma vez se aparecerem fraudes.
"""

import hashlib
import logging
import re
import uuid
from collections.abc import Callable
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from decimal import Decimal
from typing import Protocol

from app.core.config import Settings
from app.repositories.comprovativos_pagamento_repository import (
    AjustePremium,
    ComprovativoDuplicadoError,
    ComprovativoRegisto,
    ComprovativosPagamentoRepository,
    NovoComprovativo,
)
from app.services import comprovativo_pdf as pdf
from app.services.premium_service import PREMIUM_DURACAO_DIAS

logger = logging.getLogger(__name__)

PREFIXO_COMPROVATIVOS_PAGAMENTO = "comprovativos-pagamento"
TAMANHO_MAXIMO_BYTES = 5 * 1024 * 1024
# Menos caracteres visíveis do que isto = não há texto (imagem/captura).
MINIMO_CARACTERES_TEXTO = 40
# Margem para relógios ligeiramente desacertados (telemóvel vs servidor).
TOLERANCIA_FUTURO = timedelta(minutes=15)
# Um PDF gravado outra vez mais de X depois de criado foi mexido.
TOLERANCIA_MODIFICACAO = timedelta(minutes=10)
LIMITE_TEXTO_GUARDADO = 20_000

ESTADO_APROVADO = "aprovado"
ESTADO_REJEITADO = "rejeitado"
ESTADO_REVISAO = "revisao_manual"
ESTADO_REVOGADO = "revogado"

# Códigos de rejeição que são "já foi usado" -- o router responde 409.
CODIGOS_DUPLICADO = frozenset(
    {"comprovativo_ja_utilizado", "comprovativo_em_analise", "transacao_ja_utilizada"}
)

_PEDIR_ORIGINAL = "Envia o PDF original gerado pela aplicação BAI Directo ou Multicaixa Express."


# --- dependências (Protocols) -------------------------------------------------


class ArmazenamentoComprovativos(Protocol):
    def url_de_upload(self, chave: str, content_type: str) -> str: ...
    def ler_bytes(self, chave: str, limite: int) -> bytes | None: ...
    def url_de_leitura(self, chave: str) -> str: ...


class NotificadorAdmins(Protocol):
    def notificar(self, titulo: str, mensagem: str) -> None: ...


@dataclass(frozen=True)
class ConfigPagamento:
    preco_kz: Decimal
    iban: str
    telefone: str
    palavras_nome: str
    max_dias: int
    auto_aprovacao: bool
    producers_confiaveis: tuple[str, ...] = ()

    @classmethod
    def das_settings(cls, s: Settings) -> "ConfigPagamento":
        return cls(
            preco_kz=Decimal(s.subscription_price_kz),
            iban=s.payment_dest_iban,
            telefone=s.payment_dest_phone,
            palavras_nome=s.payment_dest_name_keywords,
            max_dias=s.payment_max_age_days,
            auto_aprovacao=s.payment_auto_aprovacao,
            producers_confiaveis=tuple(
                p.strip().lower() for p in s.payment_producers_confiaveis.split(",") if p.strip()
            ),
        )

    @property
    def destino_configurado(self) -> bool:
        return bool(self.iban.strip() or self.telefone.strip() or self.palavras_nome.strip())


# --- erros e resultados ---------------------------------------------------------


class ValidacaoIndisponivelError(Exception):
    """Sem conta de destino configurada -- nunca aprovar nada nesse estado."""


class ChaveDeComprovativoInvalidaError(Exception):
    """A chave não está sob `comprovativos-pagamento/{utilizador_id}/` --
    ninguém valida um ficheiro que não foi o próprio a enviar."""


class FicheiroNaoEnviadoError(Exception):
    pass


class ComprovativoInexistenteError(Exception):
    pass


class DecisaoInvalidaError(Exception):
    """O comprovativo não está num estado em que esta decisão faça sentido."""


class ComprovativoJaContaError(Exception):
    """Aprovar à mão um comprovativo cujo ficheiro/operação já conta noutro."""


@dataclass(frozen=True)
class UploadPreparado:
    url_de_upload: str
    chave: str


class _Rejeicao(Exception):
    def __init__(self, codigo: str, mensagem: str) -> None:
        super().__init__(mensagem)
        self.codigo = codigo
        self.mensagem = mensagem


def formatar_kz(valor: Decimal) -> str:
    """15000 -> "15.000,00 Kz" (formato angolano)."""
    inteiro, decimal = f"{valor:,.2f}".split(".")
    return f"{inteiro.replace(',', '.')},{decimal} Kz"


# --- service --------------------------------------------------------------------


class ValidacaoComprovativoService:
    def __init__(
        self,
        repositorio: ComprovativosPagamentoRepository,
        armazenamento: ArmazenamentoComprovativos,
        config: ConfigPagamento,
        notificador: NotificadorAdmins | None = None,
        relogio: Callable[[], datetime] = lambda: datetime.now(UTC),
    ) -> None:
        self._repo = repositorio
        self._storage = armazenamento
        self._config = config
        self._notificador = notificador
        self._agora = relogio

    # -- upload --------------------------------------------------------------

    def preparar_upload(self, utilizador_id: str) -> UploadPreparado:
        if not self._config.destino_configurado:
            raise ValidacaoIndisponivelError
        chave = f"{PREFIXO_COMPROVATIVOS_PAGAMENTO}/{utilizador_id}/{uuid.uuid4()}.pdf"
        return UploadPreparado(
            url_de_upload=self._storage.url_de_upload(chave, "application/pdf"), chave=chave
        )

    # -- validação -----------------------------------------------------------

    def validar(self, utilizador_id: str, chave: str) -> ComprovativoRegisto:
        if not self._config.destino_configurado:
            raise ValidacaoIndisponivelError
        prefixo = f"{PREFIXO_COMPROVATIVOS_PAGAMENTO}/{utilizador_id}/"
        if not chave.startswith(prefixo) or ".." in chave:
            raise ChaveDeComprovativoInvalidaError(chave)
        conteudo = self._storage.ler_bytes(chave, TAMANHO_MAXIMO_BYTES)
        if conteudo is None:
            raise FicheiroNaoEnviadoError(chave)

        hash_sha256 = hashlib.sha256(conteudo).hexdigest()
        campos: dict = {}
        avisos: list[str] = []

        def gravar(estado: str, codigo: str | None = None, motivo: str | None = None, ajuste=None):
            return self._repo.registar(
                NovoComprovativo(
                    utilizador_id=utilizador_id,
                    chave_ficheiro=chave,
                    hash_sha256=hash_sha256,
                    estado=estado,
                    motivo_codigo=codigo,
                    motivo=motivo,
                    **campos,
                ),
                ajustar_premium=ajuste,
            )

        try:
            self._camada_ficheiro(conteudo, hash_sha256)
            texto = self._camada_adulteracao(conteudo, campos, avisos)
            self._camada_conteudo(texto, campos, avisos)
        except _Rejeicao as r:
            return gravar(ESTADO_REJEITADO, r.codigo, r.mensagem)

        if not self._config.auto_aprovacao:
            avisos.append("a aprovação automática está desligada")
        if avisos:
            motivo = "A equipa vai confirmar o pagamento manualmente: " + "; ".join(avisos) + "."
            try:
                registo = gravar(ESTADO_REVISAO, "revisao_manual", motivo)
            except ComprovativoDuplicadoError:
                return self._duplicado_na_corrida(gravar)
            self._avisar_admins(registo)
            return registo

        try:
            return gravar(ESTADO_APROVADO, ajuste=self._somar_premium())
        except ComprovativoDuplicadoError:
            return self._duplicado_na_corrida(gravar)

    def _duplicado_na_corrida(self, gravar) -> ComprovativoRegisto:
        """Outro pedido com o mesmo ficheiro/operação ganhou a corrida entre
        a verificação e o `commit` -- o índice único apanhou-o."""
        return gravar(
            ESTADO_REJEITADO,
            "comprovativo_ja_utilizado",
            "Este comprovativo já foi utilizado anteriormente.",
        )

    # Camada 1
    def _camada_ficheiro(self, conteudo: bytes, hash_sha256: str) -> None:
        if len(conteudo) > TAMANHO_MAXIMO_BYTES:
            raise _Rejeicao(
                "ficheiro_grande", f"O ficheiro tem mais de 5 MB. {_PEDIR_ORIGINAL}"
            )
        if not conteudo.lstrip()[:5] == b"%PDF-":
            raise _Rejeicao("ficheiro_invalido", f"O ficheiro não é um PDF válido. {_PEDIR_ORIGINAL}")
        estado = self._repo.estado_por_hash(hash_sha256)
        if estado == ESTADO_REVISAO:
            raise _Rejeicao(
                "comprovativo_em_analise",
                "Este comprovativo já foi enviado e está a ser confirmado pela equipa.",
            )
        if estado is not None:
            raise _Rejeicao(
                "comprovativo_ja_utilizado", "Este comprovativo já foi utilizado anteriormente."
            )

    # Camada 2
    def _camada_adulteracao(self, conteudo: bytes, campos: dict, avisos: list[str]) -> str:
        try:
            lido = pdf.ler_pdf(conteudo)
        except pdf.PdfCifradoError as exc:
            raise _Rejeicao(
                "pdf_protegido",
                f"O PDF está protegido por password e não pode ser verificado. {_PEDIR_ORIGINAL}",
            ) from exc
        except pdf.PdfIlegivelError as exc:
            raise _Rejeicao(
                "ficheiro_invalido", f"O ficheiro não é um PDF válido. {_PEDIR_ORIGINAL}"
            ) from exc

        campos["metadados_pdf"] = {
            **lido.metadados,
            "paginas": lido.paginas,
            "actualizacoes_incrementais": lido.actualizacoes_incrementais,
            "cifrado": lido.cifrado,
            "texto_invisivel": lido.texto_invisivel,
        }
        campos["texto_extraido"] = lido.texto[:LIMITE_TEXTO_GUARDADO] or None

        editor = pdf.editor_suspeito(lido.metadados)
        if editor:
            raise _Rejeicao(
                "edicao_suspeita",
                f"Este PDF foi criado ou alterado com um editor de documentos ({editor}). "
                f"{_PEDIR_ORIGINAL}",
            )
        if lido.texto_invisivel:
            raise _Rejeicao(
                "texto_oculto",
                "Este PDF tem texto escondido por cima de uma imagem (digitalização ou "
                f"captura de ecrã). {_PEDIR_ORIGINAL}",
            )
        if len(re.sub(r"\s", "", lido.texto)) < MINIMO_CARACTERES_TEXTO:
            raise _Rejeicao(
                "sem_texto",
                "Não foi possível ler texto neste PDF -- parece uma imagem ou uma captura de "
                f"ecrã. {_PEDIR_ORIGINAL} Não envies capturas de ecrã nem fotografias.",
            )

        # Sinais fracos: um PDF legítimo raramente os tem, mas não chegam
        # para acusar ninguém -- vão para revisão manual.
        if lido.actualizacoes_incrementais > 0:
            avisos.append("o PDF foi gravado outra vez depois de emitido")
        criado = pdf.data_de_metadado_pdf(lido.metadados.get("CreationDate"))
        modificado = pdf.data_de_metadado_pdf(lido.metadados.get("ModDate"))
        if criado and modificado and modificado - criado > TOLERANCIA_MODIFICACAO:
            avisos.append("o PDF foi modificado depois de emitido")
        produtor = lido.metadados.get("Producer", "").lower()
        if self._config.producers_confiaveis and not any(
            p in produtor for p in self._config.producers_confiaveis
        ):
            avisos.append("o gerador do PDF não é o habitual do banco")
        if lido.paginas > pdf.MAX_PAGINAS_LIDAS:
            avisos.append("o PDF tem demasiadas páginas para um comprovativo")
        return lido.texto

    # Camada 3
    def _camada_conteudo(self, texto: str, campos: dict, avisos: list[str]) -> None:
        cfg = self._config
        normalizado = pdf.normalizar(texto)

        campos["origem"] = pdf.extrair_origem(normalizado)
        if campos["origem"] == pdf.ORIGEM_OUTRA:
            avisos.append("não foi possível confirmar que é do BAI Directo ou do Multicaixa Express")

        destinatario = pdf.destinatario_coincide(texto, cfg.iban, cfg.telefone, cfg.palavras_nome)
        if destinatario is None:
            raise _Rejeicao(
                "destinatario_invalido",
                "O destinatário do comprovativo não corresponde à conta oficial do projeto.",
            )
        campos["destinatario_detectado"] = destinatario

        montante = pdf.extrair_montante(normalizado)
        campos["montante_kz"] = montante
        if montante is None:
            avisos.append("não foi possível ler o montante")
        elif montante < cfg.preco_kz:
            raise _Rejeicao(
                "valor_insuficiente",
                f"Valor inferior ao da subscrição: o comprovativo mostra {formatar_kz(montante)} "
                f"e são precisos {formatar_kz(cfg.preco_kz)}.",
            )
        elif montante >= 2 * cfg.preco_kz:
            # O automático só dá 30 dias -- quem pagou mais (ex.: plano anual)
            # tem de ser visto por uma pessoa para não perder o que pagou.
            avisos.append(f"o montante ({formatar_kz(montante)}) é superior ao de um mês")

        referencia = pdf.extrair_referencia(normalizado, ignorar=(cfg.iban, cfg.telefone))
        campos["referencia_transacao"] = referencia
        if referencia is None:
            avisos.append("não foi possível ler o número da operação")
        else:
            estado = self._repo.estado_por_referencia(referencia)
            if estado is not None:
                raise _Rejeicao(
                    "transacao_ja_utilizada",
                    "Esta transação bancária já foi validada anteriormente.",
                )

        data = pdf.extrair_data(normalizado)
        campos["data_transacao"] = data
        agora = self._agora()
        if data is None:
            avisos.append("não foi possível ler a data da operação")
        else:
            if data > agora + TOLERANCIA_FUTURO:
                raise _Rejeicao("data_futura", "A data do comprovativo está no futuro.")
            hoje = agora.astimezone(pdf.FUSO_LUANDA).date()
            if (hoje - data.astimezone(pdf.FUSO_LUANDA).date()).days > cfg.max_dias:
                raise _Rejeicao(
                    "comprovativo_antigo",
                    f"O comprovativo tem mais de {cfg.max_dias} dias. Só são aceites "
                    f"comprovativos de pagamentos feitos nos últimos {cfg.max_dias} dias -- "
                    "se pagaste antes disso, contacta a equipa.",
                )

        estado_operacao = pdf.extrair_estado(normalizado)
        if estado_operacao == "nao_concluida":
            raise _Rejeicao(
                "operacao_nao_concluida",
                "O comprovativo não mostra uma operação concluída (parece um agendamento ou "
                "uma operação pendente). Envia o comprovativo depois de a transferência ser executada.",
            )
        if estado_operacao is None:
            avisos.append("o comprovativo não indica que a operação foi concluída")

    # -- Premium ---------------------------------------------------------------

    def _somar_premium(self) -> AjustePremium:
        """+30 dias a partir da validade actual (renovar antes do fim não
        perde dias), ou a partir de agora se o Premium já não estiver activo."""
        agora = self._agora()

        def ajustar(actual: datetime | None) -> datetime:
            base = actual if actual is not None and actual > agora else agora
            return base + timedelta(days=PREMIUM_DURACAO_DIAS)

        return ajustar

    def _retirar_premium(self) -> AjustePremium:
        """Desfaz os 30 dias deste comprovativo. Se não sobrar validade, o
        Premium desliga -- não apaga dias pagos por outro comprovativo."""
        agora = self._agora()

        def ajustar(actual: datetime | None) -> datetime | None:
            if actual is None:
                return None
            restante = actual - timedelta(days=PREMIUM_DURACAO_DIAS)
            return restante if restante > agora else None

        return ajustar

    def _avisar_admins(self, registo: ComprovativoRegisto) -> None:
        if self._notificador is None:
            return
        quem = registo.utilizador_email or "Um utilizador"
        try:
            self._notificador.notificar(
                "Comprovativo de pagamento para confirmar",
                f"{quem} enviou um comprovativo que precisa de confirmação manual. {registo.motivo}",
            )
        except Exception:  # avisar é acessório -- o registo já está gravado
            logger.exception("falha ao avisar os admins do comprovativo %s", registo.id)

    # -- decisões do admin -------------------------------------------------------

    def _obter(self, comprovativo_id: str) -> ComprovativoRegisto:
        registo = self._repo.obter(comprovativo_id)
        if registo is None:
            raise ComprovativoInexistenteError(comprovativo_id)
        return registo

    def aprovar_manualmente(self, comprovativo_id: str, admin_id: str) -> ComprovativoRegisto:
        """Um admin confirmou o pagamento (no extracto). Vale para uma revisão
        manual e para um rejeitado por engano (ex.: pago há 4 dias)."""
        registo = self._obter(comprovativo_id)
        if registo.estado not in (ESTADO_REVISAO, ESTADO_REJEITADO):
            raise DecisaoInvalidaError(registo.estado)
        try:
            return self._repo.decidir(
                comprovativo_id,
                ESTADO_APROVADO,
                admin_id,
                self._agora(),
                motivo_codigo="aprovado_pela_equipa",
                motivo="Pagamento confirmado pela equipa.",
                ajustar_premium=self._somar_premium(),
            )
        except ComprovativoDuplicadoError as exc:
            raise ComprovativoJaContaError(comprovativo_id) from exc

    def rejeitar_manualmente(
        self, comprovativo_id: str, admin_id: str, motivo: str
    ) -> ComprovativoRegisto:
        registo = self._obter(comprovativo_id)
        if registo.estado != ESTADO_REVISAO:
            raise DecisaoInvalidaError(registo.estado)
        return self._repo.decidir(
            comprovativo_id,
            ESTADO_REJEITADO,
            admin_id,
            self._agora(),
            motivo_codigo="rejeitado_pela_equipa",
            motivo=motivo,
        )

    def revogar(self, comprovativo_id: str, admin_id: str, motivo: str) -> ComprovativoRegisto:
        """Um comprovativo aprovado que não bate com o extracto (fraude ou
        erro). Fica `revogado` -- continua a bloquear o ficheiro e a operação."""
        registo = self._obter(comprovativo_id)
        if registo.estado != ESTADO_APROVADO:
            raise DecisaoInvalidaError(registo.estado)
        return self._repo.decidir(
            comprovativo_id,
            ESTADO_REVOGADO,
            admin_id,
            self._agora(),
            motivo_codigo="revogado_pela_equipa",
            motivo=motivo,
            ajustar_premium=self._retirar_premium(),
        )

    def url_do_ficheiro(self, comprovativo_id: str) -> str:
        return self._storage.url_de_leitura(self._obter(comprovativo_id).chave_ficheiro)
