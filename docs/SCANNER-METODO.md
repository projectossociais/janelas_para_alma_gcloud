# Scanner — método de medição (W-13)

> Documento de referência viva. Actualizar sempre que o método de cálculo, os
> seus limites conhecidos, ou o estado da validação clínica (W-16) mudarem.

## O que existia antes deste documento

`Scanner.tsx` sorteava um diagnóstico (`Esotropia`/`Exotropia`/`Hipertropia`/
`Hipotropia`) e uma "confiança" com `Math.random()`. Corrigido em W-04
(remover o `Math.random()`) e agora substituído por este método — um sinal
geométrico real, calculado a partir de coordenadas reais, mas **ainda não
validado clinicamente**. Ver `CLAUDE.md` secção 11 e `docs/BACKLOG.md`,
Sprint 3, para o histórico da decisão.

## O método: posição da íris na abertura ocular ("proxy de Hirschberg")

O teste de Hirschberg clássico usa uma luz pontual a uma distância
conhecida e observa **onde o reflexo dessa luz cai na córnea** de cada olho —
se cai no mesmo ponto relativo em ambos os olhos, estão alinhados; um
desvio desse ponto (~1mm ≈ 22 dioptrias prismáticas, regra empírica) indica
um desvio ocular.

**Não temos uma fonte de luz controlada** (a webcam capta luz ambiente, não
um ponto calibrado), por isso este scanner **não faz** um Hirschberg real.
Em vez disso, aproxima a mesma ideia de outra forma, através dos landmarks
já extraídos pelo MediaPipe FaceMesh (`refineLandmarks: true`, índices de
íris 468/473):

1. Na pose **"center"** (a pessoa a olhar directamente para a câmara — a
   única das 3 poses guiadas em que se pode assumir que os dois olhos
   fixam o mesmo ponto; nas poses "right"/"left" os dois olhos movem-se
   juntos em versão, o que não serve para detectar um desvio de
   alinhamento), calcula-se, para cada olho, **onde a íris está dentro do
   rectângulo definido pelos 4 cantos do próprio olho** (canto externo,
   canto interno, pálpebra superior, pálpebra inferior) — um valor 0 a 1
   em cada eixo, ~0.5 quando a íris está centrada na abertura.
2. A **diferença entre os dois olhos** nesse valor (`assimetria_horizontal`,
   `assimetria_vertical`) é o sinal reportado. Perto de 0 → os dois olhos
   parecem estar a olhar para o mesmo sítio relativo às suas próprias
   aberturas. Longe de 0 → um olho parece desviado em relação ao outro.

Implementado em `api/app/services/screening_service.py`
(`calcular_screening`), puro e testado (`api/tests/services/
test_screening_service.py`) — qualquer combinação de landmarks dá sempre o
mesmo resultado determinístico, nunca um valor aleatório.

## Limites conhecidos — porque isto NÃO é um diagnóstico

- **Sem calibração de distância/ângulo à câmara.** O ângulo de desvio real
  (em graus ou dioptrias prismáticas) depende de quão longe a pessoa está
  do ecrã — informação que não temos. O número reportado é uma **razão
  geométrica adimensional**, não um ângulo calibrado.
- **Um único frame por pose.** Uma piscadela, desfoque de movimento, ou uma
  perda momentânea de tracking no instante exacto da captura degrada o
  resultado sem que haja como o detectar a partir de um único frame (ver
  W-14, abaixo, sobre porque isto é uma limitação a resolver, não um "modo
  de falha aceitável").
- **Ambiguidade de mão (handedness).** Os índices de landmark "OLHO_A"/
  "OLHO_B" não foram verificados contra uma convenção anatómica
  esquerda/direita explícita — o sinal (positivo/negativo) da assimetria
  não deve ser lido como "o olho esquerdo" ou "o olho direito" sem essa
  verificação adicional.
- **Nenhum limiar validado.** Não sabemos, hoje, que valor de
  `assimetria_horizontal`/`assimetria_vertical` corresponde a "dentro do
  normal" versus "sinal de desvio". Isso só se estabelece comparando este
  número contra casos reais com diagnóstico oftalmológico confirmado — é
  exactamente o **W-16** do `docs/BACKLOG.md`, bloqueado por precisar de um
  parceiro clínico.

## Consequência directa: `requer_avaliacao_humana` é sempre `True`

Enquanto o W-16 não acontecer, **nenhum limiar decide "normal" vs "desvio"**
a partir deste número — a API nunca gera essa classificação, e o frontend
nunca a apresenta. O que se mostra ao utilizador é sempre "sinal registado,
sujeito a confirmação clínica", nunca um diagnóstico nem uma percentagem de
confiança. Ver `frontend/src/pages/ScannerResultados.tsx`.

## W-14 — calibração/condições de captura (implementado em parte)

`Scanner.tsx` já impunha uma condição de captura antes deste trabalho
(iluminação mínima, via `checkVideoQuality`). Este método acrescenta:

- **Inclinação da cabeça** (`_inclinacao_graus` em `screening_service.py`):
  calculada a partir do ângulo entre os cantos externos dos dois olhos.
  Acima de `LIMITE_INCLINACAO_GRAUS` (8°), o resultado ainda é calculado
  (nunca se esconde o número), mas a `qualidade_captura` desce e o motivo
  fica registado em `qualidade_motivos` — para o resultado poder dizer
  honestamente "baixa confiança técnica" em vez de apresentar um número
  duvidoso como se fosse fiável.
- **Ambiente escuro durante a captura** e **poses guiadas em falta**
  (right/left não capturadas) — mesma lógica: reduz `qualidade_captura`,
  nunca esconde o número, nunca finge uma qualidade que não existe.

**Ainda por fazer** (não bloqueia o que já está construído, mas é a
diferença entre "sinal técnico" e "medição repetível"): impedir a captura
em si quando a inclinação já é excessiva (hoje só é penalizada depois de
capturada), e capturar múltiplos frames por pose para reduzir o efeito de
uma piscadela isolada.

## Próximo passo real: W-16, validação clínica

Nada neste documento substitui a necessidade de validar `assimetria_*`
contra casos reais com diagnóstico conhecido, com um parceiro clínico. Até
lá, este método existe para dar um **sinal técnico honesto** — nunca um
diagnóstico — e para que a infraestrutura (endpoint, esquema `screenings`,
página de resultados) já exista quando essa validação acontecer.
