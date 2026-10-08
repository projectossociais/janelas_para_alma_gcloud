import type { ReactNode } from "react";
import * as Radix from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "../cn";

/**
 * Diálogo (janela por cima da página). O Radix trata do que é difícil: foco
 * preso lá dentro, Esc para fechar, o foco volta ao botão que o abriu, o resto
 * da página fica inerte para leitores de ecrã.
 *
 * - O conteúdo fica dentro de um fundo que faz scroll: em ecrãs pequenos, com o
 *   teclado aberto, nada fica cortado.
 * - Entrada curta (desvanecer e escala ligeira); com movimento reduzido, sem
 *   animação.
 * - Usar para decisões e confirmações curtas, nunca para jornadas inteiras:
 *   essas são páginas (docs/PESQUISA_UX.md §4).
 */
export const Dialogo = Radix.Root;
export const DialogoGatilho = Radix.Trigger;
export const DialogoFechar = Radix.Close;

interface DialogoConteudoBase {
  titulo: ReactNode;
  descricao?: ReactNode;
  /** Botões de acção, alinhados à direita (no telemóvel, empilhados). */
  rodape?: ReactNode;
  children?: ReactNode;
  className?: string;
}

export type DialogoConteudoProps = DialogoConteudoBase &
  (
    | {
        /** Nome acessível do botão X, traduzido (ex.: "Fechar"). */
        rotuloFechar: string;
        obrigaEscolha?: false;
      }
    | {
        /**
         * Só se sai por um dos botões do rodapé: sem X, e Esc ou um clique fora
         * não fecham. Raro -- só quando fechar "por engano" saltaria um passo
         * que tem de acontecer (ex.: a Vida Extra do jogo, que ao encerrar
         * mostra sempre a resposta certa e a explicação).
         */
        obrigaEscolha: true;
        rotuloFechar?: never;
      }
  );

export const DialogoConteudo = ({
  titulo,
  descricao,
  rotuloFechar,
  obrigaEscolha = false,
  rodape,
  children,
  className,
}: DialogoConteudoProps) => (
  <Radix.Portal>
    <Radix.Overlay
      className={cn(
        "fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-black/50 p-4",
        "data-[state=open]:animate-in data-[state=open]:fade-in-0",
        "data-[state=closed]:animate-out data-[state=closed]:fade-out-0",
        "motion-reduce:animate-none",
      )}
    >
      <Radix.Content
        // Sem descrição, diz-se explicitamente que não há (o Radix avisa se faltar).
        {...(descricao ? {} : { "aria-describedby": undefined })}
        {...(obrigaEscolha
          ? { onEscapeKeyDown: (e: Event) => e.preventDefault(), onInteractOutside: (e: Event) => e.preventDefault() }
          : {})}
        className={cn(
          "relative w-full max-w-lg rounded-cartao bg-superficie-elevada p-6 text-tinta shadow-nivel-2",
          "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foco",
          "data-[state=open]:animate-in data-[state=open]:zoom-in-95 data-[state=open]:fade-in-0",
          "data-[state=closed]:animate-out data-[state=closed]:zoom-out-95 data-[state=closed]:fade-out-0",
          "duration-transicao motion-reduce:animate-none",
          className,
        )}
      >
        <Radix.Title className="pr-10 text-titulo-p text-tinta">{titulo}</Radix.Title>
        {descricao ? (
          <Radix.Description className="mt-2 text-corpo text-tinta-suave">{descricao}</Radix.Description>
        ) : null}
        {children && <div className="mt-4">{children}</div>}
        {rodape && <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">{rodape}</div>}
        {!obrigaEscolha && (
          <Radix.Close
            aria-label={rotuloFechar}
            className={cn(
              "absolute right-3 top-3 flex min-h-alvo-app min-w-alvo-app items-center justify-center rounded-controlo",
              "text-tinta-suave transition-colors duration-feedback hover:bg-superficie-alt hover:text-tinta",
              "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foco",
            )}
          >
            <X className="size-5" aria-hidden />
          </Radix.Close>
        )}
      </Radix.Content>
    </Radix.Overlay>
  </Radix.Portal>
);
