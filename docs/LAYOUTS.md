# Arquétipos de página: cada tipo de página com a sua composição

> Redesenho (Sprint 7), direcção A. Pedido do dono do projecto (2026-09-30): "todas as
> páginas de login, homepage ou onboarding parecem iguais, só mudam as cores e os
> logótipos". É o sinal mais claro de um site gerado: um só esqueleto (cabeçalho, bloco
> centrado, rodapé) repetido em todo o lado.
>
> A regra aqui: **a forma da página nasce do que a pessoa vai lá fazer.** Ler e decidir,
> entrar, cumprir uma tarefa, voltar todos os dias, trabalhar, consultar um texto: são
> seis actividades diferentes, e cada uma tem a sua composição, não só a sua cor.
> Complementa `docs/ESTRUTURA_SITE.md` (conteúdo e navegação) e `docs/SISTEMA_DESIGN.md`
> (código).

---

## 1. O que muda de um arquétipo para outro

Não é a cor nem o logótipo. São estas oito dimensões:

| Dimensão | Site | Entrada | Tarefa | App | Consola | Documento |
|---|---|---|---|---|---|---|
| **Para quê** | Ler e decidir | Entrar ou criar conta | Fazer uma coisa do princípio ao fim | Voltar todos os dias | Trabalhar em lista | Ler com atenção |
| **Cabeçalho** | Completo, 5 destinos | Nenhum (só o logótipo no painel) | Mínimo: símbolo, passo, "Sair" | Compacto: saudação e avatar | Barra lateral | Do site |
| **Rodapé** | Completo | Nenhum | Nenhum | Nenhum (barra de separadores) | Nenhum | Do site |
| **Largura útil** | Larga, 12 colunas, assimétrica | Duas metades; o formulário numa coluna estreita | Uma coluna estreita (~36 rem) | Média, grelha de cartões | Total | Coluna de leitura (65 caracteres) + índice |
| **Densidade** | Baixa, muito espaço | Baixa | Mínima: uma pergunta por ecrã | Média | Alta | Baixa, ritmo de leitura |
| **Presença da marca** | Alta: símbolo, fotografia, destaque | Alta, mas só num painel | Quase nenhuma: foco na tarefa | Baixa: é da pessoa | Nenhuma | Baixa |
| **Acção principal** | Uma por secção | Uma, no fim do formulário | Fixa em baixo no telemóvel (zona do polegar) | Um "próximo passo" no topo | Várias, em linha | Nenhuma |
| **Fundo** | Faixas alternadas fundo/superfície, uma faixa marinho | Metade marinho, metade superfície | Superfície lisa, sem distracções | Fundo com cartões | Superfície | Superfície, como papel |

---

## 2. Os arquétipos

### 2.1 Site (página inicial, Quem somos, Comunidade, Estrabismo)

Contar uma história e levar a uma decisão. Composição editorial: **alterna largura,
alinhamento e densidade** de secção para secção (nunca "título centrado + 3 cartões"
repetido).

```
Telemóvel                         Computador
┌──────────────────────┐          ┌──────────────────────────────────────────────┐
│[símbolo] Entrar  Menu│          │[logo] Rastreio Treinos Clínicas Comunidade▾ … │
├──────────────────────┤          ├──────────────────────────────────────────────┤
│Título grande         │          │Título grande, 7 col.      │ produto real,   │
│com a palavra em      │          │texto, 1 acção             │ 5 col.,         │
│destaque              │          │                           │ desalinhado     │
│[ Fazer o rastreio ]  │          ├──────────────────────────────────────────────┤
│produto real          │          │ lista editorial numerada, coluna estreita    │
├──────────────────────┤          ├──────────────────────────────────────────────┤
│…                     │          │ faixa marinho a toda a largura               │
│[barra fixa: rastreio]│          ├──────────────────────────────────────────────┤
└──────────────────────┘          │ rodapé                                        │
                                  └──────────────────────────────────────────────┘
```

### 2.2 Entrada (entrar, criar conta, recuperar password)

Um momento de confiança, não uma página de marketing. **Ecrã dividido**: à esquerda um
painel marinho com o símbolo que se alinha, uma frase e três factos de confiança; à
direita o formulário, numa coluna estreita, sobre superfície. Sem cabeçalho nem rodapé
do site: só o logótipo no painel e "Voltar ao site". No telemóvel, o painel encolhe a
uma faixa curta no topo e o formulário ocupa o resto.

```
Telemóvel                         Computador
┌──────────────────────┐          ┌───────────────────┬──────────────────────────┐
│▓ símbolo · frase    ▓│          │▓                 ▓│  Entrar                  │
├──────────────────────┤          │▓   símbolo        ▓│  [Continuar com Google]  │
│Entrar                │          │▓   "Ver bem       ▓│  ──── ou ────            │
│[Google]              │          │▓    começa por    ▓│  Email [          ]      │
│Email [            ]  │          │▓    saber."       ▓│  [ Continuar ]           │
│[ Continuar ]         │          │▓   ✓ ✓ ✓ factos   ▓│                          │
└──────────────────────┘          └───────────────────┴──────────────────────────┘
```

### 2.3 Tarefa (rastreio, marcação, pagamento, onboarding, teste de 7 dias)

Uma coisa de cada vez, sem saídas por engano. **Sem navegação do site**: só o símbolo
(sem ligação que tire da tarefa), o indicador de passos e "Sair" (com confirmação se
houver algo por guardar). Uma coluna estreita, uma pergunta por ecrã; no telemóvel a
acção principal fica **fixa em baixo**, ao alcance do polegar; no computador fica no fim
da coluna. A marca quase desaparece: a atenção é da tarefa.

```
Telemóvel                         Computador
┌──────────────────────┐          ┌──────────────────────────────────────────────┐
│◉  Passo 2 de 4  Sair │          │◉                 Passo 2 de 4          Sair  │
│━━━━━━━━──────────────│          │                                              │
│                      │          │            ┌──────────────────┐              │
│Vamos usar a câmara   │          │            │Vamos usar a câmara│             │
│texto curto           │          │            │texto curto        │             │
│                      │          │            │[ Continuar ]      │             │
├──────────────────────┤          │            └──────────────────┘              │
│[   Continuar       ] │          │                                              │
└──────────────────────┘          └──────────────────────────────────────────────┘
```

### 2.4 App (Hoje, Treinos, Jogo, Consultas, Perfil)

Voltar todos os dias e saber logo o que fazer. **Cabeçalho compacto** com a saudação
pelo nome e o avatar; por baixo, **um único "próximo passo"** em destaque (o treino de
hoje, a consulta de amanhã) e depois uma grelha de cartões. Navegação: **barra de
separadores em baixo** no telemóvel; **barra lateral estreita** no computador. Sem
rodapé.

```
Telemóvel                         Computador
┌──────────────────────┐          ┌─────┬────────────────────────────────────────┐
│Olá, Ana         (A)  │          │ ◉   │ Olá, Ana                          (A)  │
├──────────────────────┤          │Hoje │ ┌──────────────────────────────────┐   │
│┌────────────────────┐│          │Trein│ │ Próximo passo: treino de hoje    │   │
││Próximo passo       ││          │Jogo │ └──────────────────────────────────┘   │
│└────────────────────┘│          │Cons.│ ┌──────────┐ ┌──────────┐ ┌─────────┐  │
│┌─────────┐┌────────┐│          │Perf.│ │evolução  │ │sequência │ │consulta │  │
││         ││        ││          │     │ └──────────┘ └──────────┘ └─────────┘  │
├──────────────────────┤          └─────┴────────────────────────────────────────┘
│Hoje Trein Jogo Cons P│
└──────────────────────┘
```

### 2.5 Consola (portal da clínica, admin)

Trabalhar: listas, filtros, estados de relance. Barra lateral fixa, tabela a toda a
largura, zero decoração. (Fase 5.)

### 2.6 Documento (Política, Termos, artigo do estrabismo)

Ler com atenção. Coluna de leitura de 65 caracteres, texto a 18 px com entrelinha 1,7,
títulos numerados; no computador, um índice fixo à esquerda que acompanha a leitura.

---

## 3. Regras comuns a todos (o que torna o sistema coeso)

- **Os mesmos tokens, as mesmas margens laterais** (16 px no telemóvel, 24 px no tablet,
  32 px no computador) e as mesmas larguras nomeadas: `leitura` (36 rem), `texto`
  (42 rem), `conteudo` (72 rem), `largo` (80 rem).
- **Ritmo vertical em múltiplos de 8 px**; espaço entre secções: 64 px no telemóvel, 96 px
  no computador (Site), metade disso na App.
- **"Saltar para o conteúdo"** como primeiro elemento focável, em todos os arquétipos.
- **Um só `<h1>` por página**, e os marcos (`header`, `nav`, `main`, `footer`) correctos:
  quem usa leitor de ecrã salta entre eles.
- A passagem de um arquétipo a outro é visível e com sentido: sair do Site para uma Tarefa
  "tira o barulho"; entrar na App "torna a página da pessoa".

## 4. Onde vive no código

`src/design/layouts/`: `LayoutSite`, `LayoutEntrada`, `LayoutTarefa`, `LayoutApp` (a
Consola e o Documento vêm nas fases 5 e 3). Cada um recebe o conteúdo e o texto por
propriedades (sem texto embutido). Protótipos à escala real, só em desenvolvimento, em
`/_montra/prototipos/*`, para ver os arquétipos lado a lado.
