from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

RespostaOpcao = Literal["A", "B", "C", "D"]
# Espelha `CATEGORIAS_PERGUNTA_JOGO` (orm_models.py) -- lista fechada.
CategoriaPergunta = Literal[
    "anatomia_ocular",
    "doencas_estrabismo",
    "prevencao_cuidados",
    "estilo_vida_visao",
    "ciencia_ocular",
    "curiosidades_visuais",
]


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
    categoria: CategoriaPergunta


class PerguntaCriar(BaseModel):
    texto_pergunta: str = Field(min_length=1)
    opcao_a: str = Field(min_length=1)
    opcao_b: str = Field(min_length=1)
    opcao_c: str = Field(min_length=1)
    opcao_d: str = Field(min_length=1)
    resposta_correta: RespostaOpcao
    nivel_dificuldade: int = Field(ge=1, le=3)
    explicacao: str | None = Field(default=None)
    categoria: CategoriaPergunta = "curiosidades_visuais"


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
    # Acertos seguidos que deram o marco (3, 6, 9...) e os diamantes que
    # entraram mesmo na conta -- menos do que `diamantes_do_marco` (ou 0) se
    # o limite diário de diamantes de sequências foi atingido.
    sequencia: int
    diamantes: int
    diamantes_do_marco: int
    limite_diario_atingido: bool
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
    patamares_superados_total: int = 0
    moedas_ganhas_total: int = 0

    model_config = {"from_attributes": True}


class PacoteDiamantesPublico(BaseModel):
    id: str
    diamantes: int
    bonus: int
    total_diamantes: int
    preco_kz: int
    preco_moedas: int

    model_config = {"from_attributes": True}


class LojaDiamantesPublica(BaseModel):
    pacotes: list[PacoteDiamantesPublico]
    # `True` em desenvolvimento: os Kwanzas creditam logo, sem comprovativo.
    # `False` em produção: Kwanzas por transferência + comprovativo
    # (`POST /jogo/loja/pedidos`), creditados quando um admin confirmar.
    pagamento_simulado: bool


class ComprarPacoteRequest(BaseModel):
    pacote_id: str = Field(min_length=1, max_length=40)
    # "moedas": débito atómico do saldo de moedas. "kwanzas": só credita
    # logo em modo simulado; em produção usa-se `POST /jogo/loja/pedidos`.
    metodo_pagamento: Literal["moedas", "kwanzas"] = "kwanzas"


class PacoteMoedasPublico(BaseModel):
    id: str
    moedas: int
    bonus: int
    total_moedas: int
    preco_kz: int

    model_config = {"from_attributes": True}


class LojaMoedasPublica(BaseModel):
    pacotes: list[PacoteMoedasPublico]
    # Como na Loja de Diamantes: `True` só em desenvolvimento.
    pagamento_simulado: bool


class ComprarPacoteMoedasRequest(BaseModel):
    pacote_id: str = Field(min_length=1, max_length=40)


class PedirKwanzasRequest(BaseModel):
    pacote_id: str = Field(min_length=1, max_length=40)
    # Chave devolvida por `POST /uploads/comprovativo`, depois do PUT ao R2.
    comprovativo_chave: str = Field(min_length=1, max_length=300)
    # Que loja: o pacote procura-se só no catálogo deste tipo.
    tipo_item: Literal["diamantes", "moedas"] = "diamantes"


class PedidoLojaPublico(BaseModel):
    id: str
    tipo_item: Literal["diamantes", "moedas"]
    pacote_id: str
    quantidade: int
    preco_kz: int
    estado: Literal["pendente", "aprovado", "rejeitado"]
    created_at: datetime
    decidido_em: datetime | None

    model_config = {"from_attributes": True}


class PedidoLojaAdmin(PedidoLojaPublico):
    utilizador_id: str | None
    comprovativo_url: str
    decidido_por: str | None


# --- Ajudas ------------------------------------------------------------------


class AjudaPerguntaRequest(BaseModel):
    pergunta_id: str


class NovaPerguntaRequest(BaseModel):
    # Só `true` gasta a ajuda "trocar pergunta"; sem corpo (ou `false`), o
    # pedido é idempotente e devolve a pergunta ainda por responder.
    trocar: bool = False


class CinquentaCinquentaResponse(BaseModel):
    opcoes_eliminadas: list[RespostaOpcao]


class OpiniaoPublicoResponse(BaseModel):
    percentagens: dict[RespostaOpcao, int]


# --- Mercado -----------------------------------------------------------------


class VendedorMercadoPublico(BaseModel):
    id: str
    custo_diamantes: int
    # Certeza para a pergunta em curso (categoria, patamar e a própria
    # pergunta -- `certeza_consultorio.py`). Sem explicação do porquê: o
    # jogador infere a especialidade pela profissão e pela percentagem.
    precisao: float
    # `None` = disponível agora; senão, até quando está bloqueado (UTC).
    disponivel_em: datetime | None


class MercadoPublico(BaseModel):
    # Hora do servidor -- o cliente usa-a para acertar o cronómetro do
    # bloqueio mesmo que o relógio do dispositivo esteja errado.
    agora: datetime
    # Categoria da pergunta em curso (`None` sem pergunta por responder).
    categoria: str | None = None
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


# --- Perfil: nível e estatísticas por categoria -----------------------------


class NivelJogadorPublico(BaseModel):
    numero: int
    id: Literal["iniciante", "aprendiz", "conhecedor", "especialista", "mestre_visao"]
    patamares_total: int
    minimo: int
    # `None` no último nível.
    proximo_minimo: int | None
    progresso: float


class EstatisticaCategoriaPublica(BaseModel):
    categoria: CategoriaPergunta
    respostas: int
    acertos: int
    taxa_acerto: float


class EstatisticasJogadorPublicas(BaseModel):
    perfil: PerfilJogadorPublico
    nivel: NivelJogadorPublico
    categorias: list[EstatisticaCategoriaPublica]


# `RecompensaSequenciaPublica` refere-se a `PerfilJogadorPublico`, definido mais abaixo.
RecompensaSequenciaPublica.model_rebuild()
ValidarRespostaResponse.model_rebuild()
