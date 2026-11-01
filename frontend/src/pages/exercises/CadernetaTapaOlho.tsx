import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import BaseExercise from "@/components/exercises/BaseExercise";
import PaginaExercicio from "@/components/visao/PaginaExercicio";
import { EstadoDaGravacao } from "@/components/visao/Resultados";
import { useHistoricoVisao, useRegistoSessao } from "@/components/visao/hooks";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/contexts/ProfileContext";
import {
  ACRESCENTAR_MIN,
  ALVOS_MIN,
  ALVO_OMISSAO_MIN,
  MODO_TAPA_OLHO,
  PASSO_ALVO_MIN,
  PERGUNTAR_AO_TIRAR_MIN,
  TOTAL_CROMOS,
  ajustarAlvo,
  confirmar,
  cromoDoDia,
  diasCumpridos,
  eManual,
  eSessaoDeTapa,
  guardarAlvo,
  guardarPeriodo,
  guardarVerificar,
  horasEMinutos,
  iniciarPeriodo,
  lerAlvo,
  lerPeriodo,
  lerVerificar,
  minutosDeTapaPorDia,
  precisaVerificar,
  resumoSemana,
  segundosAoTirar,
  segundosContados,
  tiradoAntesPossiveis,
  type PeriodoTapa,
} from "@/lib/visao/caderneta";
import { ID_PERTO_LONGE } from "@/lib/visao/ids";
import { diaLocal, ultimosDias } from "@/lib/visao/progresso";
import { sinalSonoro } from "@/lib/visao/voz";
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

/** "09:45", na hora local. */
const horaDe = (ms: number, lingua: string) => new Date(ms).toLocaleTimeString(lingua, { hour: "2-digit", minute: "2-digit" });

/** O desenho do tapa-olho no botão de Pôr. */
const IconeTapa = () => (
  <svg width="30" height="22" viewBox="0 0 30 22" aria-hidden>
    <path d="M1 6 C8 2 22 2 29 6" stroke="currentColor" strokeWidth={2} fill="none" />
    <ellipse cx={11} cy={12} rx={8} ry={7} fill="currentColor" />
    <circle cx={23} cy={12} r={4} fill="none" stroke="currentColor" strokeWidth={2} />
    <circle cx={23} cy={12} r={1.6} fill="currentColor" />
  </svg>
);

/** Botões de escolha única em fila (os tempos de "tirei há..." e de acrescentar). */
const Escolhas = ({ rotulo, valores, valor, aoEscolher, texto }: {
  rotulo: string;
  valores: readonly number[];
  valor: number;
  aoEscolher: (v: number) => void;
  texto: (v: number) => string;
}) => (
  <div role="radiogroup" aria-label={rotulo} className="flex flex-wrap gap-2">
    {valores.map((v) => (
      <Button
        key={v}
        role="radio"
        aria-checked={valor === v}
        variant={valor === v ? "default" : "outline"}
        className={cn("rounded-full", valor === v && "bg-navy text-navy-foreground hover:bg-navy/90")}
        onClick={() => aoEscolher(v)}
      >
        {texto(v)}
      </Button>
    ))}
  </div>
);

type Ecra = "inicio" | "configurar" | "tirar" | "acrescentar";

/**
 * Caderneta do Tapa-olho (id `flexibilidade-acomodativa`, Premium): conta as
 * horas de tapa-olho longe do ecrã, aos bocados. Ver `lib/visao/caderneta.ts`.
 */
const CadernetaTapaOlho = () => {
  const { t, i18n } = useTranslation();
  const { isLoggedIn } = useAuth();
  const { profile } = useProfile();
  const { sessoes, recarregar } = useHistoricoVisao();
  const { estado: gravacao, gravar, tentarDeNovo } = useRegistoSessao();
  const [alvoGuardado, setAlvoGuardado] = useState(() => lerAlvo());
  const alvo = alvoGuardado ?? ALVO_OMISSAO_MIN;
  const [verificar, setVerificar] = useState(() => lerVerificar());
  const [periodo, setPeriodo] = useState<PeriodoTapa | null>(() => lerPeriodo());
  const [agora, setAgora] = useState(() => Date.now());
  const [ecra, setEcra] = useState<Ecra>(() => (lerAlvo() === null && !lerPeriodo() ? "configurar" : "inicio"));
  const [escolha, setEscolha] = useState(alvo);
  const [tiradoAntes, setTiradoAntes] = useState(0);
  const [acrescentar, setAcrescentar] = useState(60);
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
  // Os bocados de hoje, do mais antigo para o mais recente (a API devolve os mais recentes primeiro).
  const bocadosHoje = useMemo(
    () =>
      (sessoes ?? [])
        .filter((s) => eSessaoDeTapa(s) && diaLocal(new Date(s.created_at)) === hoje)
        .sort((a, b) => a.created_at.localeCompare(b.created_at)),
    [hoje, sessoes],
  );

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
  }, [aVerificar]);

  // Chegou-se hoje ao tempo receitado (com o tapa-olho posto ou ao acrescentar à mão): mostra o cromo novo uma vez.
  // Uma vez por dia: ao gravar um bocado, os minutos descem por instantes (até recarregar) e não podem dar outro cromo.
  const diaDoCromo = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    if (sessoes === null) return;
    const cumpridoHoje = minutosHoje >= alvo;
    if (diaDoCromo.current === undefined) diaDoCromo.current = cumpridoHoje ? hoje : null;
    else if (cumpridoHoje && diaDoCromo.current !== hoje) {
      diaDoCromo.current = hoje;
      setCromoNovo(cromoDoDia(cumpridos.indexOf(hoje)));
      sinalSonoro("festa");
    }
  }, [alvo, cumpridos, hoje, minutosHoje, sessoes]);

  const gravarBocado = (sessao: { inicio: number; fim: number; segundos: number; manual: boolean; tiradoAntesMin: number; verificacoes: number | null }) =>
    void gravar([
      {
        exercicio_id: EXERCICIO_ID,
        olho: olhoTreinado ?? "ambos",
        duracao_segundos: Math.max(1, Math.round((sessao.fim - sessao.inicio) / 1000)),
        segundos_activos: sessao.segundos,
        limiar: null,
        sinais: {
          modo: MODO_TAPA_OLHO,
          versao: 2,
          alvo_min: alvo,
          minutos: Math.round(sessao.segundos / 60),
          manual: sessao.manual,
          verificacoes: sessao.verificacoes,
          tirado_antes_min: sessao.tiradoAntesMin,
          inicio: new Date(sessao.inicio).toISOString(),
          fim: new Date(sessao.fim - sessao.tiradoAntesMin * 60_000).toISOString(),
        },
      },
    ]).then(() => void recarregar());

  const por = () => {
    const p = iniciarPeriodo(Date.now(), alvo, olhoTreinado, verificar);
    guardarPeriodo(p);
    setPeriodo(p);
    setAgora(Date.now());
    sinalSonoro("tic");
  };

  /** Fecha o bocado em curso; `tiradoAntesMin` desconta o tempo em que já estava tirado. */
  const terminar = (p: PeriodoTapa, tiradoAntesMin = 0) => {
    const fim = Date.now();
    const segundos = segundosAoTirar(p, fim, tiradoAntesMin);
    guardarPeriodo(null);
    setPeriodo(null);
    setAgora(fim);
    setEcra("inicio");
    if (segundos < MINIMO_SEGUNDOS) return;
    gravarBocado({ inicio: p.inicio, fim, segundos, manual: false, tiradoAntesMin, verificacoes: p.verificar === false ? null : p.verificacoes });
  };

  const tirar = (p: PeriodoTapa) => {
    // Bocados compridos: pergunta-se se o tirou agora, para quem se esqueceu de tocar em Tirar.
    if (!precisaVerificar(p, Date.now()) && segundosContados(p, Date.now()) / 60 >= PERGUNTAR_AO_TIRAR_MIN) {
      setTiradoAntes(0);
      setEcra("tirar");
    } else terminar(p);
  };

  const acrescentarAgora = () => {
    const fim = Date.now();
    setEcra("inicio");
    gravarBocado({ inicio: fim - acrescentar * 60_000, fim, segundos: acrescentar * 60, manual: true, tiradoAntesMin: 0, verificacoes: null });
  };

  const guardarConfiguracao = () => {
    setAlvoGuardado(escolha);
    guardarAlvo(escolha);
    guardarVerificar(verificar);
    setEcra("inicio");
  };

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
        <p className="text-sm text-foreground">{t("Visao.cadernetaFez", { feito: horas(minutosHoje, t) })}</p>
        <Button size="lg" onClick={() => setCromoNovo(null)}>
          {t("Visao.cadernetaColar")}
        </Button>
      </div>
    );
  else if (ecra === "configurar") {
    const primeiraVez = alvoGuardado === null;
    const outro = !(ALVOS_MIN as readonly number[]).includes(escolha);
    const opcao = (min: number | null, titulo: string, texto: string) => {
      const marcada = min === null ? outro : escolha === min;
      return (
        <button
          key={titulo}
          type="button"
          role="radio"
          aria-checked={marcada}
          onClick={() => setEscolha(min ?? (outro ? escolha : 90))}
          className={cn(
            "grid gap-0.5 rounded-xl border-2 px-4 py-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            marcada ? "border-teal bg-teal/10" : "border-border",
          )}
        >
          <span className="text-lg font-bold text-foreground">{titulo}</span>
          <span className="text-sm text-muted-foreground">{texto}</span>
        </button>
      );
    };
    conteudo = (
      <div className="flex flex-col gap-4 text-left">
        <p className="text-xl font-bold text-foreground">{t("Visao.cadernetaQuantoTempo")}</p>
        <div role="radiogroup" aria-label={t("Visao.cadernetaQuantoTempo")} className="grid gap-2">
          {opcao(120, t("Visao.cadernetaDuasHoras"), t("Visao.cadernetaAlvo2h"))}
          {opcao(360, t("Visao.cadernetaSeisHoras"), t("Visao.cadernetaAlvo6h"))}
          {opcao(null, t("Visao.cadernetaAlvoOutro"), t("Visao.cadernetaAlvoOutroTexto"))}
        </div>
        {outro && (
          <div className="flex items-center justify-center gap-4">
            <Button size="icon" className="rounded-full" aria-label={t("Visao.cadernetaMenos")} onClick={() => setEscolha(ajustarAlvo(escolha - PASSO_ALVO_MIN))}>
              −
            </Button>
            <span className="min-w-24 text-center text-xl font-bold tabular-nums text-foreground">{horas(escolha, t)}</span>
            <Button size="icon" className="rounded-full" aria-label={t("Visao.cadernetaMais")} onClick={() => setEscolha(ajustarAlvo(escolha + PASSO_ALVO_MIN))}>
              +
            </Button>
          </div>
        )}
        {!primeiraVez && (
          <label className="flex items-start justify-between gap-3">
            <span>
              <span className="block font-semibold text-foreground">{t("Visao.cadernetaVerificar")}</span>
              <span className="block text-sm text-muted-foreground">{t("Visao.cadernetaVerificarTexto")}</span>
            </span>
            <input type="checkbox" role="switch" className="mt-1 h-6 w-6 shrink-0 accent-teal" checked={verificar} onChange={(e) => setVerificar(e.target.checked)} />
          </label>
        )}
        <p className="text-sm text-muted-foreground">{t("Visao.cadernetaNaDuvida")}</p>
        <Button size="lg" onClick={guardarConfiguracao}>
          {t("Visao.cadernetaGuardar")}
        </Button>
        {!primeiraVez && (
          <Button size="lg" variant="outline" onClick={() => setEcra("inicio")}>
            {t("Visao.cadernetaVoltar")}
          </Button>
        )}
      </div>
    );
  } else if (periodo && ecra === "tirar") {
    const minutos = segundosContados(periodo, agora) / 60;
    conteudo = (
      <div className="flex flex-col gap-4 text-left">
        <p className="text-xl font-bold text-foreground">{t("Visao.cadernetaTirouAgora")}</p>
        <p className="text-foreground">{t("Visao.cadernetaTirouAgoraTexto", { hora: horaDe(periodo.inicio, i18n.language) })}</p>
        <Escolhas
          rotulo={t("Visao.cadernetaTirouAgora")}
          valores={[0, ...tiradoAntesPossiveis(minutos)]}
          valor={tiradoAntes}
          aoEscolher={setTiradoAntes}
          texto={(m) => (m ? t("Visao.cadernetaHa", { tempo: horas(m, t) }) : t("Visao.cadernetaAgora"))}
        />
        <p className="text-sm text-muted-foreground">{t("Visao.cadernetaConta", { tempo: horas(Math.max(0, minutos - tiradoAntes), t) })}</p>
        <Button size="lg" onClick={() => terminar(periodo, tiradoAntes)}>
          {t("Visao.cadernetaGuardar")}
        </Button>
        <Button size="lg" variant="outline" onClick={() => setEcra("inicio")}>
          {t("Visao.cadernetaAindaPosto")}
        </Button>
      </div>
    );
  } else if (periodo)
    conteudo = (
      <div className="flex flex-col gap-4 text-center">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">{t("Visao.cadernetaPostoDesde", { hora: horaDe(periodo.inicio, i18n.language) })}</p>
        <p className="text-6xl font-bold tabular-nums text-teal">{horas(segundosContados(periodo, agora) / 60, t)}</p>
        <div className="h-3 overflow-hidden rounded-full bg-border" aria-hidden>
          <div className="h-full rounded-full bg-teal transition-all" style={{ width: `${Math.min(100, (minutosHoje / alvo) * 100)}%` }} />
        </div>
        <p className="text-sm text-muted-foreground">
          {minutosHoje >= alvo ? t("Visao.cadernetaJaCumpriu") : t("Visao.cadernetaHoje", { feito: horas(minutosHoje, t), alvo: horas(alvo, t) })}
        </p>
        <MarCalmo />
        <p className="text-sm text-foreground">{t("Visao.cadernetaBrincar")}</p>
        {aVerificar && (
          <div className="rounded-xl border-2 border-teal p-4" role="alertdialog" aria-label={t("Visao.cadernetaPergunta")}>
            <p className="mb-3 font-semibold text-foreground">{t("Visao.cadernetaPergunta")}</p>
            <div className="grid grid-cols-2 gap-2">
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
        )}
        <Button size="lg" variant="destructive" className="h-16 text-lg" onClick={() => tirar(periodo)}>
          {t("Visao.cadernetaTirar")}
        </Button>
      </div>
    );
  else if (ecra === "acrescentar")
    conteudo = (
      <div className="flex flex-col gap-4 text-left">
        <p className="text-xl font-bold text-foreground">{t("Visao.cadernetaAcrescentarTitulo")}</p>
        <p className="text-foreground">{t("Visao.cadernetaAcrescentarTexto")}</p>
        <Escolhas rotulo={t("Visao.cadernetaAcrescentarTitulo")} valores={ACRESCENTAR_MIN} valor={acrescentar} aoEscolher={setAcrescentar} texto={(m) => horas(m, t)} />
        <p className="text-sm text-muted-foreground">{t("Visao.cadernetaAcrescentarNota")}</p>
        <Button size="lg" onClick={acrescentarAgora}>
          {t("Visao.cadernetaAcrescentarBotao", { tempo: horas(acrescentar, t) })}
        </Button>
        <Button size="lg" variant="outline" onClick={() => setEcra("inicio")}>
          {t("Visao.cadernetaVoltar")}
        </Button>
      </div>
    );
  else {
    const fraccao = Math.min(1, minutosHoje / alvo);
    const ganhos = cumpridos.length;
    conteudo = (
      <div className="flex flex-col gap-5 text-left">
        <p className="text-foreground">{t("Visao.cadernetaInstrucao")}</p>
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
              {minutosHoje >= alvo ? t("Visao.cadernetaGanho") : t("Visao.cadernetaFalta", { falta: horas(alvo - minutosHoje, t) })}
            </p>
          </div>
        </div>
        <Button size="lg" className="h-16 gap-3 text-lg [&_svg]:size-auto" onClick={por}>
          <IconeTapa />
          {t("Visao.cadernetaPor")}
        </Button>
        <EstadoDaGravacao estado={gravacao} aoTentarDeNovo={() => void tentarDeNovo()} />
        <div className="space-y-2">
          <p className="font-semibold text-foreground">{t("Visao.cadernetaHojeLista")}</p>
          {bocadosHoje.length ? (
            <ul className="space-y-1 text-sm">
              {bocadosHoje.map((s) => {
                const inicio = typeof s.sinais?.inicio === "string" ? Date.parse(s.sinais.inicio) : NaN;
                const fim = typeof s.sinais?.fim === "string" ? Date.parse(s.sinais.fim) : Date.parse(s.created_at);
                return (
                  <li key={s.id} className="flex justify-between gap-2 rounded-lg bg-muted px-3 py-1.5 tabular-nums">
                    <span>
                      {eManual(s)
                        ? t("Visao.cadernetaManual")
                        : Number.isNaN(inicio)
                          ? horaDe(fim, i18n.language)
                          : `${horaDe(inicio, i18n.language)}–${horaDe(fim, i18n.language)}`}
                      {Number(s.sinais?.tirado_antes_min) > 0 && <span className="text-xs text-muted-foreground"> {t("Visao.cadernetaCorrigido")}</span>}
                    </span>
                    <span className="font-semibold">{horas((s.segundos_activos ?? 0) / 60, t)}</span>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">{t("Visao.cadernetaNenhumBocado")}</p>
          )}
          <Button
            variant="link"
            className="h-auto px-0"
            onClick={() => {
              setAcrescentar(60);
              setEcra("acrescentar");
            }}
          >
            {t("Visao.cadernetaAcrescentar")}
          </Button>
        </div>
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
          <p className="text-xs text-muted-foreground">
            {t("Visao.cadernetaParaMedico", { media: horas(semana.mediaMin, t), pct: semana.pctDoReceitado, cumpridos: semana.cumpridos })}
          </p>
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
        <Button
          variant="link"
          className="h-auto justify-start px-0"
          onClick={() => {
            setEscolha(alvo);
            setEcra("configurar");
          }}
        >
          {t("Visao.cadernetaMudar", { alvo: horas(alvo, t) })}
        </Button>
      </div>
    );
  }

  return (
    <PaginaExercicio>
      <BaseExercise title={t("Visao.pertoLongeTitulo")} description={t("Visao.pertoLongeDescricao")} exercicioId={EXERCICIO_ID} tipo="treino">
        {conteudo}
      </BaseExercise>
    </PaginaExercicio>
  );
};

export default CadernetaTapaOlho;
