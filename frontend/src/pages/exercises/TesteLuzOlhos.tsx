import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import BaseExercise from "@/components/exercises/BaseExercise";
import BotaoOuvir from "@/components/visao/BotaoOuvir";
import { BotaoContinuar, EcraPasso } from "@/components/visao/EcraPasso";
import PaginaExercicio from "@/components/visao/PaginaExercicio";
import { CartaoOlho, EcraResultado } from "@/components/visao/Resultados";
import { useRegistoSessao } from "@/components/visao/hooks";
import { formatarDecimal } from "@/i18n/formatar";
import { ID_ASTIGMATISMO } from "@/lib/visao/ids";
import {
  FREQUENCIAS,
  IRIS_RAIO_MM,
  MOVIMENTOS,
  PUPILA_RAIO_MM,
  QUANDO,
  analisarReflexos,
  desvioMaximo,
  desvioPeloTapar,
  limitarAIris,
  type Frequencia,
  type Movimento,
  type Quando,
  type Reflexo,
} from "@/lib/visao/luzOlhos";
import { OLHOS, type Olho } from "@/lib/visao/resultados";
import { falar, sinalSonoro } from "@/lib/visao/voz";
import { cn } from "@/lib/utils";

/** O id histórico `relax` (antes, Teste de Astigmatismo). */
const EXERCICIO_ID = ID_ASTIGMATISMO;

type Etapa = "diario" | "preparar" | "luz" | "marcar" | "tapar" | "resultado";
const ETAPAS: readonly Etapa[] = ["diario", "preparar", "luz", "marcar", "tapar", "resultado"];
const outro = (o: Olho): Olho => (o === "direito" ? "esquerdo" : "direito");

/** Ecrã inteiro e branco (é a luz), com um peixinho a mexer para a criança olhar. */
const EcraLuz = ({ aoVer }: { aoVer: () => void }) => {
  const { t, i18n } = useTranslation();
  const tela = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    falar(t("Visao.luzVozOlhar"), i18n.language);
    const g = tela.current?.getContext("2d");
    if (!g) return;
    let raf = 0;
    const animar = (tempo: number) => {
      g.clearRect(0, 0, 240, 240);
      const y = 120 + Math.sin(tempo / 300) * 8;
      g.fillStyle = "#f4b223";
      g.beginPath();
      g.ellipse(120, y, 70, 46, 0, 0, Math.PI * 2);
      g.fill();
      g.beginPath();
      g.moveTo(50, y);
      g.lineTo(18, y - 34 + Math.sin(tempo / 150) * 8);
      g.lineTo(18, y + 34 - Math.sin(tempo / 150) * 8);
      g.closePath();
      g.fill();
      g.fillStyle = "#ffffff";
      g.beginPath();
      g.arc(150, y - 10, 15, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = "#111111";
      g.beginPath();
      g.arc(153, y - 10, 8, 0, Math.PI * 2);
      g.fill();
      raf = requestAnimationFrame(animar);
    };
    raf = requestAnimationFrame(animar);
    return () => cancelAnimationFrame(raf);
    // Só ao abrir o ecrã.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <div className="fixed inset-0 z-[100] grid place-items-center" style={{ backgroundColor: "#ffffff", colorScheme: "light" }}>
      <canvas ref={tela} width={240} height={240} style={{ width: 120, height: 120 }} aria-label={t("Visao.luzRotuloPeixe")} />
      <button
        type="button"
        onClick={aoVer}
        className="absolute bottom-6 rounded-xl px-7 py-4 text-base font-semibold"
        style={{ backgroundColor: "#3a3f97", color: "#ffffff" }}
      >
        {t("Visao.luzJaVi")}
      </button>
    </div>
  );
};

/**
 * Os dois olhos da criança, de frente (o direito dela à esquerda de quem
 * vê). Toca-se onde estava o reflexo; volta-se a tocar para corrigir.
 */
const DiagramaOlhos = ({
  reflexos,
  aoMarcar,
}: {
  reflexos: Partial<Record<Olho, Reflexo>>;
  aoMarcar: (o: Olho, r: Reflexo) => void;
}) => {
  const { t } = useTranslation();
  const tela = useRef<HTMLCanvasElement>(null);
  const caixa = useRef<HTMLDivElement>(null);
  const [largura, setLargura] = useState(0);

  useEffect(() => {
    const medir = () => setLargura(caixa.current?.clientWidth ?? 0);
    medir();
    window.addEventListener("resize", medir);
    return () => window.removeEventListener("resize", medir);
  }, []);

  const altura = Math.round(largura * 0.42);
  // A amêndoa do olho mede 1,9 raios para cada lado: com 0,115 da largura, os dois olhos cabem lado a lado sem se tocarem.
  const raio = Math.min(largura * 0.115, altura * 0.36);
  const centros: Record<Olho, { x: number; y: number }> = {
    direito: { x: largura * 0.27, y: altura * 0.55 },
    esquerdo: { x: largura * 0.73, y: altura * 0.55 },
  };

  useEffect(() => {
    const cv = tela.current;
    const g = cv?.getContext("2d");
    if (!cv || !g || largura < 1) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.width = Math.round(largura * dpr);
    cv.height = Math.round(altura * dpr);
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.fillStyle = "#f3efe8";
    g.fillRect(0, 0, largura, altura);
    g.font = "600 13px system-ui, sans-serif";
    g.textAlign = "center";
    for (const olho of OLHOS) {
      const c = centros[olho];
      g.fillStyle = "#3a3f97";
      g.fillText(olho === "direito" ? t("Visao.luzOlhoDireitoDela") : t("Visao.luzOlhoEsquerdoDela"), c.x, 18);
      g.fillStyle = "#ffffff";
      g.beginPath();
      g.ellipse(c.x, c.y, raio * 1.9, raio * 1.15, 0, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = "#b8a99a";
      g.lineWidth = 1.5;
      g.stroke();
      g.fillStyle = "#7a5230";
      g.beginPath();
      g.arc(c.x, c.y, raio, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = "#111111";
      g.beginPath();
      g.arc(c.x, c.y, (raio * PUPILA_RAIO_MM) / IRIS_RAIO_MM, 0, Math.PI * 2);
      g.fill();
      g.setLineDash([3, 4]);
      g.strokeStyle = "rgba(255,255,255,0.35)";
      g.lineWidth = 1;
      for (const mm of [1, 4]) {
        g.beginPath();
        g.arc(c.x, c.y, (raio * mm) / IRIS_RAIO_MM, 0, Math.PI * 2);
        g.stroke();
      }
      g.setLineDash([]);
      const r = reflexos[olho];
      if (r) {
        const x = c.x + (r.x / IRIS_RAIO_MM) * raio;
        const y = c.y + (r.y / IRIS_RAIO_MM) * raio;
        g.fillStyle = "rgba(255,240,150,0.45)";
        g.beginPath();
        g.arc(x, y, 9, 0, Math.PI * 2);
        g.fill();
        g.fillStyle = "#ffffff";
        g.beginPath();
        g.arc(x, y, 4.5, 0, Math.PI * 2);
        g.fill();
      }
    }
  });

  const tocar = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - r.left;
    const y = e.clientY - r.top;
    if (!Number.isFinite(x) || !Number.isFinite(y) || raio <= 0) return;
    const olho: Olho = Math.abs(x - centros.direito.x) < Math.abs(x - centros.esquerdo.x) ? "direito" : "esquerdo";
    const c = centros[olho];
    sinalSonoro("tic");
    aoMarcar(olho, limitarAIris({ x: ((x - c.x) / raio) * IRIS_RAIO_MM, y: ((y - c.y) / raio) * IRIS_RAIO_MM }));
  };

  return (
    <div ref={caixa} className="w-full">
      {largura > 0 && (
        <canvas
          ref={tela}
          role="img"
          aria-label={t("Visao.luzRotuloDesenho")}
          className="block w-full touch-none rounded-xl"
          style={{ height: altura }}
          onPointerDown={tocar}
        />
      )}
    </div>
  );
};

/**
 * Luz nos Olhos (id `relax`, no teste de 7 dias): o adulto examina. Ver
 * `lib/visao/luzOlhos.ts`.
 */
const TesteLuzOlhos = () => {
  const { t, i18n } = useTranslation();
  const [etapa, setEtapa] = useState<Etapa>("diario");
  const [frequencia, setFrequencia] = useState<Frequencia | null>(null);
  const [quando, setQuando] = useState<Quando[]>([]);
  const [reflexos, setReflexos] = useState<Partial<Record<Olho, Reflexo>>>({});
  const [tapar, setTapar] = useState<{ vez: number; movimentos: Partial<Record<Olho, Movimento>> }>({ vez: 0, movimentos: {} });
  const inicio = useRef(Date.now());

  const nomeOlho = (o: Olho) => t(o === "direito" ? "Visao.olhoDireito" : "Visao.olhoEsquerdo").toLowerCase();
  const passos = [t("Visao.luzPassoDiario"), t("Visao.passoPreparar"), t("Visao.luzPassoLuz"), t("Visao.luzPassoMarcar"), t("Visao.luzPassoTapar"), t("Visao.passoResultado")];

  // Teste de tapar: primeiro tapa-se o direito e olha-se para o esquerdo.
  const taparAgora: Olho = OLHOS[tapar.vez] ?? "direito";
  const olharPara = outro(taparAgora);
  const textoTapar = t("Visao.luzTaparTexto", { tapa: nomeOlho(taparAgora), olha: nomeOlho(olharPara) });
  useEffect(() => {
    if (etapa === "tapar") falar(textoTapar, i18n.language);
  }, [etapa, i18n.language, textoTapar]);

  let conteudo;
  if (etapa === "diario")
    conteudo = (
      <EcraPasso titulo={t("Visao.luzDiarioTitulo")} accao={<BotaoContinuar aoClicar={() => setEtapa("preparar")} />}>
        <div className="w-full space-y-4 text-left text-sm">
          <p className="text-foreground">{t("Visao.luzDiarioPergunta")}</p>
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
  else if (etapa === "preparar") {
    const lista = [1, 2, 3].map((n) => t(`Visao.luzPreparar${n}`));
    conteudo = (
      <EcraPasso
        titulo={t("Visao.luzPrepararTitulo")}
        accao={
          <Button size="lg" onClick={() => setEtapa("luz")}>
            {t("Visao.luzAcender")}
          </Button>
        }
      >
        <div className="w-full space-y-3 text-left text-sm">
          <ol className="list-decimal space-y-1 pl-5 text-foreground">
            {lista.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ol>
          <BotaoOuvir texto={lista.join(" ")} />
        </div>
      </EcraPasso>
    );
  } else if (etapa === "luz") conteudo = <EcraLuz aoVer={() => setEtapa("marcar")} />;
  else if (etapa === "marcar") {
    const faltam = OLHOS.filter((o) => !reflexos[o]);
    conteudo = (
      <EcraPasso
        titulo={t("Visao.luzMarcarTitulo")}
        accao={
          <div className="flex flex-wrap justify-center gap-2">
            <Button variant="outline" onClick={() => setEtapa("luz")}>
              {t("Visao.luzVerOutraVez")}
            </Button>
            <Button size="lg" disabled={faltam.length > 0} onClick={() => setEtapa("tapar")}>
              {t("Visao.continuar")}
            </Button>
          </div>
        }
      >
        <div className="w-full space-y-2 text-left text-sm">
          <p className="text-muted-foreground">{t("Visao.luzMarcarTexto")}</p>
          <DiagramaOlhos reflexos={reflexos} aoMarcar={(o, r) => setReflexos((rs) => ({ ...rs, [o]: r }))} />
          <p className="text-muted-foreground" aria-live="polite">
            {faltam.length ? t("Visao.luzFaltaMarcar", { olhos: faltam.map(nomeOlho).join(" e ") }) : t("Visao.luzMarcados")}
          </p>
        </div>
      </EcraPasso>
    );
  } else if (etapa === "tapar")
    conteudo = (
      <EcraPasso titulo={t("Visao.luzTaparTitulo", { olho: nomeOlho(taparAgora) })}>
        <div className="w-full space-y-3 text-left text-sm">
          <p className="text-foreground">{textoTapar}</p>
          <BotaoOuvir texto={textoTapar} />
          <div className="grid gap-2">
            {MOVIMENTOS.map((m) => (
              <Button
                key={m}
                variant="outline"
                className="h-auto justify-start whitespace-normal py-3 text-left"
                onClick={() => {
                  sinalSonoro("tic");
                  const movimentos = { ...tapar.movimentos, [olharPara]: m };
                  if (tapar.vez + 1 < OLHOS.length) setTapar({ vez: tapar.vez + 1, movimentos });
                  else {
                    setTapar({ vez: tapar.vez, movimentos });
                    setEtapa("resultado");
                  }
                }}
              >
                {t(`Visao.luzMovimento_${m}`)}
              </Button>
            ))}
          </div>
        </div>
      </EcraPasso>
    );
  else
    conteudo = (
      <ResultadoLuz
        reflexos={reflexos as Record<Olho, Reflexo>}
        movimentos={tapar.movimentos}
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
        grupo="trial"
        tipo="teste"
        passos={passos}
        passoActual={ETAPAS.indexOf(etapa)}
      >
        {conteudo}
      </BaseExercise>
    </PaginaExercicio>
  );
};

const ResultadoLuz = ({
  reflexos,
  movimentos,
  frequencia,
  quando,
  segundos,
}: {
  reflexos: Record<Olho, Reflexo>;
  movimentos: Partial<Record<Olho, Movimento>>;
  frequencia: Frequencia | null;
  quando: Quando[];
  segundos: number;
}) => {
  const { t } = useTranslation();
  const { estado, gravar, tentarDeNovo } = useRegistoSessao();
  const gravou = useRef(false);
  const achados = analisarReflexos(reflexos);
  const peloTapar = desvioPeloTapar(movimentos);
  const nomeOlho = (o: Olho) => t(o === "direito" ? "Visao.olhoDireito" : "Visao.olhoEsquerdo").toLowerCase();
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
        limiar: desvioMaximo(achados),
        unidade: "dioptrias_prismaticas",
        sinais: {
          modo: "luz_olhos",
          reflexo: reflexos,
          achados,
          tapar: movimentos,
          desvio_tapar: peloTapar,
          diario: { frequencia, quando },
        },
      },
    ]);
  }, [achados, frequencia, gravar, movimentos, peloTapar, quando, reflexos, segundos]);

  const sinais = [
    ...achados.map((a) => t("Visao.luzSinalReflexo", { olho: nomeOlho(a.olho), sentido: sentido(a.sentido), delta: a.delta })),
    ...peloTapar.map((p) => t("Visao.luzSinalTapar", { olho: nomeOlho(p.olho), sentido: sentido(p.sentido) })),
  ];

  return (
    <EcraResultado
      titulo={t("Visao.luzResultadoTitulo")}
      gravacao={estado}
      aoTentarDeNovo={() => void tentarDeNovo()}
      sinais={sinais}
      cartoes={OLHOS.map((olho) => {
        const r = reflexos[olho];
        const desviado = achados.some((a) => a.olho === olho) || peloTapar.some((p) => p.olho === olho);
        return (
          <CartaoOlho key={olho} titulo={t(olho === "direito" ? "Visao.olhoDireito" : "Visao.olhoEsquerdo")} estado={desviado ? "sinal" : "ok"}>
            <p>{t("Visao.luzReflexoA", { mm: formatarDecimal(Math.hypot(r.x, r.y), 1) })}</p>
            <p>{t(`Visao.luzMovimento_${movimentos[olho] ?? "naovi"}`)}</p>
          </CartaoOlho>
        );
      })}
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
