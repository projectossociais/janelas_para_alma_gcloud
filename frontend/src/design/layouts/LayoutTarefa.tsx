import type { ReactNode } from "react";
import { X } from "lucide-react";
import { Botao } from "../componentes/Botao";
import { Dialogo, DialogoConteudo, DialogoFechar, DialogoGatilho } from "../componentes/Dialogo";
import { IndicadorPassos } from "../componentes/Passos";
import { Simbolo } from "../marca/Simbolo";
import type { TemaEfectivo } from "../useTema";
import { BarraInferior } from "./BarraInferior";
import { Contentor, SaltarConteudo } from "./Contentor";
import { ProvedorMovimento } from "../ProvedorMovimento";

/**
 * Arquétipo Tarefa (docs/LAYOUTS.md §2.3): rastreio, marcação, pagamento,
 * onboarding. Uma coisa de cada vez, sem saídas por engano.
 *
 * - Sem navegação do site: o símbolo (sem ligação: não tira da tarefa), o
 *   passo em que se está e "Sair".
 * - "Sair" pede confirmação quando há algo por guardar (`confirmarSaida`).
 * - Uma coluna estreita; a acção principal fica fixa em baixo no telemóvel
 *   (zona do polegar) e no fim da coluna no computador.
 */
export interface LayoutTarefaProps {
  tema: TemaEfectivo;
  passo: { actual: number; total: number; rotulo: string };
  sair: { rotulo: string; aoSair: () => void };
  /** Pedir confirmação antes de sair (há algo que se perderia). */
  confirmarSaida?: { titulo: string; descricao: string; ficar: string; sair: string; fechar: string };
  /** A acção principal do passo (normalmente um Botao grande, largura total). */
  accao?: ReactNode;
  textoSaltar: string;
  children: ReactNode;
}

export const LayoutTarefa = ({ tema, passo, sair, confirmarSaida, accao, textoSaltar, children }: LayoutTarefaProps) => {
  const botaoSair = (
    <Botao variante="fantasma" className="gap-1.5 px-3" onClick={confirmarSaida ? undefined : sair.aoSair}>
      <X aria-hidden />
      {sair.rotulo}
    </Botao>
  );

  return (
    <ProvedorMovimento>
      <div className="flex min-h-screen flex-col bg-superficie text-corpo text-tinta">
        <SaltarConteudo rotulo={textoSaltar} />
        <header className="border-b border-linha">
          <Contentor largura="largo" className="flex items-center gap-4 py-3">
            <span className="w-9 shrink-0">
              <Simbolo fundo={tema} />
            </span>
            <IndicadorPassos {...passo} className="hidden flex-1 sm:flex sm:max-w-xs md:mx-auto" />
            <div className="ml-auto sm:ml-0">
              {confirmarSaida ? (
                <Dialogo>
                  <DialogoGatilho asChild>{botaoSair}</DialogoGatilho>
                  <DialogoConteudo
                    titulo={confirmarSaida.titulo}
                    descricao={confirmarSaida.descricao}
                    rotuloFechar={confirmarSaida.fechar}
                    rodape={
                      <>
                        <DialogoFechar asChild>
                          <Botao>{confirmarSaida.ficar}</Botao>
                        </DialogoFechar>
                        <Botao variante="secundario" onClick={sair.aoSair}>
                          {confirmarSaida.sair}
                        </Botao>
                      </>
                    }
                  />
                </Dialogo>
              ) : (
                botaoSair
              )}
            </div>
          </Contentor>
          <Contentor largura="leitura" className="pb-3 sm:hidden">
            <IndicadorPassos {...passo} />
          </Contentor>
        </header>

        <main id="conteudo" tabIndex={-1} className="flex-1 outline-none">
          <Contentor largura="leitura" className="pb-32 pt-8 sm:pt-14 lg:pb-16">
            {children}
            {accao && <div className="mt-10 hidden lg:block">{accao}</div>}
          </Contentor>
        </main>

        {accao && <BarraInferior>{accao}</BarraInferior>}
      </div>
    </ProvedorMovimento>
  );
};
