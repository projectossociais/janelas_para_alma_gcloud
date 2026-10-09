import { useEffect, useRef, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  AlertTriangle,
  ArrowRight,
  CalendarCheck,
  Camera,
  CheckCircle2,
  CircleDot,
  Eye,
  FlaskConical,
  Glasses,
  Images,
  Loader2,
  Printer,
  RefreshCw,
  ShieldCheck,
  Sun,
  Users,
} from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import BackButton from "@/components/BackButton";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useAuth } from "@/contexts/AuthContext";
import { useConsentimentoSaude } from "@/contexts/ConsentimentoSaudeContext";
import { suportaCaminhoA, useCameraTraseira } from "@/hooks/useCameraTraseira";
import { localizar } from "@/i18n/rotas";
import { rastreioCompletoApi, type ResultadoRastreioCompleto } from "@/lib/apiClient";
import { analisarFoto } from "@/lib/rastreio/captura/analisarFoto";
import {
  dicaDeRepeticao,
  medirFotografias,
  paraMedicoesApi,
  type DicaRepeticao,
  type MedicoesParaApi,
} from "@/lib/rastreio/captura/sessaoCompleta";
import { detectarIris } from "@/lib/rastreio/detectorIris";

/**
 * Rastreio completo com o motor próprio (docs/MOTOR_ANALISE_RASTREIO.md): outra
 * pessoa fotografa com a câmara de trás e a luz acesa, a criança olha para um
 * ponto junto à lente, e as fotografias são medidas **no telemóvel**. Só os
 * números seguem para a API, que decide o resultado (CLAUDE.md §3).
 *
 * Duas formas de captura, a mesma análise:
 * - **A, câmara na página** (Android/Chrome): luz e quatro fotografias seguidas.
 * - **B, câmara do telemóvel** (iPhone e o resto): abre a aplicação da câmara,
 *   três fotografias, uma de cada vez.
 *
 * As fotografias vivem só na memória desta página e são libertadas logo depois
 * de medidas (CLAUDE.md §4, regra 4). Publicado só para testes com voluntários:
 * sem ligação nos menus, `noindex` e aviso "versão de teste"; o rastreio oficial
 * continua a ser o `/scanner`.
 *
 * O resultado mostra-se aqui mesmo (passo 5): o ecrã de resultados do `/scanner`
 * só conhece o resultado do serviço de análise, não o do motor.
 */

const FOTOS_CAMINHO_A = 4;
const FOTOS_CAMINHO_B = 3;

const PREPARACAO = [
  { chave: "pessoa", Icone: Users },
  { chave: "oculos", Icone: Glasses },
  { chave: "luz", Icone: Sun },
  { chave: "alvo", Icone: CircleDot },
] as const;

const DICA: Record<DicaRepeticao, string> = {
  semRosto: "RastreioCompleto.dicaSemRosto",
  longe: "RastreioCompleto.dicaLonge",
  luz: "RastreioCompleto.dicaLuz",
  olhar: "RastreioCompleto.dicaOlhar",
  geral: "RastreioCompleto.dicaGeral",
};

type EstadoAnalise = "a-medir" | "a-calcular" | "erro-rede" | "erro-fotos";

interface Resultado {
  medicoes: MedicoesParaApi;
  api: ResultadoRastreioCompleto;
  dica: DicaRepeticao;
}

/** O ficheiro da câmara nativa → imagem em memória (o browser aplica a orientação EXIF). */
const lerFicheiro = (f: File) => createImageBitmap(f);

const RastreioCompleto = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { isLoggedIn } = useAuth();
  const { garantir: garantirConsentimento } = useConsentimentoSaude();
  const camera = useCameraTraseira();

  const [passo, setPasso] = useState(1);
  const [prontos, setProntos] = useState<Record<string, boolean>>({});
  // A câmara nativa é o caminho por omissão onde a da página não existe (iPhone).
  const [nativa, setNativa] = useState(() => !suportaCaminhoA());
  const [aTirar, setATirar] = useState(false);
  const [erroCaptura, setErroCaptura] = useState(false);
  const [feitas, setFeitas] = useState(0);
  const [analise, setAnalise] = useState<EstadoAnalise>("a-medir");
  const [progresso, setProgresso] = useState<[number, number]>([0, 0]);
  const [resultado, setResultado] = useState<Resultado | null>(null);

  const fotos = useRef<ImageBitmap[]>([]);
  const medicoes = useRef<{ corpo: MedicoesParaApi; dica: DicaRepeticao } | null>(null);
  const entrada = useRef<HTMLInputElement>(null);
  const topo = useRef<HTMLHeadingElement>(null);

  // Cada passo novo começa no topo, com o foco no título (leitores de ecrã).
  useEffect(() => {
    window.scrollTo({ top: 0 });
    topo.current?.focus();
  }, [passo]);

  const libertarFotos = () => {
    fotos.current.forEach((f) => f.close());
    fotos.current = [];
    setFeitas(0);
  };

  // Ao sair da página, as fotografias que ainda estejam na memória são libertadas.
  useEffect(() => () => fotos.current.forEach((f) => f.close()), []);

  const tudoPronto = PREPARACAO.every((p) => prontos[p.chave]);

  const pedirCamera = async () => {
    // O consentimento para dados de saúde vem antes da câmara (CLAUDE.md §4.9).
    if (!(await garantirConsentimento())) return;
    libertarFotos();
    setErroCaptura(false);
    if (nativa) return setPasso(3);
    if (await camera.ligar()) setPasso(3);
  };

  const analisar = async () => {
    setAnalise("a-medir");
    try {
      // Medir só uma vez: se o envio falhar, "Tentar de novo" reenvia as medições.
      if (!medicoes.current) {
        const sessao = await medirFotografias(fotos.current, {
          detectarIris,
          analisarFoto,
          aoProgredir: (feita, total) => setProgresso([feita, total]),
        });
        medicoes.current = { corpo: paraMedicoesApi(sessao), dica: dicaDeRepeticao(sessao) };
        libertarFotos();
      }
      setAnalise("a-calcular");
      const { corpo, dica } = medicoes.current;
      const api = await rastreioCompletoApi.classificar(corpo);
      medicoes.current = null;
      setResultado({ medicoes: corpo, api, dica });
      setPasso(5);
    } catch {
      setAnalise(medicoes.current ? "erro-rede" : "erro-fotos");
    }
  };

  const seguirParaAnalise = () => {
    camera.desligar();
    medicoes.current = null;
    setProgresso([0, fotos.current.length]);
    setPasso(4);
    void analisar();
  };

  const tirarSequencia = async () => {
    setATirar(true);
    setErroCaptura(false);
    const tiradas = await camera.fotografarSequencia(FOTOS_CAMINHO_A);
    setATirar(false);
    if (tiradas.length < 2) {
      tiradas.forEach((f) => f.close());
      setErroCaptura(true);
      return;
    }
    fotos.current = tiradas;
    seguirParaAnalise();
  };

  const aoEscolherFicheiro = async (ev: React.ChangeEvent<HTMLInputElement>) => {
    const ficheiro = ev.target.files?.[0];
    ev.target.value = ""; // deixa tirar outra com o mesmo botão
    if (!ficheiro) return;
    try {
      fotos.current.push(await lerFicheiro(ficheiro));
    } catch {
      setErroCaptura(true);
      return;
    }
    setErroCaptura(false);
    setFeitas(fotos.current.length);
    if (fotos.current.length >= FOTOS_CAMINHO_B) seguirParaAnalise();
  };

  const repetirFotografias = async () => {
    libertarFotos();
    medicoes.current = null;
    setResultado(null);
    setErroCaptura(false);
    if (!nativa && (await camera.ligar())) return setPasso(3);
    setPasso(nativa ? 3 : 2);
  };

  const aLigar = camera.estado === "a-ligar";
  const falhaCamera = camera.estado === "recusada" || camera.estado === "indisponivel" || camera.estado === "sem-suporte";
  const delta = (v: number) => `${v.toLocaleString(i18n.language, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} Δ`;

  const titulo = (texto: string) => (
    <h1 ref={topo} tabIndex={-1} className="text-2xl md:text-3xl font-bold text-foreground outline-none">
      {texto}
    </h1>
  );

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Helmet>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>
      <Navbar />
      <BackButton fallbackPath={localizar("/")} />
      <main className="flex-1">
        <section className="container py-8 md:py-12">
          <div className="max-w-xl mx-auto">
            {passo < 5 && (
              <p className="text-xs font-semibold uppercase tracking-widest text-teal mb-3">
                {t("RastreioCompleto.passo", { actual: passo, total: 4 })}
              </p>
            )}

            {/* A câmara nativa devolve a fotografia por aqui; `capture` abre a aplicação da câmara. */}
            <input
              ref={entrada}
              type="file"
              accept="image/*"
              capture="environment"
              className="sr-only"
              tabIndex={-1}
              aria-hidden
              onChange={(ev) => void aoEscolherFicheiro(ev)}
            />

            {passo === 1 && (
              <div className="space-y-6">
                {titulo(t("RastreioCompleto.prepararTitulo"))}
                <p className="text-muted-foreground">{t("RastreioCompleto.prepararTexto")}</p>
                <div role="note" className="flex gap-3 rounded-xl border border-gold/40 bg-gold/10 p-4 text-sm">
                  <FlaskConical className="w-5 h-5 shrink-0 text-gold" aria-hidden />
                  <div>
                    <p className="font-semibold text-foreground">{t("RastreioCompleto.testeTitulo")}</p>
                    <p className="text-muted-foreground">{t("RastreioCompleto.testeTexto")}</p>
                  </div>
                </div>
                <ul className="space-y-3">
                  {PREPARACAO.map(({ chave, Icone }) => (
                    <li key={chave}>
                      <label className="flex cursor-pointer gap-3 rounded-xl border border-border bg-card p-4 hover:border-teal/50">
                        <Checkbox
                          checked={!!prontos[chave]}
                          onCheckedChange={(v) => setProntos((s) => ({ ...s, [chave]: v === true }))}
                          className="mt-1"
                        />
                        <Icone className="w-5 h-5 shrink-0 text-teal mt-0.5" aria-hidden />
                        <span>
                          <span className="block font-medium text-foreground">{t(`RastreioCompleto.${chave}`)}</span>
                          <span className="block text-sm text-muted-foreground">{t(`RastreioCompleto.${chave}Descricao`)}</span>
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>
                {/* Sem impressora, desenha-se à mão: o texto da folha diz como. */}
                <a
                  href="/alvo-fixacao.svg"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 font-medium text-teal hover:underline"
                >
                  <Printer className="w-5 h-5" aria-hidden /> {t("RastreioCompleto.alvoLigacao")}
                </a>
                <p role="status" className="text-sm text-muted-foreground">
                  {tudoPronto ? t("RastreioCompleto.tudoPronto") : t("RastreioCompleto.faltaConfirmar")}
                </p>
                <Button size="lg" className="w-full" disabled={!tudoPronto} onClick={() => setPasso(2)}>
                  {t("RastreioCompleto.estouPronto")} <ArrowRight className="w-4 h-4" />
                </Button>
                <p className="flex items-center gap-2 text-xs text-muted-foreground">
                  <ShieldCheck className="w-4 h-4 shrink-0 text-green" aria-hidden />
                  {t("RastreioCompleto.triagem")}
                </p>
              </div>
            )}

            {passo === 2 && (
              <div className="space-y-6">
                {titulo(t(nativa ? "RastreioCompleto.nativaTitulo" : "RastreioCompleto.cameraTitulo"))}
                <p className="text-muted-foreground">
                  {t(nativa ? "RastreioCompleto.nativaTexto" : "RastreioCompleto.cameraTexto")}
                </p>
                <ul className="space-y-4">
                  {[
                    { Icone: Eye, texto: t("RastreioCompleto.cameraPonto1") },
                    { Icone: Images, texto: t(nativa ? "RastreioCompleto.nativaPonto2" : "RastreioCompleto.cameraPonto2") },
                    { Icone: ShieldCheck, texto: t("RastreioCompleto.cameraPonto3") },
                  ].map(({ Icone, texto }) => (
                    <li key={texto} className="flex gap-3">
                      <Icone className="w-5 h-5 shrink-0 text-teal mt-0.5" aria-hidden />
                      <span className="text-foreground">{texto}</span>
                    </li>
                  ))}
                </ul>
                {falhaCamera && (
                  <div role="alert" className="flex gap-3 rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm">
                    <AlertTriangle className="w-5 h-5 shrink-0 text-destructive" aria-hidden />
                    <div>
                      <p className="font-semibold text-foreground">
                        {t(camera.estado === "recusada" ? "RastreioCompleto.recusadaTitulo" : "RastreioCompleto.indisponivelTitulo")}
                      </p>
                      <p className="text-muted-foreground">
                        {t(camera.estado === "recusada" ? "RastreioCompleto.recusadaTexto" : "RastreioCompleto.indisponivelTexto")}
                      </p>
                    </div>
                  </div>
                )}
                <div className="flex flex-col gap-3">
                  <Button size="lg" className="w-full" disabled={aLigar} onClick={() => void pedirCamera()}>
                    {aLigar ? <Loader2 className="w-4 h-4 animate-spin" /> : falhaCamera ? <RefreshCw className="w-4 h-4" /> : <Camera className="w-4 h-4" />}
                    {falhaCamera
                      ? t("RastreioCompleto.tentarDeNovo")
                      : nativa
                        ? t("RastreioCompleto.abrirCamera")
                        : t("RastreioCompleto.permitir")}
                  </Button>
                  {/* Se a câmara da página falhar, a do telemóvel resolve na maioria dos casos. */}
                  {falhaCamera && !nativa && (
                    <Button size="lg" variant="outline" className="w-full" onClick={() => setNativa(true)}>
                      {t("RastreioCompleto.usarNativa")}
                    </Button>
                  )}
                </div>
              </div>
            )}

            {passo === 3 && (
              <div className="space-y-6">
                {nativa ? (
                  <>
                    <p className="text-sm font-medium text-muted-foreground" aria-live="polite">
                      {t("RastreioCompleto.fotografiaN", { n: Math.min(feitas + 1, FOTOS_CAMINHO_B), total: FOTOS_CAMINHO_B })}
                    </p>
                    {titulo(t("RastreioCompleto.nativaFotografarTitulo"))}
                    <p className="text-muted-foreground">{t("RastreioCompleto.nativaFotografarTexto")}</p>
                    <p role="status" className="text-foreground">
                      {t("RastreioCompleto.prontas", { n: feitas, total: FOTOS_CAMINHO_B })}
                    </p>
                    <Button size="lg" className="w-full" onClick={() => entrada.current?.click()}>
                      <Camera className="w-4 h-4" />
                      {t(feitas === 0 ? "RastreioCompleto.abrirCamera" : "RastreioCompleto.tirarOutra")}
                    </Button>
                  </>
                ) : (
                  <>
                    {titulo(t("RastreioCompleto.fotografarTitulo"))}
                    <p className="text-muted-foreground">{t("RastreioCompleto.fotografarTexto")}</p>
                    <div className="relative mx-auto aspect-square w-full overflow-hidden rounded-2xl bg-navy sm:aspect-[3/4] sm:max-w-xs">
                      <video
                        ref={camera.refVideo}
                        autoPlay
                        playsInline
                        muted
                        aria-label={t("RastreioCompleto.videoRotulo")}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    {!camera.luzDisponivel && camera.estado === "ligada" && (
                      <p role="note" className="rounded-xl border border-gold/40 bg-gold/10 p-4 text-sm text-foreground">
                        {t("RastreioCompleto.luzIndisponivel")}
                      </p>
                    )}
                    <Button
                      size="lg"
                      className="w-full"
                      disabled={aTirar || camera.estado !== "ligada"}
                      onClick={() => void tirarSequencia()}
                    >
                      {aTirar ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
                      {aTirar ? t("RastreioCompleto.aTirar") : t("RastreioCompleto.tirarFotografias")}
                    </Button>
                  </>
                )}
                {erroCaptura && (
                  <p role="alert" className="rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-foreground">
                    {t("RastreioCompleto.erroFotografar")}
                  </p>
                )}
              </div>
            )}

            {passo === 4 && (
              <div className="space-y-6">
                {analise === "a-medir" || analise === "a-calcular" ? (
                  <>
                    {titulo(t("RastreioCompleto.analiseTitulo"))}
                    <p className="text-muted-foreground">{t("RastreioCompleto.analiseTexto")}</p>
                    <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="w-4 h-4 animate-spin text-teal" aria-hidden />
                      {analise === "a-calcular"
                        ? t("RastreioCompleto.aCalcular")
                        : t("RastreioCompleto.aMedir", { feita: Math.min(progresso[0] + 1, progresso[1]), total: progresso[1] })}
                    </p>
                  </>
                ) : (
                  <>
                    {titulo(t("RastreioCompleto.erroTitulo"))}
                    <p role="alert" className="rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-foreground">
                      {analise === "erro-fotos" ? t("RastreioCompleto.erroPreparar") : t("RastreioCompleto.erroTexto")}
                    </p>
                    <div className="flex flex-col gap-3">
                      {analise === "erro-rede" && (
                        <Button size="lg" className="w-full" onClick={() => void analisar()}>
                          <RefreshCw className="w-4 h-4" /> {t("RastreioCompleto.tentarDeNovo")}
                        </Button>
                      )}
                      <Button
                        size="lg"
                        variant={analise === "erro-rede" ? "outline" : "default"}
                        className="w-full"
                        onClick={() => void repetirFotografias()}
                      >
                        <Images className="w-4 h-4" /> {t("RastreioCompleto.repetirFotografias")}
                      </Button>
                    </div>
                  </>
                )}
              </div>
            )}

            {passo === 5 && resultado && (
              <ResultadoMotor
                resultado={resultado}
                titulo={titulo}
                delta={delta}
                isLoggedIn={isLoggedIn}
                aoRepetir={() => void repetirFotografias()}
                aoSair={() => navigate(localizar(isLoggedIn ? "/dashboard" : "/"))}
              />
            )}
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
};

/** O resultado, decidido pela API: encaminhar, sem sinais ou não mediu. */
const ResultadoMotor = ({
  resultado: { medicoes, api, dica },
  titulo,
  delta,
  isLoggedIn,
  aoRepetir,
  aoSair,
}: {
  resultado: Resultado;
  titulo: (texto: string) => JSX.Element;
  delta: (v: number) => string;
  isLoggedIn: boolean;
  aoRepetir: () => void;
  aoSair: () => void;
}) => {
  const { t } = useTranslation();
  const conclusao = api.conclusao;
  // O pedido de consulta, no site antigo, abre-se na página dos parceiros.
  const consulta = localizar("/parceiros?agendar=optiotica");
  const guardado = api.screening_id
    ? t("RastreioCompleto.guardado")
    : isLoggedIn
      ? t("RastreioCompleto.naoGuardadoConta")
      : t("RastreioCompleto.naoGuardadoSemSessao");

  const Icone = conclusao === "sem_sinais" ? CheckCircle2 : conclusao === "encaminhar" ? AlertTriangle : RefreshCw;
  const cor = conclusao === "sem_sinais" ? "text-green bg-green/10" : conclusao === "encaminhar" ? "text-gold bg-gold/10" : "text-teal bg-teal/10";

  return (
    <div className="space-y-6">
      <span aria-hidden className={`inline-flex w-12 h-12 items-center justify-center rounded-full ${cor}`}>
        <Icone className="w-6 h-6" />
      </span>
      {titulo(t(`RastreioCompleto.${conclusao}Titulo`))}
      <p className="text-muted-foreground">{t(`RastreioCompleto.${conclusao}Texto`)}</p>

      {conclusao === "nao_mediu" ? (
        <p className="text-foreground">{t(DICA[dica])}</p>
      ) : (
        <div role="note" className="rounded-xl border border-border bg-card p-4 text-sm">
          <p className="font-semibold text-foreground">{t(`RastreioCompleto.${conclusao}AvisoTitulo`)}</p>
          <p className="text-muted-foreground">{t(`RastreioCompleto.${conclusao}AvisoTexto`)}</p>
        </div>
      )}

      {conclusao !== "nao_mediu" && (
        <section aria-labelledby="rc-medicoes" className="rounded-xl border border-border p-4">
          <h2 id="rc-medicoes" className="text-sm font-semibold text-foreground">
            {t("RastreioCompleto.medicoesTitulo")}
          </h2>
          <dl className="mt-3 grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 text-sm">
            <dt className="text-muted-foreground">{t("RastreioCompleto.desvioHorizontal")}</dt>
            <dd className="text-right font-medium tabular-nums">{delta(medicoes.horizontal_delta)}</dd>
            <dt className="text-muted-foreground">{t("RastreioCompleto.desvioVertical")}</dt>
            <dd className="text-right font-medium tabular-nums">{delta(medicoes.vertical_delta)}</dd>
            <dt className="text-muted-foreground">{t("RastreioCompleto.dispersao")}</dt>
            <dd className="text-right font-medium tabular-nums">{delta(medicoes.dispersao_delta)}</dd>
            <dt className="text-muted-foreground">{t("RastreioCompleto.fotografiasUsadas")}</dt>
            <dd className="text-right font-medium tabular-nums">
              {t("RastreioCompleto.fotografiasUsadasValor", { validas: medicoes.fotografias_validas, total: medicoes.fotografias_total })}
            </dd>
          </dl>
          <p className="mt-3 text-xs text-muted-foreground">{t("RastreioCompleto.unidadeMotor")}</p>
          <p className="mt-1 text-xs text-muted-foreground">{t("RastreioCompleto.regra", { versao: api.versao_regra })}</p>
        </section>
      )}

      <div className="flex flex-col gap-3">
        {conclusao === "encaminhar" && (
          <Button asChild size="lg" className="w-full">
            <Link to={consulta}>
              <CalendarCheck className="w-4 h-4" /> {t("RastreioCompleto.marcarConsulta")}
            </Link>
          </Button>
        )}
        <Button size="lg" variant={conclusao === "nao_mediu" ? "default" : "outline"} className="w-full" onClick={aoRepetir}>
          <RefreshCw className="w-4 h-4" /> {t("RastreioCompleto.repetir")}
        </Button>
        <Button size="lg" variant="ghost" className="w-full" onClick={aoSair}>
          {t(isLoggedIn ? "RastreioCompleto.minhaArea" : "RastreioCompleto.voltarInicio")}
        </Button>
      </div>

      <p role="status" className="text-sm text-muted-foreground">
        {guardado}
      </p>
      <p className="flex items-center gap-2 text-xs text-muted-foreground">
        <ShieldCheck className="w-4 h-4 shrink-0 text-green" aria-hidden />
        {t("RastreioCompleto.triagem")}
      </p>
    </div>
  );
};

export default RastreioCompleto;
