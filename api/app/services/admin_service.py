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


class UtilizadorNaoEncontradoError(Exception):
    pass


class NaoPodeDespromoverASiProprioError(Exception):
    pass


class UltimoAdminError(Exception):
    pass


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
