# Dossiê para revisão jurídica — LEG-01

**Assunto:** actualizar os Termos de Utilização e a Política de Privacidade do site
Janelas Para a Alma depois da mudança dos exercícios visuais.
**Data:** 28 de Setembro de 2026.
**Estado:** os textos legais **não foram alterados**. Este dossiê descreve o que mudou,
aponta os trechos desactualizados e deixa sugestões técnicas para validação.

---

## 1. Contexto

1. Até agora, os exercícios visuais do site usavam a **câmara** do aparelho para seguir
   o olhar do utilizador.
2. A partir desta versão, os 8 exercícios **deixam de usar câmara, biometria facial ou
   qualquer monitorização**. O utilizador responde com toques no ecrã (por exemplo, "para
   que lado está a abertura do anel?", "Sim/Não").
3. Os exercícios passam a ser de dois tipos: **testes de triagem** (acuidade, contraste,
   astigmatismo, visão em profundidade) e **treinos de apoio**. Todos os ecrãs dizem que
   não são um exame médico nem substituem a consulta.
4. O **scanner de estrabismo** (outra parte do site) **continua a usar a câmara** e a
   analisar pontos do rosto. Nada mudou nele.
5. Por isso, os Termos e a Política descrevem os exercícios como "terapia visual" e
   "baseados em biometria facial", o que já não corresponde à realidade.

## 2. Trechos a rever

Os textos estão nos ficheiros de tradução do site:

- português: `frontend/src/i18n/locales/pt-AO.json`
- inglês: `frontend/src/i18n/locales/en-US.json`

O inglês é tradução do português e está nas mesmas linhas.

| # | Onde (chave · linha PT/EN) | Texto actual (PT) | Texto actual (EN) | O que já não é verdade, e porquê |
|---|---|---|---|---|
| 1 | Termos · `TermosUtilizacao.oRastreioDigitalDe` · linha 1648 | "O rastreio digital de estrabismo **e os exercícios interactivos** disponibilizados nesta plataforma têm carácter meramente preventivo, informativo e orientador, **baseando-se em biometria facial** e ferramentas de rastreio automatizado. (…)" | "The digital strabismus screening **and the interactive exercises** (…) **are based on facial biometrics** and automated screening tools. (…)" | A frase junta o scanner e os exercícios. **Para o scanner continua certa**, porque usa a câmara e pontos do rosto. **Para os exercícios deixou de ser verdade**, porque não usam câmara nem biometria. O resto do parágrafo continua válido: carácter preventivo, não é diagnóstico, não substitui a consulta. |
| 2 | Termos · `TermosUtilizacao.aPlataformaDestinaSe` · 1639 | "…acesso a **exercícios de terapia visual**…" | "…access to **vision therapy exercises**…" | "Terapia" sugere tratamento. Os exercícios são triagem e treino de apoio, e o site deixou de usar a palavra. |
| 3 | Termos · `TermosUtilizacao.todosOsConteudosDisponibilizados` · 1644 | "…metodologia dos **exercícios de terapia visual**…" | "…methodology of the **vision therapy exercises**…" | O mesmo. |
| 4 | Política · `PoliticaPrivacidade.oJanelasParaA` · 1087 | "…(rastreio digital de estrabismo, **exercícios de terapia visual**, comunidade de suporte…)" | "…(digital strabismus screening, **vision therapy exercises**, support community…)" | O mesmo. |
| 5 | Política · `PoliticaPrivacidade.dadosDeSaudeE` · 1094 | "Dados de saúde e visuais: (…) resultados do rastreio (imagens ou métricas faciais processadas pelo scanner, …) e o **progresso registado nos exercícios de terapia visual**;" | "(…) and the **progress recorded in the vision therapy exercises**;" | "Terapia visual". Além disso, a descrição dos dados dos exercícios ficou vaga: estes guardam agora resultados por olho e um perfil visual opcional (ver a secção 3). A parte do scanner (imagens ou métricas faciais) continua certa. |
| 6 | Política · `PoliticaPrivacidade.osDadosDeSaude` · 1096 | "(…) só recolhemos e processamos dados de saúde mediante consentimento inequívoco, expresso e escrito (…) nomeadamente ao iniciar voluntariamente um rastreio **ou ao submeter resultados de exercícios** (…)" | "(…) when you voluntarily start a screening **or submit exercise results** (…)" | Não é falso, mas **na prática não há um passo explícito de consentimento nos exercícios**: os resultados são gravados automaticamente no fim de cada teste ou treino (ver 3.4). Precisa de avaliação jurídica. |
| 7 | Política · `PoliticaPrivacidade.personalizarASuaExperiencia` · 1098 | "Personalizar a sua experiência na plataforma (ex.: recomendar exercícios adequados ao seu perfil);" | "(e.g., recommend exercises suited to your profile);" | Não é falso. O perfil visual novo (olho mais fraco) é usado exactamente assim: para escolher que olho treinar e para começar ao nível do último resultado. Pode valer a pena dizê-lo. |

## 3. O que o site faz agora com dados, nos exercícios

Esta secção baseia-se no código (API em `api/app/…`, site em `frontend/src/…`).

### 3.1 O que é guardado no servidor, por cada teste ou treino concluído

Guarda-se uma linha por olho testado (ou "os dois olhos", na estereopsia e na
convergência), na tabela `sessoes_exercicio`, associada à conta:

- que exercício, e a data e hora;
- a duração total e o **tempo activo** (só conta o tempo em que a pessoa está a
  responder);
- **que olho** foi testado ou treinado;
- o **resultado numérico** (o "limiar") e a sua unidade: acuidade em logMAR,
  sensibilidade ao contraste, visão em profundidade em segundos de arco, ou segundos
  nos treinos;
- a **distância** ao ecrã escolhida (60 cm, 1 m, 40 cm);
- a **calibração do ecrã** (quantos píxeis tem um milímetro) e se foi feita com um
  cartão;
- **sinais**, isto é, marcas curtas como:
  - "usa óculos durante o teste";
  - "resultado com sinal de astigmatismo" (Sim/Não);
  - "chegou ao limite do ecrã";
  - "óculos 3D verificados";
  - **"baixa atenção"** (errou perguntas de controlo muito fáceis);
  - número de controlos e de erros, nível atingido, ciclos.

Nestas sessões **não se guarda nenhuma imagem, vídeo, som, nem dado do rosto ou dos
olhos**. Os exercícios não pedem a câmara; há um teste automático que o confirma.

### 3.2 Perfil visual (opcional, preenchido pelo próprio)

Fica na tabela `utilizadores`:

- **olho mais fraco** (direito, esquerdo ou "não sei");
- **usa óculos ou lentes** (sim/não);
- **faixa etária** (até 5, 6-12, 13-17, 18-39, 40-59, 60 ou mais);
- a **calibração do ecrã**.

Se a pessoa escolhe "não sei" e faz o Teste de Acuidade, o site **sugere** o olho com o
pior resultado. Só o grava depois de a pessoa confirmar.

### 3.3 No próprio aparelho (não chega ao servidor)

A calibração do ecrã fica guardada no navegador (localStorage), para não ter de a repetir.

### 3.4 Quando e como é gravado

- A gravação é **automática**, no fim de cada teste ou treino. **Não há um ecrã de
  consentimento específico** antes de gravar.
- Só com sessão iniciada. Os exercícios são todos pagos (teste gratuito de 7 dias ou
  Premium).

### 3.5 Quem vê estes dados

- **O próprio utilizador:** vê o seu histórico, uma página de progresso e um relatório
  semanal que pode imprimir para levar à consulta. O relatório é gerado no navegador e
  não é enviado a ninguém.
- **Administradores do site:** vêem uma lista de sessões com nome, email, exercício,
  duração e data. **Não vêem** os resultados novos por olho nem o perfil visual (a lista
  de administração não inclui esses campos).

### 3.6 Retenção e eliminação

- Não há um prazo automático de apagamento das sessões.
- Quando alguém pede para eliminar a conta, esta é **anonimizada** 30 dias depois (tarefa
  W-03):
  - nome, email, telefone, etc. são apagados;
  - **o perfil visual também** (olho mais fraco, óculos, faixa etária, calibração);
  - **as sessões dos exercícios ficam guardadas**, ligadas a uma conta que já não
    identifica ninguém. Foi uma decisão do dono do projecto: preservar histórico clínico
    sem identidade.

### 3.7 Público

O site assume que o público inclui **crianças** (a faixa etária "até 5" e "6-12" existe
de propósito).

## 4. Proposta de redacção neutra

> ⚠️ **Sugestão técnica, sujeita a validação jurídica.** Serve só para mostrar o sentido
> das alterações, usando os termos que o resto do site já usa. A redacção final cabe ao
> jurista.

| # | Sugestão (PT) | Sugestão (EN) |
|---|---|---|
| 1 | "O rastreio digital de estrabismo e os testes e treinos visuais disponibilizados nesta plataforma têm carácter meramente preventivo, informativo e orientador. **O rastreio de estrabismo** baseia-se em biometria facial e ferramentas de rastreio automatizado; **os testes e treinos visuais funcionam sem câmara**, apenas com as respostas do utilizador. Estes resultados não constituem diagnóstico médico (…)" | "The digital strabismus screening and the vision tests and training offered on this platform are strictly preventive, informational and for guidance only. **The strabismus screening** is based on facial biometrics and automated screening tools; **the vision tests and training work without a camera**, using only the user's answers. These results are not a medical diagnosis (…)" |
| 2 | "…acesso a **testes de triagem e treinos visuais de apoio**…" | "…access to **vision screening tests and supportive vision training**…" |
| 3 | "…metodologia dos **testes e treinos visuais**…" | "…methodology of the **vision tests and training**…" |
| 4 | "…(rastreio digital de estrabismo, **testes de triagem e treinos visuais**, comunidade de suporte…)" | "…(digital strabismus screening, **vision screening tests and training**, support community…)" |
| 5 | "…e os **resultados dos testes e treinos visuais** (resultado por olho, tempo de treino, distância e calibração do ecrã, e o perfil visual que o utilizador escolha preencher: olho mais fraco, uso de óculos, faixa etária). Os testes e treinos visuais **não recolhem imagens** do utilizador;" | "…and the **results of the vision tests and training** (result per eye, training time, screen distance and calibration, and the optional vision profile: weaker eye, use of glasses, age group). The vision tests and training **do not collect images** of the user;" |
| 6 | A decidir pelo jurista, conforme a resposta à pergunta 5.1. Por exemplo: "…ao iniciar voluntariamente um rastreio, ou um teste ou treino visual, depois de aceitar o respectivo aviso…" | Correspondente em EN. |
| 7 | "(ex.: sugerir o olho a treinar e o nível inicial dos treinos a partir dos seus resultados anteriores)" | "(e.g., suggest which eye to train and the starting level of the training based on your previous results)" |

## 5. Perguntas para o jurista

1. **Consentimento para dados de saúde.** A Lei n.º 22/11 (artigo 14.º, citado na
   Política) exige consentimento expresso e escrito. Os resultados dos testes (acuidade
   por olho, sinal de astigmatismo, etc.) são dados de saúde? Chega a aceitação geral
   dos Termos, ou é preciso um passo de consentimento explícito antes de gravar o
   primeiro resultado? Se sim, uma vez por conta ou por tipo de teste?
2. **Menores.** Com crianças no público: quem dá o consentimento (o representante
   legal)? Como se verifica? A faixa etária "até 5" e "6-12" muda alguma coisa?
3. **Enquadramento regulatório.** Chamar-lhes "testes de triagem" com o aviso "não é
   um exame médico, não diagnostica, não substitui a consulta" chega para que não sejam
   considerados dispositivo médico, nem "software como dispositivo médico", em Angola?
   E nos mercados de língua inglesa, se o site inglês for activado? Há palavras a
   evitar para além de "terapia", "tratamento" e "diagnóstico"?
4. **Retenção.** As sessões ficam guardadas sem prazo e continuam guardadas, sem
   identidade, depois da eliminação da conta. É aceitável? Deve haver um prazo máximo?
   Deve a Política dizê-lo expressamente?
5. **Categorias de dados na Política.** A lista da secção 3 deve aparecer na Política
   com este detalhe (em especial o "sinal de baixa atenção" e a "faixa etária")?
6. **Separação scanner / exercícios.** Faz sentido a Política ter secções separadas
   para o scanner (câmara, biometria) e para os testes e treinos (sem câmara)?
7. **Relatório para o médico.** O relatório semanal que o utilizador imprime e leva à
   consulta levanta alguma questão, ou está coberto por ser o próprio a partilhá-lo?

---

*Documento técnico preparado a partir do código-fonte. Referências internas:
`docs/PENDENTE_REVISAO_LEGAL.md` (resumo) e a tarefa LEG-01 em `docs/BACKLOG.md`.*
