import { useEffect, useRef, type ReactNode } from "react";
import { AnimatePresence, m } from "motion/react";
import { cn } from "../cn";
import { MOLA } from "../movimento";

/**
 * Jornadas em passos (rastreio, marcação, pagamento): "uma coisa por ecrã"
 * (docs/PESQUISA_UX.md §1 e §4).
 */

/**
 * "Passo 2 de 4" com uma barra de segmentos. O texto é quem informa (vem de
 * quem usa, traduzido); a barra é decorativa.
 */
export const IndicadorPassos = ({
  actual,
  total,
  rotulo,
  className,
}: {
  /** Passo actual, a começar em 1. */
  actual: number;
  total: number;
  /** Ex.: "Passo 2 de 4". */
  rotulo: string;
  className?: string;
}) => (
  <div className={cn("flex flex-col gap-2", className)}>
    <p className="text-legenda font-medium text-tinta-suave">{rotulo}</p>
    <div className="flex gap-1.5" aria-hidden>
      {Array.from({ length: total }, (_, i) => (
        <span
          key={i}
          className={cn(
            "h-1.5 flex-1 rounded-pilula transition-colors duration-transicao ease-padrao",
            i < actual ? "bg-accao" : "bg-linha",
          )}
        />
      ))}
    </div>
  </div>
);

const DESLOCAMENTO = 32;

/**
 * Troca de ecrã entre passos. Avançar (`direccao` 1) entra pela direita;
 * voltar (-1) entra pela esquerda: o movimento diz para onde se foi.
 * Com movimento reduzido, só desvanece (ProvedorMovimento).
 *
 * Acessibilidade: ao mudar de passo, o foco vai para o primeiro título do ecrã
 * novo, para quem usa leitor de ecrã ou teclado saber que o ecrã mudou. No
 * primeiro ecrã não se mexe no foco (a página acabou de abrir).
 */
export const TransicaoPasso = ({
  chave,
  direccao,
  children,
  className,
}: {
  /** Identifica o passo; mudar a chave é mudar de ecrã. */
  chave: string | number;
  direccao: 1 | -1;
  children: ReactNode;
  className?: string;
}) => {
  const jaMudou = useRef(false);
  const chaveInicial = useRef(chave);
  if (chave !== chaveInicial.current) jaMudou.current = true;

  return (
    <div className={cn("relative overflow-hidden", className)}>
      <AnimatePresence mode="wait" initial={false} custom={direccao}>
        <m.div
          key={chave}
          custom={direccao}
          variants={{
            entrar: (d: number) => ({ opacity: 0, x: d * DESLOCAMENTO }),
            ver: { opacity: 1, x: 0 },
            sair: (d: number) => ({ opacity: 0, x: d * -DESLOCAMENTO }),
          }}
          initial="entrar"
          animate="ver"
          exit="sair"
          transition={MOLA.tarefa}
        >
          <FocoNoTitulo activo={jaMudou.current}>{children}</FocoNoTitulo>
        </m.div>
      </AnimatePresence>
    </div>
  );
};

const FocoNoTitulo = ({ activo, children }: { activo: boolean; children: ReactNode }) => {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!activo) return;
    const titulo = ref.current?.querySelector<HTMLElement>("h1, h2, h3");
    if (!titulo) return;
    if (!titulo.hasAttribute("tabindex")) titulo.setAttribute("tabindex", "-1");
    titulo.focus({ preventScroll: true });
    // Só na montagem de cada ecrã novo: é isso que "mudar de passo" significa.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <div ref={ref} className="[&_[tabindex='-1']]:outline-none">
      {children}
    </div>
  );
};
