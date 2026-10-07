import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  ArrowRight,
  Camera,
  CircleDot,
  Eye,
  FlaskConical,
  Glasses,
  Images,
  RefreshCw,
  ShieldCheck,
  Sun,
  Users,
} from "lucide-react";
import { useConsentimentoSaude } from "@/contexts/ConsentimentoSaudeContext";
import { Aviso } from "@/design/componentes/Aviso";
import { Botao } from "@/design/componentes/Botao";
import { OpcaoConfirmar } from "@/design/componentes/OpcaoConfirmar";
import { TransicaoPasso } from "@/design/componentes/Passos";
import { LayoutTarefa } from "@/design/layouts/LayoutTarefa";
import { suportaCaminhoA, useCameraTraseira } from "@/hooks/useCameraTraseira";
import { localizar } from "@/i18n/rotas";
import { rastreioCompletoApi } from "@/lib/apiClient";
import { analisarFoto } from "@/lib/rastreio/captura/analisarFoto";
import {
  dicaDeRepeticao,
  medirFotografias,
  paraMedicoesApi,
  type DicaRepeticao,
  type MedicoesParaApi,
} from "@/lib/rastreio/captura/sessaoCompleta";
import { detectarIris } from "@/lib/rastreio/detectorIris";
import { CHAVE_RESULTADO, paraResultadoMotor } from "@/lib/rastreio/rastreio";

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
 * de medidas (CLAUDE.md §4, regra 4). Ainda só em teste (a produção continua a
 * usar o `/scanner` até o motor passar as fases V1 e V2).
 */

const TOTAL = 4;
const FOTOS_CAMINHO_A = 4;
const FOTOS_CAMINHO_B = 3;

const PREPARACAO = [
  { chave: "pessoa", icone: <Users /> },
  { chave: "oculos", icone: <Glasses /> },
  { chave: "luz", icone: <Sun /> },
  { chave: "alvo", icone: <CircleDot /> },
] as const;

type EstadoAnalise = "a-medir" | "a-calcular" | "erro-rede" | "erro-fotos";

/** O ficheiro da câmara nativa → imagem em memória (o browser aplica a orientação EXIF). */
const lerFicheiro = (f: File) => createImageBitmap(f);

const RastreioCompleto = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { garantir: garantirConsentimento } = useConsentimentoSaude();
  const camera = useCameraTraseira();

  const [passo, setPasso] = useState(1);
  const [direccao, setDireccao] = useState<1 | -1>(1);
  const [prontos, setProntos] = useState<Record<string, boolean>>({});
  // A câmara nativa é o caminho por omissão onde a da página não existe (iPhone).
  const [nativa, setNativa] = useState(() => !suportaCaminhoA());
  const [aTirar, setATirar] = useState(false);
  const [erroCaptura, setErroCaptura] = useState(false);
  const [feitas, setFeitas] = useState(0);
  const [analise, setAnalise] = useState<EstadoAnalise>("a-medir");
  const [progresso, setProgresso] = useState<[number, number]>([0, 0]);

  const fotos = useRef<ImageBitmap[]>([]);
  const medicoes = useRef<{ corpo: MedicoesParaApi; dica: DicaRepeticao } | null>(null);
  const entrada = useRef<HTMLInputElement>(null);

  const ir = (n: number) => {
    setDireccao(n > passo ? 1 : -1);
    setPasso(n);
  };

  const libertarFotos = () => {
    fotos.current.forEach((f) => f.close());
    fotos.current = [];
    setFeitas(0);
  };

  const tudoPronto = PREPARACAO.every((p) => prontos[p.chave]);

  const pedirCamera = async () => {
    // O consentimento para dados de saúde vem antes da câmara (CLAUDE.md §4.9).
    if (!(await garantirConsentimento())) return;
    libertarFotos();
    setErroCaptura(false);
    if (nativa) return ir(3);
    if (await camera.ligar()) ir(3);
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
      const resultado = await rastreioCompletoApi.classificar(corpo);
      sessionStorage.setItem(CHAVE_RESULTADO, JSON.stringify(paraResultadoMotor(corpo, resultado, dica)));
      medicoes.current = null;
      navigate(
        localizar(resultado.screening_id ? `/scanner/resultados?id=${resultado.screening_id}` : "/scanner/resultados"),
      );
    } catch {
      setAnalise(medicoes.current ? "erro-rede" : "erro-fotos");
    }
  };

  const seguirParaAnalise = () => {
    camera.desligar();
    medicoes.current = null;
    setProgresso([0, fotos.current.length]);
    ir(4);
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
    setErroCaptura(false);
    if (!nativa && (await camera.ligar())) return ir(3);
    ir(nativa ? 3 : 2);
  };

  const sair = () => {
    camera.desligar();
    libertarFotos();
    navigate(localizar("/"));
  };

  const aLigar = camera.estado === "a-ligar";
  const falhaCamera = camera.estado === "recusada" || camera.estado === "indisponivel" || camera.estado === "sem-suporte";

  const accao =
    passo === 1 ? (
      <Botao tamanho="g" larguraTotal disabled={!tudoPronto} onClick={() => ir(2)}>
        {t("Rastreio.estouPronto")} <ArrowRight />
      </Botao>
    ) : passo === 2 ? (
      <div className="flex flex-col gap-3">
        <Botao tamanho="g" larguraTotal aCarregar={aLigar} onClick={() => void pedirCamera()}>
          {falhaCamera ? <RefreshCw /> : <Camera />}
          {falhaCamera
            ? t("Rastreio.tentarDeNovo")
            : nativa
              ? t("RastreioCompleto.abrirCamera")
              : t("RastreioCompleto.permitir")}
        </Botao>
        {/* Se a câmara da página falhar, a do telemóvel resolve na maioria dos casos. */}
        {falhaCamera && !nativa && (
          <Botao tamanho="g" larguraTotal variante="secundario" onClick={() => setNativa(true)}>
            {t("RastreioCompleto.usarNativa")}
          </Botao>
        )}
      </div>
    ) : passo === 3 ? (
      nativa ? (
        <Botao tamanho="g" larguraTotal onClick={() => entrada.current?.click()}>
          <Camera /> {t(feitas === 0 ? "RastreioCompleto.abrirCamera" : "RastreioCompleto.tirarOutra")}
        </Botao>
      ) : (
        <Botao tamanho="g" larguraTotal aCarregar={aTirar} disabled={camera.estado !== "ligada"} onClick={() => void tirarSequencia()}>
          <Camera /> {aTirar ? t("RastreioCompleto.aTirar") : t("RastreioCompleto.tirarFotografias")}
        </Botao>
      )
    ) : analise === "a-medir" || analise === "a-calcular" ? (
      <Botao tamanho="g" larguraTotal aCarregar>
        {t("Rastreio.aAnalisar")}
      </Botao>
    ) : (
      <div className="flex flex-col gap-3">
        {analise === "erro-rede" && (
          <Botao tamanho="g" larguraTotal onClick={() => void analisar()}>
            <RefreshCw /> {t("Rastreio.tentarDeNovo")}
          </Botao>
        )}
        <Botao
          tamanho="g"
          larguraTotal
          variante={analise === "erro-rede" ? "secundario" : "primario"}
          onClick={() => void repetirFotografias()}
        >
          <Images /> {t("Rastreio.repetirFotografias")}
        </Botao>
      </div>
    );

  return (
    <LayoutTarefa
      tema="claro"
      passo={{ actual: passo, total: TOTAL, rotulo: t("Rastreio.passo", { actual: passo, total: TOTAL }) }}
      sair={{ rotulo: t("Rastreio.sair"), aoSair: sair }}
      confirmarSaida={
        passo > 1
          ? {
              titulo: t("Rastreio.confirmarSaidaTitulo"),
              descricao: t("Rastreio.confirmarSaidaTexto"),
              ficar: t("Rastreio.ficar"),
              sair: t("Rastreio.confirmarSair"),
              fechar: t("Rastreio.fechar"),
            }
          : undefined
      }
      accao={accao}
      textoSaltar={t("Rastreio.saltar")}
    >
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
      <TransicaoPasso chave={passo} direccao={direccao}>
        {passo === 1 && (
          <>
            <h1 className="text-titulo-m text-tinta">{t("RastreioCompleto.prepararTitulo")}</h1>
            <p className="mt-3 text-corpo text-tinta-suave">{t("RastreioCompleto.prepararTexto")}</p>
            <Aviso className="mt-6" variante="info" titulo={t("RastreioCompleto.testeTitulo")}>
              <FlaskConical className="mr-1 inline size-4 align-text-bottom" aria-hidden />
              {t("RastreioCompleto.testeTexto")}
            </Aviso>
            <div className="mt-8 flex flex-col gap-3">
              {PREPARACAO.map((p) => (
                <OpcaoConfirmar
                  key={p.chave}
                  icone={p.icone}
                  rotulo={t(`RastreioCompleto.${p.chave}`)}
                  descricao={t(`RastreioCompleto.${p.chave}Descricao`)}
                  marcada={!!prontos[p.chave]}
                  aoMudar={(v) => setProntos((s) => ({ ...s, [p.chave]: v }))}
                />
              ))}
            </div>
            <p role="status" className="mt-4 text-legenda text-tinta-suave">
              {tudoPronto ? t("Rastreio.tudoPronto") : t("RastreioCompleto.faltaConfirmar")}
            </p>
            <p className="mt-8 flex items-center gap-2 text-legenda text-tinta-suave">
              <ShieldCheck className="size-4 shrink-0 text-accao" aria-hidden />
              {t("Rastreio.triagem")}
            </p>
          </>
        )}

        {passo === 2 && (
          <>
            <h1 className="text-titulo-m text-tinta">
              {t(nativa ? "RastreioCompleto.nativaTitulo" : "RastreioCompleto.cameraTitulo")}
            </h1>
            <p className="mt-3 text-corpo text-tinta-suave">
              {t(nativa ? "RastreioCompleto.nativaTexto" : "RastreioCompleto.cameraTexto")}
            </p>
            <ul className="mt-8 flex flex-col gap-5">
              {[
                { icone: Eye, texto: t("RastreioCompleto.cameraPonto1") },
                { icone: Images, texto: t(nativa ? "RastreioCompleto.nativaPonto2" : "RastreioCompleto.cameraPonto2") },
                { icone: ShieldCheck, texto: t("RastreioCompleto.cameraPonto3") },
              ].map(({ icone: Icone, texto }) => (
                <li key={texto} className="flex gap-4">
                  <Icone className="mt-0.5 size-6 shrink-0 text-accao" aria-hidden />
                  <span className="text-corpo text-tinta">{texto}</span>
                </li>
              ))}
            </ul>
            {falhaCamera && (
              <Aviso
                className="mt-8"
                variante="erro"
                anunciar
                titulo={t(camera.estado === "recusada" ? "Rastreio.recusadaTitulo" : "Rastreio.indisponivelTitulo")}
              >
                {t(camera.estado === "recusada" ? "Rastreio.recusadaTexto" : "Rastreio.indisponivelTexto")}
              </Aviso>
            )}
          </>
        )}

        {passo === 3 && (
          <>
            {nativa ? (
              <>
                <p className="text-legenda font-medium text-tinta-suave" aria-live="polite">
                  {t("RastreioCompleto.fotografiaN", { n: Math.min(feitas + 1, FOTOS_CAMINHO_B), total: FOTOS_CAMINHO_B })}
                </p>
                <h1 className="mt-1 text-titulo-m text-tinta">{t("RastreioCompleto.nativaFotografarTitulo")}</h1>
                <p className="mt-2 text-corpo text-tinta-suave">{t("RastreioCompleto.nativaFotografarTexto")}</p>
                <p role="status" className="mt-8 text-corpo text-tinta">
                  {t("RastreioCompleto.prontas", { n: feitas, total: FOTOS_CAMINHO_B })}
                </p>
              </>
            ) : (
              <>
                <h1 className="text-titulo-m text-tinta">{t("RastreioCompleto.fotografarTitulo")}</h1>
                <p className="mt-2 text-corpo text-tinta-suave">{t("RastreioCompleto.fotografarTexto")}</p>
                <div className="relative mx-auto mt-6 aspect-square w-full overflow-hidden rounded-cartao bg-tinta sm:aspect-retrato sm:max-w-xs">
                  <video
                    ref={camera.refVideo}
                    autoPlay
                    playsInline
                    muted
                    aria-label={t("RastreioCompleto.videoRotulo")}
                    className="size-full object-cover"
                  />
                </div>
                {!camera.luzDisponivel && camera.estado === "ligada" && (
                  <Aviso className="mt-4" variante="aviso">
                    {t("RastreioCompleto.luzIndisponivel")}
                  </Aviso>
                )}
              </>
            )}
            {erroCaptura && (
              <Aviso className="mt-4" variante="erro" anunciar>
                {t("RastreioCompleto.erroFotografar")}
              </Aviso>
            )}
          </>
        )}

        {passo === 4 && (
          <>
            <h1 className="text-titulo-m text-tinta">
              {analise === "a-medir" || analise === "a-calcular"
                ? t("RastreioCompleto.analiseTitulo")
                : t("RastreioCompleto.erroTitulo")}
            </h1>
            {analise === "a-medir" || analise === "a-calcular" ? (
              <>
                <p className="mt-3 text-corpo text-tinta-suave">{t("RastreioCompleto.analiseTexto")}</p>
                <p role="status" className="mt-8 text-legenda text-tinta-suave">
                  {analise === "a-calcular"
                    ? t("RastreioCompleto.aCalcular")
                    : t("RastreioCompleto.aMedir", { feita: Math.min(progresso[0] + 1, progresso[1]), total: progresso[1] })}
                </p>
              </>
            ) : (
              <Aviso className="mt-6" variante="erro" anunciar>
                {analise === "erro-fotos" ? t("Rastreio.erroPreparar") : t("RastreioCompleto.erroTexto")}
              </Aviso>
            )}
          </>
        )}
      </TransicaoPasso>
    </LayoutTarefa>
  );
};

export default RastreioCompleto;
