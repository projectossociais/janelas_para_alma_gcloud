"""Regras de negócio do perfil. Pouca lógica aqui de propósito — ler e
actualizar o próprio perfil não decide acesso, dinheiro nem resultado
clínico (ver CLAUDE.md secção 8); o valor deste service é ser a única porta
de entrada e manter o router e o repository desacoplados um do outro.
"""

from app.repositories.perfil_repository import PerfilPatch, PerfilRegisto, PerfilRepository


class PerfilNaoEncontradoError(Exception):
    pass


class PerfilService:
    def __init__(self, repositorio: PerfilRepository) -> None:
        self._repo = repositorio

    def obter(self, utilizador_id: str) -> PerfilRegisto:
        perfil = self._repo.obter(utilizador_id)
        if perfil is None:
            # Só acontece se a conta foi apagada entre o cookie ser validado
            # e este pedido correr — janela real, embora estreita.
            raise PerfilNaoEncontradoError(utilizador_id)
        return perfil

    def atualizar(self, utilizador_id: str, patch: PerfilPatch) -> PerfilRegisto:
        perfil = self._repo.atualizar(utilizador_id, patch)
        if perfil is None:
            raise PerfilNaoEncontradoError(utilizador_id)
        return perfil
