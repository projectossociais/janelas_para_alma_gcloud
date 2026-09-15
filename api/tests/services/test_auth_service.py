"""Testes do serviço de autenticação — a fronteira de segurança do sistema.

Usa um repositório falso em memória, não uma base de dados real: isto é
teste unitário do `AuthService`, isolado de tudo à volta (ver CLAUDE.md,
secção "Unitário vs integração"). O caminho do erro tem tanto peso aqui
como o do sucesso — errar a autenticação é o pior sítio possível para um
bug silencioso.
"""

from dataclasses import replace
from datetime import UTC, datetime

import pytest

from app.core.google_auth import PerfilGoogle
from app.core.security import criar_access_token, criar_refresh_token, hash_password
from app.repositories.utilizadores_repository import UtilizadorRegisto
from app.services.auth_service import (
    AuthService,
    CredenciaisInvalidasError,
    EmailGoogleNaoVerificadoError,
    EmailJaRegistadoError,
    EmailNaoConfirmadoError,
    RefreshTokenInvalidoError,
)


class RepositorioFalso:
    """Implementa o mesmo contrato (Protocol) que o repositório real —
    é o que torna isto substituível sem o service saber."""

    def __init__(self) -> None:
        self._utilizadores: dict[str, UtilizadorRegisto] = {}
        # Fora do UtilizadorRegisto de propósito -- o real também não guarda
        # isto na mesma dataclass (ver PerfilRegisto/eliminar_agendado_para
        # na coluna ORM). Chave é o id, não o email, para bater certo com
        # como ContaService chama estes métodos.
        self._eliminacoes_agendadas: dict[str, datetime] = {}

    def obter_por_email(self, email: str) -> UtilizadorRegisto | None:
        return self._utilizadores.get(email)

    def obter_por_id(self, utilizador_id: str) -> UtilizadorRegisto | None:
        return next((u for u in self._utilizadores.values() if u.id == utilizador_id), None)

    def criar(
        self,
        email: str,
        password_hash: str,
        papel: str = "comum",
        nome_completo: str | None = None,
        provincia: str | None = None,
        genero: str | None = None,
    ) -> UtilizadorRegisto:
        registo = UtilizadorRegisto(
            id=f"id-{len(self._utilizadores) + 1}",
            email=email,
            password_hash=password_hash,
            papel=papel,
            nome_completo=nome_completo,
            provincia=provincia,
            genero=genero,
            criado_em=datetime.now(UTC),
            # Explícito (ao contrário do default =True do dataclass, que só
            # existe para não obrigar OUTROS testes/fixtures a passar isto):
            # uma conta acabada de criar espelha sempre o repositório real,
            # nasce por confirmar (AUTH-02).
            email_confirmado=False,
        )
        self._utilizadores[email] = registo
        return registo

    def atualizar_password_hash(self, utilizador_id: str, password_hash: str) -> None:
        for email, u in self._utilizadores.items():
            if u.id == utilizador_id:
                self._utilizadores[email] = replace(u, password_hash=password_hash)
                return

    def confirmar_email(self, utilizador_id: str) -> None:
        for email, u in self._utilizadores.items():
            if u.id == utilizador_id:
                self._utilizadores[email] = replace(u, email_confirmado=True)
                return

    def agendar_eliminacao(self, utilizador_id: str, quando: datetime) -> None:
        self._eliminacoes_agendadas[utilizador_id] = quando

    def cancelar_eliminacao_se_agendada(self, utilizador_id: str) -> bool:
        return self._eliminacoes_agendadas.pop(utilizador_id, None) is not None

    def apagar(self, utilizador_id: str) -> None:
        email = next((e for e, u in self._utilizadores.items() if u.id == utilizador_id), None)
        if email:
            del self._utilizadores[email]


@pytest.fixture
def repo() -> RepositorioFalso:
    return RepositorioFalso()


@pytest.fixture
def service(repo: RepositorioFalso) -> AuthService:
    return AuthService(repo)


class TestRegistar:
    def test_regista_um_utilizador_novo(self, service: AuthService) -> None:
        sessao = service.registar("ana@example.com", "password-forte-123")

        assert sessao.utilizador.email == "ana@example.com"
        assert sessao.utilizador.papel == "comum"

    def test_regista_com_os_dados_de_perfil_recolhidos_no_formulario(self, service: AuthService) -> None:
        sessao = service.registar(
            "ana@example.com",
            "password-forte-123",
            papel="estrabico",
            nome_completo="Ana Teste",
            provincia="Luanda",
            genero="feminino",
        )

        assert sessao.utilizador.nome_completo == "Ana Teste"
        assert sessao.utilizador.provincia == "Luanda"
        assert sessao.utilizador.genero == "feminino"
        assert sessao.utilizador.papel == "estrabico"

    def test_registar_continua_a_calcular_tokens_mesmo_sem_sessao_automatica(
        self, service: AuthService
    ) -> None:
        # AUTH-02: quem decide não usar estes tokens é o router (não põe
        # cookies enquanto a conta não estiver confirmada) — o service
        # continua a calculá-los por uniformidade com `autenticar`.
        sessao = service.registar("ana@example.com", "password-forte-123")

        assert sessao.tokens.access_token
        assert sessao.tokens.refresh_token

    def test_conta_nasce_por_confirmar(self, service: AuthService) -> None:
        sessao = service.registar("ana@example.com", "password-forte-123")

        assert sessao.utilizador.email_confirmado is False

    def test_nunca_guarda_a_password_em_texto_simples(self, service: AuthService) -> None:
        sessao = service.registar("ana@example.com", "password-forte-123")

        assert sessao.utilizador.password_hash != "password-forte-123"
        assert sessao.utilizador.password_hash.startswith("$argon2")

    def test_rejeita_email_duplicado(self, service: AuthService) -> None:
        service.registar("ana@example.com", "password-forte-123")

        with pytest.raises(EmailJaRegistadoError):
            service.registar("ana@example.com", "outra-password-456")


class TestAutenticar:
    def test_autentica_com_credenciais_certas_depois_de_confirmar_o_email(
        self, service: AuthService, repo: RepositorioFalso
    ) -> None:
        sessao_registo = service.registar("ana@example.com", "password-forte-123")
        repo.confirmar_email(sessao_registo.utilizador.id)

        sessao = service.autenticar("ana@example.com", "password-forte-123")

        assert sessao.utilizador.email == "ana@example.com"
        assert sessao.tokens.access_token
        assert sessao.tokens.refresh_token
        assert sessao.tokens.access_token != sessao.tokens.refresh_token

    def test_recusa_login_sem_confirmar_o_email_mesmo_com_a_password_certa(
        self, service: AuthService
    ) -> None:
        # AUTH-02, bloqueio total: a password estar certa não chega.
        service.registar("ana@example.com", "password-forte-123")

        with pytest.raises(EmailNaoConfirmadoError):
            service.autenticar("ana@example.com", "password-forte-123")

    def test_recusa_password_errada_mesmo_numa_conta_por_confirmar(self, service: AuthService) -> None:
        # A password é verificada antes da confirmação -- uma conta por
        # confirmar com a password errada recebe o erro genérico de
        # credenciais, nunca a informação extra de "falta confirmar".
        service.registar("ana@example.com", "password-forte-123")

        with pytest.raises(CredenciaisInvalidasError):
            service.autenticar("ana@example.com", "password-errada")

    def test_recusa_email_inexistente(self, service: AuthService) -> None:
        with pytest.raises(CredenciaisInvalidasError):
            service.autenticar("nao-existe@example.com", "qualquer-coisa")

    def test_mensagem_de_erro_nao_distingue_email_inexistente_de_password_errada(
        self, service: AuthService
    ) -> None:
        # Não vazar a um atacante se um email existe ou não no sistema.
        service.registar("ana@example.com", "password-forte-123")

        erro_password_errada: str | None = None
        erro_email_inexistente: str | None = None
        try:
            service.autenticar("ana@example.com", "password-errada")
        except CredenciaisInvalidasError as exc:
            erro_password_errada = str(exc)
        try:
            service.autenticar("nao-existe@example.com", "qualquer-coisa")
        except CredenciaisInvalidasError as exc:
            erro_email_inexistente = str(exc)

        assert erro_password_errada == erro_email_inexistente


class TestRenovarAccessToken:
    def test_emite_novo_access_token_para_refresh_valido(self, service: AuthService) -> None:
        sessao = service.registar("ana@example.com", "password-forte-123")
        refresh = criar_refresh_token(sessao.utilizador.id)

        novo_access_token = service.renovar_access_token(refresh)

        assert novo_access_token

    def test_rejeita_refresh_token_invalido(self, service: AuthService) -> None:
        with pytest.raises(RefreshTokenInvalidoError):
            service.renovar_access_token("isto-nao-e-um-jwt")

    def test_rejeita_refresh_token_de_utilizador_que_deixou_de_existir(
        self, service: AuthService
    ) -> None:
        refresh_de_ninguem = criar_refresh_token("id-fantasma")

        with pytest.raises(RefreshTokenInvalidoError):
            service.renovar_access_token(refresh_de_ninguem)

    def test_rejeita_um_access_token_usado_como_refresh_token(self, service: AuthService) -> None:
        # Um access token não deve servir para pedir um access token novo —
        # confundir os dois tipos de token é uma escalada de privilégio.
        sessao = service.registar("ana@example.com", "password-forte-123")
        access_token = criar_access_token(sessao.utilizador.id)

        with pytest.raises(RefreshTokenInvalidoError):
            service.renovar_access_token(access_token)


class TestUtilizadorAPartirDoAccessToken:
    """A dependency que protege qualquer rota autenticada (ver
    routers/auth.py::obter_utilizador_atual) delega tudo nisto."""

    def test_devolve_o_utilizador_para_um_access_token_valido(self, service: AuthService) -> None:
        sessao = service.registar("ana@example.com", "password-forte-123")

        utilizador = service.utilizador_a_partir_do_access_token(sessao.tokens.access_token)

        assert utilizador.email == "ana@example.com"

    def test_rejeita_um_token_invalido(self, service: AuthService) -> None:
        with pytest.raises(CredenciaisInvalidasError):
            service.utilizador_a_partir_do_access_token("isto-nao-e-um-jwt")

    def test_rejeita_um_refresh_token_usado_como_access_token(self, service: AuthService) -> None:
        # O inverso do teste em TestRenovarAccessToken — os dois tipos de
        # token nunca podem servir um pelo outro, em nenhum dos sentidos.
        sessao = service.registar("ana@example.com", "password-forte-123")

        with pytest.raises(CredenciaisInvalidasError):
            service.utilizador_a_partir_do_access_token(sessao.tokens.refresh_token)

    def test_rejeita_token_de_utilizador_que_deixou_de_existir(self, service: AuthService) -> None:
        token_de_ninguem = criar_access_token("id-fantasma")

        with pytest.raises(CredenciaisInvalidasError):
            service.utilizador_a_partir_do_access_token(token_de_ninguem)


def test_hash_password_produz_hashes_diferentes_para_a_mesma_password() -> None:
    # Argon2 usa salt aleatório — dois hashes da mesma password nunca
    # deviam ser iguais. Confirma que não caímos num hashing determinístico.
    assert hash_password("mesma-password") != hash_password("mesma-password")


class TestEntrarComGoogle:
    def test_cria_conta_nova_ja_confirmada(self, service: AuthService, repo: RepositorioFalso) -> None:
        perfil = PerfilGoogle(email="ana@example.com", email_verificado=True, nome="Ana Teste")

        sessao = service.entrar_com_google(perfil)

        assert sessao.utilizador.email == "ana@example.com"
        assert sessao.utilizador.papel == "comum"
        assert sessao.utilizador.nome_completo == "Ana Teste"
        assert sessao.utilizador.email_confirmado is True

    def test_liga_a_uma_conta_existente_pelo_mesmo_email(
        self, service: AuthService, repo: RepositorioFalso
    ) -> None:
        existente = service.registar("ana@example.com", "password-forte-123")
        perfil = PerfilGoogle(email="ana@example.com", email_verificado=True, nome="Ana Teste")

        sessao = service.entrar_com_google(perfil)

        assert sessao.utilizador.id == existente.utilizador.id

    def test_confirma_o_email_de_uma_conta_existente_ainda_por_confirmar(
        self, service: AuthService, repo: RepositorioFalso
    ) -> None:
        service.registar("ana@example.com", "password-forte-123")
        assert repo.obter_por_email("ana@example.com").email_confirmado is False

        perfil = PerfilGoogle(email="ana@example.com", email_verificado=True, nome=None)
        sessao = service.entrar_com_google(perfil)

        assert sessao.utilizador.email_confirmado is True

    def test_recusa_email_que_o_google_nao_verificou(
        self, service: AuthService, repo: RepositorioFalso
    ) -> None:
        perfil = PerfilGoogle(email="ana@example.com", email_verificado=False, nome="Ana Teste")

        with pytest.raises(EmailGoogleNaoVerificadoError):
            service.entrar_com_google(perfil)
        assert repo.obter_por_email("ana@example.com") is None

    def test_duas_entradas_com_google_dao_sessoes_para_o_mesmo_utilizador(
        self, service: AuthService, repo: RepositorioFalso
    ) -> None:
        perfil = PerfilGoogle(email="ana@example.com", email_verificado=True, nome="Ana Teste")

        primeira = service.entrar_com_google(perfil)
        segunda = service.entrar_com_google(perfil)

        assert primeira.utilizador.id == segunda.utilizador.id
