# Sistema de design: regras de código

> Parte do redesenho (Sprint 7). `docs/MARCA.md` diz **o que** a marca é;
> `docs/PESQUISA_UX.md` diz **como** o produto se comporta; este documento diz **como se
> escreve o código** para que o sistema seja consistente por dentro, não só por fora.
> Um componente bonito com código inconsistente estraga-se na terceira alteração.
>
> Aplica-se a todo o código novo do redesenho. O código antigo migra jornada a jornada
> (REDESENHO_FRONTEND §4, estrangulamento); não se "arruma" código antigo fora disso.

---

## 1. Princípios

1. **Uma fonte de verdade por decisão.** Uma cor, um tamanho ou uma duração existe num
   só sítio (um token) e tudo o resto referencia-o. Nunca um valor solto.
2. **O significado antes da aparência.** O código diz `accao`, `texto-suave`, `erro`, não
   `azul-600`. Trocar a aparência é mudar um token; o significado não muda.
3. **Componentes que não se posicionam.** Um componente não tem margens exteriores nem
   larguras fixas: quem o usa decide onde fica. É o que os torna reutilizáveis.
4. **Composição em vez de configuração.** `<Cartao><Cartao.Titulo/>…</Cartao>` em vez de
   um componente com 15 propriedades opcionais.
5. **Acessível por construção.** Teclado, foco e leitores de ecrã vêm do Radix. Nunca
   reescrever um `<div onClick>` quando existe um primitivo.
6. **Verificado por máquina.** Cada regra que se pode verificar tem um teste ou uma
   regra de lint. Uma regra que só existe num documento acaba esquecida.

---

## 2. Estrutura

```
frontend/src/design/
  tokens.css            camadas 1 e 2 de tokens (variáveis CSS, claro e escuro)
  movimento.ts          durações e molas (a única fonte para o `motion`)
  marca/                logótipos, Simbolo, cores oficiais (hoje em src/redesenho/marca)
  componentes/          Botao, Campo, Cartao, Etiqueta, Aviso, EstadoVazio, Esqueleto,
                        Dialogo, MenuSite, BarraSeparadores, Passos...
  layouts/              LayoutSite, LayoutApp, LayoutConsola (com <Outlet>)
  util/cn.ts            junção de classes (clsx + tailwind-merge)
```

- `components/ui/` (shadcn) fica como camada de primitivos durante a migração. Os
  componentes novos embrulham o Radix directamente ou esses primitivos; as páginas
  migradas só importam de `design/`.
- Nomes em português, como o resto do domínio (CLAUDE.md §1): `Botao`, `variante`,
  `tamanho`, `aCarregar`. Um componente por ficheiro, `PascalCase.tsx`, exportação com
  nome, teste ao lado.
- O laboratório (`src/redesenho/laboratorio/`) é para experimentar; nada lá é importado
  pelo site. Quando uma direcção é escolhida, o que ficar passa para `src/design/` com
  testes.

---

## 3. Tokens em três camadas

| Camada | Exemplo | Quem a usa |
|---|---|---|
| 1 · Primitivos | `--marinho`, `--azul`, `--espaco-4`, `--raio-m` | Só a camada 2 |
| 2 · Semânticos | `--cor-fundo`, `--cor-texto`, `--cor-accao`, `--cor-erro`, `--cor-destaque` | Tailwind e componentes |
| 3 · Componente | `--botao-altura`, `--campo-borda` | Só onde um componente precisa de afinar |

- O tema escuro e as densidades (Site / App / Consola) redefinem **só a camada 2**.
- O `tailwind.config.ts` expõe **só a camada 2**: `bg-fundo`, `text-texto-suave`,
  `bg-accao`, `rounded-m`. As classes de cor de fábrica (`bg-blue-500`) desligam-se nas
  pastas novas.
- **Escalas fechadas:**
  - Espaço: base 4 px (4, 8, 12, 16, 24, 32, 48, 64, 96).
  - Tipo: 6 tamanhos (14 · 17 · 20 · 24 · 32 · 48; títulos de abertura em `clamp()`).
    Texto corrido 17 px no mínimo.
  - Raio: 3 valores. Sombra: 2 níveis, e no tema escuro a elevação faz-se com superfícies
    mais claras.
  - Movimento: 3 durações (100 / 250 / 400 ms) e 2 molas (tarefa, celebração), em
    `movimento.ts`.
- **Proibido nas pastas novas:** valores arbitrários do Tailwind com cor ou tamanho
  (`bg-[#0064A8]`, `text-[17px]`, `mt-[13px]`), `style={{ color: … }}` com cor literal, e
  hexadecimais fora de `tokens.css` e `marca/`. Verificado por um teste que percorre os
  ficheiros, no mesmo estilo de `src/i18n/codigo-fonte.test.ts`.

---

## 4. Anatomia de um componente

```tsx
// design/componentes/Botao.tsx
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { forwardRef } from "react";
import { cn } from "../util/cn";

const botao = cva(
  "inline-flex items-center justify-center gap-2 font-medium transition-colors " +
    "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 " +
    "focus-visible:outline-foco disabled:opacity-50",
  {
    variants: {
      variante: {
        primario: "bg-accao text-sobre-accao hover:bg-accao-forte",
        secundario: "border-2 border-texto text-texto hover:bg-superficie-alt",
        fantasma: "text-accao underline-offset-4 hover:underline",
      },
      tamanho: { m: "h-12 px-5 text-base", g: "h-14 px-7 text-lg" },
    },
    defaultVariants: { variante: "primario", tamanho: "g" },
  },
);

export interface BotaoProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof botao> {
  asChild?: boolean;
  aCarregar?: boolean;
}

export const Botao = forwardRef<HTMLButtonElement, BotaoProps>(
  ({ className, variante, tamanho, asChild, aCarregar, disabled, children, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        ref={ref}
        className={cn(botao({ variante, tamanho }), className)}
        disabled={disabled || aCarregar}
        aria-busy={aCarregar || undefined}
        {...props}
      >
        {children}
      </Comp>
    );
  },
);
Botao.displayName = "Botao";
```

**Regras que o exemplo mostra:**
- Variantes com `cva`, nunca `if`s de classes espalhados. `className` entra por último,
  via `cn`, para quem usa poder afinar sem partir.
- `asChild` (Radix Slot) em vez de `Botao` e `BotaoLink` duplicados.
- `forwardRef` e todas as propriedades nativas passadas: o componente comporta-se como
  o elemento HTML que substitui.
- **Nenhum texto dentro do componente.** Rótulos chegam por propriedades ou `children`,
  vindos do i18n (`codigo-fonte.test.ts` continua a guardar isto).
- Estado de carregamento dentro do botão, sem mudar a largura (o texto fica invisível e
  aparece um indicador por cima), para a página não "saltar" (CLS).

### Um componente só está pronto quando…

| Critério | Como se verifica |
|---|---|
| Todos os estados: normal, hover, foco visível, activo, desactivado, a carregar, erro | Montra (§7) |
| Alvo de toque ≥ 44 px na App e no Site (24 px na Consola) | Montra + revisão |
| Teclado completo; foco nunca escondido; `aria-*` correctos | Teste com Testing Library + axe |
| Claro e escuro; movimento reduzido | Montra nos dois temas |
| Sem texto embutido; sem valores fora dos tokens | Testes de código-fonte |
| Teste de comportamento (o que o utilizador faz, não a implementação) | Vitest |

---

## 5. Movimento no código

- Só a biblioteca `motion`, e só com valores de `movimento.ts`:
  `transition={MOLA.tarefa}`, `DURACAO.feedback`. Nunca números soltos.
- `LazyMotion` com `domAnimation` para não carregar o motor inteiro em todas as páginas.
- `useReducedMotion` em cada animação que desloca ou escala; com movimento reduzido, só
  opacidade.
- As regras do CLAUDE.md §6 continuam: nunca CSS `transition` numa propriedade
  actualizada por `requestAnimationFrame`, e um só `requestAnimationFrame` por exercício.
- As animações nunca bloqueiam: a pessoa pode tocar no passo seguinte a meio de uma
  transição.

---

## 6. Qualidade verificada por máquina

| Portão | Estado | Nota |
|---|---|---|
| TypeScript **estrito** no código novo | Activo: `npm run typecheck:redesenho` (`tsconfig.redesenho.json`, com `strict` e `noUncheckedIndexedAccess`) | A app antiga continua com `strict: false`; o código novo nasce estrito e a pasta de verificação cresce com a migração. Entra no CI quando o ramo for integrado |
| Contraste de cores AA | Activo (`direcoes.test.ts`, `marca.test.ts`) | Passa para os tokens finais |
| Texto português fora do i18n | Activo (`codigo-fonte.test.ts`) | |
| Cores e tamanhos fora dos tokens | A criar | Teste no estilo de `codigo-fonte.test.ts` |
| Acessibilidade automática (axe) | A criar | `vitest-axe` nos testes de componentes |
| Ordem das classes Tailwind | A decidir | Prettier com `prettier-plugin-tailwindcss` (hoje o projecto não usa Prettier: adoptar só nas pastas novas, para não reformatar tudo) |
| Regressão visual | Fase 2 | Playwright, capturas por componente, tema e idioma |
| Orçamento de JavaScript | Fase 2 | Build falha acima do limite (PESQUISA_UX §3) |

---

## 7. Montra (documentação viva)

Uma página só de desenvolvimento, `/_montra`, como o laboratório: cada componente em
todos os estados, nos dois temas e com movimento reduzido. É a documentação: se não está
na montra, não existe. Escolhida em vez do Storybook por ser mais leve e usar o próprio
Vite do projecto; o Storybook pode entrar mais tarde se a equipa crescer.
