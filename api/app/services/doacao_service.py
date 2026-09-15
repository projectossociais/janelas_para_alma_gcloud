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

import uuid

from app.core.email import EmailSender
from app.repositories.doacoes_repository import DoacaoRegisto, DoacoesRepository


class MateriaisNaoSelecionadosError(Exception):
    pass


def _gerar_recibo_id(prefixo: str) -> str:
    # Gerado no servidor, não confiado ao cliente -- um recibo_id previsível
    # ou reutilizável do lado do browser seria fácil de falsificar.
    return f"{prefixo}-{uuid.uuid4().hex[:10].upper()}"


class DoacaoService:
    def __init__(self, repositorio: DoacoesRepository, email_sender: EmailSender) -> None:
        self._repo = repositorio
        self._email = email_sender

    def registar_doacao_materiais(
        self, email: str, materiais: list[str], detalhes: str | None = None
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
        )

        # Doação já gravada -- uma falha daqui para a frente propaga (ver
        # nota de topo), mas nunca apaga o registo: fica "pendente" na base
        # de dados, visível a um admin, mesmo que a pessoa não tenha visto
        # a confirmação.
        self._email.enviar(
            destinatario=email,
            assunto="Recebemos a sua doação — Janelas Para a Alma",
            corpo_html=(
                f"<p>Obrigado pela sua doação! Registámo-la com o recibo "
                f"<strong>{doacao.recibo_id}</strong>.</p>"
                f"<p>Materiais: {', '.join(materiais)}"
                + (f"<br>Notas: {detalhes}" if detalhes else "")
                + "</p>"
                "<p>Em breve entraremos em contacto para combinar a recolha.</p>"
            ),
        )

        return doacao
