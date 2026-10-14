"""Migração única dos comprovativos antigos para o bucket privado.

Até 2026-10-14 os comprovativos de pagamento iam para o bucket **público**
e o URL público ficava em `comprovativo_url` (`premium_requests`, `doacoes`,
`pedidos_loja_jogo`). Este service copia cada um para o bucket privado com
a mesma chave, grava `comprovativo_chave` e esquece o URL público. Corre-se
à mão, por `scripts/migrar_comprovativos_privados.py` — precisa das
credenciais do R2, que uma migração Alembic não deve ter.

Ordem, sempre: copiar → gravar a chave → (opcional) apagar o original
público. Uma linha nunca aponta para uma cópia que ainda não existe, e o
original só se apaga quando já nada aponta para ele. Uma falha numa linha
não pára as outras; é reportada e a linha fica por migrar (correr de novo
é seguro — só se listam linhas ainda sem chave)."""

from dataclasses import dataclass, field
from typing import Protocol

from app.repositories.comprovativos_repository import ComprovativoLegado, OrigemComprovativo
from app.services.comprovativo_upload_service import chave_de_comprovativo_valida

__all__ = ["ComprovativoLegado", "MigracaoComprovativosService", "RelatorioMigracao"]


class ComprovativosLegadosRepository(Protocol):
    def listar_legados(self) -> list[ComprovativoLegado]: ...
    def marcar_migrado(self, origem: OrigemComprovativo, registo_id: str, chave: str) -> None: ...


class CopiadorComprovativos(Protocol):
    def copiar_para_privado(self, chave: str) -> None: ...
    def apagar_publico(self, chave: str) -> None: ...


Linha = tuple[str, str, str]  # (origem, registo_id, chave ou url ou motivo)


@dataclass
class RelatorioMigracao:
    migrados: list[Linha] = field(default_factory=list)
    # URLs que não são um comprovativo nosso -- nunca copiados.
    ignorados: list[Linha] = field(default_factory=list)
    falhados: list[Linha] = field(default_factory=list)
    # Migrados, mas o original público não se conseguiu apagar.
    por_apagar: list[str] = field(default_factory=list)


class MigracaoComprovativosService:
    def __init__(
        self,
        repositorio: ComprovativosLegadosRepository,
        copiador: CopiadorComprovativos,
        base_publica: str,
    ) -> None:
        self._repo = repositorio
        self._copiador = copiador
        self._base = base_publica.rstrip("/") + "/"

    def _chave_do_url(self, url: str) -> str | None:
        if not url.startswith(self._base):
            return None
        chave = url[len(self._base) :]
        return chave if chave_de_comprovativo_valida(chave) else None

    def migrar(self, executar: bool, apagar_publicos: bool = False) -> RelatorioMigracao:
        relatorio = RelatorioMigracao()
        for legado in self._repo.listar_legados():
            chave = self._chave_do_url(legado.url)
            if chave is None:
                relatorio.ignorados.append((legado.origem, legado.registo_id, legado.url))
                continue
            if not executar:
                relatorio.migrados.append((legado.origem, legado.registo_id, chave))
                continue
            try:
                self._copiador.copiar_para_privado(chave)
                self._repo.marcar_migrado(legado.origem, legado.registo_id, chave)
            except Exception as exc:  # noqa: BLE001 -- reportar e seguir para a próxima
                relatorio.falhados.append((legado.origem, legado.registo_id, repr(exc)))
                continue
            relatorio.migrados.append((legado.origem, legado.registo_id, chave))
            if apagar_publicos:
                try:
                    self._copiador.apagar_publico(chave)
                except Exception:  # noqa: BLE001 -- a migração em si já está feita
                    relatorio.por_apagar.append(chave)
        return relatorio
