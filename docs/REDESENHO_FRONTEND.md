# Redesenho total do frontend — "Da visão turva à visão nítida"

> **Sprint 7 do backlog** (`docs/BACKLOG.md`). Documento de referência vivo: quando alguém
> falar do "sprint de redesenho", "reengenharia do frontend" ou "novo visual", é este o
> ponto de partida. Actualizar aqui cada decisão tomada — nunca decidir de memória.
>
> - **Estado:** proposta aprovada para discussão, **nada implementado** (2026-09-28).
> - **Pedido do dono do projecto (2026-09-28):** o frontend está "muito artificial,
>   genérico e perceptível de que foi feito com um Lovable da vida". Tem de ficar único,
>   com impressão própria. Também: problemas de usabilidade, inconsistência entre páginas,
>   "falta de suco". Âmbito: **tudo** — site público, área do utilizador, jogo, portal da
>   clínica e painel admin.
> - **Versão visual publicada** (privada, partilhar pelo menu Share):
>   https://claude.ai/artifact/Udd7vt7MAXnspeJ7ufcbtB
> - Elaborado com três chapéus: UX, UI e arquitectura de soluções. Todos os números da
>   secção 1 foram medidos no código, não estimados.

---

## 0. Resumo

O problema não é o site ser "feio". São **três falhas sobrepostas**:

1. **Não tem identidade** — parece um template.
2. **Não tem sistema** — cada página decide sozinha como se estilizar.
3. **Tem dívidas de UX** que se sentem em telemóvel e em rede lenta.

**Recomendação:** não reescrever tudo de uma vez. Primeiro define-se uma identidade e um
design system em código; depois as páginas migram para ele **por jornada**, começando
pelas que mais pesam na saúde e no negócio. Cada fase vai para produção sozinha, sem
partir o que já funciona.

**Tese de identidade:** um produto de saúde visual tem de ser o site mais fácil de ler que
as pessoas visitam. A acessibilidade deixa de ser requisito técnico escondido e passa a
ser a própria marca — tipografia hiperlegível, contraste alto, alvos grandes, calma
visual. É algo que nenhum template genérico tem, e é verdadeiro para este produto e mais
nenhum.

---

## 1. Exame do estado actual (medido em 2026-09-28)

| Achado | Medida | O que significa |
|---|---|---|
| Páginas | 56 · ~15.700 linhas | Público, app, jogo, clínica e admin partilham o mesmo visual |
| Componentes base (shadcn, `components/ui/`) | 49 | Usados quase de fábrica — principal origem do "ar de template" |
| Componentes próprios (fora de `ui/`) | 49 | |
| Gradientes `bg-gradient-to-*` | 44 | Decoração típica de gerador, raramente comunica algo |
| Cantos `rounded-2xl/3xl` | 99 | Tudo arredondado ao máximo e igual — a hierarquia desaparece |
| Animações `animate-*` e `hover:scale-*` | 117 | Movimento espalhado sem vocabulário comum; cansa, sobretudo crianças |
| Sombras `shadow-lg/xl/2xl` | 27 | Profundidade como enfeite, não para separar camadas |
| Tipografia | 1 família (Ubuntu, `src/index.css`) | A Ubuntu é a letra do manual da marca (`docs/MARCA.md`) e fica; o que falta é escala e pesos definidos |
| Tokens | estrutura shadcn por omissão + `--navy`, `--teal`, `--gold`, `--radius: 0.75rem` | Paleta existe mas não há sistema semântico |
| Layout partilhado | 38 páginas importam Navbar/Footer à mão | Só `AdminLayout.tsx` usa `<Outlet>`; mudança global = 38 edições |
| Carregamento das rotas | 56 imports estáticos em `App.tsx`, 0 `React.lazy` | O site inteiro desce num só bundle — em dados móveis angolanos é UX |
| Monólitos | `Navbar.tsx` 798 · `JogoCuriosidades.tsx` 1.092 · `ScannerResultados.tsx` 946 linhas | Têm de ser decompostos antes de redesenhados |
| Cores escritas à mão | `#FFD500`, `#B89600` (Optioptika) | Fora dos tokens |
| Tema escuro | 1 bloco `.dark` | Praticamente inexistente |
| Restos do Lovable | 9 ficheiros `src/assets/*.asset.json` | Apontam para o CDN interno do Lovable (`/__l5e/...`); nada os usa — apagar |
| Rede de segurança | 64 ficheiros de teste · i18n pt-AO/en-US (~2.100 linhas) | Ponto forte: os testes procuram por papel/texto e sobrevivem a um redesenho |

**Dívidas de UX já registadas no backlog:** UX-08 (ordem de secções, scroll em falta num
modal, âncoras que não levam ao topo, botão Voltar pouco visível); `ScannerResultados`
com 6 categorias de diagnóstico no ecrã mas só 2 produzidas pelo cálculo real (CLAUDE.md
§11, backlog W-09); `DashboardUser` com "Próxima teleconsulta" estática apesar de a
teleconsulta já existir (Sprint 4, Fase 2).

---

## 2. Diagnóstico

| Problema | Gravidade | Causa de fundo |
|---|---|---|
| Aspecto genérico, "feito com Lovable" | Alta | Componentes e tokens de fábrica, decoração sem intenção, sem fotografia nem voz próprias |
| Inconsistência entre páginas | Alta | Sem design system nem layouts partilhados |
| Lentidão em rede móvel | Alta | Bundle único; imagens sem formatos modernos nem tamanhos responsivos |
| Três públicos num só visual | Média | Pais e crianças, profissionais de saúde e administradores precisam de densidades diferentes |
| Falta de "suco" | Média | Movimento espalhado em vez de momentos pensados; microcopy e estados vazios pouco cuidados |
| Manutenção cara | Info | Monólitos e duplicação tornam cada mudança lenta e arriscada |

---

## 3. Princípios de design

> A justificação de cada princípio e padrão, com fontes (NHS, GOV.UK, WCAG 2.2, NN/g,
> Baymard, dados de Angola), está em `docs/PESQUISA_UX.md`.

1. **Legível acima de tudo** — WCAG 2.2 AA no mínimo, AAA no texto corrido; tipografia
   pensada para baixa visão; alvos de toque de 44px. Se um ecrã não se lê bem, não está
   pronto.
2. **Clínico sem ser frio** — confiança de consultório, calor de família. Rigor na
   informação de saúde, suavidade no tom e na forma.
3. **Angolano de verdade** — fotografia real de pessoas angolanas em vez de banco de
   imagens, linguagem pt-AO, contexto local, feito com quem conhece o país.
4. **Leve por defeito** — dados móveis custam dinheiro. Orçamento de performance fixo por
   página; cada imagem e biblioteca justifica o peso.
5. **Calma para crianças** — movimento com propósito e um só vocabulário; nada pisca sem
   razão; respeitar sempre `prefers-reduced-motion`.
6. **Um só ADN, três densidades** — mesma marca, ritmos diferentes.

### Três modos de experiência

| Modo | Para quê | Páginas | Densidade |
|---|---|---|---|
| **Site** | Contar a história | Início, Sobre, Estrabismo, Equipa, Parceiros, Apoiar, Publicações, legais | Baixa · espaço generoso, editorial, poucas acções claras |
| **App** | Fazer a terapia | Dashboard, Triagem Ocular, Resultados, Exercícios, Jogo, Perfil, Premium | Média · uma tarefa de cada vez, feedback imediato, alvos grandes |
| **Consola** | Trabalhar | Portal da clínica (`DashboardPro`), painel admin | Alta · tabelas, filtros, estados de relance, zero decoração |

---

## 4. Arquitectura da solução

1. **Tokens em três camadas**, em variáveis CSS lidas pelo Tailwind — fonte única para
   cor, tipo, espaço, raio, sombra e movimento:
   - *Primitivos* (`--teal-600`, `--sand-100`, `--space-4`) — a paleta crua;
   - *Semânticos* (`--color-action`, `--color-surface`, `--text-body`) — o significado;
   - *Componente* (`--button-bg`, `--card-border`) — só onde é preciso.
   Tema claro/escuro e os três modos trocam só a camada semântica.
2. **Manter o Radix, trocar a pele.** Os 49 componentes shadcn assentam em Radix, que já
   resolve teclado, foco e leitores de ecrã. Reestilizar pelos tokens em vez de reescrever;
   acrescentar componentes próprios onde o produto precisa (cartão de exercício, régua de
   acuidade, estados de consulta).
3. **Layouts partilhados:** `SiteLayout`, `AppLayout`, `ConsoleLayout` com `<Outlet>`,
   substituindo os 38 imports manuais. A `Navbar` (798 linhas) divide-se uma por modo.
4. **Carregamento por rota:** `React.lazy` em todas as rotas; exercícios, jogo e admin em
   blocos próprios. Imagens em AVIF/WebP com `srcset`.
5. **Migração em estrangulamento (strangler fig):** sistema novo convive com o antigo;
   cada página migra quando a sua jornada migra; só entra em produção com testes verdes;
   no fim apagam-se os tokens antigos. Nunca um "grande dia" de lançamento.
6. **Redes de segurança no CI:**
   - regressão visual (capturas Playwright por página, tema e idioma);
   - acessibilidade automática (axe, zero violações sérias);
   - orçamento de performance (build falha acima do limite de JS inicial);
   - os 64 testes actuais ficam como estão — garantem que o comportamento não muda.
7. **Mantém-se:** React + Vite + TypeScript + Tailwind + Radix, i18n pt-AO/en-US
   (`src/i18n/`, com `codigo-fonte.test.ts` e `locales.test.ts`), todas as regras do
   CLAUDE.md §6 (hidratar uma vez, nunca sucesso antes do erro, exercícios sem câmara).

---

## 5. Plano por fases

Cada fase é entregável sozinha. A "acuidade" marca quão nítido fica o produto.

### Fase 0 · Descoberta — 6/60 · ≈ 2 semanas · só investigação
- Entrevistas curtas com 6 a 8 pessoas: pais, equipa clínica (Optioptika), voluntários,
  crianças acompanhadas pelos pais.
- Auditoria heurística e de acessibilidade de todas as páginas, em telemóvel real e 3G
  simulado.
- Mapa das **cinco jornadas críticas**: (1) primeiro rastreio, (2) iniciar o teste de 7
  dias e passar a Premium, (3) marcar consulta, (4) fazer uma sessão de exercício,
  (5) decidir um pedido no admin.
- Medir a linha de base (tempos, conversões, Lighthouse).
- **Pronto quando:** relatório com as dores reais priorizadas e números de partida.

### Fase 1 · Identidade e design system — 6/36 · ≈ 3 a 4 semanas
- Duas ou três direcções de identidade em moodboard; o dono do projecto escolhe uma.
  **Desde 2026-09-29 as direcções partem do manual de marca** (`docs/MARCA.md`): mudam
  a forma de usar a marca, não a marca.
- Escala de tipo em Ubuntu (a letra da marca), papéis das cores da paleta e contraste
  verificado nos dois temas.
- Direcção de fotografia e ilustração, iconografia própria, vocabulário de movimento,
  voz e microcopy.
- Biblioteca de componentes em Figma espelhada em tokens no código, documentada numa
  página viva.
- **Pronto quando:** tokens no repositório e página de referência com todos os
  componentes nos dois temas.
- **Execução (local, ramo `redesenho/frontend`):**
  - [x] Tokens definitivos da direcção A (`src/design/tokens.ts`), CSS gerado e testado,
    tema do Tailwind com nomes que não colidem com o site antigo (2026-09-30)
  - [x] Ubuntu auto-alojada (sai o `@import` do Google); movimento e tema (2026-09-30)
  - [x] Guardas de código e de acessibilidade (axe) (2026-09-30)
  - [x] Montra `/_montra` (2026-09-30)
  - [x] Botao, Campo, Indicador (2026-09-30)
  - [ ] Passos, Aviso, Cartao, EstadoVazio, Esqueleto, Dialogo
  - [ ] Cabeçalho do site e menu no telemóvel, barra de separadores da app, rodapé
  - [ ] Página inicial com a estrutura de `docs/ESTRUTURA_SITE.md` §5

### Fase 2 · Fundações técnicas — 6/24 · ≈ 2 semanas · quase invisível
- Três layouts partilhados; `Navbar` dividida por modo.
- `React.lazy` por rota; imagens optimizadas.
- Reestilizar os componentes base pelos tokens novos.
- Regressão visual, axe e orçamento de performance no CI.
- Apagar os restos do Lovable (`*.asset.json`) e as cores escritas à mão.
- **Pronto quando:** site mais leve e consistente sem ter mudado de cara, e o CI protege
  tudo o que vem a seguir.

### Fase 3 · As jornadas que mais importam — 6/12 · ≈ 3 a 4 semanas
- Início, Triagem Ocular, Resultados e marcação de consulta.
- Corrigir aqui as 6 categorias de diagnóstico que o cálculo não produz.
- Registo, teste de 7 dias e passagem a Premium.
- **Pronto quando:** as três primeiras jornadas críticas batem a linha de base em tarefa
  concluída e tempo, testadas com pessoas reais.

### Fase 4 · A app do dia a dia — 6/9 · ≈ 4 semanas
- Dashboard do utilizador com a próxima teleconsulta real.
- Os 8 exercícios. **Mudança de direcção (2026-09-28):** deixaram de usar webcam — são
  testes de triagem e treinos com resposta do utilizador (ver CLAUDE.md §1 e §6, W-18). O
  que o redesenho muda é só a moldura: a lógica em `lib/visao/`, os assistentes em
  `components/visao/` e o palco branco (medição) mantêm-se.
- Jogo Inclusivamente — decompor `JogoCuriosidades.tsx` antes de redesenhar.
- **Pronto quando:** uma criança começa e termina um exercício e uma partida sem ajuda.

### Fase 5 · Consola e acabamento — 6/6 · ≈ 3 semanas
- Portal da clínica e painel admin em modo Consola.
- Restantes páginas institucionais e legais.
- Remover tokens antigos; o sistema velho deixa de existir.
- **Pronto quando:** nenhuma página no visual antigo e todos os critérios da secção 6
  cumpridos.

**Duração indicativa:** 17 a 19 semanas com uma pessoa de design e uma de
desenvolvimento em paralelo; o dobro com uma só pessoa. Fases 3 a 5 podem sobrepor-se
depois de a 2 fechar.

---

## 6. Critérios de sucesso

| Indicador | Meta | Como se mede |
|---|---|---|
| Acessibilidade | WCAG 2.2 AA · Lighthouse Accessibility 100 | axe no CI + auditoria manual com leitor de ecrã |
| Performance em telemóvel | LCP < 2,5 s · CLS < 0,1 | Lighthouse em 3G simulado, páginas das jornadas críticas |
| Peso inicial | JS inicial ≤ 170 KB gzip | Orçamento no build |
| Tarefa concluída | ≥ 90 % nas 5 jornadas | Testes de usabilidade antes e depois |
| Percepção | SUS ≥ 80 | Questionário no fim dos testes |
| Negócio | Subir teste → Premium e pedidos de consulta | Comparar com a linha de base da Fase 0 |
| Consistência | 0 cores fora dos tokens | Regra de lint no CI |

---

## 7. Riscos

| Risco | Gravidade | Mitigação |
|---|---|---|
| Reescrever tudo de uma vez e nunca terminar | Alta | Estrangulamento; cada fase vai para produção sozinha |
| Partir comportamento que funciona | Alta | 64 testes intactos; regressão visual e axe no CI |
| Identidade genérica outra vez | Alta | Tudo parte do manual da marca (`docs/MARCA.md`); fotografia real angolana; sem designer, cada proposta é revista contra os princípios e aprovada pelo dono no laboratório |
| Estragar os exercícios | Média | Lógica em `lib/visao/` com testes; só a moldura muda; palco sempre branco; CLAUDE.md §6 |
| Textos EN maiores que PT | Média | Desenhar com as duas línguas; regressão visual nos dois idiomas |
| Âmbito a crescer a meio | Média | Funcionalidades novas ficam fora, salvo decisão explícita |

**O que não fazer:** trocar de framework (o problema é a pele e a falta de sistema, não
React/Vite/Tailwind/Radix); desenhar primeiro em código (a identidade decide-se em Figma e
com pessoas); meter funcionalidades novas no meio; usar banco de imagens ou ilustrações
genéricas "de startup".

---

## 8. Decisões pendentes do dono do projecto

Por responder antes da Fase 0. Registar a resposta e a data aqui quando decidido.

| # | Decisão | Resposta |
|---|---|---|
| 1 | A marca muda ou fica? (logótipo e nome, ou rever também na Fase 1) | **Fica** (2026-09-29). Existe um manual de marca ("Um Olhar Alinhado", XANUS PRO, 2025): logótipo, paleta e Ubuntu são fixos. Especificação para o site em `docs/MARCA.md` |
| 2 | Há orçamento para designer, ilustrador ou fotógrafo angolano? | *pendente* |
| 3 | Quem desenha? (designer dedicado, Lukeny, ou design proposto pelo Claude com aprovação a cada passo) | **Sem designer** (2026-09-29): propostas feitas em código no laboratório, aprovadas pelo dono do projecto a cada passo. As regras ficam escritas em `docs/MARCA.md`, `docs/PESQUISA_UX.md` e `docs/SISTEMA_DESIGN.md`, para a consistência não depender de uma pessoa |
| 4 | Qual jornada vem primeiro? (proposta: rastreio e marcação; alternativa: conversão Premium) | **Rastreio e marcação** (2026-09-30) |
| 5 | Tema escuro entra no âmbito? (barato se pensado na Fase 1, caro depois) | **Sim** (2026-09-30) |
| 6 | Há conta Figma para a equipa? (o plano gratuito chega para começar) | **Não é precisa** (2026-09-30): sem designer, o design faz-se em código no laboratório |

---

## 9. Registo de discussões e detalhes

Acrescentar abaixo, com data, o que for decidido ou detalhado em cada conversa sobre o
redesenho (referências visuais, páginas a priorizar, gostos e recusas do dono do
projecto, feedback do Lukeny). Mais recente em cima.

- **2026-09-30** — **Direcção escolhida: A · Clínica** (azul do logótipo como cor de
  acção, muito branco/neutro, Ubuntu, o símbolo que se alinha). Passa a ser a base dos
  tokens definitivos (Fase 1). Inventário do conteúdo actual, com o que fica, se reescreve
  e sai, em `docs/INVENTARIO_CONTEUDO.md` (6 perguntas ao dono na secção 4).
- **2026-09-30** — Respostas do dono: contactos reais tirados do site actual (telefone
  +244 926 969 819, janelasparaalma18@gmail.com, Instagram @janelas_para_alma); sem NIF;
  LT Renovate autorizada; o manual não entra no repositório; fotografias à espera de
  resposta. "Comunidade ▾" (Meu Kamba Estrábico) entra no menu, com actividades vindas
  das publicações e campanhas das actividades de voluntariado (`docs/ESTRUTURA_SITE.md`
  §5b). Primeira jornada: rastreio e marcação (decisão 4). Tema escuro no âmbito
  (decisão 5).
- **2026-09-30** — Estrutura do site novo em `docs/ESTRUTURA_SITE.md`: cabeçalho com 5
  destinos e "Entrar" sempre visível (também no telemóvel), uma só porta de entrada
  (email primeiro, Google, registo só quando faz falta), página inicial pela ordem das
  perguntas do pai, rodapé com contacto humano e aviso clínico, e a lista do que torna um
  site "genérico de IA" com a nossa alternativa. Por confirmar: o lugar de `Kamba`,
  `Circular` e `CampanhaGamek`.
- **2026-09-29** — Não há designer no projecto: o design é proposto em código e aprovado
  pelo dono (decisão 3). Letra: Ubuntu para todos, com a Atkinson Hyperlegible Next
  como opção de leitura fácil. Acrescentados a navegação por modo, o catálogo de
  momentos ("suco") e a qualidade dos componentes (`docs/PESQUISA_UX.md` §5-7), e as
  regras de código do sistema de design (`docs/SISTEMA_DESIGN.md`), com o código novo
  em TypeScript estrito (`npm run typecheck:redesenho`).
- **2026-09-29** — O dono do projecto entregou o manual de marca "Identidade Visual Um
  Olhar Alinhado" (XANUS PRO, 2025) e pediu para o respeitar. Consequências: a marca
  fica (decisão 1); as três direcções do laboratório (`/_laboratorio`, só local no ramo
  `redesenho/frontend`) passaram a usar o logótipo, a paleta e a Ubuntu do manual e
  diferem só no uso (A Clínica, B Viva, C Humana); a Atkinson Hyperlegible saiu. Pesquisa
  de UX em `docs/PESQUISA_UX.md`; especificação da marca, lacunas do manual e perguntas
  em aberto em `docs/MARCA.md`.

- **2026-09-28** — Plano criado. Discussão detalhada sobre o frontend marcada para mais
  tarde no mesmo dia.
