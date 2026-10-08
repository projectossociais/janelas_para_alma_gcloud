import { useEffect, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { ArrowRight, CreditCard, Glasses, Ruler, Sun } from "lucide-react";
import { Botao } from "@/design/componentes/Botao";
import { Slider } from "@/components/ui/slider";
import {
  CARTAO_ALTURA_MM,
  CARTAO_LARGURA_MM,
  PX_POR_MM_NOMINAL,
  type Calibracao,
} from "@/lib/visao/calibracao";
import { DISTANCIA_LONGE_MM, DISTANCIA_OMISSAO_MM } from "@/lib/visao/geometria";
import type { Olho } from "@/lib/visao/resultados";
import { cn } from "@/lib/utils";
import { rotuloDistancia } from "@/components/visao/rotulos";

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
      <div aria-hidden className="flex size-14 items-center justify-center rounded-pilula bg-accao-suave text-accao">
        {icone}
      </div>
    )}
    <h2 className="text-titulo-p text-tinta">{titulo}</h2>
    {children}
    {accao && <div className="mt-2 flex w-full flex-col items-stretch gap-3 sm:w-auto sm:items-center">{accao}</div>}
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
    <Botao
      tamanho="g"
      onClick={aoClicar}
      disabled={desactivado}
      className="w-full sm:w-auto sm:min-w-48"
    >
      {children ?? t("Visao.continuar")}
      <ArrowRight className="h-4 w-4" />
    </Botao>
  );
};

/** Primeiro passo de cada exercício. */
export const PassoBrilho = ({ aoContinuar }: { aoContinuar: () => void }) => {
  const { t } = useTranslation();
  return (
    <EcraPasso
      icone={<Sun className="h-7 w-7" />}
      titulo={t("Visao.brilhoTitulo")}
      accao={<BotaoContinuar aoClicar={aoContinuar} />}
    >
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
            <Botao variante="fantasma" onClick={() => setARecalibrar(true)}>
              {t("Visao.calibrarDeNovo")}
            </Botao>
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
          <Botao
            variante="fantasma"
            onClick={() => {
              aoGuardar({ pxPorMm: PX_POR_MM_NOMINAL, calibrado: false });
              setARecalibrar(false);
              aoContinuar();
            }}
          >
            {t("Visao.naoTenhoCartao")}
          </Botao>
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
        className="rounded-xl border-2 border-dashed border-accao bg-accao-suave"
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
        <Botao tamanho="g" variante="secundario" onClick={() => aoResponder(true)}>
          {t("Visao.oculosComCorreccao")}
        </Botao>
        <Botao tamanho="g" variante="secundario" onClick={() => aoResponder(false)}>
          {t("Visao.oculosSemCorreccao")}
        </Botao>
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
          <ellipse cx={cx} cy={25} rx={24} ry={14} className="fill-superficie stroke-tinta" strokeWidth={3} />
          {coberto ? (
            <ellipse cx={cx} cy={25} rx={26} ry={17} className="fill-tinta" />
          ) : (
            <circle cx={cx} cy={25} r={7} className="fill-acento" />
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
        <p className="rounded-lg bg-aviso-suave px-3 py-2 text-sm font-medium text-foreground">{t("Visao.aMaoNaoBasta")}</p>
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
  const rotulo = (mm: number) => rotuloDistancia(mm);
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
              escolha === mm ? "border-accao bg-accao-suave text-tinta" : "border-linha-forte text-tinta-suave hover:border-accao",
            )}
          >
            {rotulo(mm)}
          </button>
        ))}
      </div>
    </EcraPasso>
  );
};

/**
 * Sessão rápida: da segunda vez em diante, um só ecrã com as escolhas da
 * última vez em vez dos 5-6 passos de preparação. O aviso de segurança do
 * treino (se houver) aparece sempre -- não é uma escolha que se lembre.
 */
export const PassoRapido = ({
  calibrado,
  distanciaMm,
  comDistancia,
  usaCorreccao,
  olhoATapar,
  aviso,
  aoComecar,
  aoAlterar,
}: {
  calibrado: boolean;
  distanciaMm: number;
  comDistancia: boolean;
  usaCorreccao: boolean;
  /** Olho a tapar com o tapa-olho; `null` nos treinos com os dois olhos. */
  olhoATapar: Olho | null;
  aviso?: ReactNode;
  aoComecar: () => void;
  aoAlterar: () => void;
}) => {
  const { t } = useTranslation();
  const itens = [
    t("Visao.rapidoBrilho"),
    usaCorreccao ? t("Visao.rapidoComOculos") : t("Visao.rapidoSemOculos"),
    ...(olhoATapar
      ? [t("Visao.rapidoTapaOlho", { olho: (olhoATapar === "direito" ? t("Visao.olhoDireito") : t("Visao.olhoEsquerdo")).toLocaleLowerCase() })]
      : []),
    ...(comDistancia ? [t("Visao.rapidoDistancia", { distancia: rotuloDistancia(distanciaMm) })] : []),
  ];
  return (
    <EcraPasso
      titulo={t("Visao.rapidoTitulo")}
      accao={
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
          <BotaoContinuar aoClicar={aoComecar}>{t("Visao.rapidoComecar")}</BotaoContinuar>
          <Botao tamanho="g" variante="secundario" onClick={aoAlterar}>
            {t("Visao.rapidoAlterar")}
          </Botao>
        </div>
      }
    >
      <ul className="w-full space-y-2 text-left text-sm text-foreground">
        {itens.map((item) => (
          <li key={item} className="flex items-start gap-2 rounded-lg bg-muted/40 px-3 py-2">
            <span aria-hidden className="text-sucesso">✓</span>
            {item}
          </li>
        ))}
      </ul>
      {!calibrado && <p className="text-sm text-muted-foreground">{t("Visao.semCartaoAviso")}</p>}
      {aviso}
    </EcraPasso>
  );
};
