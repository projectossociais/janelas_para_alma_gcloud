"""Certeza dos profissionais do Consultório -- o modelo contextual.

A certeza de cada profissional para a pergunta em curso combina três coisas,
todas deterministas (reabrir o Consultório nunca "sorteia" outra certeza):

1. **Categoria** da pergunta (as 6 de `reserva_perguntas_jogo.CATEGORIAS`);
2. **Patamar** da partida (1-15), em três faixas: fundamentos (1-5),
   intermédio (6-10) e fim de jogo (11-15). As perguntas da reserva só
   conhecem o nível de dificuldade (1-3, cinco patamares cada); o patamar
   vem da partida;
3. **Variação** de -4 a +4 pontos percentuais, tirada de um hash do id do
   profissional + id da pergunta -- duas perguntas do mesmo patamar e
   categoria não dão exactamente a mesma percentagem redonda.

    certeza = base + ajuste_categoria + ajuste_faixa + variação
    depois: tetos do perfil (ex.: Dra. Helena em perguntas básicas de estilo
    de vida) e limites globais [CERTEZA_MINIMA, CERTEZA_MAXIMA]

Nunca 100%: `CERTEZA_MAXIMA` < 1 -- nenhum profissional é infalível. Nunca
abaixo de `CERTEZA_MINIMA`, que continua acima de adivinhar (25%).

Personalidades (decisão do dono do projecto, 2026-09-24) -- ver `PERFIS`:
- Estudante João: bom nos fundamentos. Bónus nos patamares 1-5 e em
  Anatomia; penalização severa nos patamares 11-15 e em Doenças.
- Enfermeira Marta: prática. Bónus constante em Prevenção e Cuidados; média/
  boa até ao patamar 10, cai no fim de jogo (11-15).
- Dr. Paulo (Optometrista): muito forte em Ciência Ocular e nos patamares
  intermédios/altos; ligeira penalização em Curiosidades (história, mitos).
- Dra. Helena (Oftalmologista): a especialista de topo -- o seu máximo está
  nos patamares 11-15 e em Doenças e Estrabismo; em perguntas muito básicas
  (patamares 1-3) de Estilo de Vida não passa de 80%: lida com casos
  clínicos complexos, não com o dia a dia.

Só apresentação e sorteio da sugestão dependem disto; custo e bloqueio vivem
em `mercado_jogo_service.py`.
"""

import hashlib
from collections.abc import Mapping
from dataclasses import dataclass, field

CERTEZA_MINIMA = 0.30
CERTEZA_MAXIMA = 0.98
# Amplitude da variação por pergunta, em pontos percentuais (inclusive).
VARIACAO_MAXIMA_PP = 4


def faixa_do_patamar(patamar: int) -> int:
    """0 = fundamentos (1-5), 1 = intermédio (6-10), 2 = fim de jogo (11-15)."""
    if patamar <= 5:
        return 0
    if patamar <= 10:
        return 1
    return 2


@dataclass(frozen=True)
class TetoCerteza:
    """Limite superior para uma combinação de categorias e patamares."""

    categorias: frozenset[str]
    patamar_min: int
    patamar_max: int
    teto: float

    def aplica(self, categoria: str, patamar: int) -> bool:
        return categoria in self.categorias and self.patamar_min <= patamar <= self.patamar_max


@dataclass(frozen=True)
class PerfilCerteza:
    # Certeza de referência: categoria neutra, patamar intermédio, sem variação.
    base: float
    # Ajustes (somados) por categoria -- ausente = 0.
    por_categoria: Mapping[str, float] = field(default_factory=dict)
    # Ajustes (somados) por faixa de patamar: (1-5, 6-10, 11-15).
    por_faixa: tuple[float, float, float] = (0.0, 0.0, 0.0)
    tetos: tuple[TetoCerteza, ...] = ()


PERFIS: Mapping[str, PerfilCerteza] = {
    "estudante-medicina": PerfilCerteza(
        base=0.50,
        por_categoria={
            "anatomia_ocular": 0.20,
            "curiosidades_visuais": 0.08,
            "ciencia_ocular": -0.05,
            "doencas_estrabismo": -0.15,
        },
        por_faixa=(0.12, 0.0, -0.18),
    ),
    "enfermeira-oftalmica": PerfilCerteza(
        base=0.70,
        por_categoria={
            "prevencao_cuidados": 0.15,
            "estilo_vida_visao": 0.06,
            "ciencia_ocular": -0.12,
        },
        por_faixa=(0.0, 0.0, -0.15),
    ),
    "optometrista": PerfilCerteza(
        base=0.82,
        por_categoria={
            "ciencia_ocular": 0.12,
            "anatomia_ocular": 0.04,
            "doencas_estrabismo": -0.03,
            "curiosidades_visuais": -0.08,
        },
        por_faixa=(-0.03, 0.03, 0.05),
    ),
    "oftalmologista": PerfilCerteza(
        base=0.88,
        por_categoria={
            "doencas_estrabismo": 0.07,
            "estilo_vida_visao": -0.05,
        },
        por_faixa=(-0.02, 0.0, 0.06),
        tetos=(TetoCerteza(frozenset({"estilo_vida_visao"}), 1, 3, 0.80),),
    ),
}


def variacao_deterministica(profissional_id: str, pergunta_id: str) -> float:
    """-0,04 a +0,04 (em passos de 0,01), fixa para o par profissional /
    pergunta: o mesmo hash em qualquer processo, máquina ou reinício (SHA-256,
    nunca o `hash()` do Python, que muda entre execuções)."""
    digest = hashlib.sha256(f"{profissional_id}:{pergunta_id}".encode()).digest()
    passos = 2 * VARIACAO_MAXIMA_PP + 1
    return (int.from_bytes(digest[:4], "big") % passos - VARIACAO_MAXIMA_PP) / 100


def certeza_sem_variacao(perfil: PerfilCerteza, categoria: str, patamar: int) -> float:
    """Base + categoria + faixa, sem a variação por pergunta nem limites --
    é o que as regras de personalidade descrevem."""
    return perfil.base + perfil.por_categoria.get(categoria, 0.0) + perfil.por_faixa[faixa_do_patamar(patamar)]


def calcular_certeza(
    profissional_id: str, categoria: str | None, patamar: int | None, pergunta_id: str | None
) -> float:
    """Probabilidade (0-1, duas casas) de a sugestão estar certa. Sem
    pergunta em curso (categoria/patamar/id desconhecidos), a certeza base."""
    perfil = PERFIS[profissional_id]
    if categoria is None or patamar is None or pergunta_id is None:
        return perfil.base
    valor = certeza_sem_variacao(perfil, categoria, patamar) + variacao_deterministica(profissional_id, pergunta_id)
    for teto in perfil.tetos:
        if teto.aplica(categoria, patamar):
            valor = min(valor, teto.teto)
    return round(min(CERTEZA_MAXIMA, max(CERTEZA_MINIMA, valor)), 2)
