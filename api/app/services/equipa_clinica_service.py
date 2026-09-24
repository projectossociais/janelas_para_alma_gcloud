"""Regras da ligação conta→clínica (equipa da clínica).

O que o utilizador (aqui, sempre um admin) podia mentir sobre isto, e é
recusado aqui:
- ligar um email que não corresponde a nenhuma conta → `UtilizadorNaoEncontradoError`;
- ligar a uma clínica que não existe → `ClinicaNaoEncontradaError`;
- ligar uma conta já ligada a outra clínica → `JaLigadoAOutraClinicaError`
  (o UNIQUE em `utilizador_id` garante isto na base de dados; aqui dá-se
  um erro de domínio claro em vez de deixar rebentar a excepção da BD).
"""

from app.repositories.clinica_parceira_repository import ClinicaParceiraRepository
from app.repositories.equipa_clinica_repository import EquipaClinicaRepository, MembroEquipaRegisto
from app.repositories.utilizadores_repository import UtilizadoresRepository


class UtilizadorNaoEncontradoError(Exception):
    pass


class ClinicaNaoEncontradaError(Exception):
    pass


class JaLigadoAOutraClinicaError(Exception):
    pass


class EquipaClinicaService:
    def __init__(
        self,
        equipa: EquipaClinicaRepository,
        clinicas: ClinicaParceiraRepository,
        utilizadores: UtilizadoresRepository,
    ) -> None:
        self._equipa = equipa
        self._clinicas = clinicas
        self._utilizadores = utilizadores

    def adicionar(self, clinica_id: str, email: str) -> MembroEquipaRegisto:
        if self._clinicas.obter(clinica_id) is None:
            raise ClinicaNaoEncontradaError(clinica_id)

        utilizador = self._utilizadores.obter_por_email(email)
        if utilizador is None:
            raise UtilizadorNaoEncontradoError(email)

        existente = self._equipa.obter_por_utilizador(utilizador.id)
        if existente is not None and existente.clinica_id != clinica_id:
            raise JaLigadoAOutraClinicaError(utilizador.id)
        if existente is not None:
            return existente

        return self._equipa.criar(utilizador.id, clinica_id)

    def remover(self, clinica_id: str, utilizador_id: str) -> bool:
        return self._equipa.remover(utilizador_id, clinica_id)
