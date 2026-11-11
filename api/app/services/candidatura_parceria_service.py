"""Registo de parceiros: uma empresa (clínica, óptica, hospital, outra
organização) preenche os seus dados legais, anexa documentos se quiser, e a
equipa recebe tudo por email.

Regras:
- Os documentos sobem directos ao R2 (URL de `PUT` assinado, como o avatar),
  sempre para o bucket **privado** (`r2_bucket_comprovativos`, prefixo
  `parcerias/`) -- são documentos de empresa (certidão, alvará, NIF). Sem
  esse bucket não há upload: nunca caem no bucket público.
- Ao submeter, cada chave tem de estar sob `parcerias/`: o bucket privado
  guarda também comprovativos de pagamento de outras pessoas, e uma chave
  forjada faria a API anexá-los a um email.
- A empresa recebe, com a confirmação, um comprovativo do registo em PDF
  (`comprovativo_parceria.py`) -- nunca os próprios documentos de volta.
- A candidatura gravada é o valor. Os emails (à equipa, com os documentos em
  anexo, e a confirmação à empresa) são melhor esforço: uma falha fica no
  log, o registo não se perde nem se desfaz. Uma falha de gravação, essa,
  propaga sempre.
- Tudo o que a empresa escreveu é escapado antes de entrar no HTML do email.
"""

import html
import logging
import re
import uuid
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Protocol

from app.core.email import Anexo, EmailEnvioFalhouError, EmailSender
from app.repositories.candidatura_parceria_repository import (
    CandidaturaParceriaRegisto,
    CandidaturaParceriaRepository,
    DadosCandidaturaParceria,
    DocumentoParceria,
)
from app.services.comprovativo_parceria import TIPOS_DE_PARCEIRO, gerar_comprovativo_parceria

logger = logging.getLogger(__name__)

__all__ = [
    "CandidaturaParceriaService",
    "DadosCandidaturaParceria",
    "DocumentoParceria",
]

PREFIXO_DOCUMENTOS = "parcerias/"
MAX_DOCUMENTOS = 5
# Por anexo e no total do email (o Resend aceita até 40 MB por mensagem,
# depois de codificada em base64).
LIMITE_BYTES_POR_ANEXO = 8 * 1024 * 1024
LIMITE_BYTES_TOTAL = 24 * 1024 * 1024

EXTENSAO_POR_CONTENT_TYPE = {
    "application/pdf": "pdf",
    "image/png": "png",
    "image/jpeg": "jpg",
}

class TipoDeDocumentoNaoPermitidoError(Exception):
    pass


class ChaveDeDocumentoInvalidaError(Exception):
    """A chave não está sob `parcerias/` -- nunca anexar outro objecto do
    bucket privado."""


class DemasiadosDocumentosError(Exception):
    pass


class DocumentosIndisponiveisError(Exception):
    """O bucket privado não está configurado."""


class ArmazenamentoDeDocumentos(Protocol):
    def url_de_upload(self, chave: str, content_type: str) -> str: ...
    def ler_bytes(self, chave: str, limite: int) -> bytes | None: ...


@dataclass(frozen=True)
class DocumentoPreparado:
    url_de_upload: str
    chave: str


def _chave_valida(chave: str) -> bool:
    return chave.startswith(PREFIXO_DOCUMENTOS) and ".." not in chave and len(chave) > len(PREFIXO_DOCUMENTOS)


def _nome_de_anexo(nome: str) -> str:
    """Só o nome do ficheiro, sem caminhos nem caracteres de controlo."""
    base = re.split(r"[\\/]", nome)[-1]
    base = re.sub(r"[\x00-\x1f\x7f]", "", base).replace("..", ".").strip(" .")
    return base[:120] or "documento"


def _e(texto: str | None) -> str:
    return html.escape(texto) if texto else "—"


class CandidaturaParceriaService:
    def __init__(
        self,
        repositorio: CandidaturaParceriaRepository,
        email_sender: EmailSender,
        armazenamento: ArmazenamentoDeDocumentos | None,
        email_equipa: str,
    ) -> None:
        # `armazenamento` é `None` sem o bucket privado configurado.
        self._repo = repositorio
        self._email = email_sender
        self._armazenamento = armazenamento
        self._email_equipa = email_equipa

    def preparar_documento(self, content_type: str) -> DocumentoPreparado:
        extensao = EXTENSAO_POR_CONTENT_TYPE.get(content_type)
        if extensao is None:
            raise TipoDeDocumentoNaoPermitidoError(content_type)
        if self._armazenamento is None:
            raise DocumentosIndisponiveisError()
        chave = f"{PREFIXO_DOCUMENTOS}{uuid.uuid4()}.{extensao}"
        return DocumentoPreparado(
            url_de_upload=self._armazenamento.url_de_upload(chave, content_type), chave=chave
        )

    def submeter(self, dados: DadosCandidaturaParceria) -> CandidaturaParceriaRegisto:
        if len(dados.documentos) > MAX_DOCUMENTOS:
            raise DemasiadosDocumentosError(len(dados.documentos))
        for documento in dados.documentos:
            if not _chave_valida(documento.chave):
                raise ChaveDeDocumentoInvalidaError(documento.chave)
            if documento.content_type not in EXTENSAO_POR_CONTENT_TYPE:
                raise TipoDeDocumentoNaoPermitidoError(documento.content_type)
        if dados.documentos and self._armazenamento is None:
            raise DocumentosIndisponiveisError()

        candidatura = self._repo.criar(dados)

        anexos, por_anexar = self._ler_anexos(dados.documentos)
        self._enviar_melhor_esforco(
            self._email_equipa,
            f"Novo pedido de parceria: {dados.denominacao} ({candidatura.referencia})",
            self._corpo_para_equipa(candidatura, por_anexar),
            anexos,
        )
        self._enviar_melhor_esforco(
            dados.email,
            f"Recebemos o registo da sua empresa ({candidatura.referencia}) — Janelas Para a Alma",
            (
                f"<p>Exmo.(a) Sr.(a) {_e(dados.representante_nome)},</p>"
                f"<p>Recebemos o pedido de parceria de <strong>{_e(dados.denominacao)}</strong>, com a "
                f"referência <strong>{candidatura.referencia}</strong>.</p>"
                "<p>A nossa equipa vai analisar os dados e os documentos enviados e entra em contacto "
                "consigo em breve. Em anexo segue o comprovativo do registo.</p>"
                "<p>Janelas Para a Alma<br>Olhar Alinhado, Comércio e Prestação de Serviços, Lda.</p>"
            ),
            self._comprovativo(candidatura),
        )
        return candidatura

    def _comprovativo(self, candidatura: CandidaturaParceriaRegisto) -> list[Anexo] | None:
        """PDF para a empresa guardar. Melhor esforço: se a geração falhar,
        a confirmação segue sem anexo."""
        try:
            pdf = gerar_comprovativo_parceria(candidatura.referencia, datetime.now(UTC), candidatura.dados)
        except Exception:
            logger.exception("parceria: falha a gerar o comprovativo %s", candidatura.referencia)
            return None
        return [Anexo(nome_ficheiro=f"Comprovativo-de-registo-{candidatura.referencia}.pdf", conteudo=pdf)]

    def _ler_anexos(
        self, documentos: tuple[DocumentoParceria, ...]
    ) -> tuple[list[Anexo], list[tuple[DocumentoParceria, str]]]:
        anexos: list[Anexo] = []
        por_anexar: list[tuple[DocumentoParceria, str]] = []
        total = 0
        for documento in documentos:
            assert self._armazenamento is not None  # garantido em `submeter`
            try:
                conteudo = self._armazenamento.ler_bytes(documento.chave, LIMITE_BYTES_POR_ANEXO)
            except Exception:
                logger.exception("parceria: falha a ler o documento %s", documento.chave)
                conteudo = None
            if conteudo is None:
                por_anexar.append((documento, "não foi encontrado no armazenamento"))
            elif len(conteudo) > LIMITE_BYTES_POR_ANEXO or total + len(conteudo) > LIMITE_BYTES_TOTAL:
                por_anexar.append((documento, "grande demais para seguir em anexo"))
            else:
                total += len(conteudo)
                anexos.append(Anexo(nome_ficheiro=_nome_de_anexo(documento.nome), conteudo=conteudo))
        return anexos, por_anexar

    def _corpo_para_equipa(
        self, candidatura: CandidaturaParceriaRegisto, por_anexar: list[tuple[DocumentoParceria, str]]
    ) -> str:
        d = candidatura.dados
        linhas = [
            ("Referência", candidatura.referencia),
            ("Denominação social", _e(d.denominacao)),
            ("NIF", _e(d.nif)),
            ("Tipo de entidade", _e(TIPOS_DE_PARCEIRO.get(d.tipo, d.tipo))),
            ("Província", _e(d.provincia)),
            ("Morada", _e(d.morada)),
            ("Website", _e(d.website)),
            ("Representante", f"{_e(d.representante_nome)} ({_e(d.representante_cargo)})"),
            ("Email", _e(d.email)),
            ("Telefone", _e(d.telefone)),
            ("Proposta de colaboração", _e(d.mensagem).replace("\n", "<br>")),
        ]
        tabela = "".join(
            f'<tr><td style="padding:4px 12px 4px 0;vertical-align:top"><strong>{rotulo}</strong></td>'
            f"<td>{valor}</td></tr>"
            for rotulo, valor in linhas
        )
        if d.documentos:
            itens = "".join(f"<li>{_e(_nome_de_anexo(doc.nome))}</li>" for doc in d.documentos)
            documentos = f"<p><strong>Documentos enviados ({len(d.documentos)}):</strong></p><ul>{itens}</ul>"
        else:
            documentos = "<p>A empresa não enviou documentos.</p>"
        if por_anexar:
            itens = "".join(
                f"<li>{_e(_nome_de_anexo(doc.nome))}: {motivo}. Chave no bucket privado: "
                f"<code>{_e(doc.chave)}</code></li>"
                for doc, motivo in por_anexar
            )
            documentos += f"<p><strong>Não seguem em anexo:</strong></p><ul>{itens}</ul>"
        return (
            "<p>Uma empresa preencheu o registo de parceiros em janelasparaalma.com.</p>"
            f"<table>{tabela}</table>{documentos}"
            "<p>O representante declarou ter poderes para representar a entidade e autorizou o "
            "tratamento destes dados para a análise da parceria.</p>"
        )

    def _enviar_melhor_esforco(
        self, destinatario: str, assunto: str, corpo_html: str, anexos: list[Anexo] | None
    ) -> None:
        try:
            self._email.enviar(destinatario, assunto, corpo_html, anexos)
        except EmailEnvioFalhouError:
            logger.exception("parceria: falha a enviar email para %s", destinatario)
