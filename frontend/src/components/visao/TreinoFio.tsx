import { useEffect, useRef, useState, type MutableRefObject } from "react";
import { useTranslation } from "react-i18next";
import { Square } from "lucide-react";
import type { ApiTarefa, ContextoTreino, ResultadoTreino } from "@/components/visao/AssistenteTreino";
import { desenharFio } from "@/components/visao/desenhoFio";
import { formatarDecimal } from "@/i18n/formatar";
import { MISSANGAS, NARIZ_MM, inicioDaMissanga } from "@/lib/visao/fioMissangas";
import {
  MODO_FIO_TREINO,
  ROTURAS_GUARDADAS,
  avancarFio,
  iniciarFioTreino,
  posicaoNoTreino,
  resumirFioTreino,
  retomarFio,
  tocarFio,
  type EstadoFioTreino,
  type EventoFio,
} from "@/lib/visao/fioTreino";
import { sinalSonoro } from "@/lib/visao/voz";

/** De quanto em quanto tempo a missanga anda (≈ 30 imagens por segundo). */
const PASSO_MS = 33;
/** De quanto em quanto tempo se diz ao assistente que a pessoa continua a olhar. */
const PRESENCA_MS = 2000;
/** Quanto tempo fica no ecrã a mensagem de uma repetição ("Chegou ao nariz!"). */
const MENSAGEM_MS = 1400;

const cmTexto = (cm: number) => `${formatarDecimal(cm, cm % 1 ? 1 : 0)} cm`;

/**
 * Vaivém da Missanga (id `convergence`): o ecrã inteiro e branco do Fio de
 * Missangas, com a missanga em vaivém à volta do ponto em que os olhos se
 * separam. Um toque em qualquer sítio. Ver `lib/visao/fioTreino.ts`.
 *
 * Só ocupa o ecrã com o bloco a correr: nas pausas entre blocos o assistente
 * esconde a tarefa e a missanga fica onde estava.
 */
const TreinoFio = ({
  api,
  ctx,
  resultado,
}: {
  api: ApiTarefa;
  ctx: ContextoTreino;
  resultado: MutableRefObject<(() => ResultadoTreino) | null>;
}) => {
  const { t } = useTranslation();
  const { pxPorMm } = ctx;
  const ref = useRef<HTMLCanvasElement>(null);
  const [tam, setTam] = useState({ w: window.innerWidth, h: window.innerHeight });
  const inicioCm = inicioDaMissanga(tam.h, pxPorMm);
  const estado = useRef<EstadoFioTreino>(iniciarFioTreino(inicioCm, Date.now()));
  // O que o ecrã mostra do estado (a posição muda a cada passo; o resto, só com acontecimentos).
  const [vista, setVista] = useState({ cm: inicioCm, fase: estado.current.fase, marca: null as number | null, reps: 0, melhor: null as number | null });
  const [mensagem, setMensagem] = useState<EventoFio | null>(null);
  const apiRef = useRef(api);
  apiRef.current = api;
  const inicioRef = useRef(inicioCm);
  inicioRef.current = inicioCm;

  resultado.current = () => {
    const reps = estado.current.reps;
    const r = resumirFioTreino(reps);
    return {
      limiar: r.medianaCm,
      unidade: "cm",
      resumo:
        r.medianaCm === null
          ? t("Visao.fioTreinoSemReps")
          : t("Visao.fioTreinoResumo", { n: r.repeticoes, cm: cmTexto(r.medianaCm), melhor: r.melhorCm === 0 ? t("Visao.fioTreinoNariz") : cmTexto(r.melhorCm ?? 0) }),
      sinais: {
        modo: MODO_FIO_TREINO,
        repeticoes: r.repeticoes,
        mediana_cm: r.medianaCm,
        melhor_cm: r.melhorCm,
        chegou_ao_nariz: r.narizes,
        sem_recuperar: r.semRecuperar,
        rotura_cm: reps.slice(-ROTURAS_GUARDADAS).map((x) => x.rotura),
        inicio_cm: inicioRef.current,
      },
    };
  };

  useEffect(() => {
    const medir = () => setTam({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener("resize", medir);
    return () => window.removeEventListener("resize", medir);
  }, []);

  const mostrar = (agora: number) => {
    const e = estado.current;
    const r = resumirFioTreino(e.reps);
    setVista({ cm: posicaoNoTreino(e, agora, inicioRef.current), fase: e.fase, marca: e.rotura, reps: r.repeticoes, melhor: r.melhorCm });
  };

  const acontecer = (evento: EventoFio | undefined) => {
    if (!evento) return;
    if (evento === "nariz") sinalSonoro("festa");
    else sinalSonoro("tic");
    // Uma repetição fechada conta como resposta (o toque já contou as outras).
    if (evento === "nariz" || evento === "semRecuperar") apiRef.current.registar({ controlo: false, acertou: evento === "nariz" });
    if (evento !== "rotura") setMensagem(evento);
  };

  useEffect(() => {
    if (!mensagem) return;
    const id = window.setTimeout(() => setMensagem(null), MENSAGEM_MS);
    return () => window.clearTimeout(id);
  }, [mensagem, vista.reps]);

  // A missanga a andar, só com o bloco a correr. Ao voltar de uma pausa, retoma de onde ficou.
  const activo = api.activo;
  useEffect(() => {
    if (!activo) return;
    const agora0 = Date.now();
    estado.current = retomarFio(estado.current, Math.min(vistaCm.current, inicioRef.current), agora0);
    let presenca = agora0;
    // Ecrã inteiro, quando o aparelho deixa (no iPhone não): o fundo da página fica na ponta do telemóvel.
    const pedido = document.documentElement.requestFullscreen?.() as Promise<void> | undefined;
    pedido?.catch(() => undefined);
    const id = window.setInterval(() => {
      const agora = Date.now();
      const r = avancarFio(estado.current, agora, inicioRef.current);
      estado.current = r.estado;
      acontecer(r.evento);
      if (agora - presenca >= PRESENCA_MS) {
        presenca = agora;
        apiRef.current.presente?.();
      }
      mostrar(agora);
    }, PASSO_MS);
    return () => {
      window.clearInterval(id);
      if (!document.fullscreenElement) return;
      const saida = document.exitFullscreen?.() as Promise<void> | undefined;
      saida?.catch(() => undefined);
    };
    // `acontecer` e `mostrar` mudam a cada render; o intervalo só recomeça com o bloco.
  }, [activo]);

  const vistaCm = useRef(vista.cm);
  vistaCm.current = vista.cm;

  const tocar = () => {
    if (!api.activo) return;
    const agora = Date.now();
    const r = tocarFio(estado.current, agora, inicioRef.current);
    if (!r.evento) return;
    estado.current = r.estado;
    api.registar({ controlo: false, acertou: true });
    acontecer(r.evento);
    mostrar(agora);
  };

  useEffect(() => {
    const cv = ref.current;
    const g = cv?.getContext("2d");
    if (!cv || !g) return;
    desenharFio(cv, g, { w: tam.w, h: tam.h, pxPorMm, inicioCm, cm: vista.cm, cor: MISSANGAS[vista.reps % MISSANGAS.length].hex, marcaCm: vista.marca });
  }, [inicioCm, pxPorMm, tam, vista]);

  const aAfastar = vista.fase === "afastar";
  const titulo = mensagem
    ? t(`Visao.fioTreinoEvento_${mensagem}`)
    : aAfastar
      ? t("Visao.fioToqueUma")
      : vista.fase === "folga"
        ? t("Visao.fioTreinoDescanse")
        : t("Visao.fioToqueDuas");

  return (
    <div className="fixed inset-0 z-[100]" style={{ backgroundColor: "#ffffff", color: "#17201f", colorScheme: "light" }}>
      <canvas ref={ref} aria-hidden className="block" style={{ width: tam.w, height: tam.h }} />
      {/* À esquerda, para não tapar o fio, que está ao centro. */}
      <div className="pointer-events-none absolute left-4 top-4 max-w-[38%] space-y-2 text-left" aria-live="polite">
        <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "#56635f" }}>
          {t("Visao.fioTreinoReps", { n: vista.reps })}
        </p>
        <p className="text-xl font-bold leading-tight">{titulo}</p>
        {vista.melhor !== null && (
          <p className="text-sm leading-snug" style={{ color: "#56635f" }}>
            {t("Visao.fioTreinoMelhor", { valor: vista.melhor === 0 ? t("Visao.fioTreinoNariz") : cmTexto(vista.melhor) })}
          </p>
        )}
      </div>
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 grid place-items-center text-sm font-bold"
        style={{ height: NARIZ_MM * pxPorMm, backgroundColor: "#127a6e", color: "#ffffff" }}
      >
        {t("Visao.fioNariz")}
      </div>
      <button
        type="button"
        aria-label={aAfastar ? t("Visao.fioToqueUma") : t("Visao.fioToqueDuas")}
        className="absolute inset-0 h-full w-full cursor-pointer touch-none bg-transparent focus-visible:outline-none"
        onPointerDown={tocar}
      />
      {/* Por cima da zona de toque, no canto contrário ao do texto e longe do botão do som (em baixo, à esquerda). */}
      {api.terminar && (
        <button
          type="button"
          onClick={api.terminar}
          className="absolute right-3 top-3 flex items-center gap-1 rounded-lg border px-3 py-2 text-sm"
          style={{ borderColor: "#cccccc", backgroundColor: "#f4f4f4", color: "#333333" }}
        >
          <Square className="h-3.5 w-3.5" aria-hidden />
          {t("Visao.terminarAgora")}
        </button>
      )}
    </div>
  );
};

export default TreinoFio;
