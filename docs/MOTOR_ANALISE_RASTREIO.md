# Motor de análise do rastreio — investigação e desenho

> **Estado:** investigação concluída; **fase V0 concluída** (2026-10-01: algoritmo e
> testes com imagens sintéticas, §8); ainda sem captura nem ligação ao produto. Pedido do dono do projecto: substituir o serviço externo
> `janelas-scanner-api` por um motor próprio, "sério e sólido", assente em investigação
> científica, simples no funcionamento e com validação rigorosa. As fases seguintes do
> redesenho do frontend ficam em pausa enquanto isto avança.
>
> **Regra deste documento:** nenhum número entra aqui sem ter sido lido na fonte. Durante a
> investigação, um resumo automático de um artigo inventou uma sensibilidade de 94% e uma
> especificidade de 92%; o texto original dizia 83,3% e 76,5%. Só a leitura do PDF apanhou o
> erro. Números marcados com "(a confirmar)" vêm de um resumo e ainda não foram lidos no
> artigo original.

---

## 1. Resumo (para decidir)

1. **Método:** teste de Hirschberg fotográfico, binocular, com o olhar em frente. Mede-se,
   em cada olho, onde o reflexo de uma luz pontual cai na córnea em relação ao centro da
   íris. Olhos alinhados têm reflexos simétricos; a diferença entre os dois olhos,
   multiplicada por ~21 Δ/mm, é o desvio. É o método com mais evidência para telemóvel, é
   explicável a um médico, e não precisa de dados de treino.
2. **O fluxo actual não o consegue fazer**, com qualquer algoritmo: a câmara frontal não
   tem luz pontual, e o vídeo a 1280 px põe um desvio de 8 Δ em menos de 1 píxel (§4).
3. **Captura proposta:** câmara traseira com a luz do telemóvel acesa, **outra pessoa** a
   segurar o telemóvel a 30–40 cm (pai, voluntário, professor), a criança a olhar para a
   luz, 3 a 5 fotografias em resolução total. É a configuração que foi validada na
   literatura.
4. **As fotografias nunca saem do telemóvel.** A análise corre no browser; a API recebe só
   as medições. Hoje as três fotografias vão para um servidor externo.
5. **A regra de decisão** (a partir de quantos Δ se encaminha) vive num service da API, com
   versão e testes, como o CLAUDE.md §3 exige para resultados clínicos.
6. **Validação em quatro fases** (§8), cada uma com critério de passagem escrito antes de
   começar. A última é um estudo clínico com um oftalmologista, que só a clínica parceira
   torna possível.
7. **Honestidade sobre o que se pode esperar:** os melhores aparelhos e apps publicados
   falham entre 1 em cada 6 e 1 em cada 2 crianças com estrabismo em rastreio real (§2).
   Um rastreio complementa a consulta, nunca a substitui.

---

## 2. O que a evidência diz

| Fonte | O que mostra | Números (lidos na fonte) |
|---|---|---|
| Cheng et al., 2021, BMC Ophthalmology — EyeTurn em rastreio escolar | Enfermeira escolar, iPhone 7, flash, ~40 cm, 133 crianças; verificação presencial com PACT por oftalmologista | Pelo menos uma medição válida em **93%** (125/133). Limiar óptimo pela curva ROC **3,0 Δ**: sensibilidade **83,3%**, especificidade **76,5%**. Correlação com o PACT **R² = 0,74**. Falhou um caso de **esotropia acomodativa de 14 Δ**: o alvo de fixação (o flash) não pedia acomodação. Só 6 crianças com estrabismo na amostra |
| Mesmo artigo, comparação com outros aparelhos | Desempenho para estrabismo de fotorastreadores comerciais | Spot Vision Screener **50% / 96%** (operadores leigos) e **77% / 93%** (consultório, sem intermitentes); GoCheck Kids (método de Brückner) **74,6% / 67,2%**; Plusoptix **40,7% / 98,3%** (sensibilidade / especificidade) |
| Hull et al., 2017, revisão Cochrane (testes de estrabismo na comunidade, 1–6 anos) | Só um estudo cumpriu os critérios de qualidade | Fotorastreador: sensibilidade **0,46** (IC 95% 0,19–0,75), especificidade **0,97** (0,94–0,99), 271 crianças |
| Pundlik et al., 2019, TVST — EyeTurn, desenvolvimento | Hirschberg fotográfico automático; mede o factor de Hirschberg e o ângulo kappa de cada pessoa com fixação em pontos de excentricidade conhecida (declive = factor, ordenada na origem = kappa) | Resolução teórica **1,3 Δ** com factor de ~22 Δ/mm |
| EyeTurn Cloud, 2025, JMIR Formative Research | Versão com modelos de IA para localizar a íris; câmara traseira, ~40 cm, 79 pessoas dos 4 aos 42 anos | R² = 0,95; limites de concordância de Bland–Altman −20,2 a 14,6 Δ; repetibilidade ±2,99 Δ; **10,1%** de falhas de processamento; direcção do desvio pouco fiável abaixo de 10 Δ (a confirmar) |
| Brodie, 1987; Hasebe | Calibração fotográfica do teste de Hirschberg | **~21 Δ por mm** de deslocação do reflexo (Hasebe: 19,9 Δ/mm). O valor clássico de 15 Δ/mm subestima |
| AAPOS 2021, directrizes para validar instrumentos de rastreio | O que um instrumento deve detectar e como relatar | Qualquer estrabismo manifesto **> 8 Δ**. Recomenda curvas ROC e análise de Bland–Altman para os estudos serem comparáveis |
| Estudo de IA com fotografias de telemóvel, 2025 (Tailândia) | Exemplo típico dos estudos de IA com números altos | 150 pessoas, um hospital, mediana de idade 19,6 anos, desvios medianos de **25 a 35 Δ**, só validação interna: 95% de acerto. Não diz nada sobre crianças com desvios pequenos |
| MediaPipe Iris (Google) | Base da localização da íris que já usamos | Diâmetro horizontal da íris **11,7 ± 0,5 mm** na população, usado para converter píxeis em milímetros |

**O que isto quer dizer para nós:**
- O método de Hirschberg fotográfico funciona, **quando** há luz pontual, resolução total e
  um operador a segurar o telemóvel.
- Os números altos dos estudos de IA vêm de hospitais e de desvios grandes (viés de
  espectro). Não se transferem para rastreio de crianças.
- Mesmo os aparelhos comerciais falham muitos casos em comunidade. O objectivo realista é
  igualar ou superar a EyeTurn em condições reais, e ser honesto nos números.
- Não há estudos em crianças angolanas nem, que tenhamos encontrado, em populações da
  África subsariana. A validação local não é opcional.

---

## 3. Método escolhido e alternativas rejeitadas

**Escolhido: Hirschberg fotográfico binocular, olhar em frente.**
- Mede uma coisa física e explicável: onde cai o reflexo em cada olho.
- A diferença entre os dois olhos anula o ângulo kappa (o reflexo normal fica ~0,5 mm para o
  lado do nariz nos dois olhos), desde que seja igual nos dois.
- **Correcção (2026-10-01), ao derivar a geometria para o código:** uma versão anterior
  deste documento dizia que a diferença também anulava uma fixação ao lado da luz. **Não
  anula, duplica-a.** Se a criança olhar θ ao lado da luz, a descentração de um olho
  diminui θ/FH e a do outro aumenta θ/FH: a diferença ganha 2θ. (A soma das duas anula θ,
  mas precisa do kappa de cada pessoa, que varia muito, por isso não serve.) Consequência
  prática: a criança tem de fixar um alvo **junto** à luz; tiram-se várias fotografias e
  a dispersão entre elas é um portão de qualidade. Os testes documentam esta limitação.
- Não precisa de dados de treino, que não temos.

**Rejeitado por agora:**

| Alternativa | Porque não, por agora |
|---|---|
| IA a classificar fotografias do rosto | Sem dados locais para treinar; evidência com viés de espectro; decisão não explicável a um médico; risco de funcionar pior em peles e íris escuras, que os conjuntos de dados públicos raramente têm |
| Vídeo da câmara frontal (o fluxo actual) | Sem luz pontual e sem resolução (§4) |
| Três posições do olhar (frente, direita, esquerda) | Não há evidência de que ajudem no rastreio; aumentam o tempo e a falha de captura em crianças. Fica só a frente |
| Teste de Brückner (reflexo vermelho) | Detecta outros factores de risco (diferença de graduação, opacidades), mas não mede o desvio. Pode vir numa segunda fase, com a mesma fotografia |
| Serviço no servidor | As fotografias de crianças teriam de sair do telemóvel. O cálculo é leve e corre no browser |

---

## 4. Física e orçamento de erro

Um desvio de **8 Δ** desloca o reflexo **0,38 mm** (8 ÷ 21). Quantos píxeis isso dá depende
da câmara e da distância. Com um erro de ~0,25 px na posição do reflexo e ~0,25 px no centro
da íris, em cada olho:

| Configuração | 8 Δ em píxeis | Íris em píxeis | Ruído estimado |
|---|---|---|---|
| Fotografia da câmara traseira (4000 px, campo de 69°), 35 cm | **3,2 px** | 97 px | **≈ 1,3 Δ** |
| Fotografia da câmara traseira, 40 cm | 2,8 px | 85 px | ≈ 1,4 Δ |
| Vídeo da câmara traseira (1920 px), 35 cm | 1,5 px | 47 px | ≈ 2,6 Δ |
| **Vídeo da câmara frontal (1280 px), 35 cm — fluxo actual** | **0,9 px** | 28 px | **≈ 4,4 Δ** |
| Vídeo da câmara frontal, à distância de um braço (50 cm) | 0,6 px | 20 px | ≈ 6,3 Δ |

A estimativa para a fotografia em resolução total (≈ 1,3 Δ) coincide com a resolução
teórica publicada para a EyeTurn (1,3 Δ). O ruído real será maior (fixação, pestanejo,
variação individual do factor de Hirschberg): por isso se tiram várias fotografias e se
mede a repetibilidade (§8, fase V2).

**Outras fontes de erro, e como se tratam:**
- **Factor de Hirschberg individual:** varia entre pessoas (19,9 a 22 Δ/mm nos estudos).
  Usa-se 21 Δ/mm; o erro é proporcional ao desvio, por isso pesa pouco perto do limiar.
- **Escala mm/píxel:** pelo diâmetro da íris (11,7 ± 0,5 mm, ~4% de erro), não pela
  distância.
- **Kappa assimétrico entre os dois olhos:** não se anula; entra como ruído. É uma das
  causas de falsos positivos descritas na EyeTurn.
- **Acomodação:** a criança tem de olhar para um alvo com detalhe (um desenho pequeno junto
  à lente), não só para a luz, senão as esotropias acomodativas escondem-se.

---

## 5. Protocolo de captura (o que a família ou o voluntário faz)

1. Sala com luz normal; a criança **sem óculos**, sentada.
2. **Outra pessoa** segura o telemóvel, com a **câmara traseira** virada para a criança, a
   30–40 cm, à altura dos olhos. O ecrã mostra-lhe dois quadrados para enquadrar os olhos.
3. A **luz do telemóvel acende**; a criança olha para um autocolante ou desenho pequeno
   colado junto à lente (fornecido pelo projecto, ou impresso).
4. O telemóvel tira **3 a 5 fotografias em resolução total** em ~2 segundos e analisa-as
   logo. Se a qualidade não chegar (pestanejo, reflexo não encontrado), pede para repetir.
5. Nada é enviado antes de o resultado estar calculado; só as medições saem do telemóvel.

**Compatibilidade — dois caminhos de captura, os dois analisados no telemóvel:**

| Caminho | Como | Onde funciona | Ganha / perde |
|---|---|---|---|
| **A · Câmara dentro da página** | `getUserMedia` com a câmara traseira, luz contínua (`torch`) e fotografia em resolução total (`ImageCapture.takePhoto`) | Chrome e Samsung Internet em Android | Enquadramento guiado ao vivo e várias fotografias seguidas; não funciona no iPhone |
| **B · Câmara nativa do telemóvel** | `<input type="file" accept="image/*" capture="environment">`: abre a aplicação da câmara, com flash e resolução total, e devolve a fotografia à página | **Qualquer iPhone e qualquer Android** | Funciona em todo o lado; sem enquadramento ao vivo, uma fotografia de cada vez, a pessoa tem de ligar o flash |

**Porque o iPhone não tem o caminho A** (pergunta do dono do projecto, 2026-09-30): no
iPhone, **todos os browsers, incluindo o Chrome, são obrigados pela Apple a usar o motor do
Safari (WebKit)** (regra 2.5.6 das directrizes da App Store; só a UE e o Japão têm
excepções). O Chrome no iPhone tem as limitações do Safari: sem `ImageCapture`. A luz
contínua (`torch`) passou a funcionar no WebKit a partir do iOS 17.5.1 (WebKit, bug
243075), mas há relatos de que o vídeo da câmara no Safari fica em 1280×720, o que não
chega (§4). Esses relatos são antigos: **medir num iPhone real na fase V2** antes de
decidir se o caminho A também serve no iPhone.

**Dois modos de rastreio** (decisão do dono do projecto, 2026-09-30):
- **Rastreio completo** (modo principal): outra pessoa fotografa, câmara traseira, com luz.
  É o único que dá um resultado.
- **Pré-rastreio com a câmara frontal** (a própria pessoa): **nunca dá um número nem um
  "sem sinais"**, porque não tem base científica nem resolução (§4). Serve para
  apresentar o rastreio e levar ao modo completo; dar um "está tudo bem" sem medir seria
  pior do que não dizer nada.

---

## 6. Algoritmo (cada passo é uma função pura, testada à parte)

1. **Localizar os olhos:** o FaceMesh (MediaPipe, já no projecto) dá a íris aproximada em
   cada olho. Serve só para recortar a região; a medida faz-se na fotografia em resolução
   total.
2. **Reflexo da córnea:** dentro da íris, a mancha mais brilhante e compacta; centro por
   média ponderada da intensidade (precisão abaixo do píxel). Rejeita-se se houver várias
   manchas comparáveis (óculos, janelas) ou se estiver saturada em área grande.
3. **Contorno da íris (limbo):** pontos de transição íris/esclera ao longo de raios a partir
   do centro aproximado; ajuste robusto de uma elipse (ignora pontos das pálpebras). O
   centro da elipse é o centro da íris. Com íris escuras o contraste com a esclera é alto,
   o que favorece este passo; a pupila não é usada (em íris escuras quase não se distingue).
4. **Escala:** milímetros por píxel = 11,7 ÷ diâmetro horizontal da elipse.
5. **Posição do reflexo em cada olho:** (reflexo − centro) em milímetros, com o sinal
   "para o nariz" positivo nos dois olhos.
6. **Desvio binocular:** horizontal = |diferença entre os dois olhos| × 21 Δ/mm; vertical da
   mesma forma. A direcção (para dentro ou para fora) só se indica acima de 10 Δ, onde a
   literatura diz que é fiável.
7. **Várias fotografias:** mediana das válidas; se a dispersão for grande (critério a
   fixar em V2), a sessão é "não conseguimos medir bem" e pede-se repetição.
8. **Portões de qualidade**, antes de qualquer número: olho fechado, reflexo ausente ou fora
   da íris, íris pequena demais (longe demais), cabeça inclinada, reflexos múltiplos.

A saída é sempre um de três resultados — **encaminhar**, **sem sinais**, **não conseguimos
medir** — com as medições que o justificam. É o mesmo contrato do ecrã de resultados já
redesenhado.

---

## 7. Arquitectura

- **No telemóvel (browser):** captura, os passos 1 a 8 num Web Worker, em TypeScript puro
  (`frontend/src/lib/rastreio/analise/`), sem enviar imagens.
- **Na API:** `POST /screenings` recebe as medições (posição do reflexo e da íris em cada
  olho, escala, número de fotografias válidas, dispersão, portões falhados). Um
  **`ClassificacaoRastreioService`**, com versão e testes, decide o resultado a partir das
  medições (o limiar vive só aqui). Grava-se a versão do motor e da regra em cada rastreio.
- **O `janelas-scanner-api` sai** quando o motor próprio passar a fase V2; até lá, os dois
  podem correr em paralelo para comparar, só em teste.
- Sem tabelas novas previsíveis: `screenings` já tem `medicoes` (JSON) e `versao_analise`.

---

## 8. Validação: quatro fases, critérios escritos antes

| Fase | O que se faz | Passa quando | Quem |
|---|---|---|---|
| **V0 · Sintético** | Imagens geradas com reflexo e íris em posições conhecidas, com ruído, desfoque, pálpebras, íris escuras | Recupera a posição do reflexo com erro < 0,05 mm em 95% dos casos; todos os portões de qualidade disparam quando devem | Nós, em testes automáticos |
| **V1 · Bancada com adultos** | Adultos da equipa, sem estrabismo, fixam alvos a ângulos conhecidos (ex.: 0°, 5°, 10°, 15° para cada lado); o declive dá o factor de Hirschberg, como no estudo de Pundlik | Factor medido entre 19 e 23 Δ/mm; linearidade R² ≥ 0,95; pessoas sem estrabismo medem < 3 Δ | Nós, com 5 a 10 voluntários |
| **V2 · Repetibilidade e robustez** | Mesma pessoa, várias sessões, 3+ telemóveis Android, luz diferente, operadores diferentes (incluindo pais) | Desvio-padrão entre sessões ≤ 2 Δ; ≥ 90% das sessões medem à primeira ou à segunda | Nós e voluntários do Kamba |
| **V3 · Estudo clínico** | Crianças dos 3 aos 12 anos na clínica parceira; o motor por um voluntário; PACT por oftalmologista **sem conhecer** o resultado do motor; incluir desvios pequenos e intermitentes | Sensibilidade e especificidade para > 8 Δ com IC 95%, curva ROC, Bland–Altman, taxa de "não mediu", relatados segundo STARD. Metas propostas: sensibilidade ≥ 80%, especificidade ≥ 85% (a decidir com o oftalmologista) | Clínica parceira + nós |

### Resultado da fase V0 (2026-10-01)

Código em `frontend/src/lib/rastreio/analise/` (TypeScript puro, sem dependências novas),
32 testes. Imagens sintéticas com íris do castanho muito escuro ao mais claro (tom 25–90),
pálpebra a tapar até 35% da íris, desfoque óptico, reflexo saturado, ruído do sensor, íris
de 80 a 116 px e o detector de rosto a errar até 15% no centro e no raio:

| Medida | Critério (escrito antes) | Resultado (400 olhos) |
|---|---|---|
| Erro da posição do reflexo em relação ao centro da íris | < 0,05 mm em 95% | **mediana 0,015 mm; p95 0,033 mm** (≈ 0,3 e 0,7 Δ por olho); máximo 0,055 mm |
| Olhos bons recusados | ≤ 5% | **0 em 400** |
| Pares de olhos com desvios conhecidos de 0 a 30 Δ | erro < 1,5 Δ em 95% | passa (30 pares) |
| Portões de qualidade | disparam quando devem | sem reflexo, reflexos múltiplos (óculos), luz difusa (ecrã), olho fechado, íris pequena, reflexo no bordo, íris de tamanhos diferentes, fotografias discordantes: todos testados |

**Os testes apanharam três falhas reais antes de chegarem a produção:** uma luz difusa a
passar por reflexo pontual (o fundo era medido pela mediana); o anel da pupila debaixo de
uma luz difusa a ser escolhido como reflexo; e desvios grandes (~55 Δ) recusados quando o
detector de rosto errava para o outro lado (agora há uma segunda procura centrada no
contorno da íris).

**O que V0 não prova:** que funciona em fotografias reais. As imagens sintéticas não têm a
forma real do reflexo numa córnea curva, pestanas, desfoque de movimento, compressão JPEG,
luz colorida nem a variação do kappa e do factor de Hirschberg em pessoas. Isso é a fase V1.

### Fase V0b: robustez antes das fotografias reais (2026-10-04)

Seis condições adversas, 60 olhos cada (`robustez.test.ts`), com critérios escritos antes
de correr: o que se aceita tem erro < 0,08 mm em 95% dos casos, e **números errados sem
aviso** (erro > 0,15 mm, ≈ 3 Δ) em menos de 1% do total.

| Condição | Medidos | p95 do erro |
|---|---|---|
| Tremor horizontal (3–6 px) | 60/60 | 0,050 mm |
| Tremor vertical (3–6 px) | 60/60 | 0,036 mm |
| Pestanas sobre a íris | 60/60 | 0,064 mm |
| Pouca luz (exposição 45–65%, mais ruído) | 60/60 | 0,066 mm |
| Reflexos fracos de outras luzes | 60/60 | 0,039 mm |
| Íris elíptica (olhar 15–25° de lado) | 60/60 | 0,037 mm |
| JPEG qualidade 95 | 60/60 | 0,034 mm |
| JPEG qualidade 85 | 60/60 | 0,036 mm |
| JPEG qualidade 75 | 60/60 | 0,036 mm |
| JPEG qualidade 60, com tremor | 60/60 | 0,041 mm |

**Zero números errados sem aviso em 600 olhos.** A compressão JPEG (simulada com a DCT
em blocos de 8×8 e a tabela de quantização da norma, `testes/jpeg.ts`) quase não pesa: o
reflexo e o contorno da íris são grandes em relação aos blocos, e os artefactos compensam-se.

**O que os testes de robustez obrigaram a mudar no contorno da íris:**
- A íris parece elíptica quando o olho está rodado em relação à câmara, ou seja, **no olho
  desviado**, o caso que mais importa. Um círculo enviesava aí o centro (0,093 mm). O
  contorno passou a ser uma **elipse alinhada** (Levenberg–Marquardt), com o círculo como
  recurso.
- Só com os lados da íris, o semi-eixo vertical da elipse ficava mal determinado e o
  centro vertical enviesava com a pálpebra de cima. Acrescentou-se um **sector inferior**
  de raios (a pálpebra de baixo tapa menos), que ancora o centro vertical.
- Pelo caminho testaram-se e descartaram-se duas regras de escolha círculo/elipse por
  limiares; ficam registadas nos commits.
- Custo medido nos 400 olhos da V0: p95 de 0,033 → **0,039 mm** (horizontal 0,022, vertical
  0,037), ainda dentro do critério. Troca aceite: um pouco de precisão média por um olho
  desviado bem medido.

### Detector automático e regra de decisão (2026-10-04)

- **Detector das íris** (`detectorIris.ts` + `marcos.ts`): o FaceMesh do MediaPipe corre no
  telemóvel e dá a posição aproximada das íris; o motor mede o resto. Na bancada encontra
  os olhos sozinho (verificado com uma fotografia real, através de óculos); os toques ficam
  para corrigir, e cada medição regista de onde vieram as posições, para a V1 medir também o
  detector. Os ficheiros do modelo ainda vêm da CDN, como no rastreio actual; servi-los a
  partir do próprio site fica como melhoria (não depender da CDN em Angola).
- **Regra de decisão na API** (`ClassificacaoRastreioService`, 16 testes): encaminhar /
  sem sinais / não mediu, limiar provisório de 6 Δ, versão gravada; sem medição fiável
  nunca se grava "normal". Ainda não ligada a nenhuma rota: liga-se depois da V2.
- **Web Worker: adiado de propósito.** Cada olho analisa-se em menos de 10 ms; o custo real
  está em descodificar a fotografia, que um Worker não resolve. Decide-se com medições em
  telemóveis reais (V2).

### Análise da fase V1, pronta antes das medições (2026-10-04)

`npm run analisar:v1 -- bancada-*.csv [--saida relatorio.md]` junta os CSV da bancada e
escreve o relatório: por pessoa e por olho, o factor de Hirschberg, o kappa e o R², com
passa/não passa; o desvio a olhar em frente; a repetibilidade a 0°; o factor médio de todos
os olhos; e o sucesso e os motivos de falha por caminho de captura (A/B) e por origem das
posições (detector/toques). Lógica em `relatorioV1.ts` (com testes); os critérios são os de
`CRITERIOS_V1`, os mesmos da bancada.

Também a 2026-10-04: os ficheiros do modelo do FaceMesh passaram a ser servidos pelo próprio
site (`ficheirosFaceMesh.ts`), sem CDN; verificado no browser, 0 pedidos à CDN. A observar
na V2: o MediaPipe pediu as duas versões do motor WebAssembly (com e sem SIMD), o que pode
duplicar a primeira descarga.

### Ferramenta da fase V1: a bancada (2026-10-01)

Página interna `/_bancada`, só no servidor de desenvolvimento (não entra no build de
produção), em `frontend/src/pages/interno/BancadaRastreio.tsx`:
- fotografa pelos dois caminhos (A: câmara traseira com luz e fotografia em resolução total;
  B: câmara nativa com flash) ou abre uma fotografia;
- a pessoa que testa toca no centro de cada olho (na bancada mede-se o motor, não o detector
  de rosto) e vê, ampliado, o contorno e o reflexo que o motor encontrou;
- guarda só as medições (as fotografias ficam em memória), calcula por pessoa e por olho o
  factor de Hirschberg, o kappa e o R² (`calibracao.ts`), e o desvio a 0°, contra os
  critérios da V1; exporta CSV.

Verificada de ponta a ponta no browser com uma fotografia sintética de exotropia de 12 Δ:
mediu −11,9 Δ, "exo". **Falha real apanhada ao fazê-lo:** a estimativa do tamanho da íris a
partir da distância entre os olhos assume a anatomia de um adulto e, em crianças (olhos mais
juntos, íris quase do tamanho adulto), erra 20% ou mais. O motor passou a medir primeiro o
raio da íris na própria imagem (`estimarRaio`), e funciona com estimativas de 0,6× a 1,6× do
real (testado).

**Tamanho da amostra (V3):** para estimar uma sensibilidade de ~85% com ±10 pontos (IC 95%)
são precisas **~49 crianças com estrabismo**; para uma especificidade de ~90% com ±5 pontos,
**~138 sem estrabismo**. Na comunidade só uma pequena parte das crianças tem estrabismo (valores habituais de
2–4%, a confirmar numa fonte), por isso o
estudo tem de recrutar na consulta, cuidando de não ficar só com desvios grandes.

**Ética e lei:** V3 envolve dados de saúde de crianças: consentimento dos pais,
aprovação de uma comissão de ética, e a notificação à APD que já está em curso
(`docs/APD_NOTIFICACAO.md`).

**Até V3 estar feita**, o ecrã continua a dizer "triagem, não diagnóstico" e o resultado
"encaminhar" é conservador (limiar mais baixo que 8 Δ, a fixar com o oftalmologista),
aceitando mais falsos positivos para perder menos casos.

### Observação no serviço actual, `janelas-scanner-api` (2026-10-06)

Primeiro rastreio completo pelo telemóvel (iPhone XR, câmara frontal, três fotografias
fiáveis: 95, 93 e 81/100), feito pelo dono do projecto, sem estrabismo conhecido:

| Medição do serviço | Valor |
|---|---|
| Desalinhamento a olhar em frente (`assimetria_horizontal`, posição CENTRO) | −0,09 da largura do olho |
| Variação entre posições (`motilidade.variacao_desalinhamento`) | 0,04 |
| Incomitância | Não |
| Conclusão do serviço | `requer_avaliacao_humana: true` ("vale a pena ir ao oftalmologista") |

**Hipótese (por confirmar com dados, não com o código do serviço, que não temos):** o
−0,09 é sobretudo **convergência de perto**, não estrabismo. Numa selfie a ~30 cm, cada
olho roda ~5,6° para dentro (atan(31,5 mm / 320 mm)); com o plano da íris a ~10 mm do
centro de rotação, isso desloca cada íris ~1 mm para o nariz, ~2 mm nos dois. O serviço
soma os desvios dos dois olhos com o eixo nasal espelhado, de propósito para cancelar um
olhar conjugado, mas a convergência **não** é conjugada: soma-se. Numa fenda palpebral de
~28-30 mm, dá 0,065-0,09. Somam-se a assimetria das pálpebras (mede-se a íris entre os
cantos do olho, não o reflexo corneano) e o ângulo kappa, que este método não separa. Os
limiares do serviço, diz o próprio contrato, não estão calibrados clinicamente.

**Consequência, se se confirmar:** quase toda a gente que faça o rastreio com o
telemóvel na mão recebe "avaliação recomendada", com os olhos alinhados. Falsos positivos
em massa: enchem a clínica parceira e tiram confiança ao resultado. O mesmo número é o
que apanharia um estrabismo concomitante (o mais comum na infância), por isso **não se
pode simplesmente ignorar** no frontend: a correcção é de método.

**Teste que decide:** 3 a 5 adultos sem estrabismo conhecido fazem o rastreio actual e
enviam o PDF (que, desde 2026-10-06, mostra estes três números). Se o desalinhamento em
frente ficar sistematicamente entre ~0,06 e 0,10, confirma-se o enviesamento. É mais um
argumento para o desenho deste motor (§3, §5): câmara traseira, outra pessoa a
fotografar a ~40 cm, alvo de fixação junto à lente e medida pelo reflexo corneano com
diferença binocular, onde a convergência para o alvo é a mesma em toda a gente e o kappa
se cancela entre os olhos.

Contexto: até 2026-10-06 o frontend lia a variação e a incomitância no topo da resposta,
onde o serviço nunca as põe (estão em `motilidade`), por isso nenhum relatório anterior
mostrava estes números (corrigido no ramo `redesenho/frontend`, commit `3c402de`).

---

## 9. Riscos e limites conhecidos

- **Estrabismo intermitente:** se não se manifestar no momento da fotografia, não se vê.
  A luz forte pode ajudar a revelá-lo (descrito na EyeTurn), mas não é garantido.
- **Esotropia acomodativa:** exige o alvo com detalhe junto à lente (§5).
- **Crianças pequenas:** fixação curta; por isso várias fotografias rápidas.
- **Óculos:** têm de ser tirados; reflexos múltiplos disparam o portão de qualidade.
- **iPhone:** caminho B garantido; o caminho A depende de medição num iPhone real (§5).
- **Operador sem treino:** o próprio ecrã tem de ensinar (enquadramento guiado, avisos em
  tempo real).
- **Viés de população:** a validação é feita com crianças angolanas; os limiares vêm
  daí, não da literatura estrangeira.

---

## 10. Plano de trabalho proposto

1. **V0:** o algoritmo em TypeScript puro com imagens sintéticas e testes (sem mexer em
   produção). 1 a 2 semanas.
2. **Captura:** novo passo "fotografias" com câmara traseira e luz, atrás de uma opção de
   teste, sem substituir o fluxo em produção. 1 semana.
3. **V1 e V2** com a equipa e voluntários. 2 semanas.
4. **API:** `ClassificacaoRastreioService` e o novo formato de medições (PR com revisão). 1 semana.
5. **Troca:** o motor próprio passa a ser o único; o `janelas-scanner-api` sai.
6. **V3** quando a parceria clínica estiver acordada.

---

## 11. Decisões do dono do projecto

**Tomadas a 2026-09-30:**
- **Dois modos:** rastreio completo com outra pessoa a fotografar (o único com resultado) e
  pré-rastreio com a câmara frontal, sem número (§5).
- **iPhone entra:** pelo caminho B (câmara nativa) com certeza; pelo caminho A se a
  medição num iPhone real o justificar (§5).
- **Até V2:** o `janelas-scanner-api` continua em produção; a troca faz-se quando o motor
  próprio passar V1 e V2, com limiar conservador e "triagem, não diagnóstico".

**Por decidir:**
1. **Alvo de fixação:** o projecto fornece um autocolante (ex.: nas campanhas do Kamba) ou
   mostra-se um desenho para imprimir?
2. **Parceria clínica para V3:** quem fala com a Optioptika (ou outra clínica) e com uma
   comissão de ética?

---

## 12. Fontes

- Cheng W, et al. *A smartphone ocular alignment measurement app in school screening for
  strabismus.* BMC Ophthalmology 2021;21:150. https://bmcophthalmol.biomedcentral.com/articles/10.1186/s12886-021-01902-w
- Pundlik S, Tomasi M, Liu R, Houston K, Luo G. *Development and preliminary evaluation of a
  smartphone app for measuring eye alignment.* TVST 2019;8(1):19. doi:10.1167/tvst.8.1.19
- *Quantitative Assessment of Strabismus Using Cloud AI Computing: Validation Study.* JMIR
  Formative Research 2025. https://pmc.ncbi.nlm.nih.gov/articles/PMC12627973/
- Hull S, et al. *Tests for detecting strabismus in children aged 1 to 6 years in the
  community.* Cochrane Database Syst Rev 2017. https://www.cochranelibrary.com/cdsr/doi/10.1002/14651858.CD011221.pub2/full
- Brodie SE. *Photographic calibration of the Hirschberg test.* 1987. https://pubmed.ncbi.nlm.nih.gov/3557878/
- AAPOS. *Uniform guidelines for instrument-based pediatric vision screen validation 2021.*
  JAAPOS 2022;26(1). https://pubmed.ncbi.nlm.nih.gov/35066152/
- *Utilizing deep learning from mobile phone photos for early detection of horizontal
  strabismus.* 2025. https://pmc.ncbi.nlm.nih.gov/articles/PMC13260414/
- Google Research. *MediaPipe Iris: real-time iris tracking and depth estimation.*
  https://research.google/blog/mediapipe-iris-real-time-iris-tracking-depth-estimation/
- WebKit Bugzilla, bug 243075 (*torch* em iOS). https://bugs.webkit.org/show_bug.cgi?id=243075
- Apple. *App Review Guidelines*, 2.5.6. https://developer.apple.com/app-store/review/guidelines/
- Chrome for Developers. *Take photos and control camera settings (ImageCapture).*
  https://developer.chrome.com/blog/imagecapture
- W3C. *MediaStream Image Capture.* https://www.w3.org/TR/image-capture/
