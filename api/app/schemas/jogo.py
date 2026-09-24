from typing import Literal

from pydantic import BaseModel, Field

RespostaOpcao = Literal["A", "B", "C", "D"]


class PerguntaPublica(BaseModel):
    """Forma exposta ao jogador -- sem `resposta_correta` nem
    `explicacao`, de propósito: a validação é sempre feita no servidor
    (`POST /jogo/validar`), nunca no cliente."""

    id: str
    texto_pergunta: str
    opcao_a: str
    opcao_b: str
    opcao_c: str
    opcao_d: str

    model_config = {"from_attributes": True}


class PerguntaAdmin(PerguntaPublica):
    """Forma vista no painel de administração -- inclui a resposta certa,
    o nível de dificuldade e a explicação."""

    resposta_correta: RespostaOpcao
    nivel_dificuldade: int
    explicacao: str | None


class PerguntaCriar(BaseModel):
    texto_pergunta: str = Field(min_length=1)
    opcao_a: str = Field(min_length=1)
    opcao_b: str = Field(min_length=1)
    opcao_c: str = Field(min_length=1)
    opcao_d: str = Field(min_length=1)
    resposta_correta: RespostaOpcao
    nivel_dificuldade: int = Field(ge=1, le=3)
    explicacao: str | None = Field(default=None)


class ValidarRespostaRequest(BaseModel):
    pergunta_id: str
    resposta_usuario: RespostaOpcao


class ValidarRespostaResponse(BaseModel):
    correta: bool
    resposta_correta: RespostaOpcao
    explicacao: str | None


class PerfilJogadorPublico(BaseModel):
    moedas: int
    diamantes: int
    partidas_jogadas: int
    patamar_maximo_alcancado: int

    model_config = {"from_attributes": True}


class PacoteDiamantesPublico(BaseModel):
    id: str
    diamantes: int
    bonus: int
    total_diamantes: int
    preco_kz: int

    model_config = {"from_attributes": True}


class LojaDiamantesPublica(BaseModel):
    pacotes: list[PacoteDiamantesPublico]
    # `True` enquanto a compra só credita diamantes em modo simulado
    # (desenvolvimento); `False` quando comprar ainda não está disponível.
    pagamento_simulado: bool


class ComprarPacoteRequest(BaseModel):
    pacote_id: str = Field(min_length=1, max_length=40)
