"""Regras de promoção/despromoção de administradores.

Mudar `papel` é acção sensível (CLAUDE.md §10). O router já garante, por
`obter_utilizador_admin`, que só um admin chega aqui; este service põe as
regras que impedem um admin de se dar um tiro no pé:

- não despromover a própria conta (ficarias sem forma de voltar a entrar no
  painel);
- não despromover o último admin (deixava o painel sem ninguém — só o
  `criar_admin` por linha de comando o recuperava).

A promoção nunca aceita um `papel` arbitrário: promove para `admin`,
despromove para `comum`, e mais nada.
"""

from app.repositories.admin_repository import AdminRepository, AdminUtilizadorRegisto
from app.repositories.orm_models import AppRole

# "admin" fica de fora de propósito -- promover_a_admin/despromover já têm o
# seu próprio fluxo, com a protecção do último admin (ver despromover
# abaixo). definir_papel nunca duplica essa lógica.
PAPEIS_ATRIBUIVEIS_GENERICAMENTE = {p.value for p in AppRole if p != AppRole.admin}


class UtilizadorNaoEncontradoError(Exception):
    pass


class NaoPodeDespromoverASiProprioError(Exception):
    pass


class UltimoAdminError(Exception):
    pass


class PapelInvalidoError(Exception):
    pass


class NaoPodeAlterarAdminPorAquiError(Exception):
    """O alvo já é admin -- só `despromover` pode tirar-lho (tem a
    protecção do último admin, que este caminho não repete)."""


class AdminService:
    def __init__(self, repositorio: AdminRepository) -> None:
        self._repo = repositorio

    def promover_a_admin(self, email: str) -> AdminUtilizadorRegisto:
        alvo = self._repo.obter_por_email(email)
        if alvo is None:
            raise UtilizadorNaoEncontradoError(email)
        if alvo.papel == "admin":
            return alvo
        return self._repo.definir_papel(alvo.id, "admin")

    def despromover(self, utilizador_id: str, executor_id: str) -> AdminUtilizadorRegisto:
        if utilizador_id == executor_id:
            raise NaoPodeDespromoverASiProprioError(utilizador_id)

        admins = self._repo.listar(papel="admin")
        if len(admins) <= 1:
            raise UltimoAdminError(utilizador_id)

        alvo = self._repo.definir_papel(utilizador_id, "comum")
        if alvo is None:
            raise UtilizadorNaoEncontradoError(utilizador_id)
        return alvo

    def definir_papel(self, utilizador_id: str, papel: str) -> AdminUtilizadorRegisto:
        """Muda o papel de um utilizador para qualquer papel comum
        (`comum`, `estrabico`, `profissional`, `oftalmologista`,
        `voluntario`). O utilizador podia mentir sobre isto de duas formas,
        recusadas aqui: pedir `admin` (tem de passar por `promover_a_admin`),
        ou mudar o papel de alguém que já é admin (só `despromover` pode,
        porque só ele verifica o último admin)."""
        if papel not in PAPEIS_ATRIBUIVEIS_GENERICAMENTE:
            raise PapelInvalidoError(papel)

        alvo = self._repo.obter_por_id(utilizador_id)
        if alvo is None:
            raise UtilizadorNaoEncontradoError(utilizador_id)
        if alvo.papel == "admin":
            raise NaoPodeAlterarAdminPorAquiError(utilizador_id)

        resultado = self._repo.definir_papel(utilizador_id, papel)
        if resultado is None:
            raise UtilizadorNaoEncontradoError(utilizador_id)
        return resultado
