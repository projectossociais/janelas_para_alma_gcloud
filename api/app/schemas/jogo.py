from datetime import datetime
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


class OfertaVidaExtraPublica(BaseModel):
    custo: int
    # Vidas extra que ainda se podem usar nesta partida (0 = acabou-se).
    restantes: int

    model_config = {"from_attributes": True}


class PerguntaDaPartidaPublica(PerguntaPublica):
    """A pergunta que a partida entregou -- só esta se pode validar."""

    patamar: int


class RecompensaSequenciaPublica(BaseModel):
    # Acertos seguidos que deram o marco (3, 6, 9...) e os diamantes ganhos.
    sequencia: int
    diamantes: int
    perfil: "PerfilJogadorPublico"


class ValidarRespostaResponse(BaseModel):
    correta: bool
    # `None` quando a partida fica à espera da decisão sobre a vida extra:
    # a resposta certa só se revela ao terminar (`/jogo/partidas/atual/terminar`).
    resposta_correta: RespostaOpcao | None
    explicacao: str | None
    vida_extra: OfertaVidaExtraPublica | None = None
    sequencia_acertos: int = 0
    # Preenchida só quando este acerto atinge um marco de sequência.
    recompensa_sequencia: RecompensaSequenciaPublica | None = None


class PerfilJogadorPublico(BaseModel):
    moedas: int
    diamantes: int
    partidas_jogadas: int
    patamar_maximo_alcancado: int
    melhor_sequencia: int = 0

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


# --- Ajudas ------------------------------------------------------------------


class AjudaPerguntaRequest(BaseModel):
    pergunta_id: str


class CinquentaCinquentaResponse(BaseModel):
    opcoes_eliminadas: list[RespostaOpcao]


class OpiniaoPublicoResponse(BaseModel):
    percentagens: dict[RespostaOpcao, int]


# --- Mercado -----------------------------------------------------------------


class VendedorMercadoPublico(BaseModel):
    id: str
    custo_diamantes: int
    precisao: float
    # `None` = disponível agora; senão, até quando está bloqueado (UTC).
    disponivel_em: datetime | None


class MercadoPublico(BaseModel):
    # Hora do servidor -- o cliente usa-a para acertar o cronómetro do
    # bloqueio mesmo que o relógio do dispositivo esteja errado.
    agora: datetime
    vendedores: list[VendedorMercadoPublico]


class ComprarAjudaMercadoRequest(BaseModel):
    vendedor_id: str = Field(min_length=1, max_length=40)
    pergunta_id: str
    opcoes_excluidas: list[RespostaOpcao] = Field(default_factory=list, max_length=3)


class AjudaMercadoResponse(BaseModel):
    vendedor_id: str
    resposta_sugerida: RespostaOpcao
    disponivel_em: datetime
    perfil: PerfilJogadorPublico


# --- Partida -----------------------------------------------------------------


class PartidaPublica(BaseModel):
    estado: Literal["em_curso", "a_aguardar_decisao", "terminada"]
    patamar_superado: int
    vidas_extra_usadas: int
    cinquenta_cinquenta_usada: bool
    opiniao_publico_usada: bool
    trocar_pergunta_usada: bool
    sequencia_acertos: int

    model_config = {"from_attributes": True}


class VidaExtraResponse(BaseModel):
    perfil: PerfilJogadorPublico
    pergunta_id: str
    # Opção a esconder na nova tentativa (`None` se o tempo tinha esgotado).
    opcao_falhada: RespostaOpcao | None
    vidas_restantes: int


class PartidaTerminadaResponse(BaseModel):
    perfil: PerfilJogadorPublico
    patamar_superado: int
    moedas_ganhas: int
    diamantes_ganhos: int
    resposta_correta: RespostaOpcao | None
    explicacao: str | None


# `RecompensaSequenciaPublica` refere-se a `PerfilJogadorPublico`, definido mais abaixo.
RecompensaSequenciaPublica.model_rebuild()
ValidarRespostaResponse.model_rebuild()
