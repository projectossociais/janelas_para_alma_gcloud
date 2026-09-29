# Marca: especificação para o produto digital

> Fonte: manual **"Identidade Visual Um Olhar Alinhado"** (XANUS PRO, 2025, 11 páginas),
> entregue pelo dono do projecto a 2026-09-29. O manual define o logótipo, a paleta e a
> letra. Este documento acrescenta o que um manual de marca não diz e um site precisa:
> regras de uso, contraste, tema escuro, tamanhos mínimos e o que fica por decidir.
> **A marca não se redesenha no Sprint 7; o redesenho é o site à volta dela.**
>
> Os valores vêm dos vectores do PDF, não de imagens, por isso são exactos. No código
> vivem em `frontend/src/redesenho/marca/marca.ts`, com testes em `marca.test.ts`.

---

## 1. O que o manual contém

| Pág. | Conteúdo | Leitura para o site |
|---|---|---|
| 1 | Capa: fundo marinho, título grande em branco com uma palavra ("Visual") em lima | Padrão de título com **uma palavra em destaque** |
| 2 | Fotografia a preto e branco (olho em grande plano) com a assinatura em branco e lima | Direcção de fotografia: **preto e branco**, pessoas reais, texto sobre a imagem |
| 3 | Construção do ícone: olho (lente + íris) sobre uma janela quadrada, "Olho · Vista" | O símbolo é **olho + janela** (o nome "Janelas") |
| 4 | Símbolo em fundo branco e em marinho | Só a moldura muda: azul a 78% no claro, branco a 78% no escuro |
| 5 | Paleta de 8 cores | Ver §3 |
| 6-8 | Logótipo horizontal, horizontal negativo e vertical, com a assinatura "Um Olhar Alinhado, Uma Vida Transformada" | Três versões; ver §2 |
| 9 | Aplicação em pólos (branco com gola turquesa, marinho) | Confirma branco, marinho e turquesa como as cores principais |
| 10 | Tipografia: **Ubuntu** e **LT Renovate** | Ver §4 |

---

## 2. Logótipo

**Ficheiros** (`frontend/src/redesenho/marca/`, extraídos em vectorial do manual):

| Ficheiro | Uso |
|---|---|
| `logotipo-horizontal.svg` | Fundo claro, com assinatura |
| `logotipo-horizontal-negativo.svg` | Fundo marinho ou escuro, com assinatura |
| `logotipo-horizontal-sem-assinatura.svg` e `-negativo-sem-assinatura.svg` | Tamanhos pequenos (navegação, rodapé) |
| `Simbolo.tsx` | Só o símbolo, com os traçados exactos; opção `alinhar` (animação da marca) |

**Regras:**
- Nunca redesenhar, recolorir, esticar, rodar nem aplicar sombras ou efeitos. Só se
  usam as versões do manual.
- **Assinatura legível ou ausente:** abaixo de **480 px de largura** a assinatura fica
  com menos de 12 px e deixa de se ler. Nesse caso, usar a versão sem assinatura.
- **Símbolo sozinho:** no mínimo 24 px (favicon, ícone da app, avatar do perfil). Abaixo
  disso, a moldura perde a espessura.
- **Área de protecção (proposta, o manual não define):** à volta do logótipo, um espaço
  livre igual a metade da altura do símbolo.
- **Símbolo animado:** o olho entra desviado e alinha-se na janela, **uma vez**, ao abrir
  a página (a ideia "Um Olhar Alinhado" em movimento). Nunca em repetição contínua;
  com movimento reduzido aparece logo alinhado.

---

## 3. Cor

### Paleta oficial

| Nome no código | Hex | Papel no produto | Contraste com branco |
|---|---|---|---|
| `marinho` | `#002151` | Texto principal; fundo das aberturas e do tema escuro | 15,7:1 |
| `azul` | `#0064A8` | **Cor de acção** (botões, ligações); a cor da palavra do logótipo | 6,2:1 |
| `azulClaro` | `#97CFFC` | Acção no tema escuro; fundos suaves | 1,7:1 (só como fundo) |
| `turquesa` | `#15B4AA` | Lente do símbolo, assinatura, sinais pequenos | **2,6:1 (nunca texto sobre claro)** |
| `verde` | `#236A4D` | Sucesso; acção na direcção C | 6,5:1 |
| `dourado` | `#DEC14C` | Celebração, conquistas, "Novo" | 1,8:1 (só como fundo, com texto marinho) |
| `lima` | `#DCEDA1` | Palavra em destaque sobre marinho; acção no escuro | 1,3:1 (só sobre marinho) |
| `creme` | `#FCFFEE` | Fundo quente (direcções B e C) | fundo |

A regra que decide tudo: **as cores claras da paleta (turquesa, dourado, lima, azul
claro) não servem para texto sobre fundo claro**, mas todas passam AA (≥ 4,5:1) sobre
marinho ou com texto marinho por cima. Está provado em `marca.test.ts`.

### Regras de uso (da pesquisa)

- **Proporção 60-30-10:** cerca de 60% neutros (branco, creme, cinzentos azulados
  derivados do marinho), 30% marinho e azul, 10% acento (turquesa, dourado ou lima). O
  acento marca o que importa; se tudo tem acento, nada tem.
- **Nunca só a cor para dar significado.** A paleta junta azul, turquesa e verde, uma
  das combinações que pessoas com daltonismo verde-vermelho confundem. Estados (certo,
  errado, pendente) levam sempre ícone e texto. Paletas centradas no azul, como esta,
  são das mais seguras para daltónicos.
- **Vermelho de erro fora da marca:** a paleta não tem vermelho e um erro precisa de ser
  reconhecido sem pensar. `#B42318` no claro e `#FF9D8F` no escuro, só para erros,
  sempre com ícone e texto. Não é cor decorativa.
- **Tema escuro:** fundo marinho profundo (`#00132E`) e superfícies em marinho da marca,
  nunca preto puro (o texto "vibra" e cansa, sobretudo com astigmatismo). As superfícies
  sobem de nível ficando mais claras, não com sombras. As acções passam às versões
  claras da paleta (azul claro, lima), em vez de saturar mais.
- **Tons derivados permitidos:** superfícies, linhas e texto secundário podem usar tons
  derivados da paleta (ex.: `#3E5474` a partir do marinho). Nenhuma cor nova de marca.
- **Contraste verificado por teste:** todas as combinações de texto das direcções do
  laboratório passam AA nos dois temas (`direcoes.test.ts`); a regra de lint "0 cores
  fora dos tokens" (REDESENHO_FRONTEND §6) passa a incluir esta paleta.

---

## 4. Tipografia

| Letra | Onde | Estado |
|---|---|---|
| **Ubuntu** | Todo o texto do site (títulos e corpo) | Livre (Ubuntu Font Licence), no Google Fonts. Auto-alojar só os pesos usados, subconjunto latino |
| **LT Renovate** | Palavra do logótipo | **Licença por confirmar:** os sites de fontes contradizem-se ("uso pessoal" vs. "uso comercial permitido"). Até haver confirmação por escrito da LyonsType ou do estúdio do manual (XANUS PRO), só entra como traçado dentro do SVG do logótipo, que não precisa da letra |

**Pesos:** 400 para texto corrido; 500 para etiquetas, botões e títulos pequenos; 700
para títulos com força (direcção B); **300 (Light) só em títulos ≥ 32 px**, como na
página final do manual. O manual mostra a Ubuntu Light em amostras, mas Light em texto
pequeno é fino demais para baixa visão.

**Nota honesta:** a pesquisa de UX tinha proposto a Atkinson Hyperlegible, desenhada para
baixa visão. Com um manual de marca a definir a Ubuntu, fica a Ubuntu: é humanista, com
boa distinção entre letras, e a coerência com a marca vale mais nesta fase. A legibilidade
garante-se pelo tamanho (texto corrido ≥ 17 px), pelo peso mínimo e pelo contraste. Como
nenhuma letra é a melhor para toda a gente, a Atkinson Hyperlegible Next fica disponível
como opção "Letra de leitura fácil" nas Definições (PESQUISA_UX §3, Letra).

---

## 5. Elementos gráficos derivados (propostos no laboratório, aprovados pelo dono do projecto)

Nascidos do manual, sem inventar formas novas:
1. **Palavra em destaque** nos títulos grandes (pág. 1).
2. **Símbolo que se alinha** (pág. 3-4), só na abertura.
3. **Padrão de lentes:** a lente do olho repetida em turquesa e azul, com pontos em
   dourado, sobre marinho, para ecrãs de celebração e para o mundo das crianças.
4. **A janela como moldura:** a moldura quadrada do símbolo, com a mesma opacidade, a
   enquadrar fotografias reais a preto e branco (pág. 2).

---

## 6. O que o manual não define (decidimos nós)

**Não há designer no projecto** (2026-09-29). Estas lacunas fecham-se aqui, com propostas
testadas no laboratório e aprovadas pelo dono do projecto, e passam a regra quando
aprovadas. Ao estúdio que fez o manual (XANUS PRO), se for possível contactá-lo, fica
só uma pergunta: a licença da LT Renovate.

| Falta | Porque importa no site | Proposta |
|---|---|---|
| Área de protecção e tamanho mínimo | Navegação e ícones pequenos | §2 |
| Usos proibidos | Evitar logótipos esticados ou recoloridos | §2 |
| Versão monocromática (1 cor) | Impressão, carimbos, fundos fotográficos | Pedir |
| Favicon e ícone da app | Separador do browser, ecrã inicial do telemóvel | Símbolo sozinho, ≥ 24 px |
| Papel de cada cor | Cor de acção, de sucesso, de destaque | §3 |
| Cor de erro e de aviso | Formulários, pagamentos | Vermelho funcional, §3 |
| Hierarquia tipográfica (tamanhos, pesos) | Consistência entre páginas | §4 |
| Regras de fotografia (quem, onde, como) | Evitar banco de imagens | Preto e branco, pessoas angolanas reais, com consentimento (há crianças) |
| Licença da LT Renovate | Usar nos títulos do site | §4 |

---

## Fontes

- Manual "Identidade Visual Um Olhar Alinhado", XANUS PRO, 2025 (não versionado no repositório: 5,8 MB; pedir ao dono do projecto)
- WebAIM, *Visual disabilities: color-blindness* — https://webaim.org/articles/visual/colorblind
- Level Access, *Color blindness accessibility* — https://www.levelaccess.com/blog/color-blindness-accessibility-what-designers-need-to-know/
- Venngage, *Color blind design guidelines* — https://venngage.com/blog/color-blind-design/
- NN/g, *Using color to enhance your design* — https://www.nngroup.com/articles/color-enhance-design/
- UX Planet, *The 60-30-10 rule* — https://uxplanet.org/the-60-30-10-rule-a-foolproof-way-to-choose-colors-for-your-ui-design-d15625e56d25
- Atmos, *Dark mode UI best practices* — https://atmos.style/blog/dark-mode-ui-best-practices
- Uxcel, *12 principles of dark mode design* — https://uxcel.com/blog/12-principles-of-dark-mode-design-627
- DaFont, *LT Renovate* (licença indicada pelo distribuidor) — https://www.dafont.com/lt-renovate.font
- W3C, *WCAG 2.2* — https://www.w3.org/TR/WCAG22/
