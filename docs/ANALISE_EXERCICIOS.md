# Análise crítica dos exercícios (2026-09-29)

> Pedida pelo dono do projecto depois da reescrita "exercícios sem webcam" (2026-09-28).
> Feita a partir do código em `main` (`frontend/src/pages/exercises/`, `lib/visao/`,
> `components/visao/`) e dos textos que o utilizador vê. Perspectivas: clínica, produto,
> UX e engenharia.
>
> **Decisões do dono do projecto (2026-09-29):** (1) manter os exercícios sem câmara;
> (2) trocar a Convergência pelo Treino de Anéis no trial; (3) avançar com a Fase A.

## Veredicto

1. **Tirar a câmara foi a decisão certa do ponto de vista clínico.** Seguir a íris com uma
   webcam não tem precisão validada para terapia. Os testes novos usam métodos
   reconhecidos (anel de Landolt, escada logMAR, contraste).
2. **Os testes são bons; os treinos são fracos.** A Convergência e o Perto e longe medem
   o que o utilizador declara ("Vejo 1", "Nítido"), e isso não se consegue verificar.
3. **O trial mostrava a parte errada do produto:** testes que se fazem uma vez e um treino
   contra-indicado em parte do público. *(Corrigido: o Treino de Anéis entrou no trial.)*
4. **O produto vende "8 exercícios", mas o que tem valor é "acompanhar o tratamento em
   casa e levar dados ao médico".**
5. **O público inclui crianças e o fluxo foi feito para adultos pacientes:** 5 a 6 ecrãs de
   preparação antes de cada treino, resultados em jargão e nada de jogo.

## Exercício a exercício

| Exercício | Base científica | Valor real | Veredicto |
|---|---|---|---|
| Teste de Acuidade | Forte (testes digitais validados, ex.: Peek Acuity) | Alto enquanto monitorização entre consultas | Manter, é a peça central |
| Teste de Contraste | Razoável | Médio; "log CS" não diz nada a um pai | Manter, com resultados em linguagem simples |
| Teste de Astigmatismo | Fraca (teste do relógio, pouco sensível) | Baixo, serve só para encaminhar | Manter só como triagem de entrada |
| Teste de Estereopsia | Razoável, com cross-talk | Médio; exige óculos 3D | Manter, não é argumento de venda |
| Treino de Anéis | Moderada (aprendizagem perceptual em ambliopia: Levi & Li, Polat), como complemento do tapa-olho | O de mais valor | Tornar central; a dose de 6 min fica abaixo da dos estudos |
| Contraste em blocos | Moderada (Zhou, Huang) | Faz sobreposição com o de Anéis | Juntar-lhe no futuro |
| Convergência | Fraca em casa (no CITT, os exercícios caseiros não foram melhores do que placebo); contra-indicada na esotropia | Risco clínico; resultado não verificável | **Saiu do trial**; só com aval do médico |
| Perto e longe | Fraca a moderada, pouco ligada a ambliopia/estrabismo | Baixo; não verificável | Secundário |

**Adesão pesa mais do que o algoritmo.** O ensaio PEDIG com jogos binoculares no iPad
(Holmes, 2016) falhou sobretudo porque as crianças deixaram de jogar.

## Problemas estruturais

1. O trial não provava valor (corrigido com o Treino de Anéis no trial).
2. Fricção: 5 a 6 ecrãs de preparação antes de cada treino de 6 minutos, sempre iguais.
3. Resultados em jargão (logMAR, log CS) em vez de tendência compreensível.
4. Métricas auto-declaradas misturadas com medições verificadas no relatório.
5. Nada pensado para crianças; o jogo Inclusivamente não está ligado aos treinos.
6. Retenção sem motor: sem lembretes; a sequência de dias só aparece no Progresso.
7. Preço (15.000 Kz/mês) caro para "8 exercícios"; defensável para "acompanhamento do
   tratamento com relatório para o médico e prioridade na clínica".
8. Processo: a reescrita entrou sem revisão; os ids têm significados trocados (dívida).

## Plano

**Proposta de valor Premium:** acompanhamento do tratamento do olho preguiçoso em casa,
com treino diário curto, evolução medida todas as semanas, relatório para o
oftalmologista e prioridade de marcação na clínica parceira.

### Fase A — correcções sem decisões clínicas novas (em curso)
- [x] Treino de Anéis no trial, Convergência no Premium
- [x] Sessão rápida (#121): da 2.ª vez em diante, um só ecrã de confirmação em vez de 5-6
- [x] Resultados em linguagem simples (#122) e com tendência ("leu 2 linhas mais pequenas do que
      há 3 semanas"); o jargão fica só no relatório para o médico
- [x] Convergência e Perto e longe marcados (#122) como "auto-avaliação" no progresso e no relatório
- [x] Lembrete diário por email (falta criar o job no Cloud Scheduler — comando no backlog) (usa `notificacoes_lembretes`, que já existe; job no
      Cloud Scheduler, como o W-03)

### Fase B — conversão
**Decisões do dono do projecto (2026-09-29):** bónus de 100 moedas por dia + 5 diamantes
a cada 7 dias seguidos; modo criança **não** agora (fica para o Sprint 7); relatório para
o médico por **link temporário partilhado pelo pai** (nunca envio automático).
- [x] Fim do trial com a evolução medida da própria pessoa; Premium sem promessas falsas (#124)
- [x] Bónus de assiduidade no Inclusivamente (PR à espera de revisão: tabela nova)
- [x] Relatório para o médico por link temporário, revogável (PR à espera de revisão: tabela nova)
- Modo pais/criança: adiado para o Sprint 7

### Fase C — diferenciação clínica (precisa de parceiro clínico)
- Treino dicóptico com os óculos vermelho-ciano já pedidos no teste de estereopsia
  (princípio usado por Luminopia/CureSight, com aprovação da FDA)
- Estudo com a Optioptika: acuidade em casa vs. na consulta, 30 a 50 crianças

### Métricas
Activação (dia 1 com Teste de Acuidade), dias de treino na semana 1, conversão de trial
para Premium, retenção de quem paga ao 1.º e 3.º mês.
