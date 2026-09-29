# Pesquisa de UX/UI para o redesenho (Sprint 7)

> Complementa `docs/REDESENHO_FRONTEND.md`. Aquele diz **o que** vamos fazer; este diz
> **porquê cada padrão**, com a fonte. Pesquisa de secretária feita em 2026-09-29.
> **Não substitui a Fase 0** (entrevistas com pais, clínica e voluntários e testes em
> telemóvel real): diz o que a melhor prática já sabe, para as entrevistas se
> concentrarem no que só os nossos utilizadores podem responder.

---

## 1. O que a pesquisa diz, em dez conclusões

| # | Conclusão | Fonte | Consequência para nós |
|---|---|---|---|
| 1 | Em Angola, 44,8% da população usa internet (17,2 M, Jan. 2025); 93,7% das ligações móveis já são banda larga | DataReportal | O utilizador típico está no telemóvel, com rede razoável mas dados caros. Desenhar para o telemóvel primeiro, não "adaptar" o desktop |
| 2 | Na África Subsariana há um enorme "fosso de utilização": muita gente tem cobertura mas não usa internet móvel; as barreiras principais são o preço e a literacia digital | GSMA | Cada megabyte custa dinheiro; cada ecrã confuso perde alguém que não volta. Leveza e clareza são inclusão, não estética |
| 3 | O telemóvel de referência para 2026 é da classe Samsung Galaxy A24 4G, em rede de 9 Mbps / 100 ms. Para abrir em 3 s: até ~2 MiB no caminho crítico, dos quais só ~0,3 MiB de JavaScript | Alex Russell | Orçamento de performance fixo no CI (§4). O bundle único actual (56 rotas, 0 `lazy`) está fora disto |
| 4 | "Bom" nas Core Web Vitals: LCP ≤ 2,5 s, INP ≤ 200 ms, CLS ≤ 0,1, medidos no percentil 75 das visitas reais | web.dev | São as metas de sucesso de cada página migrada |
| 5 | Informação de saúde deve ler-se com a idade de leitura de 9 a 11 anos; termo simples primeiro, termo médico a seguir | NHS, "How we write" | "Olho que desvia (estrabismo)", nunca o contrário. Aplica-se a resultados, paywall e emails |
| 6 | Perguntas uma de cada vez ("one thing per page") reduzem erros e carga mental, sobretudo em telemóvel | NHS, question pages | Rastreio, marcação e pagamento passam a sequências de ecrãs curtos com "Passo X de Y" |
| 7 | Confiança num site vem de quatro coisas: qualidade do design, **transparência logo à cabeça** (preço, o que acontece aos dados), conteúdo completo e actual, e ligação ao mundo real | NN/g | Preço do Premium, "nenhuma fotografia é guardada" e a clínica real (nome, morada, pessoas) aparecem **antes** de pedirmos alguma coisa |
| 8 | WCAG 2.2 acrescenta: alvo de toque mínimo 24×24 px (2.5.8), foco nunca escondido por barras fixas (2.4.11), não pedir de novo o que já foi dado (3.3.7), login sem teste cognitivo (3.3.8) | W3C | Regras de componente (§3). Nós vamos além do mínimo: 44 px na app, maior no modo criança |
| 9 | Crianças de 3-5, 6-8 e 9-12 anos comportam-se de forma muito diferente; as mais novas precisam de alvos de ~2 cm (4× o de um adulto); detestam conteúdo "de bebé" um ano abaixo da idade delas | NN/g | O modo criança (adiado para esta Sprint) não é "cores mais vivas": é um nível de interacção próprio, com o pai a configurar |
| 10 | Na terapia digital da ambliopia em casa, a adesão média é ~74%; filmes (84%) aderem melhor do que jogos (68%); cai com a duração do tratamento e sobe nas crianças mais novas. Dificuldade adaptativa, conquistas e feedback claro ajudam | Journal of Optometry (meta-análise, 27 estudos), JMIR Serious Games | Sessões curtas, feedback imediato e visível, progresso que se entende, recompensas que não castigam uma falha. O pai é parte do ciclo, não só a criança |

Mais dois dados de apoio: o movimento de interface deve durar ~100 ms para feedback e
200–500 ms para mudanças maiores, sempre respeitando `prefers-reduced-motion` (NN/g); e
em formulários móveis a etiqueta vai **sempre por cima** do campo (nunca dentro, porque
desaparece ao escrever) e o teclado certo aparece com `inputmode`/`type` (Baymard).

---

## 2. Princípios que adoptamos (e os que não)

Os seis princípios do `REDESENHO_FRONTEND.md` §3 mantêm-se. A pesquisa acrescenta-lhes
três, emprestados dos princípios de design do NHS, que são o equivalente mais próximo
de nós (serviço de saúde para toda a gente, incluindo quem lê pouco):

- **Desenhar para o resultado.** O sucesso de um ecrã é a criança chegar ao médico ou
  fazer o treino, não o tempo na página. Nada de padrões de "engagement" que prendem
  sem ajudar (scroll infinito, notificações de culpa, contagens decrescentes falsas).
- **Fazer o trabalho difícil para tornar simples.** A complexidade (dúvida clínica,
  pagamento por transferência, horários) fica do nosso lado; o utilizador vê um passo
  de cada vez.
- **Desenhar para a confiança.** Honestidade antes de beleza: dizer o que é gratuito, o
  que custa, o que é e não é um diagnóstico.

**Rejeitado de propósito:** dark patterns de subscrição (renovar sem aviso, esconder o
cancelar), gamificação no rastreio (é um acto clínico, não um jogo), animação decorativa
contínua nos ecrãs de tarefa, carrosséis na página inicial.

---

## 3. Padrões transversais (valem para todas as páginas)

### Texto
- Frases curtas, voz activa, "você" (pt-AO), um assunto por parágrafo.
- Títulos de ecrã que respondem à pergunta do utilizador: "Vale a pena ir ao
  oftalmologista", não "Resultado da análise".
- Botões dizem o que acontece: "Marcar consulta", não "Continuar" quando há algo mais
  específico a dizer.

### Letra (Ubuntu, com opção de leitura fácil)
- A letra é a **Ubuntu**, a do manual da marca (`docs/MARCA.md` §4). É humanista, com
  aberturas largas e letras que não se confundem (o `l` tem cauda, o `1` tem bandeira,
  o `I` é uma barra).
- A investigação diz que **nenhuma letra é a melhor para toda a gente**: no mesmo
  leitor, a velocidade de leitura varia até 35% entre a letra mais rápida e a mais lenta,
  sem perder compreensão, e a letra mais rápida muda de pessoa para pessoa (Wallace et
  al., 2022). A Atkinson Hyperlegible foi desenhada com pessoas com baixa visão, mas
  não há estudos independentes que a mostrem melhor para toda a gente.
- Por isso: **Ubuntu para todos, e uma opção "Letra de leitura fácil" (Atkinson
  Hyperlegible Next) nas Definições**, carregada só por quem a escolhe. Serve quem
  precisa, sem pôr a marca de lado nem pesar no site de toda a gente.
- A legibilidade garante-se sobretudo por: texto corrido ≥ 17 px, peso ≥ 400 (Light só
  em títulos ≥ 32 px), linhas de 45 a 75 caracteres, entrelinha ≥ 1,5 e contraste AA.
- O palco dos testes visuais não usa a letra do site: usa optótipos calculados em ângulo
  visual (CLAUDE.md §6), por isso esta escolha não mexe na medição.

### Formulários
- Etiqueta por cima, texto de ajuda entre a etiqueta e o campo, nunca placeholder como
  etiqueta.
- Teclado certo: `type="tel"` + `inputmode="numeric"` no telemóvel, `type="email"`,
  `autocomplete` em nome, email, telefone e password.
- **Validação (conciliando GOV.UK e Baymard):** não mostrar erros enquanto a pessoa
  escreve pela primeira vez. Validar ao submeter: resumo de erros no topo com o foco
  movido para ele, e mensagem junto de cada campo. A partir daí, um campo com erro
  revalida-se a cada tecla, para o erro desaparecer assim que fica corrigido.
- Mensagens de erro dizem como resolver: "Faltam números: um telemóvel angolano tem 9."
- Nunca pedir de novo o que já sabemos (WCAG 3.3.7): marcação e Premium vêm
  pré-preenchidos do perfil.
- Login: permitir colar e gestores de passwords, botão "mostrar password", sem
  CAPTCHA de puzzle (WCAG 3.3.8).

### Toque e foco
- Alvos ≥ 44×44 px na app e no site; ≥ 24 px só na consola densa; modo criança ~2 cm.
- Foco visível sempre, com contraste próprio (anel no acento, 2-3 px, com afastamento).
- Barras fixas (topo/fundo) não podem tapar o elemento com foco:
  `scroll-padding-top/bottom` igual à altura delas (WCAG 2.4.11).
- Acções principais na metade de baixo do ecrã, ao alcance do polegar.

### Estados (nenhuma página está pronta sem os cinco)
| Estado | Padrão |
|---|---|
| A carregar | Esqueleto com a forma do conteúdo quando demora > 300 ms; nada antes disso (evita piscar) |
| Vazio | Explica porquê e dá o primeiro passo ("Ainda não fez nenhum treino. Comece pelo de 3 minutos.") |
| Erro | Diz o que falhou em linguagem simples, e oferece "Tentar novamente"; **nunca** UI de sucesso a partir de um `catch` (CLAUDE.md §6) |
| Sem rede | Mantém o que já está no ecrã, avisa sem bloquear, e guarda o que foi escrito |
| Sucesso | Confirma **só** depois da resposta do servidor, e diz o que acontece a seguir |

### Movimento (um só vocabulário, em tokens)
| Token | Valor | Uso |
|---|---|---|
| `--mov-feedback` | 100 ms | Toque, hover, pressão de botão |
| `--mov-transicao` | 250 ms | Mudar de passo, abrir painel |
| `--mov-entrada` | 400 ms | Entrada de secção, celebração curta |
| Mola por omissão | amortecida, sem ressalto visível | Transições de passo (a mola "viva" do laboratório ressalta demais para crianças) |

Com `prefers-reduced-motion`: só opacidade, sem deslocamento nem escala. Nada roda ou
pulsa em ecrãs de tarefa, excepto o indicador do que a pessoa tem de fazer (ex.: o
ponto a olhar no rastreio).

### Performance (portão no CI, Fase 2)
- JavaScript inicial ≤ 300 KiB comprimido na rota de entrada; cada rota em `lazy`.
- LCP ≤ 2,5 s, INP ≤ 200 ms, CLS ≤ 0,1 medidos no perfil Galaxy A24 / 9 Mbps / 100 ms.
- Fontes: no máximo duas famílias, auto-alojadas, com `font-display: swap` e subconjunto
  latino; imagens AVIF/WebP com `srcset` e dimensões fixas (CLS).
- Biblioteca de animação com carregamento reduzido (`LazyMotion` do `motion`), medida
  antes de entrar.

---

## 4. As cinco jornadas críticas, redesenhadas

### 4.1 Primeiro rastreio (visitante → resultado → médico)
1. **Página de entrada** diz em três linhas o que é, quanto custa (grátis), quanto
   demora (2 min) e o que acontece à imagem (nada é guardado). Uma só acção principal.
2. **Explicar antes de pedir a câmara** (permission priming): um ecrã nosso diz porquê
   e o que acontece, só depois aparece o pedido do browser. Se recusar, caminho claro
   para tentar de novo.
3. **Preparação verificável**, uma condição por linha (luz, distância, óculos).
4. **Captação com uma única instrução** e progresso visível.
5. **Resultado que diz o que fazer**, em linguagem de 9-11 anos, com "isto não é um
   diagnóstico", e **um** próximo passo: a consulta, com a próxima vaga real.
6. Conta só quando é preciso guardar o resultado (registo adiado), com os dados já
   preenchidos.

### 4.2 Marcar consulta
- Escolher horário real (Sprint 4, PR C) em vez de "manhã/tarde".
- Dados pré-preenchidos do perfil; só se pede o que falta.
- **Ecrã de confirmação** ("confirme os dados") antes de enviar, com "Alterar" em cada linha.
- Página final: o que acontece a seguir, quando, e como a clínica vai contactar.

### 4.3 Sessão de exercício (o dia a dia)
- Ecrã de preparação curto; treino rápido de 3 minutos como opção por omissão.
- Feedback em ≤ 100 ms a cada toque; nada de animação que distraia do alvo.
- Fim de sessão: uma frase de evolução simples ("Hoje acertou mais 2 do que na semana
  passada"), nunca só um número.
- Sequências **que perdoam**: um dia falhado não apaga tudo, porque a adesão cai com a
  duração do tratamento e a culpa faz desistir.
- Vista do pai: o que a criança fez esta semana, em 5 segundos de leitura.

### 4.4 Trial → Premium (dinheiro)
- Preço visível antes de começar o trial, e o que cada um dá (4 treinos vs. 8).
- O fim do trial mostra a evolução medida da própria pessoa (já existe, PR #124).
- Pagamento por transferência como sequência de passos: dados bancários com botão
  "copiar" em cada campo → enviar comprovativo (progresso, repetir se falhar) →
  estado "a aguardar confirmação" com o tempo esperado e onde ver o resultado.

### 4.5 Consola (clínica e admin)
- Densidade alta, zero decoração, tabelas com ordenação e filtros, estados de relance
  (cor **e** texto, nunca só cor).
- Teclado de ponta a ponta; alvos de 24 px aceitáveis aqui.
- Acções destrutivas com confirmação que diz o que se perde.

---

## 5. Navegação e menu

A NN/g mediu que **esconder a navegação principal atrás de um ícone (☰) reduz para quase
metade a probabilidade de ser encontrada**, e as pessoas usam-na mais tarde e com mais
dificuldade, tanto no telemóvel como no computador. Barras de separadores visíveis
funcionam melhor quando há poucos destinos. Daí, uma navegação por modo:

| Modo | Telemóvel | Computador |
|---|---|---|
| **Site** (visitante) | Logótipo + botão "Fazer rastreio" sempre visível + botão **"Menu"** com a palavra, não só o ícone. O menu abre em ecrã inteiro, com os destinos agrupados (Rastreio e treinos · Clínicas · Sobre nós · Apoiar) | Barra de topo com 4 destinos visíveis + "Fazer rastreio" + "Entrar" |
| **App** (com sessão) | **Barra de separadores em baixo**, sempre visível, 5 destinos com ícone **e** nome: Hoje · Treinos · Jogo · Consultas · Perfil. O rastreio abre a partir de Hoje e de Consultas | Os mesmos 5 destinos numa barra lateral estreita |
| **Consola** (clínica e admin) | Uso secundário: menu em ecrã inteiro | Barra lateral fixa com grupos, migalhas de pão (breadcrumbs), tabelas primeiro |

**Regras que valem para todos:**
- O destino actual marca-se com `aria-current="page"` e com mais do que a cor (peso e
  indicador).
- **Cada passo é um endereço** (`/rastreio/passo-2`, `?passo=2`): o botão "voltar" do
  telemóvel volta ao passo anterior e não deita fora a jornada. Voltar é o gesto mais
  usado em Android.
- Ao mudar de página: foco no `<h1>`, título do separador actualizado e anúncio para
  leitores de ecrã (numa SPA isto não acontece sozinho).
- Ligação "Saltar para o conteúdo" como primeiro elemento focável.
- A barra de separadores guarda a posição de cada separador: voltar a "Treinos" não
  volta ao topo.
- Uma jornada de tarefa (rastreio, pagamento) esconde a navegação principal e mostra só
  "Sair" com confirmação. Menos saídas, mais tarefas concluídas.
- 404 útil: diz o que aconteceu e oferece os 3 destinos mais procurados.

---

## 6. O suco: momentos pensados

O "suco" não é animação espalhada; são **poucos momentos, escolhidos, que recompensam ou
tranquilizam**. Cada um tem de responder a "que sentimento queremos aqui?". Todos seguem
os tokens de movimento (§3), respeitam o movimento reduzido e **nunca atrasam a tarefa**
(interrompíveis, sem bloquear toques). Não há som (decisão de 2026-09-24).

| Momento | Onde | O que acontece | Sentimento |
|---|---|---|---|
| O olhar alinha-se | Abertura do site | O olho do símbolo entra desviado e alinha-se na janela, **uma vez** | "É disto que se trata" |
| Toque que responde | Todos os botões | Pressão a 97% em 100 ms; o carregamento acontece dentro do botão, sem ele mudar de tamanho | Controlo |
| Passos com direcção | Rastreio, marcação, pagamento | Avançar desliza para a esquerda, voltar para a direita, em 250 ms; a barra "Passo X de Y" enche-se | Progresso |
| Preparação que se confirma | Antes do rastreio | Cada condição (luz, distância, óculos) ganha um visto à medida que é confirmada | Confiança |
| Resultado sereno | Resultado do rastreio | Revela-se com calma, **sem celebração nem confetes**: é um momento clínico. O próximo passo aparece logo | Segurança |
| Evolução que se vê | Fim de treino | O número da evolução conta até ao valor ("+2 linhas") e a frase simples aparece a seguir | Orgulho |
| Sequência celebrada à medida | Treinos diários | Pequeno (o dia fica marcado); a cada 7 dias, maior (padrão de lentes e dourado, os 5 diamantes a voar para a carteira) | Hábito |
| Copiado | Dados bancários do Premium | O botão "Copiar" passa a "Copiado ✓" no mesmo sítio, 2 s | Certeza |
| Estado vazio com calor | Listas sem nada | O símbolo, uma frase e o primeiro passo ("Comece pelo treino de 3 minutos") | Convite |
| Espera que se entende | Carregamentos | Esqueleto com a forma do conteúdo, só depois de 300 ms | Paciência |
| Mudança de página | App (Android) | View Transitions API como melhoria progressiva: o cartão tocado "abre" para a página | Continuidade |
| Nome próprio | Painel e mensagens | "A Ana treinou 5 dias seguidos", não "Treinou 5 dias" | Pertença |

**Limites:** no máximo um momento de celebração por ecrã; nada de celebração em ecrãs
clínicos nem de dinheiro; interfaces optimistas (mostrar antes de o servidor confirmar)
**só** em gestos sem consequência (marcar um favorito), nunca em pagamentos, sessões
gravadas ou resultados (CLAUDE.md §6: nunca sucesso antes da resposta).

---

## 7. Qualidade dos componentes

A lista do que torna um componente "pronto" (todos os estados, 44 px, teclado, dois
temas, movimento reduzido, sem texto embutido, testado) e a forma de o escrever estão
em `docs/SISTEMA_DESIGN.md` §4. Resumo das peças a construir primeiro, pela ordem em
que as jornadas críticas precisam delas: Botao · Campo (com ajuda e erro) · Passos ·
Cartao · Aviso · EstadoVazio · Esqueleto · Dialogo · MenuSite · BarraSeparadores.

---

## 8. O que isto muda no laboratório (`/_laboratorio`)

> **Actualização 2026-09-29:** chegou o manual de marca. Cor, logótipo e letra seguem
> agora `docs/MARCA.md` (Ubuntu em vez de Atkinson Hyperlegible; paleta oficial com
> regras de contraste testadas). Os padrões de UX deste documento mantêm-se todos.

1. A mola das três direcções passa a amortecida (sem ressalto) nos ecrãs de tarefa;
   a mola mais viva fica só para celebrações.
2. O ecrã do rastreio ganha o passo de **explicar a câmara** antes da captação.
3. O formulário de exemplo segue o padrão de validação do §3.
4. A decoração da direcção A (anéis) é corrigida (estava quase invisível).
5. Cada direcção passa a mostrar os cinco estados (a carregar, vazio, erro, sem rede,
   sucesso), porque é aí que um design system se prova, não na página inicial.

---

## 9. O que só a Fase 0 pode responder

- Os pais confiam mais num tom clínico (A/C) ou caloroso (B)?
- Que palavras usam para "estrabismo"? ("olho vesgo", "olho torto"?) Ajusta o texto de 9-11 anos.
- Quantos usam o telemóvel da família, partilhado com a criança?
- Que modelos de telemóvel e que plano de dados têm, de facto?
- A transferência bancária é a barreira no Premium, ou é o preço?

---

## Fontes

- DataReportal, *Digital 2025: Angola* — https://datareportal.com/reports/digital-2025-angola
- GSMA, *The Mobile Economy Africa 2025* — https://www.gsma.com/mobileeconomy/africa-2025
- Alex Russell, *The Performance Inequality Gap, 2026* — https://infrequently.org/2025/11/performance-inequality-gap-2026/
- web.dev, *Defining the Core Web Vitals metrics thresholds* — https://web.dev/articles/defining-core-web-vitals-thresholds
- NHS digital service manual, *Design principles* — https://service-manual.nhs.uk/design-system/design-principles
- NHS digital service manual, *How we write* — https://service-manual.nhs.uk/content/how-we-write
- NHS digital service manual, *Question pages* — https://service-manual.nhs.uk/design-system/patterns/question-pages
- GOV.UK Design System, *Recover from validation errors* — https://design-system.service.gov.uk/patterns/validation/
- W3C, *WCAG 2.2* — https://www.w3.org/TR/WCAG22/
- NN/g, *Trustworthy design* — https://www.nngroup.com/articles/trustworthy-design/
- NN/g, *Animation duration* — https://www.nngroup.com/articles/animation-duration/
- NN/g, *Design for kids based on their stage of physical development* — https://www.nngroup.com/articles/children-ux-physical-development/
- Baymard, *Mobile form usability: never use inline labels* — https://baymard.com/blog/mobile-forms-avoid-inline-labels
- Baymard, *8 recommendations for input fields* — https://baymard.com/blog/input-fields
- *Analysis of patient adherence to emerging treatment tools in amblyopia* (meta-análise, Journal of Optometry) — https://pmc.ncbi.nlm.nih.gov/articles/PMC13063279/
- *Effectiveness of a gamified mobile app in enhancing treatment adherence for children with amblyopia* (JMIR Serious Games, 2025) — https://games.jmir.org/2025/1/e60309
- Wallace et al., *Towards individuated reading experiences: different fonts increase reading speed for different individuals* (ACM TOCHI, 2022) — https://dl.acm.org/doi/10.1145/3502222
- Braille Institute, *Atkinson Hyperlegible* — https://www.brailleinstitute.org/freefont/
- NN/g, *Hamburger menus and hidden navigation hurt UX metrics* — https://www.nngroup.com/articles/hamburger-menus/
- NN/g, *Basic patterns for mobile navigation* — https://www.nngroup.com/articles/mobile-navigation-patterns/
