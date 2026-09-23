# Handoff: versão inglesa (i18n) do Janelas para a Alma

Documento de passagem para continuar o trabalho de internacionalização noutra sessão (ex.: Cloud
Session). Descreve o estado em `main` a **2026-09-23**. Antes de começar, confirmar com
`git log --oneline origin/main -5` que nada mudou entretanto.

Ler também: `CLAUDE.md` (regras do projecto), `docs/glossario-pt-en.md` (terminologia) e
`docs/revisao-en-US.md` (chaves marcadas para revisão humana).

---

## 1. Estado actual

| | |
|---|---|
| Branch base | `main` |
| Último commit em `main` | `33f24f6` fix(voluntariado): candidaturas de "Quero ser um Kamba" deixam de se perder (W-16) (#79) |
| PRs de i18n | Todos com merge: #74 (infra), #75 (ortografia 1945), #76 (extracção PT), #77 (tradução en-US), #78 (base de lançamento). **Não há PR de i18n pendente.** |
| `VITE_ENABLE_EN` | **Desligada** em produção (não definida). Com ela desligada, `/en/*` dá 404, o botão EN não aparece e não há `hreflang`. |
| Deploy de pré-visualização com inglês | Vercel → Settings → Environment Variables → `VITE_ENABLE_EN=true` **só em Preview** (opcionalmente só numa branch) → Redeploy. Ou, em `frontend/`: `vercel deploy --build-env VITE_ENABLE_EN=true` (sem `--prod`). **Não ligar em produção sem decisão do dono do projecto.** |
| Traduções | `pt-AO.json` e `en-US.json`: 87 secções, 1.602 chaves, **0 valores vazios**. |
| Revisão humana | 299 chaves marcadas: 178 `health`, 80 `legal`, 41 `duvida` (ainda por rever). |

---

## 2. Infra-estrutura instalada

Tudo em `frontend/src/i18n/`, salvo indicação.

| Peça | Onde | O que faz |
|---|---|---|
| i18next + react-i18next | `index.ts` | Traduções no bundle; `returnEmptyString: false` (chave vazia cai para PT); `tPt` = `t` fixo em português para valores enviados à API. |
| Idioma pela rota | `idiomas.ts` | `/en` e `/en/*` = `en-US`, o resto = `pt-AO`. Sem detecção pelo browser nem redireccionamento automático. `inglesAtivo()` lê a flag. |
| Mapa de rotas PT↔EN | `rotas.ts` | Fonte única. `App.tsx` gera as rotas daqui. Campos: `apenasPt` (sem versão inglesa: o jogo) e `foraDoSitemap` (conta, fluxos, resultados). Funções: `caminhoNoIdioma`, `localizar` (links internos, idempotente), `disponivelNoIdiomaActual` (esconder links para páginas só PT), `metadadosSeo` (canonical + hreflang). `SITE = "https://www.janelasparaalma.com"` (o domínio sem `www` responde 308 para este). |
| Troca de idioma | `IdiomaDaRota.tsx` | Muda o idioma **durante** o render e remonta a árvore (`key={idioma}`). Escreve no `<head>`, via **react-helmet-async**: `<html lang>`, título, canonical e hreflang (pt-AO, en-US, x-default). Actualiza a `description` que já existe no `index.html`. |
| Botão EN/PT | `components/Footer.tsx` | Leva à mesma página no outro idioma (mantém `:slug`, query e âncora). Numa página só PT, leva a `/en`. |
| Datas | `formatar.ts` | `formatarData` / `formatarDataHora`: PT = `pt-PT` (como sempre); EN = "September 23, 2026". |
| Erros da API | `lib/apiClient.ts` (`mensagemDeErroApi`) | PT mostra o `detail`. EN nunca mostra o `detail`: mapeia os conhecidos (`DETALHES_CONHECIDOS`) para `erroApi.*`, e o resto vai por tipo (rede, 401/403/404/409/413/429, outros 4xx, 5xx). |
| Sitemap | `frontend/scripts/gerar-sitemap.mjs` | Corre depois do `vite build` (`npm run build`) e escreve `dist/sitemap.xml`. Com a flag ligada, inclui `xhtml:link` recíprocos; sem ela, só URLs PT. `robots.txt` aponta para ele. |
| Página 404 | `pages/NotFound.tsx` | `noindex` (Helmet). |
| Nota legal | `components/NotaTraducaoLegal.tsx` | "The Portuguese version prevails." no topo da Privacy Policy e dos Terms of Use, só em inglês. |
| Rotas só PT | `rotas.ts` (`apenasPt`) | Jogo (`/jogo-curiosidades*`): sem `/en/trivia-game*` (dão **404 de propósito**). No site inglês escondem-se o botão da barra, o item do menu, o botão em Curiosidades e a novidade do lançamento. |
| Revisão | `revisao.json`, `revisao-notas.json`, `frontend/scripts/gerar-revisao-en.mjs` → `docs/revisao-en-US.md` | Marcação `health` / `legal` / `duvida` por chave, com notas para quem revê. |

---

## 3. O que falta

**As páginas e componentes públicos já estão todos traduzidos.** Isso inclui a página inicial (Hero, Sobre, Impacto, Pilares, Equipa, Curiosidades, Novidades), o Scanner com os resultados e o PDF, os 12 exercícios, Contactos, Doações, Kamba e voluntariado, Parceiros, o Portal Clínico, a FAQ, as páginas legais, os modais (Premium, parceria, marcação Optioptika, feedback) e a autenticação (login, registo, recuperação, confirmação, configurações, perfil). Nenhum valor de `en-US.json` está vazio, e o CI falha se algum ficar.

O que falta mesmo está abaixo, por ordem de prioridade sugerida.

### 3.1 Antes de ligar a flag em produção
1. **Revisão humana das 299 chaves marcadas** (`docs/revisao-en-US.md`): 178 `health` (validar com um clínico), 80 `legal` (rascunho, não é tradução jurídica validada) e 41 `duvida`. Pontos críticos:
   - afirmações a confirmar: "programa clínico validado por oftalmologistas", o testemunho do Kamba, "8 exercícios avançados", as afirmações da Optioptika;
   - atribuição do estudo de 2023 ao NCBI;
   - idades diferentes (6, 7–8 e 10 anos) no artigo sobre estrabismo;
   - "Diagnóstico assistido por IA" na barra de navegação contradiz os Termos.
2. **Soft 404:** o `vercel.json` tem `{"source": "/(.*)", "destination": "/index.html"}`, por isso **qualquer URL devolve 200** (confirmado em produção). O `noindex` da página 404 atenua o problema, mas não o resolve. Solução: gerar os `rewrites` a partir do mapa de rotas (com padrões para `:slug`) em vez do *catch-all*.
3. **Open Graph com domínios errados** no `index.html`: `og:url` = `https://janelasparaalma.org/`, e `og:image` / `twitter:image` apontam para `your-site-creator-25.lovable.app`. Não há `og:locale` para inglês.
4. **Decisão do domínio canónico:** usa-se `https://www.janelasparaalma.com` porque o domínio sem `www` responde 308. Se o dono preferir o domínio sem `www` como canónico, invertem-se o redireccionamento no Vercel e a constante `SITE` (`rotas.ts` e `gerar-sitemap.mjs`).

### 3.2 Adiado por decisão (fora do âmbito até nova ordem)
- **Conteúdo do backend**, que aparece em português no site inglês: publicações (título, texto, local, legendas), barra de aviso e banner da página inicial, notificações, actividades de voluntariado e perguntas do jogo online.
- **Perguntas offline do jogo** (`pages/jogo/perguntasOffline.ts`, cerca de 1.351 textos). Proposta: ficheiro de dados por idioma, não chaves no JSON. Só depois disto faz sentido tirar `apenasPt` ao jogo.
- **Emails transaccionais** (confirmação, recuperação): enviados pelo backend, só em português.
- **Cargos da equipa em inglês** (ex.: "Chief Financial Officer", "navigator" no Banco BAI): confirmar com cada pessoa.
- **Cabeçalho dos exercícios em telemóvel:** título e descrição cortados com `truncate` (`components/exercises/BaseExercise.tsx:191-192`), nos dois idiomas. Corrigir muda o HTML português.
- **Milhares em Kz no inglês** ("10.000 to 250.000 Kz"): mantidos sem reformatação por decisão; um leitor americano pode ler o ponto como decimal.

### 3.3 Erros da API em inglês sem frase própria (caem na mensagem genérica)
"esta candidatura já foi decidida", "pedido não encontrado" / "este pedido já foi aprovado" (Premium), "essa chave não pertence a…" (uploads), "notificação não encontrada", "pergunta não encontrada", os 422 do Pydantic e os erros do admin (só PT). Os 20 mapeados em `DETALHES_CONHECIDOS` dependem do texto exacto do backend. **Solução robusta:** o backend devolver um código de erro estável (ex.: `"codigo": "email_ja_registado"`) além do texto.

### 3.4 Correcções ao português que foram pedidas mas nunca feitas
Já foi dado como "com merge" um PR com estas correcções, mas ele **nunca existiu**:
- `index.html`, meta description: "Projeto… interativos" (ortografia de 1990);
- `StrabismusSection`: dois travessões ("Correcção óptica —", "Oclusão (penso) —");
- `NotFound`: a página portuguesa está em inglês ("Oops! Page not found");
- Scanner: "A enviar imagens para o Supabase" (já não é Supabase);
- Política de Privacidade: remete para a "secção 10" para os cookies, que são a 11;
- Editar Perfil: "Máximo 2MB" contra os 5 MB aceites;
- Optioptika: o horário não inclui sexta-feira (confirmar com a clínica).

Qualquer mudança ao português tem de actualizar o `pt-AO.json` **e** manter a tradução inglesa coerente.

---

## 4. Ficheiros de tradução e convenção de chaves

- `frontend/src/i18n/locales/pt-AO.json`: fonte, ortografia de 1945 **intencional** (acção, óptimo, têm, vêm, lêem…). Nunca "modernizar".
- `frontend/src/i18n/locales/en-US.json`: exactamente as mesmas chaves.
- **Chaves:** `Secção.chave`. A secção é o nome do ficheiro do componente ou da página (`Faq`, `ScannerResultados`, `PartnerDialog`…). A chave é *camelCase* ASCII derivada das primeiras palavras do texto português (`perguntasFrequentes`). Secções transversais: `meta`, `idioma`, `erroApi`, `legal`.
- **Texto com HTML:** usar `<Trans i18nKey=… components={{ … }} />` com tags nomeadas (`<strong>`, `<ligacao>`, `<a>`, `<span>`). **Nunca** usar nomes de elementos vazios de HTML (`link`, `img`, `input`, `hr`…), porque o parser do react-i18next põe o texto fora do componente. Há um teste para isto.
- **Variáveis:** `{{nome}}`, iguais nos dois idiomas. Há um teste para isto.
- **Frases inteiras:** nunca partir uma frase em várias chaves.

**Acrescentar um texto novo:**
1. Pôr a chave em `pt-AO.json` e em `en-US.json`. O teste de paridade falha se faltar num dos dois; o teste de valores vazios falha se o inglês ficar vazio.
2. No componente, usar `t("Secção.chave")` (hook `useTranslation`) ou `<Trans>`. Em dados ao nível do módulo, usar *getter* (`get label() { return i18n.t(…) }`) ou uma função chamada no render. **Nunca** chamar `i18n.t` ao nível do módulo, nem fazer *spread* (`...obj`) de objectos com *getters* ao nível do módulo, porque os valores ficam congelados em português (foi um bug real nas clínicas do scanner).
3. Links internos: `localizar("/caminho-pt")`.
4. Valores que vão para a API: `tPt(...)`, que fica sempre em português. Mostrar ao utilizador: `t(...)`.
5. Se for afirmação de saúde, texto legal ou tradução duvidosa: acrescentar a `revisao.json` (+ nota em `revisao-notas.json`) e correr `node scripts/gerar-revisao-en.mjs`.
6. Termo recorrente novo: acrescentar ao `docs/glossario-pt-en.md`.

**Testes que guardam isto** (`frontend/src/i18n/`):
- `locales.test.ts`: paridade de chaves, sem vazios, variáveis e tags iguais, sem tags vazias de HTML, alerta de português no inglês (com excepções para nomes próprios);
- `codigo-fonte.test.ts`: nenhum literal português escrito directamente no código público;
- `rotas.test.ts`: mapa de rotas, `localizar`, hreflang recíprocos, rotas só PT;
- `sitemap.test.ts`: a leitura do mapa pelo script coincide com a aplicação; reciprocidade; sem `/en` com a flag desligada;
- `formatar.test.ts`;
- `App.rotas-idioma.test.tsx`: percurso completo com a flag ligada e desligada.

---

## 5. Regras linguísticas e de estilo (en-US)

- **Ortografia:** Merriam-Webster, **primeira variante**.
- **Estilo:** Chicago Manual of Style para texto corrido/editorial; AP Stylebook para interface, botões e textos curtos; AMA Manual of Style para qualquer afirmação clínica ou de saúde.
- **Tom:** formal, elegante, directo e moderno. Traduzir o sentido e a intenção, não palavra a palavra.
- **Proibido:** *spectacles*, *colour*, *centre*, *behaviour*, *organise*, *realise*, *metre*, *defence*, *licence* (substantivo), *cancelled*, *travelled*. Usar *color*, *center*, *behavior*, *organize*, *realize*, *meter*, *defense*, *license*, *canceled*, *traveled*.
- **Vocabulário obrigatório:** *vision care*; *eyeglasses* ou *glasses*.
- **Saúde (AMA):** linguagem centrada na pessoa (*person with strabismus*, nunca *strabismic person*); *health care* em duas palavras; a triagem automática **não é diagnóstico** (usar *screening* / *result*).
- **Não inventar** dados, números, promessas nem afirmações clínicas: se o português não diz, o inglês também não. Na dúvida, marcar `duvida` em vez de assumir.
- **Nomes próprios ficam como estão:** "Janelas para a Alma" (com "para" em minúscula no texto; o lockup do logótipo mantém-se), "Meu Kamba Estrábico", "Inclusivamente", "Visão da Banda", províncias, moradas, Optioptika, MULTICAIXA EXPRESS.
- **Datas e números:** "September 23, 2026"; "8:30 a.m. to noon"; vírgula nos milhares e ponto decimal (1,234.50); **Kz / AOA não se convertem nem se reformatam**.
- **Valores para a API** (tipos de parceria, detalhes do donativo, diagnósticos) ficam estáveis e em português; só o rótulo se traduz.
- **Erros da API em inglês:** nunca mostrar o `detail` português.
- **Jogo:** exclusão confirmada da versão inglesa. `/en/trivia-game*` dá **404 de propósito**, e os pontos de entrada estão escondidos no site inglês. Para o activar em inglês: traduzir as perguntas (ver 3.2), tirar `apenasPt` das três rotas em `rotas.ts` e ajustar `rotas.test.ts`, `sitemap.test.ts` e `App.rotas-idioma.test.tsx`.

---

## 6. Procedimento de validação

Em `frontend/`:

```bash
npm run lint
```
```bash
npx tsc -p tsconfig.app.json --noEmit
```
```bash
npm run test
```
```bash
npm run build
```
```bash
VITE_ENABLE_EN=true npm run build
```

- **Lint:** 0 erros; os 15 avisos de fast-refresh são antigos.
- **Testes:** a falha `src/integrations/supabase/client.test.ts` é **anterior** ao trabalho de i18n e não tem a ver com ele.
- **`npm run build`:** faz `vite build` e depois gera `dist/sitemap.xml`. Sem a flag, deve dizer "inglês desligado" e o sitemap não pode ter URLs `/en`.
- **`VITE_ENABLE_EN=true npm run build`:** gera o sitemap com as alternativas `xhtml:link` (65 URLs à data deste documento).

### Verificação no browser (o que foi feito em cada fase)
- **Português inalterado:** capturar o HTML de `#root` (normalizando os ids aleatórios do Radix e retirando os toasts) em todas as rotas PT, em computador (1280 px) e em telemóvel (375 px), **antes** de mexer no código; comparar depois. Tem de dar igual carácter a carácter.
- **Inglês** (`VITE_ENABLE_EN=true npm run dev`), em todas as rotas `/en/*`, em computador e a 375 px:
  - `lang="en-US"`;
  - nenhum português no DOM (texto e `alt` / `aria-label` / `placeholder` / `title`);
  - nenhum scroll horizontal;
  - links internos em `/en/…`;
  - sem 404 nos links do menu, do menu lateral e do rodapé.
- **Fluxos a testar em inglês:** erros de validação dos formulários, doação (incluindo o erro da API), scanner e PDF (pôr um resultado em `sessionStorage.scanResult` e interceptar o blob do PDF), e troca EN↔PT numa página com parâmetros (`/en/publications/campanha-gamek?foto=2#galeria`).
- **Armadilha do ambiente:** o react-helmet-async escreve o `<head>` com `requestAnimationFrame`, que o browser suspende em separadores ocultos. Para verificar `canonical` / `hreflang` num browser automatizado, o separador tem de estar visível.

---

## 7. Regras do projecto a manter (resumo do CLAUDE.md)

- **Branches:** `<área>/<descricao-curta>` (ex.: `frontend/i18n-...`); nunca fazer commit directo em `main`; PR obrigatório.
- **Commits:** Conventional Commits em português.
- **CI:** `npm run lint`, `npm run test` e `npm run build` têm de passar; lógica nova precisa de testes novos.
- **Idioma do código e do domínio:** português (pt-PT); ortografia de 1945 no texto português.
