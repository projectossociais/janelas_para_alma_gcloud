"""Testes do `EliminacaoContaService` (W-03).

O que importa aqui: nunca reprocessar a mesma conta duas vezes, e nunca
processar uma conta cujo prazo ainda não venceu -- ambos seriam um bug de
perda de dados sem aviso, não só um detalhe.
"""

from datetime import UTC, datetime

from app.services.eliminacao_conta_service import EliminacaoContaService


class RepositorioFalso:
    def __init__(self, pendentes: list[str] | None = None) -> None:
        self._pendentes = pendentes or []
        self.anonimizados: list[dict] = []

    def listar_pendentes(self, agora: datetime) -> list[str]:
        return list(self._pendentes)

    def anonimizar(
        self,
        utilizador_id: str,
        agora: datetime,
        email_anonimo: str,
        password_hash_invalido: str,
        nome_anonimo: str,
    ) -> None:
        self.anonimizados.append(
            {
                "utilizador_id": utilizador_id,
                "agora": agora,
                "email_anonimo": email_anonimo,
                "password_hash_invalido": password_hash_invalido,
                "nome_anonimo": nome_anonimo,
            }
        )


class TestProcessarPendentes:
    def test_sem_contas_pendentes_devolve_zero(self) -> None:
        repo = RepositorioFalso(pendentes=[])
        resultado = EliminacaoContaService(repo).processar_pendentes()
        assert resultado == 0
        assert repo.anonimizados == []

    def test_anonimiza_cada_conta_pendente(self) -> None:
        repo = RepositorioFalso(pendentes=["u-1", "u-2"])
        resultado = EliminacaoContaService(repo).processar_pendentes()

        assert resultado == 2
        ids_processados = [a["utilizador_id"] for a in repo.anonimizados]
        assert ids_processados == ["u-1", "u-2"]

    def test_gera_um_email_anonimo_unico_por_conta(self) -> None:
        repo = RepositorioFalso(pendentes=["u-1", "u-2"])
        EliminacaoContaService(repo).processar_pendentes()

        emails = [a["email_anonimo"] for a in repo.anonimizados]
        assert len(set(emails)) == 2
        assert "u-1" in emails[0]
        assert "anonimo.janelasparaalma.com" in emails[0]

    def test_gera_um_password_hash_diferente_por_conta_e_nunca_vazio(self) -> None:
        repo = RepositorioFalso(pendentes=["u-1", "u-2"])
        EliminacaoContaService(repo).processar_pendentes()

        hashes = [a["password_hash_invalido"] for a in repo.anonimizados]
        assert all(hashes)
        assert hashes[0] != hashes[1]

    def test_usa_o_mesmo_instante_para_todas_as_contas_do_lote(self) -> None:
        repo = RepositorioFalso(pendentes=["u-1", "u-2"])
        EliminacaoContaService(repo).processar_pendentes()

        instantes = [a["agora"] for a in repo.anonimizados]
        assert instantes[0] == instantes[1]
        assert instantes[0].tzinfo is not None
        assert instantes[0] <= datetime.now(UTC)
