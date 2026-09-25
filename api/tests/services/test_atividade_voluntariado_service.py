"""Testes do `AtividadeVoluntariadoService`.

O que o utilizador podia mentir sobre isto pesa tanto como o caminho feliz:
inscrever-se sem ser voluntário activo, inscrever-se duas vezes, ou
inscrever-se além das vagas têm de ser recusados aqui, não só na interface.
"""

from datetime import UTC, datetime, timedelta

import pytest

from app.core.email import EmailEnvioFalhouError
from app.repositories.atividade_voluntariado_repository import (
    AtividadeVoluntariadoRegisto,
    InscricaoAtividadeRegisto,
    VoluntarioParaNotificar,
)
from app.services.atividade_voluntariado_service import (
    AtividadeComInscricoesError,
    AtividadeNaoEncontradaError,
    AtividadeNaoPublicadaError,
    AtividadeVoluntariadoService,
    InscricaoNaoEncontradaError,
    JaInscritoError,
    NaoEVoluntarioAtivoError,
    SemVagasError,
)

_AGORA = datetime.now(UTC)


def _atividade(**over) -> AtividadeVoluntariadoRegisto:
    base = {
        "id": "ativ-1",
        "titulo": "Sessão de rastreio",
        "descricao": "Ajudar no rastreio comunitário",
        "local": "Luanda",
        "data_inicio": _AGORA + timedelta(days=7),
        "data_fim": None,
        "vagas": None,
        "inscritos": 0,
        "estado": "publicada",
        "criado_por": "admin-1",
        "created_at": _AGORA,
    }
    base.update(over)
    return AtividadeVoluntariadoRegisto(**base)


def _inscricao(**over) -> InscricaoAtividadeRegisto:
    base = {
        "id": "insc-1",
        "atividade_id": "ativ-1",
        "atividade_titulo": "Sessão de rastreio",
        "atividade_data_inicio": _AGORA + timedelta(days=7),
        "atividade_local": "Luanda",
        "utilizador_id": "user-1",
        "utilizador_email": "ana@example.com",
        "utilizador_nome": "Ana",
        "estado": "inscrito",
        "created_at": _AGORA,
    }
    base.update(over)
    return InscricaoAtividadeRegisto(**base)


class RepositorioFalso:
    def __init__(
        self,
        atividade: AtividadeVoluntariadoRegisto | None = None,
        voluntario_ativo: bool = True,
        inscricao_existente: InscricaoAtividadeRegisto | None = None,
        voluntarios_para_notificar: list[VoluntarioParaNotificar] | None = None,
        tem_alguma_inscricao: bool = False,
    ) -> None:
        self._atividade = atividade
        self._voluntario_ativo = voluntario_ativo
        self._inscricao_existente = inscricao_existente
        self._voluntarios = voluntarios_para_notificar or []
        self._tem_alguma_inscricao = tem_alguma_inscricao
        self.atividade_criada: dict | None = None
        self.inscricao_criada: dict | None = None
        self.cancelada: str | None = None
        self.arquivada: str | None = None
        self.apagada: str | None = None

    def criar_atividade(self, titulo, descricao, local, data_inicio, data_fim, vagas, criado_por):
        self.atividade_criada = {"titulo": titulo, "criado_por": criado_por, "vagas": vagas}
        return _atividade(titulo=titulo, descricao=descricao, local=local, vagas=vagas, criado_por=criado_por)

    def obter_atividade(self, atividade_id: str) -> AtividadeVoluntariadoRegisto | None:
        return self._atividade if self._atividade and self._atividade.id == atividade_id else None

    def listar_publicadas(self):  # pragma: no cover
        raise NotImplementedError

    def listar_todas(self):  # pragma: no cover
        raise NotImplementedError

    def cancelar_atividade(self, atividade_id: str) -> AtividadeVoluntariadoRegisto:
        self.cancelada = atividade_id
        return _atividade(id=atividade_id, estado="cancelada")

    def arquivar_atividade(self, atividade_id: str) -> AtividadeVoluntariadoRegisto:
        self.arquivada = atividade_id
        return _atividade(id=atividade_id, estado="arquivada")

    def tem_alguma_inscricao(self, atividade_id: str) -> bool:
        return self._tem_alguma_inscricao

    def apagar_atividade(self, atividade_id: str) -> None:
        self.apagada = atividade_id

    def utilizador_e_voluntario_ativo(self, utilizador_id: str) -> bool:
        return self._voluntario_ativo

    def criar_inscricao(self, atividade_id: str, utilizador_id: str) -> InscricaoAtividadeRegisto:
        self.inscricao_criada = {"atividade_id": atividade_id, "utilizador_id": utilizador_id}
        return _inscricao(atividade_id=atividade_id, utilizador_id=utilizador_id)

    def obter_inscricao(self, atividade_id, utilizador_id) -> InscricaoAtividadeRegisto | None:
        return self._inscricao_existente

    def cancelar_inscricao(self, inscricao_id: str) -> InscricaoAtividadeRegisto:
        return _inscricao(id=inscricao_id, estado="cancelado")

    def listar_inscricoes_por_utilizador(self, utilizador_id):  # pragma: no cover
        raise NotImplementedError

    def listar_inscricoes_por_atividade(self, atividade_id):  # pragma: no cover
        raise NotImplementedError

    def listar_voluntarios_para_notificar(self) -> list[VoluntarioParaNotificar]:
        return self._voluntarios


class EmailSenderFalso:
    def __init__(self, falha: bool = False) -> None:
        self.enviados: list[dict] = []
        self._falha = falha

    def enviar(self, destinatario: str, assunto: str, corpo_html: str) -> None:
        if self._falha:
            raise EmailEnvioFalhouError("falha simulada do Resend")
        self.enviados.append({"destinatario": destinatario, "assunto": assunto, "corpo_html": corpo_html})


class TestPublicar:
    def test_publica_e_notifica_voluntarios_ativos(self) -> None:
        repo = RepositorioFalso(
            voluntarios_para_notificar=[
                VoluntarioParaNotificar(email="ana@example.com", nome="Ana"),
                VoluntarioParaNotificar(email="rui@example.com", nome="Rui"),
            ]
        )
        email_sender = EmailSenderFalso()
        resultado = AtividadeVoluntariadoService(repo, email_sender).publicar(
            "admin-1", "Rastreio", "Descrição", "Luanda", _AGORA, None, 10
        )
        assert resultado.titulo == "Rastreio"
        assert len(email_sender.enviados) == 2

    def test_uma_falha_de_email_nao_impede_publicar_nem_os_restantes_envios(self) -> None:
        class EmailSenderParcial:
            def __init__(self) -> None:
                self.enviados: list[str] = []

            def enviar(self, destinatario, assunto, corpo_html) -> None:
                if destinatario == "falha@example.com":
                    raise EmailEnvioFalhouError("falha simulada")
                self.enviados.append(destinatario)

        repo = RepositorioFalso(
            voluntarios_para_notificar=[
                VoluntarioParaNotificar(email="falha@example.com", nome=None),
                VoluntarioParaNotificar(email="ana@example.com", nome="Ana"),
            ]
        )
        email_sender = EmailSenderParcial()
        resultado = AtividadeVoluntariadoService(repo, email_sender).publicar(
            "admin-1", "Rastreio", "Descrição", "Luanda", _AGORA, None, None
        )
        assert resultado.titulo == "Rastreio"
        assert email_sender.enviados == ["ana@example.com"]


class TestCancelar:
    def test_cancela(self) -> None:
        repo = RepositorioFalso(atividade=_atividade())
        resultado = AtividadeVoluntariadoService(repo, EmailSenderFalso()).cancelar("ativ-1")
        assert resultado.estado == "cancelada"

    def test_inexistente(self) -> None:
        repo = RepositorioFalso(atividade=None)
        with pytest.raises(AtividadeNaoEncontradaError):
            AtividadeVoluntariadoService(repo, EmailSenderFalso()).cancelar("ativ-1")


class TestArquivar:
    def test_arquiva(self) -> None:
        repo = RepositorioFalso(atividade=_atividade())
        resultado = AtividadeVoluntariadoService(repo, EmailSenderFalso()).arquivar("ativ-1")
        assert resultado.estado == "arquivada"
        assert repo.arquivada == "ativ-1"

    def test_inexistente(self) -> None:
        repo = RepositorioFalso(atividade=None)
        with pytest.raises(AtividadeNaoEncontradaError):
            AtividadeVoluntariadoService(repo, EmailSenderFalso()).arquivar("ativ-1")


class TestApagar:
    def test_apaga_sem_inscricoes(self) -> None:
        repo = RepositorioFalso(atividade=_atividade(), tem_alguma_inscricao=False)
        AtividadeVoluntariadoService(repo, EmailSenderFalso()).apagar("ativ-1")
        assert repo.apagada == "ativ-1"

    def test_recusa_apagar_com_inscricoes(self) -> None:
        repo = RepositorioFalso(atividade=_atividade(), tem_alguma_inscricao=True)
        with pytest.raises(AtividadeComInscricoesError):
            AtividadeVoluntariadoService(repo, EmailSenderFalso()).apagar("ativ-1")
        assert repo.apagada is None

    def test_inexistente(self) -> None:
        repo = RepositorioFalso(atividade=None)
        with pytest.raises(AtividadeNaoEncontradaError):
            AtividadeVoluntariadoService(repo, EmailSenderFalso()).apagar("ativ-1")


class TestInscrever:
    def test_inscreve_e_notifica(self) -> None:
        repo = RepositorioFalso(atividade=_atividade(), voluntario_ativo=True)
        email_sender = EmailSenderFalso()
        resultado = AtividadeVoluntariadoService(repo, email_sender).inscrever(
            "ativ-1", "user-1", "ana@example.com"
        )
        assert resultado.utilizador_id == "user-1"
        assert len(email_sender.enviados) == 1

    def test_atividade_inexistente(self) -> None:
        repo = RepositorioFalso(atividade=None)
        with pytest.raises(AtividadeNaoEncontradaError):
            AtividadeVoluntariadoService(repo, EmailSenderFalso()).inscrever(
                "ativ-1", "user-1", "ana@example.com"
            )

    def test_atividade_cancelada(self) -> None:
        repo = RepositorioFalso(atividade=_atividade(estado="cancelada"))
        with pytest.raises(AtividadeNaoPublicadaError):
            AtividadeVoluntariadoService(repo, EmailSenderFalso()).inscrever(
                "ativ-1", "user-1", "ana@example.com"
            )

    def test_recusa_quem_nao_e_voluntario_ativo(self) -> None:
        repo = RepositorioFalso(atividade=_atividade(), voluntario_ativo=False)
        with pytest.raises(NaoEVoluntarioAtivoError):
            AtividadeVoluntariadoService(repo, EmailSenderFalso()).inscrever(
                "ativ-1", "user-1", "ana@example.com"
            )

    def test_recusa_segunda_inscricao(self) -> None:
        repo = RepositorioFalso(
            atividade=_atividade(), voluntario_ativo=True, inscricao_existente=_inscricao()
        )
        with pytest.raises(JaInscritoError):
            AtividadeVoluntariadoService(repo, EmailSenderFalso()).inscrever(
                "ativ-1", "user-1", "ana@example.com"
            )

    def test_recusa_sem_vagas(self) -> None:
        repo = RepositorioFalso(atividade=_atividade(vagas=5, inscritos=5), voluntario_ativo=True)
        with pytest.raises(SemVagasError):
            AtividadeVoluntariadoService(repo, EmailSenderFalso()).inscrever(
                "ativ-1", "user-1", "ana@example.com"
            )

    def test_permite_a_ultima_vaga(self) -> None:
        repo = RepositorioFalso(atividade=_atividade(vagas=5, inscritos=4), voluntario_ativo=True)
        resultado = AtividadeVoluntariadoService(repo, EmailSenderFalso()).inscrever(
            "ativ-1", "user-1", "ana@example.com"
        )
        assert resultado.utilizador_id == "user-1"

    def test_falha_no_email_nao_impede_a_inscricao(self) -> None:
        repo = RepositorioFalso(atividade=_atividade(), voluntario_ativo=True)
        resultado = AtividadeVoluntariadoService(repo, EmailSenderFalso(falha=True)).inscrever(
            "ativ-1", "user-1", "ana@example.com"
        )
        assert resultado.utilizador_id == "user-1"


class TestCancelarInscricao:
    def test_cancela(self) -> None:
        repo = RepositorioFalso(inscricao_existente=_inscricao())
        resultado = AtividadeVoluntariadoService(repo, EmailSenderFalso()).cancelar_inscricao(
            "ativ-1", "user-1"
        )
        assert resultado.estado == "cancelado"

    def test_inexistente(self) -> None:
        repo = RepositorioFalso(inscricao_existente=None)
        with pytest.raises(InscricaoNaoEncontradaError):
            AtividadeVoluntariadoService(repo, EmailSenderFalso()).cancelar_inscricao("ativ-1", "user-1")
