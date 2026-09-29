# Pendente de revisão legal: textos dos Termos e da Política de Privacidade

> **Tarefa LEG-01 do backlog.** Bloqueia o **lançamento público** dos exercícios sem
> webcam, **não** o merge do código. Os textos legais **não foram alterados**: rever e
> reescrever cabe ao dono do projecto e/ou ao jurista.
>
> Registado a 2026-09-28, na branch `frontend/exercicios-sem-webcam`.

## Porquê

Desde 2026-09-28, os 8 exercícios deixaram de usar a câmara. Passaram a ser **testes de
triagem** e **treinos de apoio** feitos só com a resposta do utilizador (toques, Sim/Não).
Ver o `CLAUDE.md`, §1 e §6. O **scanner de estrabismo** (`/scanner`) é outro produto: **continua a
usar a câmara** e a biometria facial (MediaPipe FaceMesh).

Os Termos de Utilização e a Política de Privacidade ainda descrevem os exercícios como
eram antes. Os problemas são três:

1. **"Biometria facial" nos exercícios.** Os Termos dizem que o rastreio *e os exercícios*
   se baseiam em biometria facial. Isto continua certo para o scanner, mas já não é
   verdade para nenhum dos 8 exercícios.
2. **"Terapia visual".** Vários trechos chamam aos exercícios "exercícios de terapia
   visual". O resto do site deixou de usar esta expressão, porque pode ser lida como
   promessa de tratamento. Os ecrãs dizem agora "teste de triagem" e "complementa o
   tratamento prescrito; não o substitui".
3. **Dados tratados.** A Política de Privacidade descreve o "progresso registado nos
   exercícios de terapia visual". Os exercícios gravam agora resultados por olho (limiar,
   distância, calibração do ecrã, tempo activo) e um perfil visual opcional (olho mais
   fraco, uso de óculos, faixa etária). Não guardam imagens nem dados faciais. Convém
   confirmar se a lista de dados de saúde da Política os cobre.

## Trechos a rever

Os textos vivem nos ficheiros de tradução. As páginas `TermosUtilizacao.tsx` e
`PoliticaPrivacidade.tsx` só os mostram. O inglês é tradução do português: os dois
ficheiros têm os mesmos números de linha.

| # | Chave | PT (`frontend/src/i18n/locales/pt-AO.json`) | EN (`frontend/src/i18n/locales/en-US.json`) | Problema |
|---|---|---|---|---|
| 1 | `TermosUtilizacao.oRastreioDigitalDe` | linha 1648: "O rastreio digital de estrabismo e os exercícios interactivos (…) baseando-se em biometria facial e ferramentas de rastreio automatizado." | linha 1648: "…and the interactive exercises (…) are based on facial biometrics and automated screening tools." | **Biometria facial.** A frase junta o scanner e os exercícios num só sujeito. A menção está certa para o scanner e errada para os exercícios. O resto do parágrafo (preventivo, não é diagnóstico, não substitui a consulta) continua válido e alinhado com os avisos novos. |
| 2 | `TermosUtilizacao.aPlataformaDestinaSe` | linha 1639: "…acesso a exercícios de terapia visual…" | linha 1639: "…access to vision therapy exercises…" | "Terapia visual" |
| 3 | `TermosUtilizacao.todosOsConteudosDisponibilizados` | linha 1644: "…metodologia dos exercícios de terapia visual…" | linha 1644: "…the methodology of the vision therapy exercises…" | "Terapia visual" |
| 4 | `PoliticaPrivacidade.oJanelasParaA` | linha 1087: "…(rastreio digital de estrabismo, exercícios de terapia visual, comunidade de suporte…)" | linha 1087: "…(digital strabismus screening, vision therapy exercises, support community…)" | "Terapia visual" |
| 5 | `PoliticaPrivacidade.dadosDeSaudeE` | linha 1094: "…e o progresso registado nos exercícios de terapia visual;" | linha 1094: "…and the progress recorded in the vision therapy exercises;" | "Terapia visual" + lista de dados (ponto 3 acima). As "imagens ou métricas faciais processadas pelo scanner", na mesma frase, continuam certas. |
| 6 | `PoliticaPrivacidade.osDadosDeSaude` | linha 1096: "…ao iniciar voluntariamente um rastreio ou ao submeter resultados de exercícios…" | linha 1096: "…when you voluntarily start a screening or submit exercise results…" | Para confirmar: continua certo (os resultados são submetidos à API), mas convém verificar se o momento do consentimento está bem descrito para os testes de triagem. |
| 7 | `PoliticaPrivacidade.personalizarASuaExperiencia` | linha 1098: "…(ex.: recomendar exercícios adequados ao seu perfil);" | linha 1098: "…(e.g., recommend exercises suited to your profile);" | Para confirmar: o perfil visual novo (olho mais fraco) é usado exactamente assim, para escolher o olho a treinar. Pode ser útil referi-lo. |

Os números de linha são do commit em que esta nota entrou. Se mudarem, procure pela chave.

## Recomendação de linguagem (sem reescrever o texto)

Use os termos que o resto do site já usa desde 2026-09-28:

- Em vez de "exercícios de terapia visual" / "vision therapy exercises", use "**testes de
  triagem e treinos visuais**" / "**screening tests and vision training**", ou só
  "exercícios visuais".
- Descreva os treinos como "**apoio ao tratamento prescrito**" / "**support for the
  prescribed treatment**". Nos ecrãs a frase é "complementa o tratamento prescrito; não
  o substitui". Evite "terapia", "tratamento", "reabilitação" ou "curar" como
  característica dos exercícios.
- Descreva os testes como "**triagem**" / "**screening**", nunca como "diagnóstico" ou
  "exame".
- Separe o scanner dos exercícios: a biometria facial e a câmara ficam só no scanner. Os
  exercícios funcionam "**sem câmara**, só com as respostas do utilizador".
- Mantenha o que já está certo: carácter preventivo e informativo, não é diagnóstico
  médico, não substitui a consulta presencial.

A revisão jurídica (Lei n.º 22/11, consentimento para dados de saúde, público infantil)
fica fora do âmbito desta nota.
