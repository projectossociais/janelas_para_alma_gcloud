# Estrutura do site novo: cabeçalho, entrada, página inicial e rodapé

> Parte do redesenho (Sprint 7). Complementa `docs/PESQUISA_UX.md` (padrões e navegação
> por modo), `docs/MARCA.md` (marca) e `docs/SISTEMA_DESIGN.md` (código).
> **Ponto de partida: quem nos visita e o que precisa, não as páginas que existem hoje.**
> Válido para qualquer das direcções visuais (A, B ou C): isto é a estrutura; a direcção
> é a pele.

---

## 1. O que está mal hoje (auditado no código, 2026-09-30)

| Onde | Problema | Consequência |
|---|---|---|
| `Navbar.tsx` (798 linhas) | **9 destinos** no topo, ao mesmo nível (Sobre nós, Estrabismo, Equipa, Triagem, Kamba, Exercícios, Portal clínico, Contactos, Inclusivamente) | Nada se destaca; o rastreio, que é o produto, é mais um entre nove |
| `Navbar.tsx` no telemóvel | **"Entrar" só existe dentro do menu lateral** | Quem já tem conta tem de abrir o menu para entrar |
| `HeroSection.tsx` | O título é o **nome da marca** repetido (o logótipo reconstruído à mão, com margens negativas) e o **único botão é "Apoiar"** (doar) | A primeira coisa que um pai vê não diz o que ganha nem o que fazer. O visitante principal (pai preocupado) e o doador disputam o mesmo botão |
| `Index.tsx` | **8 secções empilhadas** (banner, cartão de estrabismo, sobre, pilares, curiosidades, novidades, parceiros) sem ordem de decisão | Informação espalhada; o caminho para o rastreio perde-se |
| `Footer.tsx` | Lista de ligações; **sem contacto directo nem aviso clínico** | Um serviço de saúde sem forma visível de falar com alguém perde confiança |

---

## 2. Quem nos visita, por ordem de importância

| # | Quem | O que quer | Onde deve chegar |
|---|---|---|---|
| 1 | **Pai ou mãe preocupado**, no telemóvel, pela primeira vez | "O meu filho tem um olho que desvia. É grave? O que faço?" | Rastreio → resultado → consulta |
| 2 | **Família em acompanhamento** (já tem conta) | Fazer o treino de hoje | Entrar → **Hoje** (sem passar pela página inicial) |
| 3 | **Clínica ou profissional** parceiro | Ver os pedidos de consulta | Entrar → portal da clínica |
| 4 | **Apoiante** (doador, voluntário, empresa) | Perceber o impacto e ajudar | Apoiar |
| 5 | Imprensa, parceiros, financiadores | Quem são, resultados, contactos | Sobre, impacto, publicações |

A página inicial serve **o visitante 1**. Os visitantes 2 e 3 não precisam dela: precisam
de "Entrar" visível em qualquer ecrã. O visitante 4 tem um lugar próprio e forte, mas
**não disputa a abertura** com o visitante 1.

---

## 3. Cabeçalho

### Computador

```
[Logótipo]   Rastreio   Treinos   Clínicas   Comunidade ▾   Sobre ▾      EN   Entrar   [ Fazer rastreio ]
```

- **5 destinos**, não 9. "Comunidade ▾" é o **Meu Kamba Estrábico** (§5b): Actividades ·
  Ser voluntário · Doar · Doar óculos usados. "Sobre ▾" abre: A nossa história e impacto ·
  O que é o estrabismo · Equipa · Publicações · Contactos. Cada entrada com uma linha que
  explica. Os painéis abrem com clique e com teclado, não só ao passar o rato (Radix
  NavigationMenu). "Doar" continua forte na página inicial (secção 7) e no rodapé.
- **À direita, pela ordem de importância:** idioma (discreto), **"Entrar"** em texto e,
  por fim, o único botão cheio do cabeçalho, **"Fazer rastreio"**. Quem volta procura o
  "Entrar" no canto superior direito, e é aí que ele está. Quem chega pela primeira vez
  vê uma única acção destacada.
- Logótipo sem assinatura (tamanho pequeno, `docs/MARCA.md` §2); clicar leva ao início.
- O cabeçalho **fica fixo e compacta-se** ao descer (de 72 px para 56 px). Não se esconde
  ao descer: numa jornada de saúde, "Entrar" e "Fazer rastreio" estão sempre à mão.
  `scroll-padding-top` igual à altura dele, para nunca tapar o foco (WCAG 2.4.11).

### Telemóvel

```
[Símbolo + nome]                       Entrar    ☰ Menu
```

- **"Entrar" fica sempre à vista**, fora do menu (corrige o problema actual).
- "Menu" com a palavra por extenso. Abre em ecrã inteiro: os 5 destinos com os
  sub-destinos, alvos de 56 px, "Fazer rastreio" em baixo (zona do polegar), e o idioma.
  O foco fica preso dentro do menu, fecha com "Esc" e ao escolher um destino.
- Na página inicial, depois de a abertura sair do ecrã, aparece uma **barra fixa em
  baixo** com "Fazer o rastreio grátis". É o gesto mais importante, sempre ao alcance do
  polegar.

### Com sessão iniciada

- "Entrar" dá lugar ao **avatar** (a inicial ou a foto) e ao sino de notificações.
  O avatar abre: nome, "Hoje", Perfil, Definições, "Letra de leitura fácil", Sair.
- **Quem tem sessão e abre `/` vai para "Hoje"** (a app). O site institucional continua
  acessível pelo menu ("Sobre"). Como nos bancos: quem já é cliente não precisa de ser
  convencido de novo.
- Na app, no telemóvel, a navegação passa a ser a barra de separadores em baixo
  (PESQUISA_UX §5): Hoje · Treinos · Jogo · Consultas · Perfil.

---

## 4. Entrar e criar conta

- **Uma só porta:** "Entrar" leva a um ecrã que pede primeiro o **email**. Se a conta
  existe, pede a password; se não existe, oferece criar a conta com o mesmo email já
  preenchido. Acaba com a escolha "Entrar ou Registar?" antes de a pessoa saber qual é o
  caso dela.
- **"Continuar com Google"** em primeiro lugar (em Angola, quase todos os Android têm
  conta Google; já existe `GoogleSignInButton`).
- Password: mostrar/esconder, colar permitido, gestores de passwords funcionam
  (`autocomplete`), regras mostradas antes de errar, nada de puzzles (WCAG 3.3.8).
- **Registo no momento em que faz falta, não à entrada:** o rastreio faz-se sem conta; a
  conta pede-se para *guardar o resultado*, *começar o teste de 7 dias* ou *marcar a
  consulta*, com o que já se sabe pré-preenchido.
- Profissionais e clínicas entram pela mesma porta; o papel decide para onde vão. O
  acesso ao portal continua a depender da ligação feita por um admin (não de um papel
  auto-registável).
- Depois de entrar, volta-se para onde se estava (ex.: ao passo do rastreio), nunca para
  uma página genérica.

---

## 5. Página inicial

Cada secção existe porque responde a uma pergunta do pai, **pela ordem em que ele a
faz**: *O que é isto? É para o meu filho? Posso confiar? Custa? Como faço? E depois?*

| # | Secção | Pergunta a que responde | Conteúdo |
|---|---|---|---|
| 0 | Aviso (opcional) | — | Uma faixa fina, gerida no admin (os banners actuais), só quando há algo a dizer. Nunca um carrossel |
| 1 | **Abertura** | O que é isto? | Título com o resultado para o pai ("Descubra em 2 minutos se o seu filho precisa de ir ao oftalmologista"), três factos (grátis · 2 minutos · nenhuma fotografia guardada), **um** botão principal "Fazer o rastreio" e um secundário "Como funciona". À direita, **o produto real** (o ecrã do rastreio no telemóvel), não uma fotografia de banco |
| 2 | **Sinais a que estar atento** | É para o meu filho? | 4 a 6 sinais do dia a dia (um olho que desvia, inclinar a cabeça, fechar um olho ao sol, tropeçar muito), com fotografia real a preto e branco ou ilustração. Liga para "O que é o estrabismo". É o conteúdo mais útil e o que as pessoas procuram no Google |
| 3 | **Como funciona** | Como faço? | Os 3 passos com **capturas reais** e uma demonstração que se pode tocar (a do laboratório). Repete o botão "Fazer o rastreio" |
| 4 | **Depois do rastreio** | E depois? | Duas saídas lado a lado: **consulta** numa clínica parceira real (nome, cidade, presencial ou vídeo) e **treinos em casa** (teste de 7 dias, depois 15.000 Kz/mês, dito às claras) |
| 5 | **Porque confiar** | Posso confiar? | Instituição angolana, equipa com rostos e nomes reais, clínica parceira, "isto é triagem, não diagnóstico". Números **só se forem reais**, com data |
| 6 | **Para as crianças** | — | O jogo Inclusivamente, curto: aprender sobre os olhos a jogar |
| 7 | **Apoiar a causa** | — | Uma faixa forte para doar, voluntariar ou ser parceiro. Aqui o doador tem o palco todo, sem competir com a abertura |
| 8 | **Perguntas rápidas** | As dúvidas que travam | 4 perguntas: É um diagnóstico? Guardam a fotografia do meu filho? Quanto custa? A partir de que idade? Liga para o FAQ completo |

**Sai da página inicial:** os "pilares" genéricos e as curiosidades (passam para o jogo e
para as publicações). As novidades passam para "Publicações" (no máximo, 3 destaques em
"Porque confiar", se forem notícias de impacto).

**Ritmo visual:** as secções não têm todas a mesma forma (título centrado + grelha de
3). Alternam largura, alinhamento e densidade: uma abertura assimétrica, uma lista
editorial, uma demonstração, duas colunas de decisão, uma faixa a toda a largura.
Grelha de 12 colunas, contentor de 1200 px, texto com no máximo 65 caracteres por linha,
espaço entre secções de 96 px no computador e 64 px no telemóvel.

---

## 5b. Comunidade: Meu Kamba Estrábico

**Pedido do dono do projecto (2026-09-30):** os admins publicam as actividades que
realizaram e as campanhas de voluntariado; **qualquer pessoa vê, sem conta** (dá
credibilidade); **quem tem conta candidata-se**.

**O que já existe (auditado no código):**

| Peça | Estado hoje | Leitura |
|---|---|---|
| Página `/kamba` | Candidatura + próximas actividades + "acções recentes" | A estrutura certa, com o nome certo |
| "Acções recentes" (`ActivitiesFeed.tsx`) | **Escrito à mão no código** (só a campanha da Gamek) | Não escala: cada acção nova obrigava a mexer no código |
| `CampanhaGamek.tsx` | Página inteira escrita à mão para uma acção | O mesmo problema |
| Publicações (`publicacoes`, admin) | Título, resumo, texto, local, data, capa, fotografias e vídeos, rascunho/publicado | **É exactamente um relatório de actividade**, já gerido pelos admins |
| Actividades de voluntariado (`atividades_voluntariado`, admin) | Título, descrição, local, datas, vagas, estado | São as **campanhas** futuras |
| Candidatura (`candidaturas_voluntariado`) | Candidatura geral a voluntário, aprovada por um admin | Existe |
| Inscrição por actividade (`inscricoes_atividade`) | Só voluntários aprovados; uma por pessoa por actividade; cancelável; "as minhas inscrições" | **Já existe no backend e no cliente da API**; falta só a interface nova |

**Proposta:**

1. **"O que já fizemos" vem das publicações**, não do código. Uma acção realizada é uma
   publicação com data, local e fotografias (a preto e branco, `docs/MARCA.md`). A página
   da Gamek passa a ser a primeira publicação; o endereço antigo redirecciona para ela.
   Cada acção tem a sua página, fácil de partilhar por WhatsApp.
2. **"Próximas actividades" vem das actividades de voluntariado**, com data, local e vagas
   restantes. Públicas, sem conta.
3. **"Quero participar"** numa actividade: sem conta, abre a entrada e **volta à mesma
   actividade** depois de entrar; voluntário aprovado inscreve-se com um toque (a API já
   o faz); quem ainda não é voluntário é levado à candidatura, e fica a saber que a
   inscrição depende da aprovação.
4. **Ser voluntário** (a candidatura geral que já existe) continua, para quem quer ajudar
   sem uma actividade em concreto.
5. **Números reais no topo** (actividades realizadas, voluntários activos), calculados a
   partir dos dados, nunca escritos à mão.

**Trabalho de backend novo (PR próprio, com revisão):** só uma forma de marcar as
publicações que são relatos de actividade (por exemplo, uma categoria), para a
Comunidade não mostrar notícias gerais. A inscrição por actividade já existe (corrigido
a 2026-09-30, depois de auditar o código). Conteúdo: `docs/INVENTARIO_CONTEUDO.md`.

## 6. Rodapé

```
┌──────────────────────────────────────────────────────────────────────────┐
│ Precisa de ajuda?   +244 926 969 819 · janelasparaalma18@gmail.com         │  ← faixa de contacto
├──────────────────────────────────────────────────────────────────────────┤
│ Serviço              Instituição            Ajuda                          │
│ Rastreio             Sobre nós e impacto    Perguntas frequentes           │
│ Treinos em casa      Equipa                 Suporte                        │
│ Clínicas parceiras   Publicações            Contactos                      │
│ Preços e Premium     Apoiar · Voluntariado  Para clínicas (entrar)         │
├──────────────────────────────────────────────────────────────────────────┤
│ [Logótipo com assinatura]   Luanda, Angola · Instagram @janelas_para_alma  │
│ Este serviço é triagem e não substitui uma consulta médica.                │
│ Privacidade · Termos · Português / English              © 2026            │
└──────────────────────────────────────────────────────────────────────────┘
```

- **Contactos reais** (tirados do site actual, 2026-09-30): telefone +244 926 969 819,
  email janelasparaalma18@gmail.com, Instagram @janelas_para_alma, Luanda. A instituição
  **não tem NIF**: não se mostra nenhum número de registo.
- **Não há Facebook nem LinkedIn da instituição:** o rodapé actual tem esses botões a
  apontar só para `facebook.com` e `linkedin.com`. Saem; só entram redes que existam.
- Horário de atendimento: só se o dono do projecto o definir.
- **A faixa de contacto vem primeiro:** num serviço de saúde, poder falar com alguém é
  a maior prova de que há pessoas reais por trás (NN/g, confiança).
- **3 colunas**, não 5. No telemóvel ficam empilhadas e **abertas** (nada escondido em
  acordeões).
- O **logótipo completo com assinatura** vive aqui: é onde há largura para a assinatura
  se ler (`docs/MARCA.md` §2).
- **Aviso clínico permanente** e dados legais da instituição: confiança e obrigação.
- Na app (com sessão), não há rodapé grande: a barra de separadores ocupa esse lugar e
  as ligações legais ficam em Perfil.
- Na consola (admin e clínica), nem cabeçalho de site nem rodapé: layout próprio.

---

## 7. Mapa de páginas (os endereços actuais mantêm-se)

Mudar endereços parte ligações partilhadas e o Google. Os endereços actuais ficam; só
muda o sítio onde cada página aparece no menu. Se algum mudar, fica um redireccionamento.

| Grupo no menu | Páginas actuais |
|---|---|
| Rastreio | `Scanner`, `ScannerResultados` |
| Treinos | `Exercicios` (+ progresso e relatório) · na app: Hoje (`DashboardUser`), Jogo |
| Clínicas | `ClinicalPartners` / marcação, `PortalClinicoOptioptika`, `Parceiros` (para clínicas) |
| Sobre ▾ | `Impacto` (história e impacto), `Sobre` (o que é o estrabismo), `Equipa`, `Publicacoes`, `JunteSe` (contactos), `Tecnologia` |
| Comunidade ▾ | `Kamba` (Meu Kamba Estrábico: actividades e voluntariado, §5b), `Apoiar` (doar), `Circular` (doar óculos usados), `CampanhaGamek` (passa a publicação; o endereço redirecciona) |
| Rodapé / ajuda | `Faq`, `Suporte`, `PoliticaPrivacidade`, `TermosUtilizacao` |

---

## 8. O que torna isto profissional, e não "feito por IA"

Os sinais de um site gerado a partir de um pedido genérico, e o que fazemos no lugar:

| Sinal de site genérico | Aqui |
|---|---|
| Título vago ("Transformando vidas através da visão") | Título com o resultado concreto para quem lê |
| Abertura centrada com gradiente e fotografia de banco | Composição assimétrica com o produto real e a marca (janela, lente) |
| Três cartões de "funcionalidades" com ícones | Passos com capturas reais e uma demonstração que se toca |
| Estatísticas redondas e inventadas ("10.000+ vidas") | Só números reais, com data; se não houver, não há secção |
| Testemunhos de banco de imagens | Só testemunhos reais, com consentimento (há crianças); senão, nenhum |
| Todas as secções com a mesma forma | Ritmo editorial: largura, alinhamento e densidade variam |
| Tudo arredondado, sombras, gradientes, vidro | Decoração só da marca, com parcimónia; profundidade só onde separa camadas |
| Cada secção "aparece" ao descer a página | Só os momentos do catálogo (PESQUISA_UX §6) |
| Ícones e emojis em todo o lado | Um só conjunto de ícones, só quando ajudam a ler |
| Texto de marketing inflacionado | pt-AO simples, nas palavras que os pais usam |
| Rodapé com newsletter e 5 colunas | Contacto humano primeiro, 3 colunas, aviso clínico |

**Como se prova:** cada ecrã novo passa por esta tabela antes de ser aprovado, e as
jornadas são testadas com pais reais (Fase 0 e Fase 3).
