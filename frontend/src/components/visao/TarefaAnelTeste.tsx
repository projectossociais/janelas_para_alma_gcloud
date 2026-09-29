import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import PalcoVisual from "@/components/visao/PalcoVisual";
import SeletorDireccao from "@/components/visao/SeletorDireccao";
import { useTempoActivo } from "@/components/visao/hooks";
import {
  direccaoAleatoria,
  iniciarEscadaTeste,
  responderTeste,
  type Direccao,
  type EstadoEscadaTeste,
} from "@/lib/visao/escada";

export interface FimTarefaAnel {
  escada: EstadoEscadaTeste;
  segundosActivos: number;
  duracaoSegundos: number;
}

/**
 * Tarefa de teste com anéis de Landolt numa escada (3 por nível, passa com
 * 2). O estímulo de cada nível é desenhado por quem chama -- tamanho na
 * acuidade, cinzento no contraste. Sem feedback de certo/errado: é um teste.
 */
const TarefaAnelTeste = ({
  totalNiveis,
  indiceInicial,
  estimulo,
  aoTerminar,
}: {
  totalNiveis: number;
  indiceInicial: number;
  estimulo: (indice: number, direccao: Direccao) => ReactNode;
  aoTerminar: (fim: FimTarefaAnel) => void;
}) => {
  const { t } = useTranslation();
  const tempo = useTempoActivo();
  const inicio = useRef(Date.now());
  const [escada, setEscada] = useState(() => iniciarEscadaTeste(totalNiveis, indiceInicial));
  const [direccao, setDireccao] = useState<Direccao>(() => direccaoAleatoria(null));
  const [aTrocar, setATrocar] = useState(false);

  const { iniciar } = tempo;
  useEffect(() => {
    iniciar();
  }, [iniciar]);

  const terminou = useRef(false);
  const aoResponder = useCallback(
    (resposta: Direccao | null) => {
      if (aTrocar || terminou.current) return;
      tempo.registar();
      const seguinte = responderTeste(escada, resposta === direccao);
      if (seguinte.terminado) {
        terminou.current = true;
        tempo.pausar();
        aoTerminar({
          escada: seguinte,
          segundosActivos: tempo.lerSegundos(),
          duracaoSegundos: Math.max(1, Math.round((Date.now() - inicio.current) / 1000)),
        });
        return;
      }
      // Um instante em branco entre optótipos -- a mudança de direcção nota-se.
      setATrocar(true);
      window.setTimeout(() => {
        setEscada(seguinte);
        setDireccao((d) => direccaoAleatoria(d));
        setATrocar(false);
      }, 250);
    },
    [aTrocar, aoTerminar, direccao, escada, tempo],
  );

  return (
    <div className="flex flex-col items-center gap-5">
      <p className="text-center text-sm text-muted-foreground">{t("Visao.instrucaoAnel")}</p>
      <PalcoVisual className="min-h-[150px] sm:min-h-[260px]" rotulo={t("Visao.rotuloAnel")}>
        {!aTrocar && estimulo(escada.indice, direccao)}
      </PalcoVisual>
      <SeletorDireccao aoResponder={aoResponder} desactivado={aTrocar} />
      {tempo.emPausa && <p className="text-xs text-muted-foreground">{t("Visao.emPausaAutomatica")}</p>}
    </div>
  );
};

export default TarefaAnelTeste;
