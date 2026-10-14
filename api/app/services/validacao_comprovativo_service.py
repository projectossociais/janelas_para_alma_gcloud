"""Validação instantânea do comprovativo de pagamento do Premium -- lógica de
dinheiro e de acesso, por isso vive num service com testes e nunca confia
num id vindo do corpo do pedido (CLAUDE.md §3/§4/§10). Decidido pelo dono do
projecto em 2026-10-14: substitui o envio do comprovativo por email e a
espera pela aprovação de um admin.

A conta de destino é a do projecto (no BAI); quem paga pode usar **qualquer
banco angolano** (BAI, BFA, BIC, Atlântico, Sol, Standard Bank, Keve,
Access, BNI, Caixa Geral...) ou o **Multicaixa Express**, e enviar o **PDF**
do comprovativo ou uma **captura de ecrã** (PNG/JPEG/WebP) -- muita gente
não sabe descarregar o PDF no telemóvel. O ficheiro vai do browser
directamente ao bucket privado (URL de `PUT` assinado, CLAUDE.md §4b) e a
API lê-o e passa-o por camadas:

1. **Ficheiro** -- PDF ou imagem pelos bytes (nunca pela extensão), até
   5 MB; o SHA-256 nunca pode já contar noutro comprovativo.
2. **Adulteração e leitura** -- sem ferramentas de edição nos metadados
   (/Producer de um PDF, EXIF/XMP de uma imagem). O texto sai da camada de
   texto do PDF ou, numa imagem (ou num PDF que é só uma imagem), do OCR
   local (`app/core/ocr.py`). Uma captura quase igual a outra já usada
   (hash perceptual) com o mesmo número de operação, ou sem ele legível,
   vai para revisão.
3. **Conteúdo** -- destinatário = conta oficial (IBAN, NBA, conta, telefone
   Express ou nome do titular), montante >= preço, número da operação
   nunca usado, data dos últimos N dias e não no futuro, operação concluída.
4. **Gravação atómica** -- comprovativo aprovado e +30 dias de Premium na
   mesma transacção (somados à validade actual, se ainda houver).

O que é claramente errado num PDF (valor, conta, ficheiro, repetido) é
**rejeitado** com o motivo exacto. Numa imagem, o OCR pode ter lido mal --
por isso valor, conta e data errados **lidos por OCR** vão para revisão em
vez de rejeitar quem acabou de pagar; só o repetido e a operação falhada se
rejeitam. O que não se conseguiu ler com certeza (layout novo, imagem
desfocada, PDF regravado) vai para **revisão manual** e avisa os admins --
nunca é aprovado por omissão.

O que isto não garante: um PDF ou uma captura forjados com cuidado passam
as camadas 1-3 -- só o extracto bancário prova que o dinheiro entrou. Por
isso cada aprovação automática fica no painel para reconciliar e pode ser
revogada, e `payment_auto_aprovacao` / `payment_auto_aprovar_imagens`
desligam a aprovação automática se aparecerem fraudes.
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

from PIL import Image

from app.core.config import Settings
from app.core.ocr import LeitorOcr, OcrIndisponivelError
from app.repositories.comprovativos_pagamento_repository import (
    AjustePremium,
    ComprovativoDuplicadoError,
    ComprovativoRegisto,
    ComprovativosPagamentoRepository,
    NovoComprovativo,
)
from app.services import comprovativo_imagem as imagem
from app.services import comprovativo_pdf as pdf
from app.services import comprovativo_texto as txt
from app.services.premium_service import PREMIUM_DURACAO_DIAS

logger = logging.getLogger(__name__)

PREFIXO_COMPROVATIVOS_PAGAMENTO = "comprovativos-pagamento"
TAMANHO_MAXIMO_BYTES = 5 * 1024 * 1024
# Menos caracteres visíveis do que isto = não há texto (imagem/captura).
MINIMO_CARACTERES_TEXTO = 40
# Confiança média do OCR abaixo da qual a leitura não serve para decidir.
CONFIANCA_MINIMA_OCR = 60.0
# Duas referências a esta distância (ou menos) são a mesma lida duas vezes
# pelo OCR com um carácter trocado.
DISTANCIA_MAXIMA_REFERENCIA = 2
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
# Numa leitura por OCR, estes erros podem ser o OCR a ler mal (um "1" que
# some de 15.000, um dígito do IBAN trocado) -- vão para revisão em vez de
# rejeitar quem acabou de pagar.
CODIGOS_SUAVES_NO_OCR = frozenset(
    {"destinatario_invalido", "valor_insuficiente", "data_futura", "comprovativo_antigo"}
)

CONTENT_TYPES_ACEITES = {
    "application/pdf": "pdf",
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/webp": "webp",
}

_PEDIR_ORIGINAL = (
    "Envia o PDF do comprovativo ou uma captura de ecrã nítida do pagamento "
    "(de qualquer banco ou do Multicaixa Express)."
)


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
    auto_aprovar_imagens: bool = True
    aceitar_interbancario_pendente: bool = False

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
            auto_aprovar_imagens=s.payment_auto_aprovar_imagens,
            aceitar_interbancario_pendente=s.payment_aceitar_interbancario_pendente,
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


class TipoDeFicheiroNaoPermitidoError(Exception):
    pass


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


@dataclass
class _Leitura:
    """O texto a validar e de onde veio. `texto=None` = não se conseguiu ler
    (OCR desfocado/indisponível) -- vai para revisão sem olhar ao conteúdo."""

    texto: str | None
    via_ocr: bool


def formatar_kz(valor: Decimal) -> str:
    """15000 -> "15.000,00 Kz" (formato angolano)."""
    inteiro, decimal = f"{valor:,.2f}".split(".")
    return f"{inteiro.replace(',', '.')},{decimal} Kz"


def _distancia_edicao(a: str, b: str) -> int:
    """Levenshtein -- quantos caracteres separam duas referências."""
    anterior = list(range(len(b) + 1))
    for i, ca in enumerate(a, 1):
        actual = [i]
        for j, cb in enumerate(b, 1):
            actual.append(min(anterior[j] + 1, actual[j - 1] + 1, anterior[j - 1] + (ca != cb)))
        anterior = actual
    return anterior[-1]


# --- service --------------------------------------------------------------------


class ValidacaoComprovativoService:
    def __init__(
        self,
        repositorio: ComprovativosPagamentoRepository,
        armazenamento: ArmazenamentoComprovativos,
        config: ConfigPagamento,
        notificador: NotificadorAdmins | None = None,
        relogio: Callable[[], datetime] = lambda: datetime.now(UTC),
        ocr: LeitorOcr | None = None,
    ) -> None:
        self._repo = repositorio
        self._storage = armazenamento
        self._config = config
        self._notificador = notificador
        self._agora = relogio
        self._ocr = ocr

    # -- upload --------------------------------------------------------------

    def preparar_upload(self, utilizador_id: str, content_type: str) -> UploadPreparado:
        if not self._config.destino_configurado:
            raise ValidacaoIndisponivelError
        extensao = CONTENT_TYPES_ACEITES.get(content_type)
        if extensao is None:
            raise TipoDeFicheiroNaoPermitidoError(content_type)
        chave = f"{PREFIXO_COMPROVATIVOS_PAGAMENTO}/{utilizador_id}/{uuid.uuid4()}.{extensao}"
        return UploadPreparado(
            url_de_upload=self._storage.url_de_upload(chave, content_type), chave=chave
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
            tipo = self._camada_ficheiro(conteudo, hash_sha256)
            campos["metadados_ficheiro"] = {"tipo": tipo}
            if tipo == imagem.TIPO_PDF:
                leitura = self._ler_pdf(conteudo, campos, avisos)
            else:
                leitura = self._ler_imagem(conteudo, campos, avisos)
            if leitura.texto is not None:
                self._camada_conteudo(leitura.texto, campos, avisos, leitura.via_ocr)
                self._captura_repetida(campos, avisos)
        except _Rejeicao as r:
            return gravar(ESTADO_REJEITADO, r.codigo, r.mensagem)

        if not self._config.auto_aprovacao:
            avisos.append("a aprovação automática está desligada")
        elif leitura.via_ocr and not self._config.auto_aprovar_imagens:
            avisos.append("a aprovação automática de capturas de ecrã está desligada")
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
    def _camada_ficheiro(self, conteudo: bytes, hash_sha256: str) -> str:
        if len(conteudo) > TAMANHO_MAXIMO_BYTES:
            raise _Rejeicao("ficheiro_grande", f"O ficheiro tem mais de 5 MB. {_PEDIR_ORIGINAL}")
        tipo = imagem.detectar_tipo(conteudo)
        if tipo is None:
            raise _Rejeicao(
                "ficheiro_invalido", f"O ficheiro não é um PDF nem uma imagem válida. {_PEDIR_ORIGINAL}"
            )
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
        return tipo

    # Camada 2 -- PDF
    def _ler_pdf(self, conteudo: bytes, campos: dict, avisos: list[str]) -> _Leitura:
        try:
            lido = pdf.ler_pdf(conteudo)
        except pdf.PdfCifradoError as exc:
            raise _Rejeicao(
                "pdf_protegido",
                f"O PDF está protegido por password e não pode ser verificado. {_PEDIR_ORIGINAL}",
            ) from exc
        except pdf.PdfIlegivelError as exc:
            raise _Rejeicao(
                "ficheiro_invalido", f"O ficheiro não é um PDF nem uma imagem válida. {_PEDIR_ORIGINAL}"
            ) from exc

        campos["metadados_ficheiro"].update(
            {
                **lido.metadados,
                "paginas": lido.paginas,
                "actualizacoes_incrementais": lido.actualizacoes_incrementais,
                "cifrado": lido.cifrado,
                "texto_invisivel": lido.texto_invisivel,
            }
        )
        editor = pdf.editor_suspeito(lido.metadados)
        if editor:
            raise _Rejeicao(
                "edicao_suspeita",
                f"Este ficheiro foi criado ou alterado com um editor ({editor}). {_PEDIR_ORIGINAL}",
            )

        # Sinais fracos: um PDF legítimo raramente os tem, mas não chegam
        # para acusar ninguém -- vão para revisão manual.
        if lido.actualizacoes_incrementais > 0:
            avisos.append("o PDF foi gravado outra vez depois de emitido")
        criado = pdf.data_de_metadado_pdf(lido.metadados.get("CreationDate"))
        modificado = pdf.data_de_metadado_pdf(lido.metadados.get("ModDate"))
        if criado and modificado and modificado - criado > TOLERANCIA_MODIFICACAO:
            avisos.append("o PDF foi modificado depois de emitido")
        if lido.paginas > pdf.MAX_PAGINAS_LIDAS:
            avisos.append("o PDF tem demasiadas páginas para um comprovativo")

        texto_nativo = len(re.sub(r"\s", "", lido.texto)) >= MINIMO_CARACTERES_TEXTO
        if texto_nativo and not lido.texto_invisivel:
            produtor = lido.metadados.get("Producer", "").lower()
            if self._config.producers_confiaveis and not any(
                p in produtor for p in self._config.producers_confiaveis
            ):
                avisos.append("o gerador do PDF não é o habitual do banco")
            campos["texto_extraido"] = lido.texto[:LIMITE_TEXTO_GUARDADO]
            return _Leitura(lido.texto, via_ocr=False)

        # Sem texto nativo (captura de ecrã exportada em PDF, digitalização) ou
        # com texto invisível por cima de uma imagem: a camada de texto não
        # merece confiança -- lê-se a própria imagem.
        if lido.maior_imagem is None:
            raise _Rejeicao(
                "sem_texto",
                f"Não foi possível ler este PDF: não tem texto nem imagem. {_PEDIR_ORIGINAL}",
            )
        return self._ler_por_ocr(lido.maior_imagem, campos, avisos)

    # Camada 2 -- imagem
    def _ler_imagem(self, conteudo: bytes, campos: dict, avisos: list[str]) -> _Leitura:
        try:
            lida = imagem.abrir_imagem(conteudo)
        except imagem.ImagemIlegivelError as exc:
            raise _Rejeicao(
                "imagem_invalida", f"Não foi possível abrir esta imagem. {_PEDIR_ORIGINAL}"
            ) from exc
        campos["metadados_ficheiro"].update(
            {**lida.metadados, "formato": lida.formato, "largura": lida.largura, "altura": lida.altura}
        )
        editor = imagem.editor_suspeito_imagem(lida.metadados)
        if editor:
            raise _Rejeicao(
                "edicao_suspeita",
                f"Este ficheiro foi criado ou alterado com um editor ({editor}). {_PEDIR_ORIGINAL}",
            )
        return self._ler_por_ocr(lida.imagem, campos, avisos)

    def _ler_por_ocr(self, img: Image.Image, campos: dict, avisos: list[str]) -> _Leitura:
        campos["hash_perceptual"] = imagem.hash_perceptual(img)
        if self._ocr is None:
            avisos.append("a leitura automática de imagens não está disponível")
            return _Leitura(None, via_ocr=True)
        try:
            lido = self._ocr.ler(imagem.preparar_para_ocr(img))
        except OcrIndisponivelError:
            avisos.append("a leitura automática de imagens falhou")
            return _Leitura(None, via_ocr=True)
        campos["metadados_ficheiro"]["ocr_confianca"] = round(lido.confianca, 1)
        campos["texto_extraido"] = lido.texto[:LIMITE_TEXTO_GUARDADO] or None
        legivel = len(re.sub(r"\s", "", lido.texto)) >= MINIMO_CARACTERES_TEXTO
        if not legivel or lido.confianca < CONFIANCA_MINIMA_OCR:
            avisos.append("a imagem está desfocada ou não se consegue ler com clareza")
            return _Leitura(None, via_ocr=True)
        return _Leitura(lido.texto, via_ocr=True)

    def _captura_repetida(self, campos: dict, avisos: list[str]) -> None:
        """A mesma captura de ecrã cortada ou recomprimida tem outro SHA-256 mas
        quase o mesmo hash perceptual. Duas capturas *diferentes* do mesmo
        ecrã da mesma app também ficam parecidas -- por isso só conta como
        suspeita se o número da operação não se leu, ou se é quase igual ao
        da outra (o OCR trocou um carácter). Vai para revisão, não é rejeitada."""
        phash = campos.get("hash_perceptual")
        if not phash:
            return
        referencia = campos.get("referencia_transacao")
        for outro_hash, outra_ref in self._repo.capturas_activas():
            if imagem.distancia_hamming(phash, outro_hash) > imagem.LIMIAR_HASH_PERCEPTUAL:
                continue
            if referencia is None or outra_ref is None or (
                _distancia_edicao(referencia, outra_ref) <= DISTANCIA_MAXIMA_REFERENCIA
            ):
                avisos.append("a imagem é quase igual à de um comprovativo já enviado")
                return

    # Camada 3
    def _camada_conteudo(self, texto: str, campos: dict, avisos: list[str], ocr: bool) -> None:
        cfg = self._config
        normalizado = txt.normalizar(texto)
        lido_na_imagem = " (lido na imagem)" if ocr else ""

        def falhar(codigo: str, mensagem: str, aviso: str) -> None:
            if ocr and codigo in CODIGOS_SUAVES_NO_OCR:
                avisos.append(aviso + lido_na_imagem)
                return
            raise _Rejeicao(codigo, mensagem)

        campos["origem"] = txt.extrair_origem(normalizado)
        if campos["origem"] == txt.ORIGEM_OUTRA:
            avisos.append("não foi possível identificar o banco ou o Multicaixa Express")

        destinatario = txt.destinatario_coincide(
            texto, cfg.iban, cfg.telefone, cfg.palavras_nome, ocr=ocr
        )
        campos["destinatario_detectado"] = destinatario
        if destinatario is None:
            falhar(
                "destinatario_invalido",
                "O destinatário do comprovativo não corresponde à conta oficial do projeto.",
                "o destinatário não corresponde à conta oficial",
            )

        montante = txt.extrair_montante(normalizado)
        campos["montante_kz"] = montante
        if montante is None:
            avisos.append("não foi possível ler o montante" + lido_na_imagem)
        elif montante < cfg.preco_kz:
            falhar(
                "valor_insuficiente",
                f"Valor inferior ao da subscrição: o comprovativo mostra {formatar_kz(montante)} "
                f"e são precisos {formatar_kz(cfg.preco_kz)}.",
                f"o montante ({formatar_kz(montante)}) é inferior a {formatar_kz(cfg.preco_kz)}",
            )
        elif montante >= 2 * cfg.preco_kz:
            # O automático só dá 30 dias -- quem pagou mais (ex.: plano anual)
            # tem de ser visto por uma pessoa para não perder o que pagou.
            avisos.append(f"o montante ({formatar_kz(montante)}) é superior ao de um mês")

        referencia = txt.extrair_referencia(normalizado, ignorar=(cfg.iban, cfg.telefone))
        campos["referencia_transacao"] = referencia
        if referencia is None:
            avisos.append("não foi possível ler o número da operação" + lido_na_imagem)
        elif self._repo.estado_por_referencia(referencia) is not None:
            raise _Rejeicao(
                "transacao_ja_utilizada",
                "Esta transação bancária já foi validada anteriormente.",
            )

        data = txt.extrair_data(normalizado)
        campos["data_transacao"] = data
        agora = self._agora()
        hoje = agora.astimezone(txt.FUSO_LUANDA).date()
        if data is None:
            avisos.append("não foi possível ler a data da operação" + lido_na_imagem)
        elif data > agora + TOLERANCIA_FUTURO:
            falhar(
                "data_futura",
                "A data do comprovativo está no futuro.",
                "a data do comprovativo está no futuro",
            )
        elif (hoje - data.astimezone(txt.FUSO_LUANDA).date()).days > cfg.max_dias:
            falhar(
                "comprovativo_antigo",
                f"O comprovativo tem mais de {cfg.max_dias} dias. Só são aceites "
                f"comprovativos de pagamentos feitos nos últimos {cfg.max_dias} dias -- "
                "se pagaste antes disso, contacta a equipa.",
                f"o comprovativo tem mais de {cfg.max_dias} dias",
            )

        estado_operacao = txt.extrair_estado(normalizado)
        if estado_operacao == txt.ESTADO_NAO_CONCLUIDA:
            raise _Rejeicao(
                "operacao_nao_concluida",
                "O comprovativo não mostra uma operação concluída (parece um agendamento ou "
                "uma operação falhada ou cancelada). Envia o comprovativo depois de a "
                "transferência ser executada.",
            )
        if estado_operacao == txt.ESTADO_EM_PROCESSAMENTO:
            de_hoje = data is not None and data.astimezone(txt.FUSO_LUANDA).date() == hoje
            if not (cfg.aceitar_interbancario_pendente and referencia and de_hoje):
                avisos.append("a transferência ainda aparece como aceite / em processamento")
        elif estado_operacao is None:
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
