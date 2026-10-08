import { useEffect, useRef, useState, type ReactNode } from "react";
import { Check, Copy } from "lucide-react";
import { cn } from "../cn";
import { Botao } from "./Botao";

/**
 * Um dado que se copia para a área de transferência (IBAN, telefone de
 * pagamento), em vez de se escrever à mão num telemóvel. O que se mostra pode
 * ser uma versão ofuscada (`mostrado`); o que se copia é sempre `valor`.
 *
 * O botão diz o que faz e depois diz "Copiado", e isso anuncia-se a quem usa
 * leitor de ecrã. Se o navegador recusar copiar (página sem permissão), não
 * finge que copiou: o botão fica como estava.
 */
export interface LinhaCopiarProps {
  rotulo: ReactNode;
  valor: string;
  mostrado?: string;
  textos: { copiar: string; copiado: string };
  /**
   * `palavras` (por omissão) parte só entre palavras (nomes, IBAN com espaços);
   * `qualquer` parte em qualquer sítio, para valores sem espaços (um link).
   */
  quebra?: "palavras" | "qualquer";
}

export const LinhaCopiar = ({ rotulo, valor, mostrado, textos, quebra = "palavras" }: LinhaCopiarProps) => {
  const [copiado, setCopiado] = useState(false);
  const relogio = useRef<number>();
  useEffect(() => () => window.clearTimeout(relogio.current), []);

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(valor);
    } catch {
      return; // sem permissão: nunca mostrar "Copiado" sem ter copiado
    }
    setCopiado(true);
    window.clearTimeout(relogio.current);
    relogio.current = window.setTimeout(() => setCopiado(false), 2000);
  };

  return (
    // No telemóvel, o botão vai para baixo do valor: um valor longo (um link) nunca
    // fica espremido numa coluna estreita ao lado dele.
    <div className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
      <div className="min-w-0">
        <p className="text-legenda text-tinta-suave">{rotulo}</p>
        <p className={cn("text-corpo font-medium text-tinta", quebra === "qualquer" ? "break-all" : "break-words")}>
          {mostrado ?? valor}
        </p>
      </div>
      <Botao type="button" variante="secundario" className="shrink-0 self-start px-4 sm:self-auto" onClick={() => void copiar()}>
        {copiado ? <Check /> : <Copy />}
        <span aria-live="polite">{copiado ? textos.copiado : textos.copiar}</span>
      </Botao>
    </div>
  );
};
