import { useEffect, useRef, useState, type ReactNode } from "react";
import { Check, Copy } from "lucide-react";
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
}

export const LinhaCopiar = ({ rotulo, valor, mostrado, textos }: LinhaCopiarProps) => {
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
    <div className="flex items-center justify-between gap-4 py-3">
      <div className="min-w-0">
        <p className="text-legenda text-tinta-suave">{rotulo}</p>
        <p className="break-words text-corpo font-medium text-tinta">{mostrado ?? valor}</p>
      </div>
      <Botao type="button" variante="secundario" className="shrink-0 px-4" onClick={() => void copiar()}>
        {copiado ? <Check /> : <Copy />}
        <span aria-live="polite">{copiado ? textos.copiado : textos.copiar}</span>
      </Botao>
    </div>
  );
};
