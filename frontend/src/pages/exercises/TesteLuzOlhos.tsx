import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import BaseExercise from "@/components/exercises/BaseExercise";
import { BotaoContinuar, EcraPasso } from "@/components/visao/EcraPasso";
import PaginaExercicio from "@/components/visao/PaginaExercicio";
import { CartaoOlho, EcraResultado } from "@/components/visao/Resultados";
import { useRegistoSessao } from "@/components/visao/hooks";
import { ID_ASTIGMATISMO } from "@/lib/visao/ids";
import {
  FREQUENCIAS,
  IRIS_RAIO_MM,
  LADOS,
  MOVIMENTOS,
  NIVEIS,
  PUPILA_RAIO_MM,
  QUANDO,
  achadoDoReflexo,
  concordam,
  desvioMaximo,
  desvioPeloTapar,
  reflexoNatural,
  reflexoNoDesenho,
  type Frequencia,
  type Lado,
  type Movimento,
  type Nivel,
  type Quando,
  type Reflexo,
  type RespostaLuz,
} from "@/lib/visao/luzOlhos";
import type { Olho } from "@/lib/visao/resultados";
import { sinalSonoro } from "@/lib/visao/voz";
import { cn } from "@/lib/utils";

/** O id histórico `relax` (antes, Teste de Astigmatismo). */
const EXERCICIO_ID = ID_ASTIGMATISMO;

type Etapa = "lanterna" | "iguais" | "qual_olho" | "lado" | "quanto" | "demo" | "tapar" | "semana" | "resultado";
const PASSO_DA_ETAPA: Record<Etapa, number> = { lanterna: 0, iguais: 1, qual_olho: 1, lado: 1, quanto: 1, demo: 2, tapar: 2, semana: 3, resultado: 4 };
/** Primeiro tapa-se o esquerdo e olha-se para o direito (como na animação), depois o contrário. */
const ORDEM_TAPAR: readonly Olho[] = ["esquerdo", "direito"];
const outro = (o: Olho): Olho => (o === "direito" ? "esquerdo" : "direito");

/** Desenho: a íris, com 6 mm de raio, tem 26 px. */
const PX_MM = 26 / IRIS_RAIO_MM;

/**
 * Um olho visto de frente: a amêndoa, a íris, a pupila e, se houver, o
 * pontinho de luz. `irisClasse` deixa animar a íris (a demonstração do tapar).
 */
const OlhoDesenho = ({
  cx,
  cy,
  reflexo,
  escala = 1,
  destaque = false,
  irisClasse,
}: {
  cx: number;
  cy: number;
  reflexo?: Reflexo | null;
  escala?: number;
  destaque?: boolean;
  irisClasse?: string;
}) => {
  const id = useId();
  const s = escala;
  return (
    <g>
      <clipPath id={id}>
        <ellipse cx={cx} cy={cy} rx={44 * s} ry={25 * s} />
      </clipPath>
      <ellipse cx={cx} cy={cy} rx={44 * s} ry={25 * s} fill="#fbfaf7" stroke={destaque ? "#1d6fa5" : "#3b2a20"} strokeWidth={destaque ? 3 : 2} />
      <g clipPath={`url(#${id})`}>
        <g className={irisClasse}>
          <circle cx={cx} cy={cy} r={26 * s} fill="#7a4e2d" />
          <circle cx={cx} cy={cy} r={16 * s} fill="#5c381e" opacity={0.6} />
          <circle cx={cx} cy={cy} r={PUPILA_RAIO_MM * PX_MM * s} fill="#111111" />
          {reflexo && (
            <circle cx={cx + reflexo.x * PX_MM * s} cy={cy + reflexo.y * PX_MM * s} r={3.6 * s} fill="#ffffff" stroke="#9fd6ff" strokeWidth={s} />
          )}
        </g>
      </g>
    </g>
  );
};

/** Os dois olhos da criança, de frente: o direito dela à esquerda de quem vê. */
const DoisOlhos = ({
  reflexos,
  destaque,
  legenda = true,
  largura,
}: {
  reflexos?: Partial<Record<Olho, Reflexo>>;
  destaque?: Olho;
  legenda?: boolean;
  largura?: number;
}) => {
  const { t } = useTranslation();
  const altura = legenda ? 96 : 70;
  return (
    <svg viewBox={`0 0 300 ${altura}`} width={largura ?? "100%"} aria-hidden className="shrink-0">
      <OlhoDesenho cx={78} cy={36} reflexo={reflexos?.direito} destaque={destaque === "direito"} />
      <OlhoDesenho cx={222} cy={36} reflexo={reflexos?.esquerdo} destaque={destaque === "esquerdo"} />
      {legenda && (
        <g fontSize={12} fill="currentColor" opacity={0.7} textAnchor="middle">
          <text x={78} y={altura - 8}>{t("Visao.luzDireitoDela")}</text>
          <text x={222} y={altura - 8}>{t("Visao.luzEsquerdoDela")}</text>
        </g>
      )}
    </svg>
  );
};

/** Um olho só, pequeno, para as opções; com seta quando a resposta é um movimento. */
const UmOlho = ({ reflexo, seta }: { reflexo?: Reflexo | null; seta?: Reflexo }) => (
  <svg viewBox="0 0 100 56" width={92} height={52} aria-hidden className="shrink-0">
    <OlhoDesenho cx={50} cy={28} reflexo={reflexo} escala={0.95} />
    {seta && (
      <>
        <path d={`M50 28 L${50 + seta.x * 26} ${28 + seta.y * 18}`} stroke="#1d6fa5" strokeWidth={4} strokeLinecap="round" />
        <circle cx={50 + seta.x * 26} cy={28 + seta.y * 18} r={5} fill="#1d6fa5" />
      </>
    )}
  </svg>
);

/** Uma resposta com desenho: botões grandes, fáceis de acertar com a outra mão a segurar o telemóvel. */
const Opcao = ({
  desenho,
  texto,
  ajuda,
  empilhar,
  aoEscolher,
}: {
  desenho?: ReactNode;
  texto: string;
  ajuda?: string;
  empilhar?: boolean;
  aoEscolher: () => void;
}) => (
  <Button
    variant="outline"
    // `[&_svg]:size-auto`: o Button encolhe os SVG a 16 px (para ícones); aqui os desenhos têm o seu tamanho.
    className={cn("h-auto whitespace-normal py-2 [&_svg]:size-auto", empilhar ? "flex-col gap-1 text-center" : "justify-start gap-3 text-left")}
    onClick={() => {
      sinalSonoro("tic");
      aoEscolher();
    }}
  >
    {desenho}
    <span className="font-semibold">
      {texto}
      {ajuda && <span className="block text-xs font-normal text-muted-foreground">{ajuda}</span>}
    </span>
  </Button>
);

/** De lado: o adulto com o telemóvel abaixo dos olhos (ecrã para si, lanterna para ela) e a criança a um braço. */
const DesenhoLanterna = () => {
  const { t } = useTranslation();
  return (
    <svg viewBox="0 0 300 150" role="img" aria-label={t("Visao.luzLanternaRotulo")} className="h-auto w-full rounded-xl" style={{ backgroundColor: "#eef3f7" }}>
      <ellipse cx={62} cy={62} rx={34} ry={42} fill="#d9ab84" />
      <circle cx={76} cy={54} r={3} fill="#1f1a17" />
      <rect x={96} y={66} width={10} height={56} rx={3} fill="#1c2227" />
      <rect x={98} y={68} width={3} height={52} rx={1} fill="#bfe0f5" />
      <circle cx={106} cy={72} r={3} fill="#fff6c8" />
      <path d="M108 72 L232 52 L232 92 Z" fill="#fff3b0" opacity={0.55} />
      <ellipse cx={248} cy={72} rx={28} ry={34} fill="#a0714d" />
      <circle cx={236} cy={66} r={4} fill="#1f1a17" />
      <circle cx={236.6} cy={65.4} r={1.2} fill="#ffffff" />
      <g fontSize={12} fill="#3f4a52" textAnchor="middle">
        <text x={62} y={138}>{t("Visao.luzDesenhoAdulto")}</text>
        <text x={248} y={138}>{t("Visao.luzDesenhoCrianca")}</text>
        <text x={104} y={28}>{t("Visao.luzDesenhoEcra")}</text>
        <text x={104} y={42}>{t("Visao.luzDesenhoLanterna")}</text>
      </g>
    </svg>
  );
};

/** A animação do teste de tapar: a mão tapa o olho esquerdo dela e o direito, que estava virado para o nariz, vai para o meio. */
const CSS_DEMO = `
@keyframes jpa-luz-mao { 0%, 18% { transform: translateX(130px); } 32%, 72% { transform: translateX(0); } 86%, 100% { transform: translateX(130px); } }
@keyframes jpa-luz-iris { 0%, 36% { transform: translateX(9px); } 46%, 72% { transform: translateX(0); } 82%, 100% { transform: translateX(9px); } }
.jpa-luz-mao { animation: jpa-luz-mao 4.2s ease-in-out infinite; }
.jpa-luz-iris { animation: jpa-luz-iris 4.2s ease-in-out infinite; }
@media (prefers-reduced-motion: reduce) { .jpa-luz-mao, .jpa-luz-iris { animation: none; } }
`;
const DemoTapar = () => {
  const { t } = useTranslation();
  return (
    <svg viewBox="0 0 300 110" role="img" aria-label={t("Visao.luzDemoRotulo")} className="h-auto w-full rounded-xl" style={{ backgroundColor: "#eef3f7" }}>
      <style>{CSS_DEMO}</style>
      <OlhoDesenho cx={78} cy={50} irisClasse="jpa-luz-iris" />
      <OlhoDesenho cx={222} cy={50} />
      <g className="jpa-luz-mao">
        <rect x={170} y={10} width={104} height={82} rx={34} fill="#d9ab84" />
        <rect x={176} y={18} width={16} height={66} rx={8} fill="#c99a73" />
      </g>
      <g fontSize={12} fill="#56616b" textAnchor="middle">
        <text x={78} y={104}>{t("Visao.luzDemoMexe")}</text>
        <text x={222} y={104}>{t("Visao.luzDemoTapa")}</text>
      </g>
    </svg>
  );
};

/** A seta de cada movimento, num olho visto de frente ("dentro" = para o lado do nariz). */
const LADO_DO_MOVIMENTO: Record<Movimento, Lado | null> = { nao: null, naovi: null, dentro: "nariz", fora: "orelha", cima: "cima", baixo: "baixo" };
const setaDoMovimento = (olho: Olho, m: Movimento): Reflexo | undefined => {
  const l = LADO_DO_MOVIMENTO[m];
  return l ? reflexoNoDesenho(olho, l, 1) : undefined;
};

/**
 * Luz nos Olhos (id `relax`, no teste de 90 dias): o adulto examina, com a
 * lanterna do telemóvel. Ver `lib/visao/luzOlhos.ts`.
 */
const TesteLuzOlhos = () => {
  const { t } = useTranslation();
  const [etapa, setEtapa] = useState<Etapa>("lanterna");
  const [resposta, setResposta] = useState<RespostaLuz | null>(null);
  const [olhoLuz, setOlhoLuz] = useState<Olho | null>(null);
  const [lado, setLado] = useState<Lado | null>(null);
  const [nivel, setNivel] = useState<Nivel | null>(null);
  const [vez, setVez] = useState(0);
  const [movimentos, setMovimentos] = useState<Partial<Record<Olho, Movimento>>>({});
  const [frequencia, setFrequencia] = useState<Frequencia | null>(null);
  const [quando, setQuando] = useState<Quando[]>([]);
  const inicio = useRef(Date.now());

  const nomeOlho = (o: Olho) => t(o === "direito" ? "Visao.olhoDireito" : "Visao.olhoEsquerdo").toLowerCase();
  const olhoDela = (o: Olho) => t(o === "direito" ? "Visao.luzOlhoDireitoDela" : "Visao.luzOlhoEsquerdoDela");
  const passos = [t("Visao.luzPassoLanterna"), t("Visao.luzPassoPontinhos"), t("Visao.luzPassoTapar"), t("Visao.luzPassoDiario"), t("Visao.passoResultado")];
  const subtitulo = (texto: string) => <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{texto}</p>;

  let conteudo;
  if (etapa === "lanterna")
    conteudo = (
      <EcraPasso
        titulo={t("Visao.luzLanternaTitulo")}
        accao={
          <>
            <BotaoContinuar aoClicar={() => setEtapa("iguais")}>{t("Visao.luzLanternaAcesa")}</BotaoContinuar>
            <Button
              variant="outline"
              className="h-auto whitespace-normal"
              onClick={() => {
                setResposta("sem_lanterna");
                setEtapa("demo");
              }}
            >
              {t("Visao.luzSemLanterna")}
            </Button>
          </>
        }
      >
        <div className="w-full space-y-3 text-left text-base">
          <DesenhoLanterna />
          <p className="text-foreground">{t("Visao.luzLanternaTexto1")}</p>
          <p className="text-foreground">{t("Visao.luzLanternaTexto2")}</p>
        </div>
      </EcraPasso>
    );
  else if (etapa === "iguais")
    conteudo = (
      <EcraPasso titulo={t("Visao.luzIguaisTitulo")}>
        <div className="grid w-full gap-2">
          {subtitulo(t("Visao.luzPontinhosSubtitulo"))}
          <Opcao
            desenho={<DoisOlhos legenda={false} largura={150} reflexos={{ direito: reflexoNatural("direito"), esquerdo: reflexoNatural("esquerdo") }} />}
            texto={t("Visao.luzIguais_iguais")}
            ajuda={t("Visao.luzIguaisAjuda_iguais")}
            aoEscolher={() => {
              setResposta("iguais");
              setEtapa("demo");
            }}
          />
          <Opcao
            desenho={
              <DoisOlhos legenda={false} largura={150} reflexos={{ direito: reflexoNatural("direito"), esquerdo: reflexoNoDesenho("esquerdo", "orelha", 2.2) }} />
            }
            texto={t("Visao.luzIguais_diferente")}
            ajuda={t("Visao.luzIguaisAjuda_diferente")}
            aoEscolher={() => {
              setResposta("diferente");
              setEtapa("qual_olho");
            }}
          />
          <Opcao
            texto={t("Visao.luzIguais_naovi")}
            aoEscolher={() => {
              setResposta("naovi");
              setEtapa("demo");
            }}
          />
        </div>
      </EcraPasso>
    );
  else if (etapa === "qual_olho")
    conteudo = (
      <EcraPasso titulo={t("Visao.luzQualOlhoTitulo")}>
        <div className="w-full space-y-3 text-left">
          {subtitulo(t("Visao.luzPontinhosSubtitulo"))}
          <p className="text-foreground">{t("Visao.luzQualOlhoTexto")}</p>
          <div className="grid grid-cols-2 gap-2">
            {(["direito", "esquerdo"] as const).map((o) => (
              <Opcao
                key={o}
                empilhar
                desenho={<UmOlho reflexo={reflexoNoDesenho(o, "orelha", 2.2)} />}
                texto={olhoDela(o)}
                ajuda={t(o === "direito" ? "Visao.luzDoSeuLadoEsquerdo" : "Visao.luzDoSeuLadoDireito")}
                aoEscolher={() => {
                  setOlhoLuz(o);
                  setEtapa("lado");
                }}
              />
            ))}
          </div>
        </div>
      </EcraPasso>
    );
  else if (etapa === "lado" && olhoLuz)
    conteudo = (
      <EcraPasso titulo={t("Visao.luzLadoTitulo")}>
        <div className="w-full space-y-3">
          {subtitulo(olhoDela(olhoLuz))}
          <div className="grid grid-cols-2 gap-2">
            {LADOS.map((l) => (
              <Opcao
                key={l}
                empilhar
                desenho={<UmOlho reflexo={reflexoNoDesenho(olhoLuz, l, 2.6)} />}
                texto={t(`Visao.luzLado_${l}`)}
                aoEscolher={() => {
                  setLado(l);
                  setEtapa("quanto");
                }}
              />
            ))}
          </div>
        </div>
      </EcraPasso>
    );
  else if (etapa === "quanto" && olhoLuz && lado)
    conteudo = (
      <EcraPasso titulo={t("Visao.luzQuantoTitulo")}>
        <div className="grid w-full gap-2">
          {subtitulo(olhoDela(olhoLuz))}
          {NIVEIS.map((n) => (
            <Opcao
              key={n.nivel}
              // Na borda da íris, o pontinho desenha-se um pouco para dentro, para se ver inteiro.
              desenho={<UmOlho reflexo={reflexoNoDesenho(olhoLuz, lado, Math.min(n.mm, IRIS_RAIO_MM - 0.4))} />}
              texto={t(`Visao.luzNivel_${n.nivel}`)}
              aoEscolher={() => {
                setNivel(n.nivel);
                setEtapa("demo");
              }}
            />
          ))}
        </div>
      </EcraPasso>
    );
  else if (etapa === "demo")
    conteudo = (
      <EcraPasso titulo={t("Visao.luzDemoTitulo")} accao={<BotaoContinuar aoClicar={() => setEtapa("tapar")}>{t("Visao.luzDemoPercebi")}</BotaoContinuar>}>
        <div className="w-full space-y-3 text-left text-base">
          {subtitulo(t("Visao.luzPassoTapar"))}
          <DemoTapar />
          <p className="text-foreground">{resposta === "sem_lanterna" ? t("Visao.luzDemoTextoSemLuz") : t("Visao.luzDemoTexto")}</p>
        </div>
      </EcraPasso>
    );
  else if (etapa === "tapar") {
    const tapa = ORDEM_TAPAR[vez];
    const olha = outro(tapa);
    conteudo = (
      <EcraPasso titulo={t("Visao.luzTaparTitulo", { tapa: nomeOlho(tapa), olha: nomeOlho(olha) })}>
        <div className="w-full space-y-3">
          {subtitulo(t("Visao.luzTaparSubtitulo", { n: vez + 1, total: ORDEM_TAPAR.length }))}
          <DoisOlhos destaque={olha} />
          <div className="grid grid-cols-2 gap-2">
            {MOVIMENTOS.map((m) => (
              <Opcao
                key={m}
                empilhar
                desenho={m === "naovi" ? undefined : <UmOlho seta={setaDoMovimento(olha, m)} />}
                texto={t(`Visao.luzMovimento_${m}`)}
                aoEscolher={() => {
                  setMovimentos((ms) => ({ ...ms, [olha]: m }));
                  if (vez + 1 < ORDEM_TAPAR.length) setVez(vez + 1);
                  else setEtapa("semana");
                }}
              />
            ))}
          </div>
        </div>
      </EcraPasso>
    );
  } else if (etapa === "semana")
    conteudo = (
      <EcraPasso
        titulo={t("Visao.luzDiarioPergunta")}
        accao={
          <BotaoContinuar desactivado={!frequencia} aoClicar={() => setEtapa("resultado")}>
            {t("Visao.luzVerResultado")}
          </BotaoContinuar>
        }
      >
        <div className="w-full space-y-4 text-left text-sm">
          {subtitulo(t("Visao.luzPassoDiario"))}
          <div role="radiogroup" aria-label={t("Visao.luzDiarioPergunta")} className="flex flex-wrap gap-2">
            {FREQUENCIAS.map((f) => (
              <Button
                key={f}
                role="radio"
                aria-checked={frequencia === f}
                size="sm"
                variant={frequencia === f ? "default" : "outline"}
                className={cn(frequencia === f && "bg-navy text-navy-foreground hover:bg-navy/90")}
                onClick={() => setFrequencia(f)}
              >
                {t(`Visao.luzFrequencia_${f}`)}
              </Button>
            ))}
          </div>
          <p className="text-muted-foreground">{t("Visao.luzDiarioQuando")}</p>
          <div className="flex flex-wrap gap-2">
            {QUANDO.map((q) => {
              const on = quando.includes(q);
              return (
                <Button
                  key={q}
                  aria-pressed={on}
                  size="sm"
                  variant={on ? "default" : "outline"}
                  className={cn(on && "bg-navy text-navy-foreground hover:bg-navy/90")}
                  onClick={() => setQuando((qs) => (on ? qs.filter((x) => x !== q) : [...qs, q]))}
                >
                  {t(`Visao.luzQuando_${q}`)}
                </Button>
              );
            })}
          </div>
        </div>
      </EcraPasso>
    );
  else
    conteudo = (
      <ResultadoLuz
        resposta={resposta ?? "naovi"}
        reflexo={resposta === "diferente" && olhoLuz && lado && nivel ? { olho: olhoLuz, lado, nivel } : null}
        movimentos={movimentos}
        frequencia={frequencia}
        quando={quando}
        segundos={Math.max(1, Math.round((Date.now() - inicio.current) / 1000))}
      />
    );

  return (
    <PaginaExercicio>
      <BaseExercise
        title={t("Visao.astigmatismoTitulo")}
        description={t("Visao.astigmatismoDescricao")}
        exercicioId={EXERCICIO_ID}
        tipo="teste"
        passos={passos}
        passoActual={PASSO_DA_ETAPA[etapa]}
      >
        {conteudo}
      </BaseExercise>
    </PaginaExercicio>
  );
};

const ResultadoLuz = ({
  resposta,
  reflexo,
  movimentos,
  frequencia,
  quando,
  segundos,
}: {
  resposta: RespostaLuz;
  reflexo: { olho: Olho; lado: Lado; nivel: Nivel } | null;
  movimentos: Partial<Record<Olho, Movimento>>;
  frequencia: Frequencia | null;
  quando: Quando[];
  segundos: number;
}) => {
  const { t } = useTranslation();
  const { estado, gravar, tentarDeNovo } = useRegistoSessao();
  const gravou = useRef(false);
  const achados = useMemo(() => (reflexo ? [achadoDoReflexo(reflexo.olho, reflexo.lado, reflexo.nivel)] : []), [reflexo]);
  const peloTapar = useMemo(() => desvioPeloTapar(movimentos), [movimentos]);
  const viuLuz = resposta === "iguais" || resposta === "diferente";
  const olhoMaiusc = (o: Olho) => t(o === "direito" ? "Visao.olhoDireito" : "Visao.olhoEsquerdo");
  const nomeOlho = (o: Olho) => olhoMaiusc(o).toLowerCase();
  const sentido = (s: string) => t(`Visao.luzSentido_${s}`);

  useEffect(() => {
    if (gravou.current) return;
    gravou.current = true;
    void gravar([
      {
        exercicio_id: EXERCICIO_ID,
        olho: "ambos",
        duracao_segundos: segundos,
        segundos_activos: segundos,
        // Sem pontinhos vistos, não há estimativa pelo reflexo (o tapar e o diário contam na mesma).
        limiar: viuLuz ? desvioMaximo(achados) : null,
        unidade: "dioptrias_prismaticas",
        sinais: {
          modo: "luz_olhos",
          versao: 2,
          reflexo: { resposta, ...(reflexo ?? {}) },
          achados,
          tapar: movimentos,
          desvio_tapar: peloTapar,
          diario: { frequencia, quando },
        },
      },
    ]);
  }, [achados, frequencia, gravar, movimentos, peloTapar, quando, reflexo, resposta, segundos, viuLuz]);

  const sinais = [
    ...achados.map((a) => t("Visao.luzSinalReflexo", { olho: nomeOlho(a.olho), sentido: sentido(a.sentido), delta: a.delta })),
    ...peloTapar.map((p) => t("Visao.luzSinalTapar", { olho: nomeOlho(p.olho), sentido: sentido(p.sentido) })),
  ];
  const textoLuz = achados.length
    ? t("Visao.luzLuzAchado", { olho: olhoMaiusc(achados[0].olho), sentido: sentido(achados[0].sentido), delta: achados[0].delta })
    : t(`Visao.luzLuz_${resposta}`);
  const ninguemMexeu = Object.values(movimentos).every((m) => m === "nao");
  const textoTapar = peloTapar.length
    ? peloTapar.map((p) => t("Visao.luzTaparAchado", { olho: olhoMaiusc(p.olho), sentido: sentido(p.sentido) })).join(" ")
    : ninguemMexeu
      ? t("Visao.luzTaparNada")
      : t("Visao.luzTaparNaoVi");

  return (
    <EcraResultado
      titulo={t("Visao.luzResultadoTitulo")}
      gravacao={estado}
      aoTentarDeNovo={() => void tentarDeNovo()}
      sinais={sinais}
      cartoes={[
        <CartaoOlho key="luz" titulo={t("Visao.luzCartaoLuz")} estado={achados.length ? "sinal" : viuLuz ? "ok" : "indeterminado"}>
          <p className="text-lg font-bold text-foreground">{textoLuz}</p>
        </CartaoOlho>,
        <CartaoOlho key="tapar" titulo={t("Visao.luzPassoTapar")} estado={peloTapar.length ? "sinal" : ninguemMexeu ? "ok" : "indeterminado"}>
          <p className="text-lg font-bold text-foreground">{textoTapar}</p>
          {concordam(achados, peloTapar) && <p>{t("Visao.luzConcordam")}</p>}
        </CartaoOlho>,
      ]}
      notas={
        <div className="space-y-2 text-center text-xs text-muted-foreground">
          {frequencia && (
            <p className="text-sm text-foreground">
              {t("Visao.luzDiarioResumo", {
                frequencia: t(`Visao.luzFrequencia_${frequencia}`).toLowerCase(),
                momentos: quando.length ? ` (${quando.map((q) => t(`Visao.luzQuando_${q}`).toLowerCase()).join(", ")})` : "",
              })}
            </p>
          )}
          <p>{t("Visao.luzNotaMetodo")}</p>
        </div>
      }
    />
  );
};

export default TesteLuzOlhos;
