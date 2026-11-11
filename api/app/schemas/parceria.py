from typing import Literal

from pydantic import BaseModel, EmailStr, Field, field_validator

TipoDeParceiro = Literal[
    "clinica_oftalmologica",
    "optica",
    "hospital",
    "seguradora",
    "empresa",
    "ong",
    "instituicao_ensino",
    "outro",
]


class DocumentoParceriaPedido(BaseModel):
    content_type: str = Field(min_length=1, max_length=100)


class DocumentoParceriaPreparado(BaseModel):
    url_de_upload: str
    chave: str


class DocumentoParceriaEnviado(BaseModel):
    # Chave devolvida por POST /parcerias/documentos, depois do PUT ao R2.
    chave: str = Field(min_length=1, max_length=300)
    nome: str = Field(min_length=1, max_length=200)
    content_type: str = Field(min_length=1, max_length=100)


class CandidaturaParceriaCriar(BaseModel):
    """O que o formulário `/parceiros/registo` envia. Público: uma empresa
    que ainda não é parceira não tem conta."""

    denominacao: str = Field(min_length=2, max_length=200)
    nif: str = Field(min_length=5, max_length=20, pattern=r"^[0-9A-Za-z]+$")
    tipo: TipoDeParceiro
    provincia: str = Field(min_length=2, max_length=60)
    morada: str | None = Field(default=None, max_length=300)
    website: str | None = Field(default=None, max_length=200)
    representante_nome: str = Field(min_length=2, max_length=150)
    representante_cargo: str = Field(min_length=2, max_length=100)
    email: EmailStr
    telefone: str = Field(min_length=6, max_length=30, pattern=r"^[0-9+()\s-]+$")
    mensagem: str | None = Field(default=None, max_length=2000)
    documentos: list[DocumentoParceriaEnviado] = Field(default_factory=list, max_length=5)
    # Declaração de poderes de representação e autorização do tratamento
    # dos dados -- sem ela não há registo.
    declaracao: bool

    @field_validator("declaracao")
    @classmethod
    def _declaracao_aceite(cls, valor: bool) -> bool:
        if not valor:
            raise ValueError("é preciso aceitar a declaração")
        return valor

    @field_validator("denominacao", "provincia", "representante_nome", "representante_cargo", mode="before")
    @classmethod
    def _sem_espacos_a_volta(cls, valor: object) -> object:
        return valor.strip() if isinstance(valor, str) else valor

    @field_validator("morada", "website", "mensagem", mode="before")
    @classmethod
    def _vazio_e_nada(cls, valor: object) -> object:
        if isinstance(valor, str):
            valor = valor.strip()
            return valor or None
        return valor


class CandidaturaParceriaPublica(BaseModel):
    referencia: str
