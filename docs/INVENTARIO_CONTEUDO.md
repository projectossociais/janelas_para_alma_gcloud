# Inventário do conteúdo do site actual

> Redesenho (Sprint 7). Lido a 2026-09-30 a partir de `frontend/src/i18n/locales/pt-AO.json`
> e das páginas. Objectivo: decidir, texto a texto, o que **fica**, o que **se reescreve**
> e o que **sai**, antes de desenhar as páginas novas. Regra de fundo: **o site só
> promete o que existe** (NN/g, confiança; `docs/PESQUISA_UX.md`) e escreve para quem lê
> pouco (idade de leitura 9 a 11 anos).

---

## 1. Problemas transversais (valem para todas as páginas)

| # | Problema | Onde | Decisão proposta |
|---|---|---|---|
| T1 | **Quem somos muda de página para página:** "instituição" (abertura, rodapé), "startup" (Sobre nós), "iniciativa" (Termos), e uma empresa "Olhar Alinhado, Comércio & Prestação de Serviços, Lda." (novidade da formalização) | `HeroSection`, `AboutSection`, `TermosUtilizacao`, `FirmaOlharAlinhadoModal` | **Uma só frase de identidade**, igual em todo o lado. **Pergunta ao dono:** o responsável legal é a "Olhar Alinhado, Lda."? Se sim, é essa a entidade da Política de Privacidade e do pedido à APD, e uma Lda. normalmente tem NIF |
| T2 | **Números que se contradizem:** estrabismo afecta "cerca de 4%" (curiosidades), "2 a 4%" (artigo) e "0,8% em África" (Sobre nós) | `CuriosidadesSection`, `StrabismusSection`, `AboutSection` | Um só número por facto, sempre com a fonte e o ano. Mundo: 2-4%; África: 0,8% (meta-análise de 2023) |
| T3 | **Idades críticas que se contradizem:** diagnóstico "antes dos 6", ambliopia "antes dos 7", "até aos 7-8", tratamento "antes dos 10" | `StrabismusSection`, `CuriosidadesSection` | Uma mensagem simples e coerente: "quanto mais cedo, melhor: idealmente antes dos 7 anos"; os pormenores ficam no artigo, com a fonte |
| T4 | **Promessas do que não existe no código:** "apoio psicossocial e sessões terapêuticas", comunidade digital com "partilha de experiências", "marketplace de serviços e produtos", "canal de comunicação directa", "redistribuição a preços simbólicos", "revenda de materiais" | `PillarsSection`, `Suporte`, `Tecnologia` | **Sai tudo o que não existe.** Se for um plano, diz "em preparação", sem desenho de algo que parece pronto |
| T5 | **"Terapia"** ainda em textos de marketing ("sessões terapêuticas", "reutilização terapêutica", "ciclo completo de tratamento (consulta, óculos e terapia)") | `PillarsSection`, `Circular`, `Apoiar` | Trocar por "treino visual", "acompanhamento" ou retirar (CLAUDE.md §1: nunca prometer tratar) |
| T6 | **Tu e você misturados:** "Não estás sozinho", "Torna-te um Kamba" vs. "Faça a diferença" | `Suporte`, `KambaHeroCarousel`, `VolunteerSection` vs. resto | "Você" em todo o produto. **Excepção possível:** o programa Kamba, dirigido a jovens voluntários, pode usar "tu" de propósito. Decisão do dono |
| T7 | **Brasileirismos:** "bilhões", "percecionam", "suscetíveis" | `AboutSection`, `StrabismusSection` | pt-AO: "mil milhões", "percepcionam", "susceptíveis" |
| T8 | **Conteúdo escrito no código** em vez de gerido pelos admins: novidades, a campanha da Gamek (feed e página inteira) | `NovidadesSection`, `ActivitiesFeed`, `CampanhaGamek` | Passa para as **publicações** (já geridas no admin, com fotografias) |
| T9 | **Formulário de voluntário duplicado** (em `VolunteerSection` e dentro de `ContactSection`) | Kamba, Contactos | Um só, na Comunidade |
| T10 | **Redes sociais falsas:** Facebook e LinkedIn a apontar para as páginas iniciais dessas redes | `Footer` | Só o Instagram @janelas_para_alma |

---

## 2. Página a página

### Sobre nós (`Impacto` + `AboutSection` + `ImpactSection` + `AboutTeaserSection` + `PillarsSection`)

**Fica (é bom):**
- A história em primeira pessoa, com verdade: "somos jovens angolanos que decidimos olhar
  de frente para uma condição que a maioria prefere ignorar".
- Os dados com fonte: OMS 2019 (2,2 mil milhões de pessoas com deficiência visual, pelo
  menos mil milhões evitáveis ou por tratar), prevalência em África (0,8%, 2023), visão
  como principal sentido (~80%).
- A ideia central: saúde visual e economia circular ao mesmo tempo.

**Reescreve-se:**
- "Impacto climático" e "impacto ecológico" são genéricos e sem números. Juntam-se numa
  frente, "Economia circular", **com números reais** (quantos óculos recolhidos e
  redistribuídos) ou sem números.
- Os "três pilares" passam a descrever **o que fazemos de facto** (§3).

**Estrutura proposta da página "Quem somos":**
1. **A missão numa frase** + a história (porque nasceu: a frase da Dalva, "dar visibilidade
   ao que muitas vezes é ignorado").
2. **Porque importa:** os três dados com fonte, em linguagem simples.
3. **O que fazemos:** as frentes reais (§3), cada uma com ligação.
4. **A equipa:** rostos e nomes reais.
5. **Marcos:** linha do tempo com o que aconteceu, com data (campanha na Gamek a 12 de
   Setembro, lançamento do jogo, formalização da empresa, plataforma).
6. **Parceiros:** Optioptika, Desafio Genial, Nelt Group.
7. **Transparência:** quem é a entidade legal e como se usam os donativos, **só com o que
   for verdade**.

### O que é o estrabismo (`Sobre` + `StrabismusSection` + `StrabismusIntroCard`)

**O melhor conteúdo do site:** artigo sério, com causas, tipos, consequências, tratamento e
referências. **Fica**, com três mudanças:
- **Resumo em linguagem simples no topo** ("Em resumo: um olho desvia; quanto mais cedo
  se trata, melhor; faça o rastreio e fale com um oftalmologista"), e o artigo técnico
  por baixo, para quem quer ler mais.
- **"Sinais a que estar atento"** (novo, `docs/ESTRUTURA_SITE.md` §5), que é o que os pais
  procuram.
- Corrigir T2, T3 e T7; manter as referências.

### A equipa (`Equipa` + `TeamSection`)

**Fica:** pessoas reais com nome, cargo e fotografia (a maior prova de confiança).
**Reescreve-se:** as biografias são currículos longos, com informação que não ajuda a
confiar no projecto (negócios pessoais, religião, cargos noutras associações), e há
incoerências (o Director de TI descreve-se como estudante de finanças). Proposta, igual
para todos: **nome, cargo, uma frase sobre o que faz no projecto, e a citação pessoal**
(as citações são boas). A biografia longa, se ficar, abre só a pedido.
**Pergunta ao dono:** cada pessoa aprova o seu texto e fotografia.

### Comunidade: Meu Kamba Estrábico (`Kamba`, `KambaHeroCarousel`, `ProgramModal`, `VolunteerSection`, `ActivitiesFeed`, `UpcomingActivities`)

**Fica:** o nome e o significado (desestigmatizar pelo afecto; os "Kambas" como
embaixadores), objectivos, público-alvo. O backend já tem tudo: candidatura a voluntário
aprovada por admin, actividades com vagas e **inscrição por actividade** (só voluntários
aprovados; uma inscrição por pessoa por actividade).
**Muda:** acções realizadas vêm das publicações (T8); formulário único (T9). Detalhe em
`docs/ESTRUTURA_SITE.md` §5b.

### Apoio psicossocial (`Suporte`)

**Sai do menu.** Descreve uma comunidade digital e acompanhamento emocional que não
existem (T4). **Pergunta ao dono:** há apoio psicossocial real (pessoas, sessões)? Se sim,
fica uma secção curta e verdadeira na Comunidade; se não, a página sai.

### Tecnologia (`Tecnologia`)

**Sai.** É um ecrã de apresentação com funcionalidades inexistentes (marketplace, canal de
comunicação) e uma interface fictícia ("Próxima consulta: Sex, 14:30"). O que é verdade
(rastreio no telemóvel, marcação de consulta, acessibilidade) passa para "Como funciona"
na página inicial. O endereço redirecciona.

### Economia circular (`Circular`)

**Fica, reescrita:** recolha, recondicionamento e redistribuição de óculos é real e
diferencia o projecto. Sem "terapêutica" (T5), sem "reduz drasticamente os custos" sem
números. Liga à doação de óculos (pontos de recolha, que existem em `pontos_recolha`).

### Apoiar (`Apoiar`)

**Fica:** fluxo em passos (materiais ou dinheiro), pontos de recolha, comprovativo.
**A confirmar com o dono antes de reescrever:** os três níveis prometem "um ciclo
completo de tratamento (consulta, óculos e terapia)" e "cirurgias correctivas em grupo".
Só ficam se for isso que o dinheiro faz de facto; senão, descreve-se o uso real. O mesmo
para "revertem integralmente para os pacientes".

### Para clínicas (`Parceiros`)

**Fica.** Retirar "como a Centroptico": nomeia uma clínica que não é parceira.

### Perguntas frequentes (`Faq`)

**Fica e cresce.** Hoje só tem perguntas de privacidade. Faltam as dos pais: É um
diagnóstico? A partir de que idade? Quanto custa? Como funciona o teste de 7 dias e o
Premium? Preciso de conta? O meu filho usa óculos, faz na mesma? Guardam a fotografia?

### Página inicial (`Index` e secções)

Já tratada em `docs/ESTRUTURA_SITE.md` §5. Destino do conteúdo actual:

| Secção actual | Destino |
|---|---|
| `HeroSection` | Reescrita (abertura com o resultado para o pai) |
| `BannerHomepageSection` | Fica como faixa de aviso opcional, gerida no admin |
| `StrabismusIntroCard` | Vira "Sinais a que estar atento" |
| `AboutTeaserSection` | Vai para "Porque confiar" (texto bom) |
| `PillarsSection` | Sai (T4, T5); o que é real vai para "Quem somos" |
| `CuriosidadesSection` | Vai para o jogo e para o artigo do estrabismo, com fontes |
| `NovidadesSection` | Retirada do código (2026-09-30). O texto da formalização e do lançamento do jogo está em `docs/PUBLICACOES_A_CRIAR.md`, pronto a publicar pelos admins (a formalização depende da pergunta 1) |
| `ParceirosSection` | Foi para "Porque confiar" (2026-09-30), com os mesmos 5 parceiros: Desafio Genial (programa da UNICEF Angola com a Arotec), UNICEF, Arotec, Optioptika, Nelt Group |

### Novidade da formalização (`FirmaOlharAlinhadoModal`)

**Vira publicação.** Ver T1: esclarecer a entidade legal. O componente saiu do código
(2026-09-30); o texto original e uma revisão sem promessa de tratamento estão em
`docs/PUBLICACOES_A_CRIAR.md`.

---

## 3. "O que fazemos": as frentes reais (para "Quem somos" e a página inicial)

| Frente | Existe hoje? |
|---|---|
| Rastreio de estrabismo no telemóvel, grátis | Sim |
| Testes e treinos visuais em casa (teste de 7 dias, Premium) | Sim |
| Consulta com clínicas parceiras (presencial e por vídeo) | Sim (Optioptika) |
| Relatório para o médico | Sim |
| Comunidade Meu Kamba Estrábico: voluntariado e acções no terreno | Sim |
| Recolha e reaproveitamento de óculos | Sim (pontos de recolha, doações de materiais) |
| Jogo educativo Inclusivamente | Sim |
| Apoio psicossocial | **A confirmar** |
| Loja de óculos recondicionados | **Não** (no backlog) |

---

## 4. Perguntas para o dono do projecto

1. Entidade legal: a "Olhar Alinhado, Lda." é o responsável? Tem NIF? (T1)
2. Há apoio psicossocial real? (Suporte)
3. Os níveis de doação correspondem ao que o dinheiro faz? (Apoiar)
4. Cada membro da equipa aprova o seu texto e fotografia?
5. Temos números reais (rastreios feitos, óculos recolhidos, acções realizadas) para mostrar?
6. O programa Kamba fala por "tu" de propósito? (T6)
