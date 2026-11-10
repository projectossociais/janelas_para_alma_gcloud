"""Testes do `PublicacoesService` — a regra que mais importa é o slug:
gerado sempre pelo servidor, único, e nunca muda depois de criado."""

from datetime import UTC, date, datetime

import pytest

from app.repositories.publicacoes_repository import MidiaRegisto, PublicacaoRegisto
from app.services.publicacoes_service import PublicacaoNaoEncontradaError, PublicacoesService


class RepositorioPublicacoesFalso:
    def __init__(self) -> None:
        self._registos: dict[str, PublicacaoRegisto] = {}
        self._proximo = 1
        self._gostos: set[tuple[str, str]] = set()

    def criar(self, slug, titulo, resumo, corpo, local, data_evento, criado_por) -> PublicacaoRegisto:
        registo = PublicacaoRegisto(
            id=f"pub-{self._proximo}",
            slug=slug,
            titulo=titulo,
            resumo=resumo,
            corpo=corpo,
            local=local,
            data_evento=data_evento,
            capa_url=None,
            estado="rascunho",
            criado_por=criado_por,
            created_at=datetime.now(UTC),
            updated_at=datetime.now(UTC),
            midias=[],
        )
        self._proximo += 1
        self._registos[registo.id] = registo
        return registo

    def obter_por_id(self, publicacao_id: str) -> PublicacaoRegisto | None:
        return self._registos.get(publicacao_id)

    def obter_por_slug(self, slug: str) -> PublicacaoRegisto | None:
        registo = next((r for r in self._registos.values() if r.slug == slug), None)
        # Como o repositório real, a contagem de gostos vem com o registo.
        return PublicacaoRegisto(**{**registo.__dict__, "gostos": self.contar_gostos(registo.id)}) if registo else None

    def existe_slug(self, slug: str) -> bool:
        return any(r.slug == slug for r in self._registos.values())

    def listar_publicadas(self) -> list[PublicacaoRegisto]:
        return [r for r in self._registos.values() if r.estado == "publicada"]

    def listar_todas(self) -> list[PublicacaoRegisto]:
        return list(self._registos.values())

    def atualizar(self, publicacao_id: str, **campos: object) -> PublicacaoRegisto | None:
        atual = self._registos.get(publicacao_id)
        if atual is None:
            return None
        mudancas = {k: v for k, v in campos.items() if v is not None}
        novo = PublicacaoRegisto(**{**atual.__dict__, **mudancas})
        self._registos[publicacao_id] = novo
        return novo

    def definir_estado(self, publicacao_id: str, estado: str) -> PublicacaoRegisto | None:
        return self.atualizar(publicacao_id, estado=estado)

    def apagar(self, publicacao_id: str) -> None:
        self._registos.pop(publicacao_id, None)

    def definir_capa(self, publicacao_id: str, url: str) -> None:
        self.atualizar(publicacao_id, capa_url=url)

    def adicionar_midia(self, publicacao_id: str, url: str) -> MidiaRegisto:
        registo = MidiaRegisto(id="midia-1", publicacao_id=publicacao_id, url=url, ordem=1)
        atual = self._registos[publicacao_id]
        self._registos[publicacao_id] = PublicacaoRegisto(
            **{**atual.__dict__, "midias": [*atual.midias, registo]}
        )
        return registo

    def remover_midia(self, midia_id: str) -> None:
        for publicacao_id, atual in self._registos.items():
            midias = [m for m in atual.midias if m.id != midia_id]
            self._registos[publicacao_id] = PublicacaoRegisto(**{**atual.__dict__, "midias": midias})

    def incrementar_visualizacoes(self, publicacao_id: str) -> int:
        atual = self._registos[publicacao_id]
        self._registos[publicacao_id] = PublicacaoRegisto(
            **{**atual.__dict__, "visualizacoes": atual.visualizacoes + 1}
        )
        return atual.visualizacoes + 1

    def adicionar_gosto(self, publicacao_id: str, utilizador_id: str) -> None:
        self._gostos.add((publicacao_id, utilizador_id))

    def remover_gosto(self, publicacao_id: str, utilizador_id: str) -> None:
        self._gostos.discard((publicacao_id, utilizador_id))

    def contar_gostos(self, publicacao_id: str) -> int:
        return sum(1 for p, _ in self._gostos if p == publicacao_id)

    def gostou(self, publicacao_id: str, utilizador_id: str) -> bool:
        return (publicacao_id, utilizador_id) in self._gostos


@pytest.fixture
def servico() -> tuple[PublicacoesService, RepositorioPublicacoesFalso]:
    repo = RepositorioPublicacoesFalso()
    return PublicacoesService(repo), repo


class TestCriar:
    def test_gera_slug_a_partir_do_titulo(self, servico) -> None:
        svc, _ = servico
        registo = svc.criar("Rastreio Gratuito em Luanda!", "resumo", "corpo", None, None, None)
        assert registo.slug == "rastreio-gratuito-em-luanda"

    def test_nasce_sempre_em_rascunho(self, servico) -> None:
        svc, _ = servico
        registo = svc.criar("Título", "resumo", "corpo", None, None, None)
        assert registo.estado == "rascunho"

    def test_titulos_repetidos_geram_slugs_diferentes(self, servico) -> None:
        svc, _ = servico
        primeiro = svc.criar("Campanha Kamba", "r", "c", None, None, None)
        segundo = svc.criar("Campanha Kamba", "r", "c", None, None, None)
        assert primeiro.slug == "campanha-kamba"
        assert segundo.slug == "campanha-kamba-2"

    def test_titulo_sem_caracteres_ascii_nao_fica_vazio(self, servico) -> None:
        svc, _ = servico
        registo = svc.criar("嗨", "r", "c", None, None, None)
        assert registo.slug == "publicacao"


class TestAtualizar:
    def test_atualiza_campos_sem_mudar_o_slug(self, servico) -> None:
        svc, _ = servico
        criado = svc.criar("Título Original", "r", "c", None, None, None)

        atualizado = svc.atualizar(criado.id, titulo="Novo Título")

        assert atualizado.titulo == "Novo Título"
        assert atualizado.slug == criado.slug  # nunca muda -- partiria um link já partilhado

    def test_falha_com_id_inexistente(self, servico) -> None:
        svc, _ = servico
        with pytest.raises(PublicacaoNaoEncontradaError):
            svc.atualizar("nao-existe", titulo="X")


class TestPublicarEDespublicar:
    def test_publicar_muda_o_estado(self, servico) -> None:
        svc, _ = servico
        criado = svc.criar("Título", "r", "c", None, None, None)
        publicado = svc.publicar(criado.id)
        assert publicado.estado == "publicada"

    def test_despublicar_volta_a_rascunho(self, servico) -> None:
        svc, _ = servico
        criado = svc.criar("Título", "r", "c", None, None, None)
        svc.publicar(criado.id)
        despublicado = svc.despublicar(criado.id)
        assert despublicado.estado == "rascunho"

    def test_publicar_id_inexistente_falha(self, servico) -> None:
        svc, _ = servico
        with pytest.raises(PublicacaoNaoEncontradaError):
            svc.publicar("nao-existe")


class TestApagar:
    def test_apaga_publicacao_existente(self, servico) -> None:
        svc, repo = servico
        criado = svc.criar("Título", "r", "c", None, None, None)
        svc.apagar(criado.id)
        assert repo.obter_por_id(criado.id) is None

    def test_apagar_id_inexistente_falha(self, servico) -> None:
        svc, _ = servico
        with pytest.raises(PublicacaoNaoEncontradaError):
            svc.apagar("nao-existe")


class TestDatasEvento:
    def test_guarda_local_e_data_do_evento(self, servico) -> None:
        svc, _ = servico
        registo = svc.criar("Rastreio", "r", "c", "Luanda", date(2026, 10, 1), "admin-1")
        assert registo.local == "Luanda"
        assert registo.data_evento == date(2026, 10, 1)
        assert registo.criado_por == "admin-1"


class TestVisualizacoesEGostos:
    """2026-10-26: contador de visualizações e "Gosto" (uma conta, um gosto)."""

    def _publicada(self, svc: PublicacoesService) -> PublicacaoRegisto:
        registo = svc.criar("Acção em Cacuaco", "r", "c", None, None, None)
        return svc.publicar(registo.id)

    def test_cada_visualizacao_soma_um(self, servico) -> None:
        svc, _ = servico
        pub = self._publicada(svc)
        assert svc.registar_visualizacao(pub.slug) == 1
        assert svc.registar_visualizacao(pub.slug) == 2

    def test_rascunho_nao_conta_visualizacoes(self, servico) -> None:
        svc, _ = servico
        rascunho = svc.criar("Ainda por publicar", "r", "c", None, None, None)
        with pytest.raises(PublicacaoNaoEncontradaError):
            svc.registar_visualizacao(rascunho.slug)

    def test_a_mesma_conta_so_conta_um_gosto(self, servico) -> None:
        svc, _ = servico
        pub = self._publicada(svc)
        assert svc.gostar(pub.slug, "u1") == (1, True)
        assert svc.gostar(pub.slug, "u1") == (1, True)
        assert svc.gostar(pub.slug, "u2") == (2, True)

    def test_retirar_gosto(self, servico) -> None:
        svc, _ = servico
        pub = self._publicada(svc)
        svc.gostar(pub.slug, "u1")
        assert svc.retirar_gosto(pub.slug, "u1") == (0, False)
        # Retirar um gosto que não existe não é erro.
        assert svc.retirar_gosto(pub.slug, "u1") == (0, False)

    def test_rascunho_nao_recebe_gostos(self, servico) -> None:
        svc, _ = servico
        rascunho = svc.criar("Ainda por publicar", "r", "c", None, None, None)
        with pytest.raises(PublicacaoNaoEncontradaError):
            svc.gostar(rascunho.slug, "u1")
