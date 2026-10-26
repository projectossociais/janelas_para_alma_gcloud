"""Regras de negócio de doações.

Este é o serviço com o histórico mais grave do projecto: a versão antiga do
fluxo mostrava "Doação registada!" mesmo quando a gravação falhava (ver
CLAUDE.md, "Nunca mostrar sucesso antes de verificar `error`/excepção"). A
regra aqui é estrutural, não um cuidado a lembrar: `criar` do repository
nunca é chamado dentro de um `try` que engula a excepção — se a gravação
falhar, a excepção propaga até ao router (que devolve 5xx), e o frontend
nunca vê um ecrã de sucesso para uma doação que não foi gravada.

O mesmo vale para o email de confirmação, agora que o Resend está disponível
(ver core/email.py): ao contrário do registo de conta (AUTH-02, onde a conta
já criada é o sucesso real e uma falha no email não a desfaz), aqui uma
falha no envio conta como falha do pedido inteiro — é o comportamento já
estabelecido (e testado) neste fluxo desde a versão que corria no Supabase:
nunca mostrar "doação recebida" sem a pessoa também receber a confirmação.
"""

import html
import logging
import uuid
from typing import Protocol

from app.core.email import EmailSender
from app.repositories.doacoes_repository import DoacaoRegisto, DoacoesRepository
from app.services.comprovativo_upload_service import referencia_do_comprovativo

logger = logging.getLogger(__name__)


class MateriaisNaoSelecionadosError(Exception):
    pass


class NotificadorAdmins(Protocol):
    def notificar(self, titulo: str, mensagem: str) -> None: ...


def _gerar_recibo_id(prefixo: str) -> str:
    # Gerado no servidor, não confiado ao cliente -- um recibo_id previsível
    # ou reutilizável do lado do browser seria fácil de falsificar.
    return f"{prefixo}-{uuid.uuid4().hex[:10].upper()}"


class DoacaoService:
    def __init__(
        self,
        repositorio: DoacoesRepository,
        email_sender: EmailSender,
        notificador: NotificadorAdmins | None = None,
    ) -> None:
        self._repo = repositorio
        self._email = email_sender
        self._notificador = notificador

    def registar_doacao_materiais(
        self, email: str, materiais: list[str], provincia: str, detalhes: str | None = None
    ) -> DoacaoRegisto:
        if not materiais:
            raise MateriaisNaoSelecionadosError("selecione pelo menos um tipo de material")

        doacao = self._repo.criar(
            recibo_id=_gerar_recibo_id("JPA"),
            tipo="materiais",
            email=email,
            status="pendente",
            materiais=materiais,
            detalhes=detalhes,
            provincia=provincia,
        )

        # Antes do email ao doador: se esse envio falhar, a doação continua
        # gravada e a equipa tem de saber dela para combinar a recolha.
        self._avisar_equipa(doacao, materiais, provincia, detalhes)

        # Doação já gravada -- uma falha daqui para a frente propaga (ver
        # nota de topo), mas nunca apaga o registo: fica "pendente" na base
        # de dados, visível a um admin, mesmo que a pessoa não tenha visto
        # a confirmação.
        #
        # Tudo o que veio do formulário é escapado: o email sai do nosso
        # domínio para um endereço que qualquer pessoa pode escrever.
        itens = "".join(f"<li>{html.escape(m)}</li>" for m in materiais)
        self._email.enviar(
            destinatario=email,
            assunto="Recebemos a sua doação — Janelas Para a Alma",
            corpo_html=(
                f"<p>Obrigado pela sua doação! Registámo-la com o recibo "
                f"<strong>{doacao.recibo_id}</strong>.</p>"
                f"<p>Materiais:</p><ul>{itens}</ul>"
                + (f"<p>Notas: {html.escape(detalhes)}</p>" if detalhes else "")
                + "<p>Em breve entraremos em contacto para combinar a recolha.</p>"
            ),
        )

        return doacao

    def _avisar_equipa(
        self, doacao: DoacaoRegisto, materiais: list[str], provincia: str, detalhes: str | None
    ) -> None:
        self._notificar(
            "Nova doação de materiais para recolher",
            f"{doacao.email} ({provincia}) quer doar: {'; '.join(materiais)}."
            + (f" Notas: {detalhes}" if detalhes else "")
            + f" Recibo {doacao.recibo_id}.",
            doacao.recibo_id,
        )

    def _notificar(self, titulo: str, mensagem: str, recibo_id: str) -> None:
        if self._notificador is None:
            return
        try:
            self._notificador.notificar(titulo, mensagem)
        except Exception:  # avisar é acessório -- a doação já está gravada
            logger.exception("falha ao avisar a equipa da doação %s", recibo_id)

    def registar_doacao_financeira(
        self,
        email: str,
        detalhes: str | None,
        comprovativo_chave: str,
        frequencia: str = "unica",
    ) -> DoacaoRegisto:
        """CROSS-02: o comprovativo já foi enviado directamente ao R2 (ver
        `uploads.py`/`comprovativo_upload_service.py`) — aqui só se
        confirma que a chave apresentada é mesmo um comprovativo (nunca um
        caminho arbitrário do bucket) antes de a gravar."""
        comprovativo_url = referencia_do_comprovativo(comprovativo_chave)

        doacao = self._repo.criar(
            recibo_id=_gerar_recibo_id("FIN"),
            tipo="financeiro",
            email=email,
            status="comprovativo_enviado",
            detalhes=detalhes,
            comprovativo_url=comprovativo_url,
        )

        mensal = frequencia == "mensal"
        self._notificar(
            "Novo donativo mensal" if mensal else "Novo donativo",
            f"{doacao.email} enviou o comprovativo"
            + (f" ({detalhes})" if detalhes else "")
            + f". Recibo {doacao.recibo_id}.",
            doacao.recibo_id,
        )

        self._email.enviar(
            destinatario=email,
            assunto="Recebemos o seu comprovativo — Janelas Para a Alma",
            corpo_html=(
                f"<p>Obrigado pelo seu donativo! Recebemos o comprovativo, com o "
                f"recibo <strong>{doacao.recibo_id}</strong>.</p>"
                + (f"<p>{html.escape(detalhes)}</p>" if detalhes else "")
                + "<p>A nossa equipa vai confirmar a transferência em breve.</p>"
                + (
                    "<p>Para doar todos os meses, crie no seu banco uma transferência "
                    "permanente (mensal) com o mesmo valor e os mesmos dados. Pode "
                    "cancelá-la quando quiser.</p>"
                    if mensal
                    else ""
                )
            ),
        )

        return doacao
