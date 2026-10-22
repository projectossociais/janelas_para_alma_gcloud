import { useEffect, useMemo, useRef, useState, type MutableRefObject } from "react";
import { useTranslation } from "react-i18next";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import AssistenteTreino, {
  type ApiTarefa,
  type ContextoTreino,
  type ResultadoTreino,
} from "@/components/visao/AssistenteTreino";
import { BotoesForma } from "@/components/visao/BotoesForma";
import { EcraPasso } from "@/components/visao/EcraPasso";
import PaginaExercicio from "@/components/visao/PaginaExercicio";
import PalcoVisual from "@/components/visao/PalcoVisual";
import { rotuloDelta, rotuloSentidoPontes } from "@/components/visao/rotulos";
import { coresEstereograma, type Afinacao } from "@/lib/visao/anaglifo";
import { escolhaAleatoria } from "@/lib/visao/escada";
import { FORMAS, type Forma } from "@/lib/visao/estereograma";
import { arcsegParaPx } from "@/lib/visao/geometria";
import { ID_CONVERGENCIA } from "@/lib/visao/ids";
import {
  DIAMETRO_PONTE_MM,
  DISPARIDADE_FORMA_ARCSEG,
  ESPESSURA_ANEL_MM,
  MARGEM_PALCO_MM,
  NIVEIS_DELTA,
  PONTO_MM,
  VERIFICACAO_TENTATIVAS,
  gerarPonte,
  guardarEscolhaSentidos,
  iniciarRampa,
  lerEscolhaSentidos,
  niveisMostraveis,
  passouVerificacao,
  rampaEmDelta,
  responderRampa,
  resumirRampas,
  sentidosDaEscolha,
  separacaoMm,
  type EscolhaSentidos,
  type EstadoRampa,
  type RampaEmDelta,
  type Sentido,
} from "@/lib/visao/pontes";
import { cn } from "@/lib/utils";

const EXERCICIO_ID = ID_CONVERGENCIA;
/** Abaixo disto o ecrã não afasta os anéis o suficiente para valer a pena. */
const DEGRAUS_MINIMOS = 4;
const ESCOLHAS: readonly EscolhaSentidos[] = ["ambos", "convergencia", "divergencia"];

/** A ponte desenhada em píxeis de dispositivo (canvas), como o estereograma. */
const Ponte = ({
  larguraCss,
  alturaCss,
  dpr,
  pxPorMm,
  distanciaMm,
  delta,
  sentido,
  forma,
  semente,
  afinacao,
}: {
  larguraCss: number;
  alturaCss: number;
  dpr: number;
  pxPorMm: number;
  distanciaMm: number;
  delta: number;
  sentido: Sentido;
  forma: Forma;
  semente: number;
  afinacao: Afinacao | null;
}) => {
  const ref = useRef<HTMLCanvasElement>(null);
  const largura = Math.round(larguraCss * dpr);
  const altura = Math.round(alturaCss * dpr);
  useEffect(() => {
    const ctx = ref.current?.getContext("2d");
    if (!ctx || largura < 1 || altura < 1) return;
    const dispositivo = (mm: number) => mm * pxPorMm * dpr;
    const px = gerarPonte({
      largura,
      altura,
      lado: Math.round(dispositivo(DIAMETRO_PONTE_MM)),
      espessuraAnel: Math.max(1, Math.round(dispositivo(ESPESSURA_ANEL_MM))),
      separacao: Math.round(dispositivo(separacaoMm(delta, distanciaMm))),
      sentido,
      disparidadeForma: Math.max(1, Math.round(arcsegParaPx(DISPARIDADE_FORMA_ARCSEG, distanciaMm, pxPorMm) * dpr)),
      forma,
      tamanhoPonto: Math.max(1, Math.round(dispositivo(PONTO_MM))),
      cores: coresEstereograma(afinacao),
    });
    ctx.putImageData(new ImageData(px, largura, altura), 0, 0);
  }, [afinacao, altura, delta, distanciaMm, dpr, forma, largura, pxPorMm, semente, sentido]);
  return <canvas ref={ref} width={largura} height={altura} style={{ width: larguraCss, height: alturaCss, display: "block" }} />;
};

/** Largura disponível para o palco, em px CSS, actualizada quando a janela muda. */
function useLarguraDe(ref: MutableRefObject<HTMLDivElement | null>): number {
  const [largura, setLargura] = useState(0);
  useEffect(() => {
    const medir = () => setLargura(ref.current?.clientWidth ?? 0);
    medir();
    window.addEventListener("resize", medir);
    return () => window.removeEventListener("resize", medir);
  }, [ref]);
  return largura;
}

type Fase = "verificar" | "semFusao" | "rampas";

/**
 * Pontes de Fusão: primeiro confirma que a pessoa vê a forma escondida com os
 * anéis sobrepostos (0 Δ); depois, rampas de rotura e recuperação, a alternar
 * os sentidos escolhidos. A cada ~10 respostas, um estímulo de controlo a 0 Δ
 * (muito fácil) mede a atenção, como nos outros treinos.
 */
export const TarefaPontes = ({
  api,
  ctx,
  resultado,
}: {
  api: ApiTarefa;
  ctx: ContextoTreino;
  resultado: MutableRefObject<(() => ResultadoTreino) | null>;
}) => {
  const { t } = useTranslation();
  const contentor = useRef<HTMLDivElement | null>(null);
  const larguraCss = useLarguraDe(contentor);
  const { pxPorMm, distanciaMm, devicePixelRatio: dpr, afinacao } = ctx;
  const alturaCss = Math.round((DIAMETRO_PONTE_MM + 2 * MARGEM_PALCO_MM) * pxPorMm);

  const [escolha, setEscolha] = useState<EscolhaSentidos>(() => lerEscolhaSentidos());
  const sentidos = sentidosDaEscolha(escolha);
  const niveis = useMemo(
    () => ({
      convergencia: niveisMostraveis(NIVEIS_DELTA.convergencia, distanciaMm, larguraCss / pxPorMm),
      divergencia: niveisMostraveis(NIVEIS_DELTA.divergencia, distanciaMm, larguraCss / pxPorMm),
    }),
    [distanciaMm, larguraCss, pxPorMm],
  );

  const [fase, setFase] = useState<Fase>("verificar");
  const [verificacao, setVerificacao] = useState({ feitas: 0, certas: 0 });
  const [vez, setVez] = useState(0); // qual dos sentidos escolhidos está a correr
  const sentido = sentidos[vez % sentidos.length];
  const [rampa, setRampa] = useState<EstadoRampa | null>(null);
  const [controlo, setControlo] = useState(false);
  const [forma, setForma] = useState(() => escolhaAleatoria(FORMAS.length, null));
  const [semente, setSemente] = useState(0);
  const rampas = useRef<Record<Sentido, RampaEmDelta[]>>({ convergencia: [], divergencia: [] });
  const [ultima, setUltima] = useState<{ sentido: Sentido; r: RampaEmDelta } | null>(null);

  const niveisSentido = niveis[sentido];
  const ecraEstreito = larguraCss > 0 && niveisSentido.length < DEGRAUS_MINIMOS;

  // Uma rampa nova sempre que muda o sentido ou cabem outros degraus no ecrã.
  useEffect(() => {
    if (fase === "rampas" && niveisSentido.length >= DEGRAUS_MINIMOS) setRampa(iniciarRampa(niveisSentido.length));
  }, [fase, niveisSentido.length, sentido]);

  resultado.current = () => {
    const conv = resumirRampas(rampas.current.convergencia);
    const div = resumirRampas(rampas.current.divergencia);
    // O limiar da sessão é a rotura de convergência; sem ela, a de divergência.
    const sentidoLimiar: Sentido | null = conv.rampas ? "convergencia" : div.rampas ? "divergencia" : null;
    const principal = sentidoLimiar === "convergencia" ? conv : div;
    const linhas = [
      ...(conv.rampas ? [rotuloSentidoPontes("convergencia", conv)] : []),
      ...(div.rampas ? [rotuloSentidoPontes("divergencia", div)] : []),
    ];
    return {
      limiar: sentidoLimiar ? principal.rotura : null,
      unidade: "dioptrias_prismaticas",
      resumo: linhas.length ? linhas.join(" · ") : t("Visao.pontesSemRampas"),
      sinais: {
        pontes: { convergencia: conv, divergencia: div },
        sentido_limiar: sentidoLimiar,
        sentidos_escolhidos: escolha,
        verificacao_certas: verificacao.certas,
        forma_disparidade_arcsec: DISPARIDADE_FORMA_ARCSEG,
      },
    };
  };

  const novaApresentacao = () => {
    setForma((f) => escolhaAleatoria(FORMAS.length, f));
    setSemente((s) => s + 1);
  };

  const responder = (i: number) => {
    if (!api.activo) return;
    const acertou = i === forma;

    if (fase === "verificar") {
      api.registar({ controlo: false, acertou });
      const v = { feitas: verificacao.feitas + 1, certas: verificacao.certas + (acertou ? 1 : 0) };
      setVerificacao(v);
      if (v.feitas >= VERIFICACAO_TENTATIVAS) setFase(passouVerificacao(v.certas) ? "rampas" : "semFusao");
      novaApresentacao();
      return;
    }

    if (controlo) {
      api.registar({ controlo: true, acertou });
      setControlo(false);
      novaApresentacao();
      return;
    }

    if (!rampa) return;
    api.registar({ controlo: false, acertou });
    const seguinte = responderRampa(rampa, acertou);
    if (seguinte.terminado) {
      const r = rampaEmDelta(seguinte, niveisSentido);
      rampas.current[sentido] = [...rampas.current[sentido], r];
      setUltima({ sentido, r });
      setVez((n) => n + 1);
      if (sentidos.length === 1) setRampa(iniciarRampa(niveisSentido.length));
    } else setRampa(seguinte);
    if (api.proximaEControlo()) setControlo(true);
    novaApresentacao();
  };

  const mudarEscolha = (e: EscolhaSentidos) => {
    setEscolha(e);
    guardarEscolhaSentidos(e);
    setVez(0);
  };

  if (fase === "semFusao")
    return (
      <EcraPasso
        titulo={t("Visao.pontesSemFusaoTitulo")}
        accao={
          <Button
            size="lg"
            onClick={() => {
              setVerificacao({ feitas: 0, certas: 0 });
              setFase("verificar");
              novaApresentacao();
            }}
          >
            <RotateCcw className="h-4 w-4" />
            {t("Visao.tentarDeNovo")}
          </Button>
        }
      >
        <p className="text-sm text-muted-foreground">{t("Visao.pontesSemFusaoTexto")}</p>
      </EcraPasso>
    );

  const delta = fase === "verificar" || controlo || !rampa ? 0 : niveisSentido[rampa.indice];

  return (
    <div className="flex flex-col items-center gap-4">
      {fase === "rampas" && (
        <div className="flex flex-col items-center gap-1">
          <div role="radiogroup" aria-label={t("Visao.pontesSentidos")} className="flex flex-wrap justify-center gap-2">
            {ESCOLHAS.map((e) => (
              <Button
                key={e}
                role="radio"
                aria-checked={escolha === e}
                size="sm"
                variant={escolha === e ? "default" : "outline"}
                className={cn(escolha === e && "bg-navy text-navy-foreground hover:bg-navy/90")}
                onClick={() => mudarEscolha(e)}
              >
                {e === "ambos"
                  ? t("Visao.pontesSentidoAmbos")
                  : e === "convergencia"
                    ? t("Visao.pontesSentidoConvergencia")
                    : t("Visao.pontesSentidoDivergencia")}
              </Button>
            ))}
          </div>
          <p className="max-w-md text-center text-xs text-muted-foreground">{t("Visao.pontesNotaEsotropia")}</p>
        </div>
      )}

      <p className="text-center text-sm text-muted-foreground" aria-live="polite">
        {fase === "verificar"
          ? t("Visao.pontesVerificacao", { feitas: verificacao.feitas, total: VERIFICACAO_TENTATIVAS })
          : t("Visao.pontesInstrucao")}
      </p>

      <div ref={contentor} className="w-full">
        {ecraEstreito ? (
          <p className="rounded-lg bg-gold/10 px-3 py-2 text-center text-sm font-medium text-foreground">
            {t("Visao.pontesEcraEstreito")}
          </p>
        ) : (
          larguraCss > 0 && (
            <PalcoVisual className="min-h-0" rotulo={t("Visao.pontesRotuloPalco")}>
              <Ponte
                larguraCss={larguraCss - 2}
                alturaCss={alturaCss}
                dpr={dpr}
                pxPorMm={pxPorMm}
                distanciaMm={distanciaMm}
                delta={delta}
                sentido={sentido}
                forma={FORMAS[forma]}
                semente={semente}
                afinacao={afinacao}
              />
            </PalcoVisual>
          )
        )}
      </div>

      {fase === "rampas" && !controlo && rampa && (
        <p className="text-xs font-medium text-muted-foreground">
          {t("Visao.pontesProcura", {
            sentido: sentido === "convergencia" ? t("Visao.pontesConvergencia") : t("Visao.pontesDivergencia"),
            delta: rotuloDelta(delta),
          })}
        </p>
      )}

      <BotoesForma aoEscolher={responder} desactivado={ecraEstreito || larguraCss === 0} />

      {ultima && (
        <p className="text-center text-xs text-muted-foreground">
          {t("Visao.pontesUltima", { resultado: rotuloSentidoPontes(ultima.sentido, resumirRampas([ultima.r])) })}
        </p>
      )}
    </div>
  );
};

const AvisoPontes = () => {
  const { t } = useTranslation();
  return (
    <div className="space-y-3 text-left text-sm">
      <p className="flex gap-2 rounded-lg border border-gold/60 bg-gold/10 p-3 text-foreground" role="note">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-gold" aria-hidden />
        <span>{t("Visao.convergenciaAvisoParar")}</span>
      </p>
      <p className="flex gap-2 rounded-lg border border-gold/60 bg-gold/10 p-3 text-foreground" role="note">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-gold" aria-hidden />
        <span>{t("Visao.convergenciaAvisoEstrabismo")}</span>
      </p>
      <p className="text-muted-foreground">{t("Visao.convergenciaComoFazer")}</p>
    </div>
  );
};

const PontesFusao = () => {
  const { t } = useTranslation();
  return (
    <PaginaExercicio>
      <AssistenteTreino
        exercicioId={EXERCICIO_ID}
        grupo="premium"
        titulo={t("Visao.pontesTitulo")}
        descricao={t("Visao.pontesDescricao")}
        monocular={false}
        comDistancia
        oculos3D
        aviso={<AvisoPontes />}
        tarefa={(api, ctx, resultado) => <TarefaPontes api={api} ctx={ctx} resultado={resultado} />}
      />
    </PaginaExercicio>
  );
};

export default PontesFusao;
