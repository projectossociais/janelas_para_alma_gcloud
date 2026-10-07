import { useCallback, useEffect, useRef, useState, type MutableRefObject } from "react";
import { useTranslation } from "react-i18next";
import { AlertTriangle } from "lucide-react";
import { Botao } from "@/design/componentes/Botao";
import AssistenteTreino, {
  type ApiTarefa,
  type ContextoTreino,
  type ResultadoTreino,
} from "@/components/visao/AssistenteTreino";
import PalcoVisual from "@/components/visao/PalcoVisual";
import { PAUSA_AUTOMATICA_MS } from "@/lib/visao/tempoActivo";
import { ID_CONVERGENCIA } from "@/lib/visao/ids";

const EXERCICIO_ID = ID_CONVERGENCIA;

type Nivel = "normal" | "saltos";

/** Separação entre os centros dos pontos, em mm no ecrã. */
const SEPARACAO_MIN_MM = 12;
const SEPARACAO_MAX_MM = 45;
const DIAMETRO_PONTO_MM = 5;
/** Nível normal: um vaivém completo em 16 s. */
const PERIODO_NORMAL_MS = 16000;
/** Nível avançado ("saltos"): muda de separação de repente a cada 2,5 s. */
const INTERVALO_SALTO_MS = 2500;
/** Lembrete para responder, antes da pausa automática dos 8 s. */
const LEMBRETE_MS = 5000;

/**
 * Dois pontos que se afastam e aproximam devagar (ou aos saltos, no nível
 * avançado). O utilizador junta-os numa só imagem e diz o que vê: "Vejo 1"
 * ou "Vejo 2". Conta o tempo com imagem única, com as mesmas regras do
 * tempo activo (intervalos entre respostas até 8 s).
 *
 * Os dois olhos trabalham juntos: é o único treino sem tapa-olho.
 */
const TarefaConvergencia = ({
  api,
  ctx,
  resultado,
}: {
  api: ApiTarefa;
  ctx: ContextoTreino;
  resultado: MutableRefObject<(() => ResultadoTreino) | null>;
}) => {
  const { t } = useTranslation();
  const [nivel, setNivel] = useState<Nivel>("normal");
  const [usouSaltos, setUsouSaltos] = useState(false);
  const [controlo, setControlo] = useState(false);
  const pontoEsq = useRef<HTMLDivElement>(null);
  const pontoDir = useRef<HTMLDivElement>(null);
  const msImagemUnica = useRef(0);
  const ultima = useRef<{ em: number; vejo: 1 | 2 } | null>(null);
  const respostas = useRef(0);

  const pxMm = ctx.pxPorMm;
  resultado.current = () => {
    const s = Math.round(msImagemUnica.current / 1000);
    return {
      limiar: s,
      unidade: "segundos",
      resumo: t("Visao.convergenciaResumo", { segundos: s }),
      sinais: { nivel_max: usouSaltos ? "saltos" : "normal", respostas: respostas.current },
    };
  };

  // Um só requestAnimationFrame; posições escritas directamente no estilo,
  // sem transição CSS por cima. Ângulo contínuo (sem módulo antes do seno).
  useEffect(() => {
    if (!api.activo || controlo) return;
    const inicio = performance.now();
    let raf = 0;
    let proximoSalto = 0;
    let separacaoSalto = (SEPARACAO_MIN_MM + SEPARACAO_MAX_MM) / 2;
    const animar = (agora: number) => {
      const decorrido = agora - inicio;
      let mm: number;
      if (nivel === "normal") {
        const fase = (decorrido / PERIODO_NORMAL_MS) * Math.PI * 2;
        mm = SEPARACAO_MIN_MM + ((SEPARACAO_MAX_MM - SEPARACAO_MIN_MM) * (1 - Math.cos(fase))) / 2;
      } else {
        if (decorrido >= proximoSalto) {
          separacaoSalto = SEPARACAO_MIN_MM + Math.random() * (SEPARACAO_MAX_MM - SEPARACAO_MIN_MM);
          proximoSalto = decorrido + INTERVALO_SALTO_MS;
        }
        mm = separacaoSalto;
      }
      const meio = (mm * pxMm) / 2;
      if (pontoEsq.current) pontoEsq.current.style.transform = `translate(calc(-50% - ${meio}px), -50%)`;
      if (pontoDir.current) pontoDir.current.style.transform = `translate(calc(-50% + ${meio}px), -50%)`;
      raf = requestAnimationFrame(animar);
    };
    raf = requestAnimationFrame(animar);
    return () => cancelAnimationFrame(raf);
  }, [api.activo, controlo, nivel, pxMm]);

  // Sem resposta há 5 s: lembrar de responder (o tempo activo pára aos 8 s).
  const [lembrar, setLembrar] = useState(false);
  useEffect(() => {
    if (!api.activo) return;
    const id = window.setInterval(() => {
      const em = ultima.current?.em;
      // Só depois da primeira resposta: antes disso, a instrução já diz o que fazer.
      setLembrar(em !== undefined && performance.now() - em > LEMBRETE_MS);
    }, 1000);
    return () => window.clearInterval(id);
  }, [api.activo]);

  // Pausa entre blocos: o intervalo em curso não conta como imagem única.
  useEffect(() => {
    if (!api.activo) ultima.current = null;
  }, [api.activo]);

  const responder = useCallback(
    (vejo: 1 | 2) => {
      if (!api.activo) return;
      const agora = performance.now();
      respostas.current += 1;
      if (controlo) {
        api.registar({ controlo: true, acertou: vejo === 1 });
        setControlo(false);
        ultima.current = null;
        return;
      }
      if (ultima.current?.vejo === 1 && agora - ultima.current.em <= PAUSA_AUTOMATICA_MS) {
        msImagemUnica.current += agora - ultima.current.em;
      }
      ultima.current = { em: agora, vejo };
      setLembrar(false);
      api.registar({ controlo: false, acertou: true });
      if (api.proximaEControlo()) setControlo(true);
    },
    [api, controlo],
  );

  const diametro = DIAMETRO_PONTO_MM * pxMm;
  const estiloPonto = { width: diametro, height: diametro, backgroundColor: "#000" } as const;

  return (
    <div className="flex flex-col items-center gap-4">
      <div role="radiogroup" aria-label={t("Visao.convergenciaNivel")} className="flex gap-2">
        {(["normal", "saltos"] as const).map((n) => (
          <Botao
            key={n}
            role="radio"
            aria-checked={nivel === n}
            variante={nivel === n ? "primario" : "secundario"}
            onClick={() => {
              setNivel(n);
              if (n === "saltos") setUsouSaltos(true);
            }}
          >
            {n === "normal" ? t("Visao.nivelNormal") : t("Visao.nivelSaltos")}
          </Botao>
        ))}
      </div>
      <p className="text-center text-sm text-muted-foreground">
        {controlo ? t("Visao.convergenciaControlo") : t("Visao.convergenciaInstrucao")}
      </p>
      <PalcoVisual className="relative h-[220px] sm:h-[260px]" rotulo={t("Visao.rotuloDoisPontos")}>
        {controlo ? (
          <div className="rounded-full" style={estiloPonto} />
        ) : (
          <>
            <div ref={pontoEsq} className="absolute left-1/2 top-1/2 rounded-full" style={estiloPonto} />
            <div ref={pontoDir} className="absolute left-1/2 top-1/2 rounded-full" style={estiloPonto} />
          </>
        )}
      </PalcoVisual>
      {lembrar && !controlo && (
        <p className="text-center text-sm font-medium text-foreground" aria-live="polite">
          {t("Visao.convergenciaLembrete")}
        </p>
      )}
      <div className="grid w-full max-w-sm grid-cols-2 gap-3">
        <Botao tamanho="g" onClick={() => responder(1)}>
          {t("Visao.vejo1")}
        </Botao>
        <Botao tamanho="g" variante="secundario" onClick={() => responder(2)}>
          {t("Visao.vejo2")}
        </Botao>
      </div>
    </div>
  );
};

const AvisoConvergencia = () => {
  const { t } = useTranslation();
  return (
    <div className="space-y-3 text-left text-sm">
      <p className="flex gap-2 rounded-lg border border-linha bg-aviso-suave p-3 text-foreground" role="note">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-aviso" aria-hidden />
        <span>{t("Visao.convergenciaAvisoParar")}</span>
      </p>
      <p className="flex gap-2 rounded-lg border border-linha bg-aviso-suave p-3 text-foreground" role="note">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-aviso" aria-hidden />
        <span>{t("Visao.convergenciaAvisoEstrabismo")}</span>
      </p>
      <p className="text-muted-foreground">{t("Visao.convergenciaComoFazer")}</p>
    </div>
  );
};

const TreinoConvergencia = () => {
  const { t } = useTranslation();
  return (
    <AssistenteTreino
      exercicioId={EXERCICIO_ID}
      grupo="premium"
      titulo={t("Visao.convergenciaTitulo")}
      descricao={t("Visao.convergenciaDescricao")}
      monocular={false}
      aviso={<AvisoConvergencia />}
      tarefa={(api, ctx, resultado) => <TarefaConvergencia api={api} ctx={ctx} resultado={resultado} />}
    />
  );
};

export default TreinoConvergencia;
