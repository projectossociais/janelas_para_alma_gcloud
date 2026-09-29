# Revisão de SEO: exercícios sem webcam

Este documento é para o responsável de SEO rever. Lista tudo o que a branch
`frontend/exercicios-sem-webcam` muda nas superfícies de SEO, comparada com o
`origin/main`, que já inclui o PR #115.

**Critério.** Mantêm-se o título e a estrutura do #115. Troca-se só a linguagem que
promete terapia ("terapia visual", "terapêutico", "fortalecer", "vision therapy",
"strengthen") por linguagem neutra: "testes de triagem visual", "treino visual de apoio",
"visão binocular" / "vision screening tests", "supportive vision training".

Os termos de pesquisa sobre a condição ficam: "estrabismo", "ambliopia", "olho
preguiçoso", "saúde ocular". São temas, não promessas.

Os números de linha referem-se ao estado actual da branch.

## Alterado

| Superfície | Ficheiro:linha | Antes (`origin/main`) | Depois |
|---|---|---|---|
| `<meta name="description">` | `frontend/index.html:7` | "…rastreio de estrabismo pela webcam, **exercícios de terapia visual** para ambliopia e rede de clínicas parceiras em Angola." | "…rastreio de estrabismo pela webcam, **testes de triagem e treinos visuais** para ambliopia e rede de clínicas parceiras em Angola." |
| `<meta name="keywords">` | `frontend/index.html:8` | "…, exercícios visuais, **terapia visual**, plataforma angolana, …" | "…, exercícios visuais, **testes de triagem visual, treino visual de apoio, visão binocular**, plataforma angolana, …" (todas as outras keywords mantêm-se) |
| `og:description` | `frontend/index.html:45` | igual à antiga `description` | igual à nova `description` |
| `twitter:description` | `frontend/index.html:46` | igual à antiga `description` | igual à nova `description` |
| Manifest da app (instalação) | `frontend/public/manifest.webmanifest:4` | "Projeto angolano dedicado à inclusão visual, combate ao estrabismo e **exercícios terapêuticos**." | "Projecto angolano dedicado à inclusão visual e ao combate ao estrabismo, com **testes de triagem visual e treino visual de apoio**." |
| `meta.descricao` (PT, escrita por página) | `frontend/src/i18n/locales/pt-AO.json:8` | igual à antiga `description` do `index.html` | igual à nova |
| `meta.descricao` (EN) | `frontend/src/i18n/locales/en-US.json:8` | "Angolan eye health platform: webcam strabismus screening, **vision therapy exercises** for amblyopia and a network of partner clinics in Angola." | "Angolan eye health platform: webcam strabismus screening, **screening tests and vision training** for amblyopia, and a network of partner clinics in Angola." |
| `seo.exerciciosTitulo` (PT) | `pt-AO.json:36` | "Exercícios Visuais Práticos" | "Testes e treinos visuais" |
| `seo.exerciciosTitulo` (EN) | `en-US.json:36` | "Practical Vision Exercises" | "Vision tests and training" |
| `seo.exerciciosDescricao` (PT) | `pt-AO.json:37` | "Técnicas simples e interactivas para **fortalecer a visão** no dia-a-dia, com exercícios gratuitos e Premium." | "Testes de triagem e treinos de apoio para a visão, sem câmara, com Premium e teste de 7 dias." |
| `seo.exerciciosDescricao` (EN) | `en-US.json:37` | "Simple, interactive techniques to **strengthen your vision** in everyday life, with free and Premium exercises." | "Screening tests and supporting training for vision, with no camera, with Premium and a 7-day trial." |
| `seo.registoPremiumDescricao` (PT) | `pt-AO.json:69` | "…acesso a todos os **exercícios de terapia visual**." | "…acesso a todos os testes de triagem e treinos visuais." |
| `seo.registoPremiumDescricao` (EN) | `en-US.json:69` | "…every **vision therapy exercise**." | "…every screening test and vision training exercise." |

## Páginas novas e retiradas

- **Novas:** títulos e descrições `seo.exercicio{Acuidade,Contraste,Astigmatismo,Aneis,ContrasteBlocos,PertoLonge}` e `seo.exercicios{Progresso,Relatorio}`, em PT e EN. As descrições dos treinos terminam em "Complementa o tratamento prescrito" / "Complements the prescribed treatment". É o aviso obrigatório, não uma promessa.
- **Retiradas:** `seo.exercicio{Cerebro,Tracking,Relaxamento,Ambliopia,SacadasConvergencia,FlexibilidadeAcomodativa}`. Os URLs antigos redireccionam para `/exercicios` (ver `EXERCICIOS_RETIRADOS` em `frontend/src/i18n/rotas.ts`). As páginas de progresso e de relatório ficam fora do sitemap.

## Revisto e mantido de propósito

| Onde | Texto | Porquê fica |
|---|---|---|
| `seo.sobreDescricao` (`pt-AO.json:13`, `en-US.json:13`) | "O que é o estrabismo, o que o causa e como se trata…" | Página educativa sobre a condição. Fala do tratamento médico em geral, não promete nada sobre os exercícios. |
| `Navbar.oQueEO` e `Navbar.estrabismoDefinicaoCausasTipos` (`pt-AO.json`/`en-US.json:842-843`) | "…consequências e tratamento", "…tratamento, cirurgia, óculos…" | Palavras-chave da pesquisa interna para a mesma página educativa. São temas. |
| `seo.exercicio{Convergencia,Aneis,ContrasteBlocos}Descricao` | "…Complementa o tratamento prescrito." | É o aviso obrigatório. |
| `<title>` e `og:title`/`twitter:title` do #115 | "Janelas Para a Alma \| Saúde Ocular e Estrabismo em Angola" | Mantido tal como o #115. |

Não há JSON-LD no projecto, e o `robots.txt` e o sitemap não têm texto.

## Para o responsável de SEO decidir

- Se "terapia visual" tinha volume de pesquisa relevante, a palavra saiu das keywords.
  Hoje o Google quase não usa a meta `keywords`, por isso o impacto esperado é pequeno.
- Os caminhos antigos que estavam no sitemap redireccionam no router do frontend. Um 301
  do lado do servidor exige uma regra `redirects` no `frontend/vercel.json`. Ainda não foi
  feito; fica ao critério de quem trata o SEO.
