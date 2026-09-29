# Guia de revisão do PR: exercícios sem webcam

Este guia serve para ler o diff da branch `frontend/exercicios-sem-webcam` com método,
sem ter de percorrer os ~85 ficheiros por ordem alfabética. As linhas indicadas são do
estado da branch quando este guia foi escrito. Se mudarem, procure pelo nome da função.

Para ver o diff completo:

```bash
git diff origin/main...HEAD --stat
```

## 1. Ordem de leitura, por risco

### (a) Migração e API — risco alto, exige revisão humana (CLAUDE.md §9)

1. `api/alembic/versions/b2c6e9a4d1f8_exercicios_visao_sem_webcam.py` — colunas, CHECKs,
   índice e downgrade. Há análise completa em `docs/REVISAO_MIGRACAO_b2c6e9a4d1f8.md`.
2. `api/app/repositories/orm_models.py` — `Utilizador` (perfil visual, ~l. 133-140, e os
   CHECKs em `__table_args__`) e `SessaoExercicio` (~l. 395-415).
3. `api/app/schemas/sessao_exercicio.py` — validação dos campos novos (`versao: Literal[1, 2]`,
   l. 30) e o limite de tamanho de `sinais`.
4. `api/app/repositories/sessoes_exercicio_repository.py` e
   `api/app/routers/sessoes_exercicio.py` — `POST` com os campos novos; `GET` novo,
   `listar_minhas_sessoes` (l. 70), com o `user_id` tirado sempre do JWT.
5. `api/app/schemas/perfil.py`, `api/app/repositories/perfil_repository.py` — perfil visual.
6. `api/app/repositories/eliminacao_conta_repository.py` (l. 83) — a anonimização limpa o
   perfil visual.
7. `api/app/services/acesso_exercicios_service.py` — **só um comentário**; ver a secção 3.
8. Testes: `api/tests/routers/test_sessoes_exercicio_router.py`,
   `api/tests/routers/test_perfil_router.py`.

### (b) `frontend/src/lib/visao/` — lógica pura, com testes

Ler cada módulo ao lado do seu teste: `geometria`, `calibracao`, `escada`, `contraste`,
`estereograma`, `tempoActivo`, `treino`, `resultados`, `progresso`, `respiracao`, `ids`.
Os testes estão em `*.test.ts` na mesma pasta (`regras.test.ts` cobre tempo activo,
resultados, treino e progresso).

### (c) Componentes e páginas

1. `frontend/src/components/exercises/BaseExercise.tsx` — a casca, agora sem câmara (o
   bloqueio de acesso é o mesmo de antes).
2. `frontend/src/components/visao/` — `hooks.ts` (gravação, histórico, tempo activo),
   `AssistenteTeste.tsx`, `AssistenteTreino.tsx`, `Passos.tsx` (calibração), `SeletorDireccao.tsx`,
   `PalcoVisual.tsx`, `Tarefa*.tsx`, `Resultados.tsx`.
3. `frontend/src/pages/exercises/Teste*.tsx`, `Treino*.tsx`, `ProgressoVisao.tsx`,
   `RelatorioSemanal.tsx`.
4. `frontend/src/App.tsx` e `frontend/src/i18n/rotas.ts` — rotas novas e redireccionamentos.
5. `frontend/src/pages/Exercicios.tsx`, `EditarPerfil.tsx`, `ExercisesSection.tsx`,
   `ScannerResultados.tsx` (só os links para os exercícios), `lib/apiClient.ts`,
   `contexts/ProfileContext.tsx`.

### (d) Traduções

`frontend/src/i18n/locales/pt-AO.json` e `en-US.json`: namespace `Visao` novo, `seo.*` das
rotas novas, e remoção das chaves dos exercícios antigos. Os testes `src/i18n/*.test.ts`
garantem que PT e EN têm as mesmas chaves e que não há português escrito directamente no
código. Para o SEO, ver `docs/REVISAO_SEO_EXERCICIOS.md`.

### (e) Ficheiros removidos

`TrackingExercise.tsx`, `CerebroExercise.tsx`, `ConvergenciaExercise.tsx`,
`RelaxamentoExercise.tsx`, `AmbliopiaExercise.tsx`, `EstereopsiaExercise.tsx`,
`SacadasConvergenciaExercise.tsx`, `FlexibilidadeAcomodativaExercise.tsx`,
`PremiumExercicioEsqueleto.tsx`, `hooks/useEyeTracking.ts`. Basta confirmar que nada os
importa:

```bash
git grep -n "useEyeTracking\|PremiumExercicioEsqueleto\|TrackingExercise\|CerebroExercise" -- frontend/src
```

O resultado esperado é vazio.

## 2. Os 10 pontos de maior risco ou decisão

| # | Ponto | Onde | O que verificar |
|---|---|---|---|
| 1 | **Ângulo visual → píxeis e limite do ecrã** | `frontend/src/lib/visao/geometria.ts:21` (`arcminParaMm`: `distância × tan(arcmin·π/10800)`), `:15` (`MIN_PX_DISPOSITIVO = 1.4`), `:40` (`desenhavel`: `px × devicePixelRatio ≥ 1,4`), `:61` (`niveisDesenhaveis`) | A fórmula usa píxeis CSS (`pxPorMm` da calibração) e o limite usa píxeis de dispositivo. Os níveis abaixo do limite são descartados, não arredondados. |
| 2 | **Escada de teste e de treino** | `frontend/src/lib/visao/escada.ts:71` (`responderTeste`: 3 por nível, passa com 2), `:87`/`:100` (`passarNivel`/`falharNivel`: quando parar), `:147` (`responderTreino`: 2 acertos seguidos sobem, 1 erro desce), `:173` (`limiarTreino`: média das últimas 6 inversões) | O teste pára quando um nível passado fica ao lado de um falhado. Sem nenhum nível lido → `null`. Passar o nível mais pequeno → `atingiuLimite`. |
| 3 | **Gravação das sessões (`versao = 2`)** | `frontend/src/components/visao/hooks.ts:125` (`useRegistoSessao`), `:144` (força `versao: 2`); `api/app/schemas/sessao_exercicio.py:30` (omissão 1) | Nunca mostra "guardado" antes da resposta da API. "Tentar de novo" reenvia só o que falhou. Um bundle antigo sem `versao` grava 1. |
| 4 | **Regra "não sei" do olho mais fraco** | `frontend/src/lib/visao/resultados.ts:47` (`olhoMaisFracoPelaAcuidade`), `frontend/src/components/visao/AssistenteTreino.tsx:105` (`EscolherOlho`), `:143` (sugestão) | "Não leu o maior" conta como o pior resultado. Com empate não sugere nenhum olho. A sugestão só é gravada depois de o utilizador confirmar. |
| 5 | **Tempo activo** | `frontend/src/lib/visao/tempoActivo.ts:10` (`PAUSA_AUTOMATICA_MS = 8000`), `:23` (`registarResposta`); `frontend/src/components/visao/hooks.ts:71` (`visibilitychange`); `AssistenteTreino.tsx:328` (fim de bloco aos 120 s activos) | Só contam intervalos entre respostas até 8 s, com o separador visível. A pausa entre blocos não conta. |
| 6 | **Controlo de atenção** | `frontend/src/lib/visao/treino.ts:19` (`eTentativaDeControlo`: 10.ª, 20.ª…), `:28` (`criarAgendaControlo`, para o Perto e longe), `:54` (`sinaisDeControlo`); `frontend/src/lib/visao/progresso.ts:32` (`contaParaDose`) | Um controlo errado marca `baixa_atencao`, e a sessão não conta para os minutos do dia. O controlo do Perto e longe fica pendente até uma fase "perto" (bug corrigido, com teste de regressão). |
| 7 | **Contraste em luminância linear** | `frontend/src/lib/visao/contraste.ts:14` (sRGB ↔ linear), `:40` (`cinzentoParaContraste`), `:55` (`degrausMostraveis`) | Usa-se sempre o contraste **real** depois de arredondar a 8 bits. São descartados os degraus iguais ao branco, com erro relativo > 25% ou repetidos. |
| 8 | **Estereograma e disparidade** | `frontend/src/lib/visao/estereograma.ts:54` (`gerarPares`), `:58` (metade da disparidade para cada olho); `frontend/src/lib/visao/geometria.ts:29` (`arcsegParaPx`); `frontend/src/pages/exercises/TesteEstereopsia.tsx:187` (filtro pelo limite de píxeis), `:78` (pontos de ~2 px CSS) | O canvas é desenhado em píxeis de dispositivo. O canal vermelho é o olho esquerdo; verde e azul são o direito. Com um olho só, a forma não se vê (há teste disto). Sem óculos vêem-se franjas de cor, o que é inerente ao anáglifo. |
| 9 | **Redireccionamentos** | `frontend/src/i18n/rotas.ts:103` (`EXERCICIOS_RETIRADOS`), `frontend/src/App.tsx:157` (PT) e `:166` (EN, só com `VITE_ENABLE_EN`) | Seis caminhos em cada língua, com `<Navigate replace>`. Convergência e estereopsia não estão na lista, porque continuam a existir. |
| 10 | **Comentário em `acesso_exercicios_service.py`** | `api/app/services/acesso_exercicios_service.py:30-41` | Só comentário. As listas `EXERCICIOS_TRIAL`/`PREMIUM` (l. 42 e seguintes) ficam byte a byte iguais. |

## 3. O que NÃO mudou (e como o provar)

| Área | Ficheiros | Prova (saída esperada: vazia) |
|---|---|---|
| Regras de acesso (lógica) | `api/app/services/acesso_exercicios_service.py` (salvo o comentário), `api/app/routers/exercicios.py`, `api/app/repositories/acesso_exercicios_repository.py`, `api/tests/services/test_acesso_exercicios_service.py` | ver o primeiro bloco a seguir à tabela |
| Espelho do acesso no frontend | `frontend/src/contexts/AcessoExerciciosContext.tsx`, `frontend/src/components/exercises/useAcaoDesbloqueio.ts` | `git diff origin/main...HEAD -- frontend/src/contexts/AcessoExerciciosContext.tsx frontend/src/components/exercises/useAcaoDesbloqueio.ts` |
| Preços (Premium e loja do jogo) | `api/app/services/loja_jogo_service.py`, `api/app/services/premium_service.py`, `frontend/src/components/PremiumPaywallModal.tsx`, `frontend/src/pages/RegistoPremium.tsx` | `git diff origin/main...HEAD -- <estes ficheiros>`; e nos locales: ver o segundo bloco |
| Scanner | `frontend/src/pages/Scanner.tsx`, `frontend/src/components/EyeLandmarkOverlay.tsx` | `git diff origin/main...HEAD -- frontend/src/pages/Scanner.tsx frontend/src/components/EyeLandmarkOverlay.tsx`. O `ScannerResultados.tsx` muda **só** a lista de links para os exercícios. |
| Dependências `@mediapipe/*` | `frontend/package.json`, `frontend/package-lock.json` | `git diff origin/main...HEAD -- frontend/package.json frontend/package-lock.json` |

Regras de acesso — só pode sair o bloco de comentário:

```bash
git diff origin/main...HEAD -- api/app/services/acesso_exercicios_service.py | grep '^[-+]' | grep -v '^+++\|^---\|^+#'
```

Preços nos locales:

```bash
git diff origin/main...HEAD -- frontend/src/i18n/locales | grep '^[-+]' | grep -i 'kz\|kwanza\|15.000'
```

Estes comandos foram corridos quando o guia foi escrito e deram todos saída vazia.

## 4. Perguntas a fazer em cada bloco

**Migração e API**
- Alguma linha existente pode violar os CHECKs novos? (Não: as colunas novas nascem todas
  `NULL`, e os CHECKs aceitam `NULL`.)
- O `GET /sessoes-exercicio` alguma vez devolve sessões de outra pessoa? Existe algum
  parâmetro que o permita?
- A API aceita ainda o pedido de um frontend antigo, sem os campos novos?
- A anonimização limpa tudo o que é pessoal no perfil visual?

**lib/visao**
- Os testes cobrem os limites: o nível mais fácil falhado, o mais difícil passado, a lista
  vazia?
- Os números clínicos (6/9, 2 linhas, 1,4 px, 8 s, 120 s, 10 tentativas) estão em
  constantes com nome, e não soltos no código?
- Algum resultado pode ser mostrado com mais precisão do que o ecrã permite?

**Componentes e páginas**
- Há algum caminho que mostre "guardado" ou sucesso a partir de um `catch`?
- O aviso de triagem ou de treino aparece em todos os ecrãs, incluindo o do resultado?
- Com o acesso ainda a carregar, o conteúdo fica bloqueado (e não desbloqueado)?
- Há algum `requestAnimationFrame` a mais, ou uma `transition` CSS por cima de uma
  propriedade animada (CLAUDE.md §6)?
- O palco fica branco no modo escuro?

**Traduções**
- Há alguma promessa clínica ("trata", "cura", "fortalece", "terapia")?
- O PT segue a ortografia de 1945 e o EN a Merriam-Webster?
- Os avisos obrigatórios estão iguais nas duas línguas?

**Ficheiros removidos**
- Há links, rotas ou chaves de tradução órfãs? (Os testes de i18n e o `tsc` apanham a
  maior parte; os redireccionamentos cobrem os URLs.)
