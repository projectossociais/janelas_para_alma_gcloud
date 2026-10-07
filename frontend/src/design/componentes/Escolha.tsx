import { useId, type ReactNode } from "react";
import { AlertCircle } from "lucide-react";
import { cn } from "../cn";

/**
 * Escolher **uma** opção de entre várias (modalidade da consulta, dia, hora).
 * Por baixo são botões de opção nativos com o mesmo `name`: as setas mudam de
 * opção, o Tab entra e sai do grupo, e o leitor de ecrã diz "1 de 3". O grupo
 * é um `fieldset` com `legend`: a pergunta é o nome do grupo.
 *
 * Três aparências:
 * - `cartao`: linhas grandes, com ícone e descrição (poucas opções que pedem
 *   explicação). O indicador é um círculo com ponto, para não se confundir
 *   com a caixa quadrada do `OpcaoConfirmar`.
 * - `pastilha`: botões compactos em grelha (dias e horas).
 * - `radio`: o botão de rádio de sempre, sem caixa, todos na mesma linha (poucas
 *   opções curtas, como o género).
 *
 * O estado escolhido vê-se pela forma (ponto, preenchimento), nunca só pela cor.
 */
export interface OpcaoEscolha<T extends string> {
  valor: T;
  rotulo: ReactNode;
  /** Só na aparência `cartao`. */
  descricao?: ReactNode;
  /** Só na aparência `cartao`: ícone decorativo à esquerda. */
  icone?: ReactNode;
  /** Nome acessível completo, quando o rótulo visível é abreviado (ex.: "seg. 6"). */
  rotuloAcessivel?: string;
}

export interface GrupoEscolhaProps<T extends string> {
  legenda: ReactNode;
  /** Esconde a legenda (quando um título por cima já diz o mesmo), sem a tirar ao leitor de ecrã. */
  legendaOculta?: boolean;
  opcoes: readonly OpcaoEscolha<T>[];
  valor: T | null;
  aoMudar: (valor: T) => void;
  aparencia?: "cartao" | "pastilha" | "radio";
  erro?: ReactNode;
  className?: string;
}

export function GrupoEscolha<T extends string>({
  legenda,
  legendaOculta = false,
  opcoes,
  valor,
  aoMudar,
  aparencia = "cartao",
  erro,
  className,
}: GrupoEscolhaProps<T>) {
  const nome = useId();
  const idErro = erro ? `${nome}-erro` : undefined;
  const pastilha = aparencia === "pastilha";
  const radio = aparencia === "radio";

  return (
    <fieldset className={cn("min-w-0", className)} aria-describedby={idErro}>
      <legend className={cn(legendaOculta ? "sr-only" : "mb-3 text-corpo font-medium text-tinta")}>{legenda}</legend>
      {erro && (
        <p id={idErro} className="mb-3 flex items-start gap-1.5 text-legenda font-medium text-erro">
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>{erro}</span>
        </p>
      )}
      <div
        className={
          radio
            ? "flex flex-wrap gap-x-4 gap-y-1"
            : pastilha
              ? "grid grid-cols-3 gap-2 sm:grid-cols-4"
              : "flex flex-col gap-3"
        }
      >
        {opcoes.map((o) => {
          const escolhida = o.valor === valor;
          const id = `${nome}-${o.valor}`;
          const idDescricao = o.descricao && !pastilha ? `${id}-descricao` : undefined;
          // O nome é só o rótulo; a descrição fica como descrição (senão o
          // leitor de ecrã lia tudo como nome).
          const idRotulo = !pastilha && !o.rotuloAcessivel ? `${id}-rotulo` : undefined;
          return (
            <label
              key={o.valor}
              htmlFor={id}
              className={cn(
                "relative flex cursor-pointer",
                "has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-foco",
                radio
                  ? "min-h-alvo-app items-center gap-1.5 rounded-controlo"
                  : cn(
                      "items-center rounded-controlo border",
                      "transition-colors duration-feedback ease-padrao",
                      pastilha
                        ? cn(
                            "min-h-alvo-app justify-center px-2 py-2 text-center text-corpo font-medium",
                            escolhida
                              ? "border-accao bg-accao text-sobre-accao"
                              : "border-linha-forte bg-superficie text-tinta hover:border-accao",
                          )
                        : cn(
                            "min-h-12 gap-4 px-4 py-2.5",
                            escolhida ? "border-accao bg-accao-suave" : "border-linha-forte bg-superficie hover:border-accao",
                          ),
                    ),
              )}
            >
              <input
                id={id}
                type="radio"
                name={nome}
                value={o.valor}
                checked={escolhida}
                onChange={() => aoMudar(o.valor)}
                aria-label={o.rotuloAcessivel}
                aria-labelledby={idRotulo}
                aria-describedby={idDescricao}
                className="sr-only"
              />
              {radio ? (
                <>
                  <span
                    aria-hidden
                    className="flex size-5 shrink-0 items-center justify-center rounded-pilula border-2 border-accao"
                  >
                    {escolhida && <span className="size-2.5 rounded-pilula bg-accao" />}
                  </span>
                  <span id={idRotulo} className="text-legenda text-tinta">
                    {o.rotulo}
                  </span>
                </>
              ) : pastilha ? (
                <span aria-hidden={o.rotuloAcessivel ? true : undefined}>{o.rotulo}</span>
              ) : (
                <>
                  {o.icone && (
                    <span
                      aria-hidden
                      className="flex size-10 shrink-0 items-center justify-center rounded-pilula bg-superficie-alt text-accao [&_svg]:size-5"
                    >
                      {o.icone}
                    </span>
                  )}
                  <span className="min-w-0 flex-1">
                    <span id={idRotulo} className="block text-corpo text-tinta">
                      {o.rotulo}
                    </span>
                    {o.descricao && (
                      <span id={idDescricao} className="mt-0.5 block text-legenda text-tinta-suave">
                        {o.descricao}
                      </span>
                    )}
                  </span>
                  <span
                    aria-hidden
                    className="flex size-6 shrink-0 items-center justify-center rounded-pilula border-2 border-accao"
                  >
                    {escolhida && <span className="size-3 rounded-pilula bg-accao" />}
                  </span>
                </>
              )}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
