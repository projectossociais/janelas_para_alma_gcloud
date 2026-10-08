import { useCallback, useEffect, useRef, useState, type MutableRefObject } from "react";
import { useTranslation } from "react-i18next";
import { Mountain } from "lucide-react";
import { Botao } from "@/design/componentes/Botao";
import AnelLandolt from "@/components/visao/AnelLandolt";
import AssistenteTreino, {
  type ApiTarefa,
  type ContextoTreino,
  type ResultadoTreino,
} from "@/components/visao/AssistenteTreino";
import PalcoVisual from "@/components/visao/PalcoVisual";
import SeletorDireccao from "@/components/visao/SeletorDireccao";
import { formatarDecimal } from "@/i18n/formatar";
import { direccaoAleatoria, iniciarEscadaTreino, responderTreino, type Direccao } from "@/lib/visao/escada";
import { aberturaPx } from "@/lib/visao/geometria";
import { criarAgendaControlo } from "@/lib/visao/treino";
import { ID_PERTO_LONGE } from "@/lib/visao/ids";

const EXERCICIO_ID = ID_PERTO_LONGE;

/** O alvo perto fica a ~40 cm (distância de leitura). */
const DISTANCIA_PERTO_MM = 400;
/** Tamanho do alvo de perto e do alvo de controlo (muito fácil). */
const LOGMAR_ALVO = 0.3;
const LOGMAR_CONTROLO = 1.0;
/** Tempo-alvo por mudança de foco, em segundos, do nível 1 ao 6. */
const NIVEIS_SEGUNDOS = [6, 4.5, 3.5, 2.5, 2, 1.5];

type Fase = "perto" | "longe";

const mediana = (xs: number[]) => {
  if (!xs.length) return null;
  const o = [...xs].sort((a, b) => a - b);
  const m = Math.floor(o.length / 2);
  return o.length % 2 ? o[m] : (o[m - 1] + o[m]) / 2;
};

/**
 * Perto e longe: alternar o foco entre um anel no ecrã (~40 cm) e um objecto
 * a 3 m ou mais, tocando "Nítido" quando cada um fica nítido. Mede o tempo
 * de cada mudança; a escada de treino pede mudanças mais rápidas a cada
 * nível. Exercício de flexibilidade -- sem promessas de tratamento.
 */
const TarefaPertoLonge = ({
  api,
  ctx,
  resultado,
}: {
  api: ApiTarefa;
  ctx: ContextoTreino;
  resultado: MutableRefObject<(() => ResultadoTreino) | null>;
}) => {
  const { t } = useTranslation();
  const [fase, setFase] = useState<Fase>("perto");
  const [escada, setEscada] = useState(() => iniciarEscadaTreino(NIVEIS_SEGUNDOS.length, 0));
  const [direccao, setDireccao] = useState<Direccao>(() => direccaoAleatoria(null));
  const [controlo, setControlo] = useState(false);
  const inicioFase = useRef(performance.now());
  const tempos = useRef<number[]>([]);
  const ciclos = useRef(0);
  // A vez do controlo (10.ª, 20.ª... tentativa) pode calhar num toque de
  // "perto" ou de "longe"; fica pendente até à próxima fase "perto".
  const agendaControlo = useRef(criarAgendaControlo());
  const tentativas = useRef(0);
  const escadaRef = useRef(escada);
  escadaRef.current = escada;

  resultado.current = () => {
    const m = mediana(tempos.current);
    const s = m === null ? null : Math.round(m * 10) / 10;
    return {
      limiar: s,
      unidade: "segundos",
      resumo:
        s === null
          ? ""
          : t("Visao.pertoLongeResumo", { segundos: formatarDecimal(s, 1), nivel: escadaRef.current.melhor + 1 }),
      sinais: { ciclos: ciclos.current, nivel_max: escadaRef.current.melhor + 1 },
    };
  };

  // Ao voltar da pausa, a fase recomeça a contar agora.
  useEffect(() => {
    if (api.activo) inicioFase.current = performance.now();
  }, [api.activo]);

  const alvo = NIVEIS_SEGUNDOS[escada.indice];

  const proximaFase = useCallback(() => {
    setFase((f) => {
      if (f === "longe") ciclos.current += 1;
      return f === "perto" ? "longe" : "perto";
    });
    setDireccao((d) => direccaoAleatoria(d));
    inicioFase.current = performance.now();
  }, []);

  const nitido = () => {
    if (!api.activo) return;
    const s = (performance.now() - inicioFase.current) / 1000;
    tempos.current.push(s);
    api.registar({ controlo: false, acertou: true });
    tentativas.current += 1;
    setEscada((e) => responderTreino(e, s <= alvo));
    // O controlo aparece no lugar de uma fase "perto" (a seguir a um "longe").
    if (agendaControlo.current.aposResposta(tentativas.current, fase === "longe")) setControlo(true);
    proximaFase();
  };

  const responderControlo = (d: Direccao | null) => {
    if (!api.activo) return;
    api.registar({ controlo: true, acertou: d === direccao });
    tentativas.current += 1;
    setControlo(false);
    setDireccao((x) => direccaoAleatoria(x));
    inicioFase.current = performance.now();
  };

  const gap = Math.max(aberturaPx(LOGMAR_ALVO, DISTANCIA_PERTO_MM, ctx.pxPorMm), 1.5 / ctx.devicePixelRatio);

  return (
    <div className="flex flex-col items-center gap-4">
      <p className="text-xs font-medium text-muted-foreground">
        {t("Visao.pertoLongeNivel", { nivel: escada.indice + 1, segundos: formatarDecimal(alvo, 1) })}
      </p>
      {controlo ? (
        <>
          <p className="text-center text-sm text-muted-foreground">{t("Visao.pertoLongeControlo")}</p>
          <PalcoVisual className="min-h-[200px]" rotulo={t("Visao.rotuloAnel")}>
            <AnelLandolt aberturaPx={aberturaPx(LOGMAR_CONTROLO, DISTANCIA_PERTO_MM, ctx.pxPorMm)} direccao={direccao} />
          </PalcoVisual>
          <SeletorDireccao aoResponder={responderControlo} desactivado={!api.activo} />
        </>
      ) : (
        <>
          <p className="text-center font-semibold text-foreground" aria-live="polite">
            {fase === "perto" ? t("Visao.pertoLongeOlhePerto") : t("Visao.pertoLongeOlheLonge")}
          </p>
          <PalcoVisual className="min-h-[200px]" rotulo={fase === "perto" ? t("Visao.rotuloAnel") : undefined}>
            {fase === "perto" ? (
              <AnelLandolt aberturaPx={gap} direccao={direccao} />
            ) : (
              <Mountain className="h-16 w-16" style={{ color: "#16305C" }} aria-hidden />
            )}
          </PalcoVisual>
          <Botao tamanho="g" className="w-full max-w-xs" onClick={nitido}>
            {t("Visao.nitido")}
          </Botao>
        </>
      )}
    </div>
  );
};

const TreinoPertoLonge = () => {
  const { t } = useTranslation();
  return (
    <AssistenteTreino
      exercicioId={EXERCICIO_ID}
      grupo="premium"
      titulo={t("Visao.pertoLongeTitulo")}
      descricao={t("Visao.pertoLongeDescricao")}
      monocular
      distanciaFixaMm={DISTANCIA_PERTO_MM}
      aviso={<p className="text-sm text-muted-foreground">{t("Visao.pertoLongeComoFazer")}</p>}
      tarefa={(api, ctx, resultado) => <TarefaPertoLonge api={api} ctx={ctx} resultado={resultado} />}
    />
  );
};

export default TreinoPertoLonge;
