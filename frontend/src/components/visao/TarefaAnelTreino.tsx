import { useCallback, useRef, useState, type MutableRefObject, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import PalcoVisual from "@/components/visao/PalcoVisual";
import SeletorDireccao from "@/components/visao/SeletorDireccao";
import type { ApiTarefa, ResultadoTreino } from "@/components/visao/AssistenteTreino";
import {
  direccaoAleatoria,
  iniciarEscadaTreino,
  responderTreino,
  type Direccao,
  type EstadoEscadaTreino,
} from "@/lib/visao/escada";

/**
 * Treino com anéis: escada de treino (2 acertos seguidos sobem, 1 erro
 * desce) e, a cada ~10 tentativas, um anel de controlo muito fácil (nível
 * 0) que não mexe na escada -- só serve para medir a atenção.
 */
const TarefaAnelTreino = ({
  api,
  resultado,
  totalNiveis,
  indiceInicial,
  estimulo,
  calcularResultado,
}: {
  api: ApiTarefa;
  resultado: MutableRefObject<(() => ResultadoTreino) | null>;
  totalNiveis: number;
  indiceInicial: number;
  estimulo: (indice: number, direccao: Direccao) => ReactNode;
  calcularResultado: (escada: EstadoEscadaTreino) => ResultadoTreino;
}) => {
  const { t } = useTranslation();
  const [escada, setEscada] = useState(() => iniciarEscadaTreino(totalNiveis, indiceInicial));
  const [direccao, setDireccao] = useState<Direccao>(() => direccaoAleatoria(null));
  const [controlo, setControlo] = useState(false);
  const [retorno, setRetorno] = useState<"certo" | "errado" | null>(null);
  const escadaRef = useRef(escada);
  escadaRef.current = escada;
  resultado.current = () => calcularResultado(escadaRef.current);

  const aoResponder = useCallback(
    (resposta: Direccao | null) => {
      if (retorno || !api.activo) return;
      const acertou = resposta === direccao;
      api.registar({ controlo, acertou });
      if (!controlo) setEscada((e) => responderTreino(e, acertou));
      setRetorno(acertou ? "certo" : "errado");
      window.setTimeout(() => {
        setRetorno(null);
        setDireccao((d) => direccaoAleatoria(d));
        setControlo(api.proximaEControlo());
      }, 450);
    },
    [api, controlo, direccao, retorno],
  );

  return (
    <div className="flex flex-col items-center gap-5">
      <p className="text-center text-sm text-muted-foreground">{t("Visao.instrucaoAnel")}</p>
      <PalcoVisual className="relative min-h-[150px] sm:min-h-[260px]" rotulo={t("Visao.rotuloAnel")}>
        {retorno ? (
          <span className="text-lg font-semibold" style={{ color: retorno === "certo" ? "#0f7a6f" : "#8a5a00" }} aria-live="polite">
            {retorno === "certo" ? t("Visao.certo") : t("Visao.quase")}
          </span>
        ) : (
          estimulo(controlo ? 0 : escada.indice, direccao)
        )}
      </PalcoVisual>
      <SeletorDireccao aoResponder={aoResponder} desactivado={!!retorno || !api.activo} />
    </div>
  );
};

export default TarefaAnelTreino;
