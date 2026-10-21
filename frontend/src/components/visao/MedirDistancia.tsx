import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { RotateCcw, Ruler, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BotaoContinuar, EcraPasso } from "@/components/visao/EcraPasso";
import {
  MEDICOES_MINIMAS,
  TAMANHO_ALVO_MM,
  avaliarMedicoes,
  classificarMedicao,
  desvioDoPonto,
  distanciaDoDesvio,
  distanciaMaximaMensuravel,
  sentidoDoPonto,
} from "@/lib/visao/pontoCego";
import type { Olho } from "@/lib/visao/resultados";

/** Margem entre os alvos e a borda do ecrã, em px CSS. */
const MARGEM_PX = 24;
/** Pausa entre duas passagens do ponto (e depois de um toque). */
const PAUSA_MS = 900;
/** Passagens seguidas em que o ponto chega à borda sem sumir, antes de desistir. */
const FALHAS_MAX = 2;
/** Abaixo disto, avisa-se para rodar o telemóvel antes de começar. */
const ALCANCE_CONFORTAVEL_MM = 550;

type Desfecho = { estado: "concluida"; distanciaMm: number } | { estado: "inconsistente" } | { estado: "naoSumiu" };

/**
 * O ecrã da medição em si: ocupa a janela toda (o ponto precisa de toda a
 * largura), fundo branco fixo como o `PalcoVisual`. Um só
 * requestAnimationFrame a mover o ponto, posição escrita directamente no
 * estilo, sem transições CSS (CLAUDE.md §6).
 */
const Pista = ({
  pxPorMm,
  olho,
  aoTerminar,
  aoCancelar,
}: {
  pxPorMm: number;
  olho: Olho;
  aoTerminar: (d: Desfecho) => void;
  aoCancelar: () => void;
}) => {
  const { t } = useTranslation();
  const contentor = useRef<HTMLDivElement>(null);
  const ponto = useRef<HTMLDivElement>(null);
  const quadrado = useRef<HTMLDivElement>(null);
  const [validas, setValidas] = useState(0);
  const [aviso, setAviso] = useState(false);
  // Os callbacks mudam a cada render do pai; a animação não deve recomeçar por isso.
  const terminar = useRef(aoTerminar);
  const cancelar = useRef(aoCancelar);
  terminar.current = aoTerminar;
  cancelar.current = aoCancelar;

  useEffect(() => {
    const caixa = contentor.current;
    const elPonto = ponto.current;
    const elQuadrado = quadrado.current;
    if (!caixa || !elPonto || !elQuadrado) return;

    const sentido = sentidoDoPonto(olho);
    const alvoPx = TAMANHO_ALVO_MM * pxPorMm;
    const largura = caixa.clientWidth;
    // O quadrado fica do lado contrário ao do percurso, para o ponto ter a largura toda.
    const fixX = sentido < 0 ? largura - MARGEM_PX - alvoPx / 2 : MARGEM_PX + alvoPx / 2;
    const limiteMm = (sentido < 0 ? fixX - MARGEM_PX - alvoPx / 2 : largura - MARGEM_PX - alvoPx / 2 - fixX) / pxPorMm;
    elQuadrado.style.transform = `translate(${fixX - alvoPx / 2}px, -50%)`;

    let medicoes: number[] = [];
    let falhas = 0;
    let parado = false;
    let inicio = performance.now() + PAUSA_MS;
    let raf = 0;

    const mostrar = (desvioMm: number | null) => {
      if (desvioMm === null) {
        elPonto.style.visibility = "hidden";
        return;
      }
      elPonto.style.visibility = "visible";
      elPonto.style.transform = `translate(${fixX + sentido * desvioMm * pxPorMm - alvoPx / 2}px, -50%)`;
    };

    const fim = (d: Desfecho) => {
      parado = true;
      mostrar(null);
      terminar.current(d);
    };

    const animar = (agora: number) => {
      if (parado) return;
      if (agora < inicio) mostrar(null);
      else {
        const desvio = desvioDoPonto((agora - inicio) / 1000);
        if (desvio > limiteMm) {
          falhas += 1;
          mostrar(null);
          if (falhas >= FALHAS_MAX) return fim({ estado: "naoSumiu" });
          inicio = agora + PAUSA_MS;
        } else mostrar(desvio);
      }
      raf = requestAnimationFrame(animar);
    };

    const responder = () => {
      const agora = performance.now();
      if (parado || agora < inicio) return; // entre passagens: o toque não conta
      const distancia = distanciaDoDesvio(desvioDoPonto((agora - inicio) / 1000));
      inicio = agora + PAUSA_MS;
      mostrar(null);
      if (classificarMedicao(distancia) !== "valida") {
        setAviso(true);
        return;
      }
      setAviso(false);
      falhas = 0;
      medicoes = [...medicoes, distancia];
      setValidas(medicoes.length);
      const avaliacao = avaliarMedicoes(medicoes);
      if (avaliacao.estado !== "continuar") fim(avaliacao);
    };

    const aoTocar = (e: PointerEvent) => {
      if ((e.target as HTMLElement).closest("[data-cancelar]")) return;
      e.preventDefault();
      responder();
    };
    const aoTecla = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        parado = true;
        cancelar.current();
        return;
      }
      if (e.repeat || e.key === "Tab") return;
      e.preventDefault();
      responder();
    };

    caixa.addEventListener("pointerdown", aoTocar);
    window.addEventListener("keydown", aoTecla);
    raf = requestAnimationFrame(animar);
    return () => {
      parado = true;
      cancelAnimationFrame(raf);
      caixa.removeEventListener("pointerdown", aoTocar);
      window.removeEventListener("keydown", aoTecla);
    };
  }, [olho, pxPorMm]);

  const alvo = TAMANHO_ALVO_MM * pxPorMm;
  return (
    <div
      ref={contentor}
      className="fixed inset-0 z-[60] touch-none select-none"
      style={{
        backgroundColor: "#ffffff",
        color: "#000000",
        colorScheme: "light",
        paddingTop: "env(safe-area-inset-top, 0px)",
        paddingLeft: "env(safe-area-inset-left, 0px)",
        paddingRight: "env(safe-area-inset-right, 0px)",
      }}
      role="application"
      aria-label={t("Visao.medirPistaRotulo")}
    >
      <div className="flex items-start justify-between gap-3 px-4 pt-3 text-sm">
        <p className="max-w-md">
          {t("Visao.medirPistaInstrucao")}
          <span className="mt-1 block font-semibold" aria-live="polite">
            {aviso ? t("Visao.medirCedoDemais") : t("Visao.medirContagem", { feitas: validas, total: MEDICOES_MINIMAS })}
          </span>
        </p>
        <Button
          data-cancelar
          variant="outline"
          size="sm"
          className="shrink-0 border-black/30 bg-white text-black hover:bg-black/5"
          onClick={aoCancelar}
        >
          <X className="h-4 w-4" />
          {t("Visao.medirCancelar")}
        </Button>
      </div>
      <div
        ref={quadrado}
        aria-hidden
        className="absolute left-0 top-1/2"
        style={{ width: alvo, height: alvo, backgroundColor: "#000000" }}
      />
      <div
        ref={ponto}
        aria-hidden
        className="absolute left-0 top-1/2 rounded-full"
        style={{ width: alvo, height: alvo, backgroundColor: "#e00000", visibility: "hidden" }}
      />
    </div>
  );
};

type Fase = "instrucoes" | "medir" | "resultado" | "inconsistente" | "naoSumiu";

/**
 * Régua Invisível, passo da distância: mede a distância olhos-ecrã pelo ponto
 * cego (ver `lib/visao/pontoCego.ts`), sem câmara. Mede-se com o olho que vê
 * melhor (`olho`), com o outro tapado pela mão.
 */
const MedirDistancia = ({
  pxPorMm,
  olho,
  aoMedir,
  aoDesistir,
}: {
  pxPorMm: number;
  olho: Olho;
  aoMedir: (distanciaMm: number) => void;
  /** "Escolher sem medir": volta às distâncias de sempre. */
  aoDesistir: () => void;
}) => {
  const { t } = useTranslation();
  const [fase, setFase] = useState<Fase>("instrucoes");
  const [distanciaMm, setDistanciaMm] = useState<number | null>(null);
  const [larguraJanela, setLarguraJanela] = useState(() => (typeof window === "undefined" ? 1024 : window.innerWidth));

  useEffect(() => {
    const medir = () => setLarguraJanela(window.innerWidth);
    window.addEventListener("resize", medir);
    return () => window.removeEventListener("resize", medir);
  }, []);

  const nomeOlho = (o: Olho) => (o === "direito" ? t("Visao.olhoDireito") : t("Visao.olhoEsquerdo")).toLocaleLowerCase();
  const tapar = nomeOlho(olho === "direito" ? "esquerdo" : "direito");
  const percursoMm = (larguraJanela - 2 * MARGEM_PX) / pxPorMm - TAMANHO_ALVO_MM;
  const alcanceMm = distanciaMaximaMensuravel(percursoMm);

  const desistir = (
    <Button variant="ghost" onClick={aoDesistir}>
      {t("Visao.medirSemMedir")}
    </Button>
  );

  if (fase === "medir")
    return (
      <Pista
        pxPorMm={pxPorMm}
        olho={olho}
        aoCancelar={() => setFase("instrucoes")}
        aoTerminar={(d) => {
          if (d.estado === "concluida") {
            setDistanciaMm(d.distanciaMm);
            setFase("resultado");
          } else setFase(d.estado);
        }}
      />
    );

  if (fase === "resultado" && distanciaMm !== null)
    return (
      <EcraPasso
        icone={<Ruler className="h-7 w-7" />}
        titulo={t("Visao.medirResultadoTitulo", { cm: Math.round(distanciaMm / 10) })}
        accao={
          <>
            <BotaoContinuar aoClicar={() => aoMedir(distanciaMm)} />
            <Button variant="ghost" onClick={() => setFase("instrucoes")}>
              <RotateCcw className="h-4 w-4" />
              {t("Visao.medirDeNovo")}
            </Button>
          </>
        }
      >
        <p className="text-sm text-muted-foreground">{t("Visao.medirResultadoTexto")}</p>
      </EcraPasso>
    );

  if (fase === "inconsistente" || fase === "naoSumiu")
    return (
      <EcraPasso
        icone={<Ruler className="h-7 w-7" />}
        titulo={fase === "naoSumiu" ? t("Visao.medirNaoSumiuTitulo") : t("Visao.medirInconsistenteTitulo")}
        accao={
          <>
            <BotaoContinuar aoClicar={() => setFase("medir")}>{t("Visao.tentarDeNovo")}</BotaoContinuar>
            {desistir}
          </>
        }
      >
        <p className="text-sm text-muted-foreground">
          {fase === "naoSumiu" ? t("Visao.medirNaoSumiuTexto") : t("Visao.medirInconsistenteTexto")}
        </p>
      </EcraPasso>
    );

  return (
    <EcraPasso
      icone={<Ruler className="h-7 w-7" />}
      titulo={t("Visao.medirTitulo")}
      accao={
        <>
          <BotaoContinuar aoClicar={() => setFase("medir")}>{t("Visao.medirComecar")}</BotaoContinuar>
          {desistir}
        </>
      }
    >
      <p className="text-sm text-muted-foreground">{t("Visao.medirTexto")}</p>
      <ol className="w-full space-y-2 text-left text-sm text-foreground">
        {[
          t("Visao.medirPasso1"),
          t("Visao.medirPasso2", { olho: tapar }),
          t("Visao.medirPasso3"),
          t("Visao.medirPasso4"),
        ].map((passo, i) => (
          <li key={passo} className="flex items-start gap-2 rounded-lg bg-muted/40 px-3 py-2">
            <span className="font-semibold text-teal">{i + 1}.</span>
            {passo}
          </li>
        ))}
      </ol>
      {alcanceMm < ALCANCE_CONFORTAVEL_MM && (
        <p className="rounded-lg bg-gold/10 px-3 py-2 text-sm font-medium text-foreground">{t("Visao.medirRodar")}</p>
      )}
    </EcraPasso>
  );
};

export default MedirDistancia;
