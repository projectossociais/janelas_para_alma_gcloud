# Scanner — método de medição (W-13)

> Documento de referência viva. Actualizar sempre que o método de cálculo, os
> seus limites conhecidos, ou o estado da validação clínica (W-16) mudarem.
> Revisto a 2026-09-12 com investigação da literatura real — a versão
> anterior classificava-se a si própria como "proxy de Hirschberg" sem ter
> verificado se era, de facto, equivalente. Não era. Ver secção "O que mudou
> nesta revisão" no fim.

## O que existia antes deste documento

`Scanner.tsx` sorteava um diagnóstico (`Esotropia`/`Exotropia`/`Hipertropia`/
`Hipotropia`) e uma "confiança" com `Math.random()`. Corrigido em W-04
(remover o `Math.random()`) e substituído por este método — um sinal
geométrico real, calculado a partir de coordenadas reais, mas **ainda não
validado clinicamente**. Ver `CLAUDE.md` secção 11 e `docs/BACKLOG.md`,
Sprint 3, para o histórico da decisão.

## Porque não é Hirschberg verdadeiro

O teste de Hirschberg clássico usa uma luz pontual a uma distância conhecida
e observa onde o **reflexo dessa luz** cai na córnea de cada olho. É um
método bem calibrado: a conversão entre descentração do reflexo e ângulo de
desvio está publicada — a literatura reporta valores entre **~15 e ~22
dioptrias prismáticas por milímetro** de descentração, consoante o estudo e
a distância de calibração (Wikipedia cita 11 PD a 0,5mm ≈ 22 PD/mm; outros
estudos fotográficos calibrados relatam ~15 a ~21 PD/mm —
[Wikipedia, "Hirschberg test"][hirschberg-wiki];
[Kothari et al., cálculo do factor de conversão fotográfico][jmat-hirschberg];
[estudo de fiabilidade Photo-Hirschberg vs. Krimsky, PMC8635364][pmc-fiabilidade]).

**Não temos uma fonte de luz controlada.** A webcam do `Scanner.tsx` capta
luz ambiente, não um ponto calibrado a uma distância conhecida — por isso
este scanner **não pode** medir um ângulo de desvio real nem convertê-lo em
dioptrias prismáticas. Confirmado directamente nos protótipos publicados que
tentam evitar essa dependência: sistemas como o *EyeTurn* ou os classificadores
por CNN mais precisos (86–93% de exactidão) continuam a exigir um **flash ou
alvo de fixação brilhante** para produzir um reflexo corneano fiável
([smartphone ocular alignment app][smartphone-app]; [deep learning com
reflexo corneano, Scientific Reports][strabnet-reflexo]).

## O método adoptado: razão canto-íris (Huang et al., 2021)

Sem reflexo, a literatura tem uma alternativa publicada e validada
estatisticamente que **não precisa de luz controlada** — usa só landmarks
faciais de uma fotografia frontal comum:

> Huang X., Lee S.J., Kim C.Z., Choi S.H. (2021). *"An automatic screening
> method for strabismus detection based on image processing."* PLOS ONE
> 16(8): e0255643. [DOI: 10.1371/journal.pone.0255643][plos-huang]

**O método**, adaptado aqui aos landmarks do MediaPipe FaceMesh (em vez dos
68 pontos Dlib/iBUG do artigo original):

1. Na pose **"center"** (a única das 3 poses guiadas em que se pode assumir
   que os dois olhos fixam o mesmo ponto — nas poses "right"/"left" os dois
   olhos movem-se juntos em versão, o que não isola um desvio de
   alinhamento), calcula-se, **por olho**, a razão entre a distância da íris
   ao canto medial (nasal) e ao canto lateral (temporal):
   `ratio = distância(íris, canto medial) / distância(íris, canto lateral)`.
2. Compara-se os dois olhos. O artigo original usa
   `S = max(ratio_1, ratio_2) / min(ratio_1, ratio_2)` (sem sinal — descarta
   qual dos dois olhos está desviado). Aqui usa-se a **diferença**
   `ratio_2 − ratio_1`, para preservar a direcção; o `S` do artigo fica
   guardado em `medicoes.estatistica_s_huang2021` para quem quiser comparar
   directamente com os valores publicados.
3. Os autores reportam, no seu conjunto de 60 imagens (30 normais, 30
   estrábicas): **olhos normais `S = 1.073 ± 0.039`**, **olhos estrábicos
   `S = 1.924 ± 0.472`** (p < 10⁻¹¹). Não são os *nossos* dados — servem só
   de referência de ordem de grandeza, nunca como limiar de decisão aqui.

Implementado em `api/app/services/screening_service.py`
(`_ratio_medial_lateral`, `calcular_screening`), puro e testado
(`api/tests/services/test_screening_service.py`) — qualquer combinação de
landmarks dá sempre o mesmo resultado determinístico, nunca um valor
aleatório.

### Índices de landmark usados (verificados, não assumidos)

Confirmado por fonte externa, não copiado sem verificar: no MediaPipe
FaceMesh (com `refineLandmarks`), o landmark **33** é o canto lateral e o
**133** o canto medial de um olho; o **263** é o canto lateral e o **362** o
canto medial do outro. A primeira versão deste serviço tinha estes dois
trocados num dos olhos — inofensivo enquanto o cálculo só usava `min`/`max`
(não distinguia qual era qual), mas teria produzido um sinal com a direcção
errada agora que a distinção medial/lateral importa. Corrigido nesta
revisão.

**Lateralidade anatómica (esquerdo/direito da pessoa) continua por
verificar** — depende de a captura estar ou não espelhada, o que não foi
confirmado. Por isso os resultados nunca são rotulados "olho esquerdo"/
"olho direito", só "olho 1"/"olho 2".

## Porque não se usa a pálpebra (versão anterior, abandonada)

A primeira versão deste serviço calculava a posição da íris dentro do
rectângulo pálpebra-superior/pálpebra-inferior/canto-medial/canto-lateral —
não o método de Huang et al., uma construção própria não verificada contra
literatura nenhuma. Abandonada por colidir directamente com um viés clínico
real e bem documentado:

> **Pseudoestrabismo por prega epicântica**: a aparência de olhos desviados
> pode vir inteiramente da pálpebra (menos esclera visível do lado nasal
> devido a uma prega epicântica proeminente ou ponte nasal larga), sem
> qualquer desalinhamento ocular real. Clinicamente distingue-se porque, no
> pseudoestrabismo, **o reflexo corneano permanece centrado nos dois olhos**
> ([EyeWiki, "Pseudostrabismus"][eyewiki-pseudo]; [Moran CORE,
> "Pseudoesotropia"][morancore-pseudo]).

Sem reflexo corneano, não há como aplicar esse critério de distinção aqui.
Mas medir a partir dos **cantos** (pontos ósseos/de tecido relativamente
estáveis) em vez da **pálpebra** (móvel, afectada por piscadela, ptose,
cansaço) pelo menos não persegue directamente o mesmo artefacto — a pálpebra
é precisamente o que muda com a prega epicântica. Isto **não resolve** o
confundimento, só o reduz.

## Eixo vertical — extensão própria, sem equivalente publicado

Toda a pesquisa feita (Hirschberg fotográfico, EyeTurn, RT-DETR + classificadores,
CNN com reflexo, o método de Huang et al.) tem como alvo **estrabismo
horizontal** (esotropia/exotropia). Não foi encontrado nenhum método
publicado, sem reflexo, para desvios verticais (hipertropia/hipotropia) a
partir só de landmarks.

Construído aqui por analogia, **sem validação nem precedente publicado**:
distância perpendicular de cada íris à recta que liga os dois cantos
laterais (referência estável, não a pálpebra), normalizada pela distância
entre esses dois cantos. A diferença entre os dois olhos é o sinal
reportado. **Tratar com mais cepticismo do que o eixo horizontal** — este
não tem sequer um artigo a apoiá-lo, por fraco que seja.

## Qualidade da captura: inclinação (roll) E desvio de eixo (yaw)

A documentação da própria Google/MediaPipe é explícita sobre esta
limitação: a posição da íris "não é gaze verdadeira" e "o movimento da
cabeça e vistas fora do eixo degradam a precisão sem normalização da pose
da cabeça" ([MediaPipe Iris, Google Research][mediapipe-iris];
[documentação oficial do modelo Iris][mediapipe-iris-docs]).

Sem um modelo 3D calibrado (o que exigiria a imagem, não só os landmarks —
e a imagem é precisamente o que não guardamos, CLAUDE.md §4) não há como
**corrigir** isto. O que se faz é **detectar e penalizar**:

- **Inclinação (roll)**: ângulo entre os dois cantos laterais. Acima de
  `LIMITE_INCLINACAO_GRAUS` (8°, heurística, não derivada de um estudo),
  desce `qualidade_captura` em 0.3 e regista o motivo.
- **Desvio de eixo (yaw)**: diferença de profundidade (`z` do MediaPipe)
  entre os dois cantos laterais, normalizada pela distância entre eles.
  Acima de `LIMITE_DESVIO_YAW` (0.15, heurística) desce `qualidade_captura`
  em 0.4 — penalização maior do que a inclinação, porque é a limitação que a
  própria MediaPipe identifica como a mais directamente relevante para a
  posição horizontal da íris (exactamente o que o eixo principal deste
  método mede). `z` é opcional; sem ele, não se penaliza por não se saber.
- **Ambiente escuro** durante a captura e **poses guiadas em falta**
  (right/left não capturadas): penalizações já existentes, mantidas.

Em nenhum caso o número calculado é escondido — só a confiança técnica
(`qualidade_fiavel`, `qualidade_motivos`) é que reflecte estes problemas.

## Consequência directa: `requer_avaliacao_humana` é sempre `True`

Enquanto o W-16 não acontecer, **nenhum limiar decide "normal" vs "desvio"**
a partir deste número — nem sequer o `S ≈ 1.9` que Huang et al. reportam
como típico de estrabismo no *seu* conjunto de dados, porque nunca foi
verificado contra a nossa população, o nosso hardware, nem a nossa distância
de captura. A API nunca gera essa classificação, e o frontend nunca a
apresenta. O que se mostra ao utilizador é sempre "sinal registado, sujeito
a confirmação clínica", nunca um diagnóstico nem uma percentagem de
confiança. Ver `frontend/src/pages/ScannerResultados.tsx`.

## Próximo passo real: W-16, validação clínica

Nada neste documento substitui a necessidade de validar `assimetria_*`
contra casos reais com diagnóstico conhecido, com um parceiro clínico —
mesmo o método de Huang et al., publicado e revisto por pares, foi validado
só em 60 imagens de um hospital sul-coreano; não há garantia nenhuma de que
a mesma separação estatística apareça com MediaPipe em vez de Dlib, com uma
webcam em vez de uma câmara de estúdio, ou com a nossa população-alvo. Até
lá, este método existe para dar um **sinal técnico honesto** — nunca um
diagnóstico — e para que a infraestrutura (endpoint, esquema `screenings`,
página de resultados) já exista quando essa validação acontecer.

## O que mudou nesta revisão (2026-09-12)

A primeira versão deste documento e do `screening_service.py` foi escrita
sem verificar a literatura — chamava-se a si própria "proxy de Hirschberg"
por semelhança superficial, e usava pálpebra superior/inferior para o eixo
vertical sem notar a colisão com pseudoestrabismo. Corrigido depois de
pesquisa real:

- Eixo horizontal passou a implementar o método publicado de Huang et al.
  (2021) — razão canto-íris — em vez de uma métrica inventada.
- Corrigido um bug de rotulagem medial/lateral herdado sem verificação de
  `frontend/src/hooks/useEyeTracking.ts` (inofensivo no cálculo antigo,
  teria invertido a direcção no novo).
- Eixo vertical deixou de usar a pálpebra (vulnerável a pseudoestrabismo);
  passou a usar a linha inter-cantal como referência — ainda sem
  equivalente publicado, agora dito explicitamente.
- Qualidade da captura ganhou detecção de desvio de eixo (yaw), não só
  inclinação (roll), respondendo directamente à limitação documentada pela
  própria MediaPipe.
- `VERSAO_ANALISE` subiu para `geometria-canto-iris-huang2021-v2-experimental`
  — distinguível de qualquer registo (nenhum existe em produção) da versão
  anterior.

[hirschberg-wiki]: https://en.wikipedia.org/wiki/Hirschberg_test
[jmat-hirschberg]: http://www.jmatonline.com/PDF/1193-1198-PB-98-12.pdf
[pmc-fiabilidade]: https://www.ncbi.nlm.nih.gov/pmc/articles/PMC8635364/
[smartphone-app]: https://link.springer.com/article/10.1186/s12886-021-01902-w
[strabnet-reflexo]: https://www.nature.com/articles/s41598-025-88154-6
[plos-huang]: https://journals.plos.org/plosone/article?id=10.1371%2Fjournal.pone.0255643
[eyewiki-pseudo]: https://eyewiki.org/Pseudostrabismus
[morancore-pseudo]: https://morancore.utah.edu/section-06-pediatric-ophthalmology-and-strabismus/pseudoesotropia/
[mediapipe-iris]: https://research.google/blog/mediapipe-iris-real-time-iris-tracking-depth-estimation/
[mediapipe-iris-docs]: https://github.com/google/mediapipe/blob/master/docs/solutions/iris.md
