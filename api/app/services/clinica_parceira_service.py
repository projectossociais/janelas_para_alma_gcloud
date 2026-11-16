"""Remover uma clínica parceira do painel de administração.

Apagar de vez só é seguro quando a clínica não tem pedidos de consulta:
`agendamentos_clinicos` guarda pedidos de famílias (com nome e contacto) e
tem `ON DELETE RESTRICT` para a clínica -- esse histórico nunca se perde por
um clique. Nesse caso a clínica é desactivada (deixa de aparecer ao público
e de receber pedidos novos) e pode ser reactivada mais tarde.
"""

from enum import StrEnum

from app.repositories.clinica_parceira_repository import (
    ClinicaComAgendamentosError,
    ClinicaParceiraRepository,
)


class ClinicaNaoEncontradaError(Exception):
    pass


class ResultadoRemocao(StrEnum):
    apagada = "apagada"
    desativada = "desativada"


class ClinicaParceiraService:
    def __init__(self, repositorio: ClinicaParceiraRepository) -> None:
        self._repo = repositorio

    def remover(self, clinica_id: str) -> ResultadoRemocao:
        # Mantém o bloqueio da linha até apagar/desactivar. A criação de um
        # pedido usa o mesmo bloqueio, para as duas operações ficarem ordenadas.
        if self._repo.obter_para_remocao(clinica_id) is None:
            raise ClinicaNaoEncontradaError(clinica_id)
        if self._repo.tem_agendamentos(clinica_id):
            return self._desativar(clinica_id)
        try:
            apagada = self._repo.apagar(clinica_id)
        except ClinicaComAgendamentosError:
            # Um pedido de consulta chegou entre a verificação e o DELETE:
            # a mesma regra, só que decidida pela base de dados.
            return self._desativar(clinica_id)
        if not apagada:
            raise ClinicaNaoEncontradaError(clinica_id)
        return ResultadoRemocao.apagada

    def _desativar(self, clinica_id: str) -> ResultadoRemocao:
        if self._repo.definir_ativa(clinica_id, False) is None:
            raise ClinicaNaoEncontradaError(clinica_id)
        return ResultadoRemocao.desativada
