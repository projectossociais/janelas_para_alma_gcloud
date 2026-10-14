"""Testes do `MigracaoComprovativosService` — move os comprovativos antigos
(URL público em `comprovativo_url`) para o bucket privado.

O que nunca pode acontecer:
- uma linha passar a apontar para uma chave privada que ainda não existe
  (copiar primeiro, gravar depois);
- copiar um URL que não é um comprovativo nosso (outro domínio, outro
  prefixo) — fica de fora e é reportado;
- apagar o original público antes de a linha já apontar para a cópia.
"""

from app.services.migracao_comprovativos_service import (
    ComprovativoLegado,
    MigracaoComprovativosService,
)

BASE = "https://pub.r2.test"


class RepositorioFalso:
    def __init__(self, legados: list[ComprovativoLegado]) -> None:
        self.legados = list(legados)
        self.migrados: list[tuple[str, str, str]] = []

    def listar_legados(self) -> list[ComprovativoLegado]:
        return list(self.legados)

    def marcar_migrado(self, origem: str, registo_id: str, chave: str) -> None:
        self.migrados.append((origem, registo_id, chave))
        self.legados = [x for x in self.legados if (x.origem, x.registo_id) != (origem, registo_id)]


class CopiadorFalso:
    def __init__(self, falha_em: set[str] | None = None, log: list[str] | None = None) -> None:
        self.copiados: list[str] = []
        self.apagados: list[str] = []
        self._falha_em = falha_em or set()
        self._log = log if log is not None else []

    def copiar_para_privado(self, chave: str) -> None:
        if chave in self._falha_em:
            raise RuntimeError("NoSuchKey")
        self._log.append(f"copiar {chave}")
        self.copiados.append(chave)

    def apagar_publico(self, chave: str) -> None:
        self._log.append(f"apagar {chave}")
        self.apagados.append(chave)


def _legado(origem: str, id_: str, url: str) -> ComprovativoLegado:
    return ComprovativoLegado(origem=origem, registo_id=id_, url=url)


def test_ensaio_nao_copia_nem_grava_nada() -> None:
    repo = RepositorioFalso([_legado("premium", "p1", f"{BASE}/comprovativos/a.pdf")])
    copiador = CopiadorFalso()

    relatorio = MigracaoComprovativosService(repo, copiador, BASE).migrar(executar=False)

    assert relatorio.migrados == [("premium", "p1", "comprovativos/a.pdf")]
    assert copiador.copiados == []
    assert repo.migrados == []


def test_copia_para_o_privado_e_grava_a_chave_nas_tres_tabelas() -> None:
    repo = RepositorioFalso(
        [
            _legado("premium", "p1", f"{BASE}/comprovativos/a.pdf"),
            _legado("doacao", "d1", f"{BASE}/comprovativos/b.png"),
            _legado("loja", "l1", f"{BASE}/comprovativos/c.webp"),
        ]
    )
    copiador = CopiadorFalso()

    relatorio = MigracaoComprovativosService(repo, copiador, BASE).migrar(executar=True)

    assert copiador.copiados == ["comprovativos/a.pdf", "comprovativos/b.png", "comprovativos/c.webp"]
    assert repo.migrados == [
        ("premium", "p1", "comprovativos/a.pdf"),
        ("doacao", "d1", "comprovativos/b.png"),
        ("loja", "l1", "comprovativos/c.webp"),
    ]
    assert relatorio.falhados == []
    assert copiador.apagados == []  # só com apagar_publicos=True


def test_aceita_base_publica_com_barra_final() -> None:
    repo = RepositorioFalso([_legado("premium", "p1", f"{BASE}/comprovativos/a.pdf")])

    MigracaoComprovativosService(repo, CopiadorFalso(), BASE + "/").migrar(executar=True)

    assert repo.migrados == [("premium", "p1", "comprovativos/a.pdf")]


def test_url_que_nao_e_um_comprovativo_nosso_fica_de_fora() -> None:
    repo = RepositorioFalso(
        [
            _legado("premium", "p1", "https://outro.dominio/comprovativos/a.pdf"),
            _legado("premium", "p2", f"{BASE}/avatares/u/x.png"),
            _legado("premium", "p3", f"{BASE}/comprovativos/../avatares/x.png"),
        ]
    )
    copiador = CopiadorFalso()

    relatorio = MigracaoComprovativosService(repo, copiador, BASE).migrar(executar=True)

    assert [i[1] for i in relatorio.ignorados] == ["p1", "p2", "p3"]
    assert copiador.copiados == []
    assert repo.migrados == []


def test_falha_na_copia_nao_grava_a_linha_e_continua_com_as_outras() -> None:
    repo = RepositorioFalso(
        [
            _legado("premium", "p1", f"{BASE}/comprovativos/falha.pdf"),
            _legado("premium", "p2", f"{BASE}/comprovativos/ok.pdf"),
        ]
    )
    copiador = CopiadorFalso(falha_em={"comprovativos/falha.pdf"})

    relatorio = MigracaoComprovativosService(repo, copiador, BASE).migrar(executar=True)

    assert repo.migrados == [("premium", "p2", "comprovativos/ok.pdf")]
    assert [f[1] for f in relatorio.falhados] == ["p1"]


def test_apagar_publicos_so_apaga_depois_de_copiar_e_gravar() -> None:
    log: list[str] = []
    repo = RepositorioFalso([_legado("loja", "l1", f"{BASE}/comprovativos/c.png")])
    original = repo.marcar_migrado

    def marcar(origem, registo_id, chave):
        log.append(f"gravar {chave}")
        original(origem, registo_id, chave)

    repo.marcar_migrado = marcar  # type: ignore[method-assign]
    copiador = CopiadorFalso(log=log)

    MigracaoComprovativosService(repo, copiador, BASE).migrar(executar=True, apagar_publicos=True)

    assert log == ["copiar comprovativos/c.png", "gravar comprovativos/c.png", "apagar comprovativos/c.png"]


def test_falha_a_apagar_o_publico_nao_desfaz_a_migracao() -> None:
    class CopiadorQueNaoApaga(CopiadorFalso):
        def apagar_publico(self, chave: str) -> None:
            raise RuntimeError("AccessDenied")

    repo = RepositorioFalso([_legado("premium", "p1", f"{BASE}/comprovativos/a.pdf")])

    relatorio = MigracaoComprovativosService(repo, CopiadorQueNaoApaga(), BASE).migrar(
        executar=True, apagar_publicos=True
    )

    assert repo.migrados == [("premium", "p1", "comprovativos/a.pdf")]
    assert relatorio.por_apagar == ["comprovativos/a.pdf"]


def test_sem_legados_nao_faz_nada() -> None:
    relatorio = MigracaoComprovativosService(RepositorioFalso([]), CopiadorFalso(), BASE).migrar(executar=True)

    assert (relatorio.migrados, relatorio.ignorados, relatorio.falhados) == ([], [], [])
