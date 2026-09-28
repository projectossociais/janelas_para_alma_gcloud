import { useEffect, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { ArrowRight, CreditCard, Glasses, Ruler, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { exerciciosApi } from "@/lib/apiClient";
import {
  CARTAO_ALTURA_MM,
  CARTAO_LARGURA_MM,
  PX_POR_MM_NOMINAL,
  type Calibracao,
} from "@/lib/visao/calibracao";
import { DISTANCIA_LONGE_MM, DISTANCIA_OMISSAO_MM } from "@/lib/visao/geometria";
import type { Olho } from "@/lib/visao/resultados";
import { cn } from "@/lib/utils";

/** Moldura comum de um passo: ícone, título, texto, conteúdo e botão. */
export const EcraPasso = ({
  icone,
  titulo,
  children,
  accao,
}: {
  icone?: ReactNode;
  titulo: string;
  children?: ReactNode;
  accao?: ReactNode;
}) => (
  <section className="mx-auto flex max-w-xl flex-col items-center gap-4 text-center">
    {icone && (
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-teal/10 text-teal">{icone}</div>
    )}
    <h2 className="text-xl font-bold text-foreground">{titulo}</h2>
    {children}
    {accao && <div className="mt-2 flex w-full flex-col items-center gap-2 sm:w-auto">{accao}</div>}
  </section>
);

export const BotaoContinuar = ({
  aoClicar,
  children,
  desactivado,
}: {
  aoClicar: () => void;
  children?: ReactNode;
  desactivado?: boolean;
}) => {
  const { t } = useTranslation();
  return (
    <Button
      size="lg"
      onClick={aoClicar}
      disabled={desactivado}
      className="w-full gap-2 bg-teal text-teal-foreground hover:bg-teal/90 sm:w-auto sm:min-w-48"
    >
      {children ?? t("Visao.continuar")}
      <ArrowRight className="h-4 w-4" />
    </Button>
  );
};

/**
 * Exercícios com vídeo do personagem já carregado no R2 privado. Vazio até
 * os vídeos novos existirem (W-18): sem isto, cada ecrã inicial pedia um URL
 * que a API recusa (503) e enchia a consola de erros. Acrescentar aqui o id
 * quando o vídeo for carregado.
 */
const EXERCICIOS_COM_VIDEO: readonly string[] = [];

/**
 * Vídeo do personagem animado a explicar o exercício (R2 privado, URL
 * assinado pela API). Sem vídeo carregado -- ou sem acesso --, não mostra
 * nada: o texto do passo chega para começar.
 */
export const Personagem = ({ exercicioId }: { exercicioId: string }) => {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!EXERCICIOS_COM_VIDEO.includes(exercicioId)) return;
    let cancelado = false;
    exerciciosApi
      .video(exercicioId)
      .then((r) => !cancelado && setUrl(r.url))
      .catch(() => undefined);
    return () => {
      cancelado = true;
    };
  }, [exercicioId]);
  if (!url) return null;
  return (
    <video
      src={url}
      controls
      playsInline
      preload="metadata"
      className="aspect-video w-full max-w-md rounded-xl bg-navy/5"
      onError={() => setUrl(null)}
    />
  );
};

export const PassoBrilho = ({ exercicioId, aoContinuar }: { exercicioId: string; aoContinuar: () => void }) => {
  const { t } = useTranslation();
  return (
    <EcraPasso
      icone={<Sun className="h-7 w-7" />}
      titulo={t("Visao.brilhoTitulo")}
      accao={<BotaoContinuar aoClicar={aoContinuar} />}
    >
      <Personagem exercicioId={exercicioId} />
      <p className="text-sm text-muted-foreground">{t("Visao.brilhoTexto")}</p>
    </EcraPasso>
  );
};

const LARGURA_MIN_PX = 120;
const LARGURA_MAX_PX = 720;
/** Abaixo desta largura de janela, o cartão fica ao alto (lado curto na horizontal). */
const LARGURA_JANELA_CARTAO_AO_ALTO = 640;

/**
 * Calibração: o utilizador encosta um cartão de banco (ou outro cartão do
 * mesmo tamanho) ao ecrã e ajusta a moldura com o slider até coincidir. Num
 * telemóvel o lado comprido do cartão não cabe na largura do ecrã, por isso
 * aí o cartão fica ao alto e mede-se o lado curto.
 */
export const PassoCalibracao = ({
  calibracao,
  aoGuardar,
  aoContinuar,
}: {
  calibracao: Calibracao | null;
  aoGuardar: (c: Calibracao) => void;
  aoContinuar: () => void;
}) => {
  const { t } = useTranslation();
  const [aRecalibrar, setARecalibrar] = useState(calibracao === null);
  const [janela, setJanela] = useState(() => (typeof window === "undefined" ? 1024 : window.innerWidth));
  const aoAlto = janela < LARGURA_JANELA_CARTAO_AO_ALTO;
  const ladoHorizontalMm = aoAlto ? CARTAO_ALTURA_MM : CARTAO_LARGURA_MM;
  const ladoVerticalMm = aoAlto ? CARTAO_LARGURA_MM : CARTAO_ALTURA_MM;
  const pxPorMmInicial = calibracao?.calibrado ? calibracao.pxPorMm : PX_POR_MM_NOMINAL;
  const [pxPorMm, setPxPorMm] = useState(pxPorMmInicial);

  useEffect(() => {
    const medir = () => setJanela(window.innerWidth);
    window.addEventListener("resize", medir);
    return () => window.removeEventListener("resize", medir);
  }, []);

  if (calibracao && !aRecalibrar) {
    return (
      <EcraPasso
        icone={<CreditCard className="h-7 w-7" />}
        titulo={t("Visao.calibracaoFeitaTitulo")}
        accao={
          <>
            <BotaoContinuar aoClicar={aoContinuar} />
            <Button variant="ghost" onClick={() => setARecalibrar(true)}>
              {t("Visao.calibrarDeNovo")}
            </Button>
          </>
        }
      >
        <p className="text-sm text-muted-foreground">
          {calibracao.calibrado ? t("Visao.calibracaoFeitaTexto") : t("Visao.semCartaoAviso")}
        </p>
      </EcraPasso>
    );
  }

  // O slider trabalha na largura da moldura, em px CSS; o px/mm sai dela.
  const maxLargura = Math.max(LARGURA_MIN_PX + 40, Math.min(LARGURA_MAX_PX, janela - 48));
  const largura = Math.min(Math.max(Math.round(ladoHorizontalMm * pxPorMm), LARGURA_MIN_PX), maxLargura);
  const altura = (largura * ladoVerticalMm) / ladoHorizontalMm;
  const pxPorMmActual = largura / ladoHorizontalMm;

  return (
    <EcraPasso
      icone={<CreditCard className="h-7 w-7" />}
      titulo={t("Visao.calibracaoTitulo")}
      accao={
        <>
          <BotaoContinuar
            aoClicar={() => {
              aoGuardar({ pxPorMm: pxPorMmActual, calibrado: true });
              setARecalibrar(false);
              aoContinuar();
            }}
          >
            {t("Visao.calibracaoConfirmar")}
          </BotaoContinuar>
          <Button
            variant="ghost"
            onClick={() => {
              aoGuardar({ pxPorMm: PX_POR_MM_NOMINAL, calibrado: false });
              setARecalibrar(false);
              aoContinuar();
            }}
          >
            {t("Visao.naoTenhoCartao")}
          </Button>
        </>
      }
    >
      <p className="text-sm text-muted-foreground">
        {aoAlto ? t("Visao.calibracaoTextoAoAlto") : t("Visao.calibracaoTexto")}
      </p>
      <div className="w-full max-w-sm">
        <label className="mb-2 block text-xs font-medium text-muted-foreground" id="rotulo-calibracao">
          {t("Visao.calibracaoSlider")}
        </label>
        <Slider
          aria-labelledby="rotulo-calibracao"
          min={LARGURA_MIN_PX}
          max={maxLargura}
          step={1}
          value={[largura]}
          onValueChange={([v]) => setPxPorMm(v / ladoHorizontalMm)}
        />
      </div>
      {/* A moldura mede-se em px CSS: nada de max-width nem escala aqui. */}
      <div
        className="rounded-xl border-2 border-dashed border-navy bg-teal/10 dark:border-foreground"
        style={{ width: largura, height: altura, maxWidth: "none", flexShrink: 0 }}
        aria-hidden
      />
      <p className="text-xs text-muted-foreground">{t("Visao.semCartaoExplicacao")}</p>
    </EcraPasso>
  );
};

export const PassoOculos = ({
  exercicioDePerto = false,
  aoResponder,
}: {
  exercicioDePerto?: boolean;
  aoResponder: (usaCorreccao: boolean) => void;
}) => {
  const { t } = useTranslation();
  return (
    <EcraPasso icone={<Glasses className="h-7 w-7" />} titulo={t("Visao.oculosTitulo")}>
      <p className="text-sm text-muted-foreground">
        {exercicioDePerto ? t("Visao.oculosTextoPerto") : t("Visao.oculosTexto")}
      </p>
      <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
        <Button size="lg" variant="outline" onClick={() => aoResponder(true)}>
          {t("Visao.oculosComCorreccao")}
        </Button>
        <Button size="lg" variant="outline" onClick={() => aoResponder(false)}>
          {t("Visao.oculosSemCorreccao")}
        </Button>
      </div>
    </EcraPasso>
  );
};

/** Pequeno desenho de dois olhos com um tapado. */
const DoisOlhos = ({ tapado }: { tapado: Olho }) => (
  <svg viewBox="0 0 120 50" className="h-14 w-32" aria-hidden>
    {/* O olho direito do utilizador aparece à esquerda de quem o vê de frente. */}
    {(["direito", "esquerdo"] as const).map((o, i) => {
      const cx = i === 0 ? 32 : 88;
      const coberto = o === tapado;
      return (
        <g key={o}>
          <ellipse cx={cx} cy={25} rx={24} ry={14} className="fill-background stroke-navy dark:stroke-foreground" strokeWidth={3} />
          {coberto ? (
            <ellipse cx={cx} cy={25} rx={26} ry={17} className="fill-navy dark:fill-foreground" />
          ) : (
            <circle cx={cx} cy={25} r={7} className="fill-teal" />
          )}
        </g>
      );
    })}
  </svg>
);

/**
 * "Tape o olho X". Nos testes chega a palma da mão; nos treinos o outro
 * olho tem de estar tapado com tapa-olho (a mão cansa e deixa espreitar).
 */
export const PassoTaparOlho = ({
  olhoATapar,
  tapaOlho,
  aoContinuar,
}: {
  olhoATapar: Olho;
  tapaOlho: boolean;
  aoContinuar: () => void;
}) => {
  const { t } = useTranslation();
  const titulo = olhoATapar === "direito" ? t("Visao.tapeOlhoDireito") : t("Visao.tapeOlhoEsquerdo");
  return (
    <EcraPasso icone={<DoisOlhos tapado={olhoATapar} />} titulo={titulo} accao={<BotaoContinuar aoClicar={aoContinuar} />}>
      <p className="text-sm text-muted-foreground">{tapaOlho ? t("Visao.tapaOlhoTexto") : t("Visao.taparComAMao")}</p>
      {tapaOlho && (
        <p className="rounded-lg bg-gold/10 px-3 py-2 text-sm font-medium text-foreground">{t("Visao.aMaoNaoBasta")}</p>
      )}
    </EcraPasso>
  );
};

export const PassoDistancia = ({
  distanciaMm,
  aoEscolher,
  opcoes = [DISTANCIA_OMISSAO_MM, DISTANCIA_LONGE_MM],
}: {
  distanciaMm: number;
  aoEscolher: (mm: number) => void;
  opcoes?: readonly number[];
}) => {
  const { t } = useTranslation();
  const [escolha, setEscolha] = useState(distanciaMm);
  const rotulo = (mm: number) =>
    mm === DISTANCIA_OMISSAO_MM
      ? t("Visao.distanciaBraco")
      : mm === DISTANCIA_LONGE_MM
        ? t("Visao.distanciaUmMetro")
        : t("Visao.distanciaCm", { cm: Math.round(mm / 10) });
  return (
    <EcraPasso
      icone={<Ruler className="h-7 w-7" />}
      titulo={t("Visao.distanciaTitulo")}
      accao={<BotaoContinuar aoClicar={() => aoEscolher(escolha)} />}
    >
      <p className="text-sm text-muted-foreground">{t("Visao.distanciaTexto")}</p>
      <div role="radiogroup" aria-label={t("Visao.distanciaTitulo")} className="flex w-full flex-col gap-2 sm:flex-row">
        {opcoes.map((mm) => (
          <button
            key={mm}
            type="button"
            role="radio"
            aria-checked={escolha === mm}
            onClick={() => setEscolha(mm)}
            className={cn(
              "flex-1 rounded-xl border-2 px-4 py-3 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              escolha === mm ? "border-teal bg-teal/10 text-foreground" : "border-border text-muted-foreground hover:border-teal/50",
            )}
          >
            {rotulo(mm)}
          </button>
        ))}
      </div>
    </EcraPasso>
  );
};
