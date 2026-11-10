"""Testes do `CandidaturaParceriaService` — o registo de uma empresa (clínica,
óptica, organização) que se quer juntar à rede.

O que quem preenche podia falsear e é recusado aqui:
- apresentar como documento uma chave que não é um documento de parceria
  (outro objecto do bucket privado, ex.: o comprovativo de outra pessoa);
- anexar mais documentos do que o permitido.

E a regra herdada das doações (CLAUDE.md §6): a candidatura gravada é o
valor — nunca se perde por causa de um email, e nunca se diz "enviado" se a
gravação falhou."""

import pytest

from app.core.email import Anexo, EmailEnvioFalhouError
from app.repositories.candidatura_parceria_repository import (
    CandidaturaParceriaRegisto,
    DocumentoParceria,
)
from app.services.candidatura_parceria_service import (
    LIMITE_BYTES_POR_ANEXO,
    MAX_DOCUMENTOS,
    CandidaturaParceriaService,
    ChaveDeDocumentoInvalidaError,
    DadosCandidaturaParceria,
    DemasiadosDocumentosError,
    DocumentosIndisponiveisError,
    TipoDeDocumentoNaoPermitidoError,
)

EMAIL_EQUIPA = "equipa@janelas.test"


class RepositorioFalso:
    def __init__(self, falha: bool = False) -> None:
        self.criadas: list[DadosCandidaturaParceria] = []
        self._falha = falha

    def criar(self, dados: DadosCandidaturaParceria) -> CandidaturaParceriaRegisto:
        if self._falha:
            raise RuntimeError("ligação perdida")
        self.criadas.append(dados)
        return CandidaturaParceriaRegisto(id="cand-1", referencia="PAR-ABC123", dados=dados)


class EmailFalso:
    def __init__(self, falha_para: set[str] | None = None) -> None:
        self.enviados: list[dict] = []
        self._falha_para = falha_para or set()

    def enviar(self, destinatario, assunto, corpo_html, anexos: list[Anexo] | None = None) -> None:
        if destinatario in self._falha_para:
            raise EmailEnvioFalhouError("falha simulada do Resend")
        self.enviados.append(
            {"destinatario": destinatario, "assunto": assunto, "corpo_html": corpo_html, "anexos": anexos or []}
        )


class ArmazenamentoFalso:
    def __init__(self, objectos: dict[str, bytes] | None = None) -> None:
        self.objectos = objectos or {}
        self.assinados: list[tuple[str, str]] = []

    def url_de_upload(self, chave: str, content_type: str) -> str:
        self.assinados.append((chave, content_type))
        return f"https://privado.r2.test/{chave}?assinado=1"

    def ler_bytes(self, chave: str, limite: int) -> bytes | None:
        conteudo = self.objectos.get(chave)
        return None if conteudo is None else conteudo[: limite + 1]


def _dados(**over) -> DadosCandidaturaParceria:
    base = {
        "denominacao": "Clínica Visão Clara, Lda.",
        "nif": "5001234567",
        "tipo": "clinica_oftalmologica",
        "provincia": "Luanda",
        "morada": "Rua da Missão, 12",
        "website": None,
        "representante_nome": "Ana Silva",
        "representante_cargo": "Directora Clínica",
        "email": "ana@visaoclara.test",
        "telefone": "+244 923 000 000",
        "mensagem": "Queremos receber pacientes encaminhados.",
        "documentos": (),
    }
    base.update(over)
    return DadosCandidaturaParceria(**base)


def _servico(repo=None, email=None, armazenamento=None, sem_armazenamento=False):
    repo = repo or RepositorioFalso()
    email = email or EmailFalso()
    armazenamento = None if sem_armazenamento else (armazenamento or ArmazenamentoFalso())
    return CandidaturaParceriaService(repo, email, armazenamento, EMAIL_EQUIPA), repo, email, armazenamento


class TestPrepararDocumento:
    def test_assina_o_upload_no_prefixo_das_parcerias(self) -> None:
        servico, _, _, armazenamento = _servico()

        preparado = servico.preparar_documento("application/pdf")

        assert preparado.chave.startswith("parcerias/")
        assert preparado.chave.endswith(".pdf")
        assert armazenamento.assinados == [(preparado.chave, "application/pdf")]
        assert preparado.url_de_upload.endswith("?assinado=1")

    @pytest.mark.parametrize("tipo", ["application/zip", "text/html", "image/svg+xml", ""])
    def test_recusa_tipos_fora_da_lista(self, tipo) -> None:
        servico, _, _, armazenamento = _servico()

        with pytest.raises(TipoDeDocumentoNaoPermitidoError):
            servico.preparar_documento(tipo)
        assert armazenamento.assinados == []

    def test_sem_bucket_privado_recusa_em_vez_de_usar_o_publico(self) -> None:
        servico, *_ = _servico(sem_armazenamento=True)

        with pytest.raises(DocumentosIndisponiveisError):
            servico.preparar_documento("application/pdf")


class TestSubmeter:
    def test_grava_e_envia_os_dados_a_equipa_com_os_documentos_em_anexo(self) -> None:
        doc = DocumentoParceria(chave="parcerias/a1.pdf", nome="Alvará.pdf", content_type="application/pdf")
        armazenamento = ArmazenamentoFalso({"parcerias/a1.pdf": b"%PDF-alvara"})
        servico, repo, email, _ = _servico(armazenamento=armazenamento)

        candidatura = servico.submeter(_dados(documentos=(doc,)))

        assert candidatura.referencia == "PAR-ABC123"
        assert len(repo.criadas) == 1
        para_equipa = next(e for e in email.enviados if e["destinatario"] == EMAIL_EQUIPA)
        for esperado in ("Clínica Visão Clara, Lda.", "5001234567", "Ana Silva", "ana@visaoclara.test", "PAR-ABC123"):
            assert esperado in para_equipa["corpo_html"]
        assert [(a.nome_ficheiro, a.conteudo) for a in para_equipa["anexos"]] == [("Alvará.pdf", b"%PDF-alvara")]

    def test_a_empresa_recebe_confirmacao_com_o_comprovativo_em_pdf(self) -> None:
        doc = DocumentoParceria(chave="parcerias/a1.pdf", nome="Alvará.pdf", content_type="application/pdf")
        servico, _, email, _ = _servico(armazenamento=ArmazenamentoFalso({"parcerias/a1.pdf": b"%PDF-alvara"}))

        servico.submeter(_dados(documentos=(doc,)))

        confirmacao = next(e for e in email.enviados if e["destinatario"] == "ana@visaoclara.test")
        assert "PAR-ABC123" in confirmacao["corpo_html"]
        # Só o comprovativo gerado por nós -- nunca os documentos de volta.
        assert [a.nome_ficheiro for a in confirmacao["anexos"]] == ["Comprovativo-de-registo-PAR-ABC123.pdf"]
        assert confirmacao["anexos"][0].conteudo.startswith(b"%PDF")

    def test_falha_a_gerar_o_comprovativo_nao_impede_o_registo_nem_o_email(self, monkeypatch) -> None:
        def rebenta(*_a, **_k):
            raise RuntimeError("fonte em falta")

        monkeypatch.setattr("app.services.candidatura_parceria_service.gerar_comprovativo_parceria", rebenta)
        servico, repo, email, _ = _servico()

        servico.submeter(_dados())

        assert len(repo.criadas) == 1
        confirmacao = next(e for e in email.enviados if e["destinatario"] == "ana@visaoclara.test")
        assert confirmacao["anexos"] == []

    def test_funciona_sem_documentos(self) -> None:
        servico, repo, email, _ = _servico(sem_armazenamento=True)

        servico.submeter(_dados())

        assert len(repo.criadas) == 1
        assert next(e for e in email.enviados if e["destinatario"] == EMAIL_EQUIPA)["anexos"] == []

    @pytest.mark.parametrize(
        "chave",
        ["comprovativos/outro.pdf", "comprovativos-pagamento/u/x.pdf", "parcerias/../comprovativos/x.pdf", "", "parcerias/"],
    )
    def test_recusa_documento_que_nao_e_de_parceria_e_nao_grava_nada(self, chave) -> None:
        servico, repo, email, _ = _servico()
        doc = DocumentoParceria(chave=chave, nome="x.pdf", content_type="application/pdf")

        with pytest.raises(ChaveDeDocumentoInvalidaError):
            servico.submeter(_dados(documentos=(doc,)))
        assert repo.criadas == []
        assert email.enviados == []

    def test_recusa_documentos_a_mais(self) -> None:
        servico, repo, _, _ = _servico()
        docs = tuple(
            DocumentoParceria(chave=f"parcerias/{i}.pdf", nome=f"{i}.pdf", content_type="application/pdf")
            for i in range(MAX_DOCUMENTOS + 1)
        )

        with pytest.raises(DemasiadosDocumentosError):
            servico.submeter(_dados(documentos=docs))
        assert repo.criadas == []

    def test_documentos_com_chave_valida_exigem_o_bucket_privado(self) -> None:
        servico, repo, _, _ = _servico(sem_armazenamento=True)
        doc = DocumentoParceria(chave="parcerias/a.pdf", nome="a.pdf", content_type="application/pdf")

        with pytest.raises(DocumentosIndisponiveisError):
            servico.submeter(_dados(documentos=(doc,)))
        assert repo.criadas == []

    def test_nunca_engole_uma_falha_de_gravacao(self) -> None:
        servico, _, email, _ = _servico(repo=RepositorioFalso(falha=True))

        with pytest.raises(RuntimeError):
            servico.submeter(_dados())
        assert email.enviados == []

    def test_falha_do_email_nao_perde_a_candidatura_gravada(self) -> None:
        email = EmailFalso(falha_para={EMAIL_EQUIPA, "ana@visaoclara.test"})
        servico, repo, _, _ = _servico(email=email)

        candidatura = servico.submeter(_dados())

        assert candidatura.id == "cand-1"
        assert len(repo.criadas) == 1

    def test_documento_em_falta_ou_grande_demais_fica_referido_no_email_sem_anexo(self) -> None:
        docs = (
            DocumentoParceria(chave="parcerias/falta.pdf", nome="Falta.pdf", content_type="application/pdf"),
            DocumentoParceria(chave="parcerias/grande.pdf", nome="Grande.pdf", content_type="application/pdf"),
            DocumentoParceria(chave="parcerias/ok.png", nome="Logo.png", content_type="image/png"),
        )
        armazenamento = ArmazenamentoFalso(
            {"parcerias/grande.pdf": b"x" * (LIMITE_BYTES_POR_ANEXO + 10), "parcerias/ok.png": b"png"}
        )
        servico, _, email, _ = _servico(armazenamento=armazenamento)

        servico.submeter(_dados(documentos=docs))

        para_equipa = next(e for e in email.enviados if e["destinatario"] == EMAIL_EQUIPA)
        assert [a.nome_ficheiro for a in para_equipa["anexos"]] == ["Logo.png"]
        assert "Falta.pdf" in para_equipa["corpo_html"]
        assert "Grande.pdf" in para_equipa["corpo_html"]
        assert "parcerias/grande.pdf" in para_equipa["corpo_html"]

    def test_o_que_a_empresa_escreve_nunca_entra_como_html_no_email(self) -> None:
        servico, _, email, _ = _servico()

        servico.submeter(_dados(denominacao="<script>alert(1)</script>", mensagem='<img src=x onerror="x">'))

        corpo = next(e for e in email.enviados if e["destinatario"] == EMAIL_EQUIPA)["corpo_html"]
        assert "<script>" not in corpo
        assert "<img" not in corpo
        assert "&lt;script&gt;" in corpo

    def test_o_nome_do_anexo_nunca_leva_caminhos(self) -> None:
        doc = DocumentoParceria(chave="parcerias/a.pdf", nome="../../etc/passwd\r\n.pdf", content_type="application/pdf")
        servico, _, email, _ = _servico(armazenamento=ArmazenamentoFalso({"parcerias/a.pdf": b"x"}))

        servico.submeter(_dados(documentos=(doc,)))

        nome = next(e for e in email.enviados if e["destinatario"] == EMAIL_EQUIPA)["anexos"][0].nome_ficheiro
        assert "/" not in nome and "\r" not in nome and "\n" not in nome and ".." not in nome
