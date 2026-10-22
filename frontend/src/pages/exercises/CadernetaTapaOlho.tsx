import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import BaseExercise from "@/components/exercises/BaseExercise";
import PaginaExercicio from "@/components/visao/PaginaExercicio";
import { EstadoDaGravacao } from "@/components/visao/Resultados";
import { useHistoricoVisao, useRegistoSessao } from "@/components/visao/hooks";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/contexts/ProfileContext";
import {
  ALVOS_MIN,
  MODO_TAPA_OLHO,
  TOTAL_CROMOS,
  confirmar,
  cromoDoDia,
  diasCumpridos,
  guardarAlvo,
  guardarPeriodo,
  horasEMinutos,
  iniciarPeriodo,
  lerAlvo,
  lerPeriodo,
  minutosDeTapaPorDia,
  precisaVerificar,
  resumoSemana,
  segundosContados,
  type PeriodoTapa,
} from "@/lib/visao/caderneta";
import { ID_PERTO_LONGE } from "@/lib/visao/ids";
import { diaLocal, ultimosDias } from "@/lib/visao/progresso";
import { falar, sinalSonoro } from "@/lib/visao/voz";
import { cn } from "@/lib/utils";

/** O id histórico `flexibilidade-acomodativa` (antes, Treino Perto e longe). */
const EXERCICIO_ID = ID_PERTO_LONGE;
const CORES_CROMO = ["#b3302a", "#e3a21a", "#2f7d4f", "#1f52c4", "#a3168e", "#0b7782", "#c4450c", "#3a3f97"];
/** Menos do que isto não chega a ser um período: não se grava. */
const MINIMO_SEGUNDOS = 60;

/** "2 h 05" ou "45 min", com espaços que não partem a linha. */
const horas = (min: number, t: (k: string, o?: Record<string, unknown>) => string) => {
  const { h, m } = horasEMinutos(min);
  const texto = h ? t("Visao.cadernetaHoras", { h, m: String(m).padStart(2, "0") }) : t("Visao.cadernetaMinutos", { m });
  return texto.replace(/ /g, " ");
};

/** Um cromo: padrão de formas geradas a partir do número, com o nome por baixo. */
const Cromo = ({ i, grande = false }: { i: number; grande?: boolean }) => {
  const { t } = useTranslation();
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = ref.current;
    const g = cv?.getContext("2d");
    if (!cv || !g) return;
    const W = cv.width;
    const H = cv.height;
    let semente = (i + 1) * 9301;
    const r = () => (semente = (semente * 49297 + 233280) % 233280) / 233280;
    g.fillStyle = CORES_CROMO[i % CORES_CROMO.length];
    g.fillRect(0, 0, W, H);
    for (let k = 0; k < 7; k++) {
      g.fillStyle = CORES_CROMO[(i + k + 1) % CORES_CROMO.length];
      g.globalAlpha = 0.75;
      const tipo = Math.floor(r() * 3);
      const x = r() * W;
      const y = r() * H;
      const tam = 20 + r() * W * 0.35;
      g.beginPath();
      if (tipo === 0) g.arc(x, y, tam / 2, 0, Math.PI * 2);
      else if (tipo === 1) {
        g.moveTo(x, y - tam / 2);
        g.lineTo(x + tam / 2, y + tam / 2);
        g.lineTo(x - tam / 2, y + tam / 2);
        g.closePath();
      } else g.rect(x - tam / 2, y - tam / 6, tam, tam / 3);
      g.fill();
    }
    g.globalAlpha = 1;
    g.fillStyle = "rgba(255,255,255,0.9)";
    g.fillRect(0, H * 0.74, W, H * 0.26);
    g.fillStyle = "#111111";
    g.textAlign = "center";
    g.font = `800 ${Math.round(W * 0.42)}px system-ui, sans-serif`;
    g.fillText(String(i + 1), W / 2, H * 0.5);
    g.font = `600 ${Math.round(W * 0.075)}px system-ui, sans-serif`;
    g.fillText(t(`Visao.cadernetaCromo_${i}`), W / 2, H * 0.89, W * 0.92);
  }, [i, t]);
  return (
    <canvas
      ref={ref}
      width={grande ? 300 : 120}
      height={grande ? 400 : 160}
      role="img"
      aria-label={t("Visao.cadernetaCromoRotulo", { n: i + 1, nome: t(`Visao.cadernetaCromo_${i}`) })}
      className={cn("block w-full rounded-lg", grande && "mx-auto max-w-[220px] border-[3px] border-teal")}
    />
  );
};

/** A Kianda a nadar devagar, enquanto o tapa-olho está posto. Um só requestAnimationFrame, ~10 imagens por segundo. */
const MarCalmo = () => {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const g = ref.current?.getContext("2d");
    if (!g) return;
    let raf = 0;
    let ultimo = 0;
    const animar = (tempo: number) => {
      raf = requestAnimationFrame(animar);
      if (tempo - ultimo < 100) return;
      ultimo = tempo;
      const f = tempo / 1000 * 0.6;
      g.fillStyle = "#cfe9f2";
      g.fillRect(0, 0, 600, 220);
      g.fillStyle = "#e3c896";
      g.fillRect(0, 190, 600, 30);
      const x = 300 + Math.sin(f) * 200;
      const y = 110 + Math.sin(f * 2.1) * 25;
      g.save();
      g.translate(x, y);
      g.scale(Math.cos(f) >= 0 ? 1 : -1, 1);
      g.fillStyle = "#0b7782";
      g.beginPath();
      g.ellipse(0, 0, 50, 22, 0, 0, Math.PI * 2);
      g.fill();
      g.beginPath();
      g.moveTo(-40, 0);
      g.lineTo(-75, -22);
      g.lineTo(-75, 22);
      g.closePath();
      g.fill();
      g.fillStyle = "#3a2a1a";
      g.beginPath();
      g.ellipse(30, -12, 22, 12, -0.4, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = "#ffffff";
      g.beginPath();
      g.arc(30, -6, 6, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = "#111111";
      g.beginPath();
      g.arc(32, -6, 3, 0, Math.PI * 2);
      g.fill();
      g.restore();
    };
    raf = requestAnimationFrame(animar);
    return () => cancelAnimationFrame(raf);
  }, []);
  return <canvas ref={ref} width={600} height={220} className="block h-auto w-full rounded-xl" aria-hidden />;
};

/**
 * Caderneta do Tapa-olho (id `flexibilidade-acomodativa`, Premium): conta as
 * horas de tapa-olho longe do ecrã. Ver `lib/visao/caderneta.ts`.
 */
const CadernetaTapaOlho = () => {
  const { t, i18n } = useTranslation();
  const { isLoggedIn } = useAuth();
  const { profile } = useProfile();
  const { sessoes, recarregar } = useHistoricoVisao();
  const { estado: gravacao, gravar, tentarDeNovo } = useRegistoSessao();
  const [alvo, setAlvo] = useState(() => lerAlvo());
  const [periodo, setPeriodo] = useState<PeriodoTapa | null>(() => lerPeriodo());
  const [agora, setAgora] = useState(() => Date.now());
  const [cromoNovo, setCromoNovo] = useState<number | null>(null);
  const perguntou = useRef(false);

  const olhoTreinado = profile?.olho_mais_fraco === "direito" || profile?.olho_mais_fraco === "esquerdo" ? profile.olho_mais_fraco : null;
  const hoje = diaLocal(new Date(agora));
  const porDiaGravado = useMemo(() => minutosDeTapaPorDia(sessoes ?? []), [sessoes]);
  const contadosAgora = periodo ? segundosContados(periodo, agora) / 60 : 0;
  const porDia = useMemo(() => {
    const m = new Map(porDiaGravado);
    if (contadosAgora) m.set(hoje, (m.get(hoje) ?? 0) + contadosAgora);
    return m;
  }, [contadosAgora, hoje, porDiaGravado]);
  const minutosHoje = porDia.get(hoje) ?? 0;
  const cumpridos = diasCumpridos(porDia, alvo);
  const semana = resumoSemana(porDia, alvo, new Date(agora));
  const aVerificar = !!periodo && precisaVerificar(periodo, agora);

  // Um relógio de segundo a segundo enquanto o tapa-olho está posto.
  useEffect(() => {
    if (!periodo) return;
    const id = window.setInterval(() => setAgora(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [periodo]);

  useEffect(() => {
    if (!aVerificar) {
      perguntou.current = false;
      return;
    }
    if (perguntou.current) return;
    perguntou.current = true;
    sinalSonoro("tic");
    falar(t("Visao.cadernetaVozVerificar"), i18n.language);
  }, [aVerificar, i18n.language, t]);

  // Dia cumprido durante este período: mostra o cromo novo uma vez.
  const cumpridoHojeAntes = useRef<boolean | null>(null);
  useEffect(() => {
    if (!periodo || sessoes === null) return;
    const cumpridoHoje = minutosHoje >= alvo;
    if (cumpridoHojeAntes.current === null) cumpridoHojeAntes.current = cumpridoHoje;
    else if (cumpridoHoje && !cumpridoHojeAntes.current) {
      cumpridoHojeAntes.current = true;
      const i = cromoDoDia(cumpridos.indexOf(hoje));
      setCromoNovo(i);
      sinalSonoro("festa");
      falar(t("Visao.cadernetaVozCromo", { nome: t(`Visao.cadernetaCromo_${i}`) }), i18n.language);
    }
  }, [alvo, cumpridos, hoje, i18n.language, minutosHoje, periodo, sessoes, t]);

  const comecar = () => {
    const p = iniciarPeriodo(Date.now(), alvo, olhoTreinado);
    guardarPeriodo(p);
    setPeriodo(p);
    setAgora(Date.now());
    cumpridoHojeAntes.current = null;
    sinalSonoro("tic");
    falar(t("Visao.cadernetaVozComecar"), i18n.language);
  };

  const terminar = useCallback(
    (p: PeriodoTapa) => {
      const fim = Date.now();
      const segundos = segundosContados(p, fim);
      guardarPeriodo(null);
      setPeriodo(null);
      setAgora(fim);
      if (segundos < MINIMO_SEGUNDOS) return;
      void gravar([
        {
          exercicio_id: EXERCICIO_ID,
          olho: p.olhoTreinado ?? "ambos",
          duracao_segundos: Math.max(1, Math.round((fim - p.inicio) / 1000)),
          segundos_activos: segundos,
          limiar: null,
          sinais: { modo: MODO_TAPA_OLHO, alvo_min: p.alvoMin, verificacoes: p.verificacoes, minutos: Math.round(segundos / 60) },
        },
      ]).then(() => void recarregar());
    },
    [gravar, recarregar],
  );

  if (!isLoggedIn)
    return (
      <PaginaExercicio>
        <p className="py-10 text-center text-sm text-muted-foreground">{t("Visao.progressoSemSessao")}</p>
      </PaginaExercicio>
    );

  let conteudo;
  if (cromoNovo !== null)
    conteudo = (
      <div className="flex flex-col items-center gap-4 text-center">
        <p className="text-xl font-bold text-foreground">{t("Visao.cadernetaCromoNovo")}</p>
        <div className="w-full max-w-[220px]">
          <Cromo i={cromoNovo} grande />
        </div>
        <Button size="lg" onClick={() => setCromoNovo(null)}>
          {t("Visao.cadernetaColar")}
        </Button>
      </div>
    );
  else if (periodo)
    conteudo = (
      <div className="flex flex-col gap-4 text-center">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">{t("Visao.cadernetaPosto")}</p>
        <p className="text-6xl font-bold tabular-nums text-teal">{horas(segundosContados(periodo, agora) / 60, t)}</p>
        <p className="text-sm text-muted-foreground">
          {minutosHoje >= alvo ? t("Visao.cadernetaJaCumpriu") : t("Visao.cadernetaFalta", { falta: horas(alvo - minutosHoje, t) })}
        </p>
        <MarCalmo />
        <p className="text-sm text-foreground">{t("Visao.cadernetaBrincar")}</p>
        {aVerificar ? (
          <div className="rounded-xl border-2 border-teal p-4" role="alertdialog" aria-label={t("Visao.cadernetaPergunta")}>
            <p className="mb-3 font-semibold text-foreground">{t("Visao.cadernetaPergunta")}</p>
            <div className="flex flex-col justify-center gap-2 sm:flex-row">
              <Button
                size="lg"
                onClick={() => {
                  const c = confirmar(periodo, Date.now());
                  guardarPeriodo(c);
                  setPeriodo(c);
                  setAgora(Date.now());
                  sinalSonoro("certo");
                }}
              >
                {t("Visao.cadernetaSim")}
              </Button>
              <Button size="lg" variant="outline" onClick={() => terminar(periodo)}>
                {t("Visao.cadernetaTirou")}
              </Button>
            </div>
          </div>
        ) : (
          <Button variant="outline" onClick={() => terminar(periodo)}>
            {t("Visao.cadernetaTirei")}
          </Button>
        )}
      </div>
    );
  else {
    const fraccao = Math.min(1, minutosHoje / alvo);
    const ganhos = cumpridos.length;
    conteudo = (
      <div className="flex flex-col gap-5 text-left">
        <div className="flex items-center gap-4">
          <svg viewBox="0 0 120 120" className="h-28 w-28 shrink-0" aria-hidden>
            <circle cx={60} cy={60} r={50} fill="none" className="stroke-border" strokeWidth={12} />
            <circle
              cx={60}
              cy={60}
              r={50}
              fill="none"
              className="stroke-teal"
              strokeWidth={12}
              strokeLinecap="round"
              strokeDasharray={`${(2 * Math.PI * 50 * fraccao).toFixed(1)} 999`}
              transform="rotate(-90 60 60)"
            />
            <text x={60} y={66} textAnchor="middle" className="fill-foreground text-[22px] font-bold">
              {Math.round(fraccao * 100)}%
            </text>
          </svg>
          <div className="min-w-0 space-y-1">
            <p className="text-lg font-semibold text-foreground">{t("Visao.cadernetaHoje", { feito: horas(minutosHoje, t), alvo: horas(alvo, t) })}</p>
            <p className="text-sm text-muted-foreground">
              {t("Visao.cadernetaParaMedico", { media: horas(semana.mediaMin, t), pct: semana.pctDoReceitado, cumpridos: semana.cumpridos })}
            </p>
          </div>
        </div>
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">{t("Visao.cadernetaReceitado")}</p>
          <div role="radiogroup" aria-label={t("Visao.cadernetaReceitado")} className="flex flex-wrap gap-2">
            {ALVOS_MIN.map((m) => (
              <Button
                key={m}
                role="radio"
                aria-checked={alvo === m}
                size="sm"
                variant={alvo === m ? "default" : "outline"}
                className={cn(alvo === m && "bg-navy text-navy-foreground hover:bg-navy/90")}
                onClick={() => {
                  setAlvo(m);
                  guardarAlvo(m);
                }}
              >
                {horas(m, t)}
              </Button>
            ))}
          </div>
        </div>
        <Button size="lg" onClick={comecar}>
          {t("Visao.cadernetaComecar")}
        </Button>
        <EstadoDaGravacao estado={gravacao} aoTentarDeNovo={() => void tentarDeNovo()} />
        <div className="space-y-2">
          <p className="font-semibold text-foreground">{t("Visao.cadernetaSemana")}</p>
          <ol className="grid h-28 grid-cols-7 items-end gap-1" aria-label={t("Visao.cadernetaSemana")}>
            {ultimosDias(new Date(agora), 7).map((d, k) => {
              const m = semana.minutos[k];
              return (
                <li key={d} className="flex flex-col items-center gap-1 text-[10px] text-muted-foreground">
                  <span className="tabular-nums">{m}</span>
                  <div
                    className={cn("w-full rounded-t bg-teal", m < alvo && "opacity-50")}
                    style={{ height: `${Math.max(3, (m / Math.max(alvo, ...semana.minutos)) * 72)}px` }}
                  />
                </li>
              );
            })}
          </ol>
        </div>
        <div className="space-y-2">
          <p className="font-semibold text-foreground">{t("Visao.cadernetaAlbum", { n: Math.min(ganhos, TOTAL_CROMOS), total: TOTAL_CROMOS })}</p>
          <div className="grid grid-cols-5 gap-2">
            {Array.from({ length: TOTAL_CROMOS }, (_, i) =>
              i < ganhos ? (
                <Cromo key={i} i={cromoDoDia(i)} />
              ) : (
                <div key={i} className="grid aspect-[3/4] place-items-center rounded-lg border border-border text-xs text-muted-foreground">
                  {i + 1}
                </div>
              ),
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <PaginaExercicio>
      <BaseExercise title={t("Visao.pertoLongeTitulo")} description={t("Visao.pertoLongeDescricao")} exercicioId={EXERCICIO_ID} grupo="premium" tipo="treino">
        {conteudo}
      </BaseExercise>
    </PaginaExercicio>
  );
};

export default CadernetaTapaOlho;
