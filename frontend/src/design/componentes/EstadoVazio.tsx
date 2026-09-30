import type { ReactNode } from "react";
import { cn } from "../cn";

/**
 * Quando não há nada para mostrar: diz porquê e dá o primeiro passo
 * (docs/PESQUISA_UX.md §3, Estados). "Ainda não fez nenhum treino. Comece
 * pelo de 3 minutos." e não uma lista vazia sem explicação.
 */
export interface EstadoVazioProps {
  titulo: ReactNode;
  descricao?: ReactNode;
  /** O primeiro passo (normalmente um Botao). */
  accao?: ReactNode;
  /** Ilustração ou ícone; decorativo. */
  imagem?: ReactNode;
  /** Nível do título, para a hierarquia da página. */
  nivelTitulo?: "h2" | "h3";
  className?: string;
}

export const EstadoVazio = ({
  titulo,
  descricao,
  accao,
  imagem,
  nivelTitulo: Titulo = "h2",
  className,
}: EstadoVazioProps) => (
  <div
    className={cn(
      "flex flex-col items-center rounded-cartao border border-dashed border-linha-forte px-6 py-12 text-center",
      className,
    )}
  >
    {imagem && (
      <div className="mb-6 w-20 text-accao" aria-hidden>
        {imagem}
      </div>
    )}
    <Titulo className="max-w-md text-titulo-p text-tinta">{titulo}</Titulo>
    {descricao && <p className="mt-2 max-w-md text-corpo text-tinta-suave">{descricao}</p>}
    {accao && <div className="mt-6">{accao}</div>}
  </div>
);
