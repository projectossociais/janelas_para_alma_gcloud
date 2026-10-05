import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ArrowRight, Camera, CheckCircle2, Eye, Glasses, Images, RefreshCw, Ruler, ScanFace, ShieldCheck, Sun } from "lucide-react";
import EyeLandmarkOverlay from "@/components/EyeLandmarkOverlay";
import { useAuth } from "@/contexts/AuthContext";
import { useConsentimentoSaude } from "@/contexts/ConsentimentoSaudeContext";
import { Aviso } from "@/design/componentes/Aviso";
import { Botao } from "@/design/componentes/Botao";
import { OpcaoConfirmar } from "@/design/componentes/OpcaoConfirmar";
import { TransicaoPasso } from "@/design/componentes/Passos";
import { cn } from "@/design/cn";
import { LayoutTarefa } from "@/design/layouts/LayoutTarefa";
import { useCameraRastreio } from "@/hooks/useCameraRastreio";
import { localizar } from "@/i18n/rotas";
import { screeningsApi } from "@/lib/apiClient";
import {
  CHAVE_RESULTADO,
  dataUrlParaBlob,
  paraRegistoScreening,
  paraResultadoEcra,
} from "@/lib/rastreio/rastreio";
import { submeterRastreioMultiGaze, textoDoScannerNoIdioma } from "@/services/api/screeningApi";

/**
 * Rastreio ocular, no arquétipo Tarefa (docs/LAYOUTS.md §2.3): preparar →
 * explicar a câmara antes de a pedir → três fotografias guiadas → medir.
 *
 * Tudo o que se mostra é real: a luz mede-se na imagem, o rosto vem do
 * detector, e a espera do passo 4 é a da análise, nada mais (a versão
 * anterior tinha um atraso de 2,5 s e "fases de detecção" por temporizador).
 * As fotografias vão para o janelas-scanner-api e nunca se guardam: na API
 * própria grava-se só as medições (CLAUDE.md §4, regra 4).
 */

const TOTAL = 4;

const PREPARACAO = [
  { chave: "luz", icone: <Sun /> },
  { chave: "altura", icone: <Ruler /> },
  { chave: "oculos", icone: <Glasses /> },
] as const;

/** A ordem das fotografias e o nome que cada uma tem na API. */
const POSES = [
  { chave: "Frente", api: "centro" },
  { chave: "Direita", api: "direita" },
  { chave: "Esquerda", api: "esquerda" },
] as const;

type EstadoAnalise = "a-analisar" | "erro-rede" | "erro-fotos";

const Scanner = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { garantir: garantirConsentimento } = useConsentimentoSaude();
  const camera = useCameraRastreio();

  const [passo, setPasso] = useState(1);
  const [direccao, setDireccao] = useState<1 | -1>(1);
  const [prontos, setProntos] = useState<Record<string, boolean>>({});
  const [pose, setPose] = useState(0);
  const [analise, setAnalise] = useState<EstadoAnalise>("a-analisar");
  const [mensagemErro, setMensagemErro] = useState<string | null>(null);
  const fotos = useRef<string[]>([]);

  const ir = (n: number) => {
    setDireccao(n > passo ? 1 : -1);
    setPasso(n);
  };

  const tudoPronto = PREPARACAO.every((p) => prontos[p.chave]);

  const pedirCamera = async () => {
    // O consentimento para dados de saúde vem antes da câmara (CLAUDE.md §4.9).
    if (!(await garantirConsentimento())) return;
    if (await camera.ligar()) {
      fotos.current = [];
      setPose(0);
      ir(3);
    }
  };

  const analisar = async () => {
    setAnalise("a-analisar");
    setMensagemErro(null);
    const blobs = POSES.map((_, i) => {
      const foto = fotos.current[i];
      return foto ? dataUrlParaBlob(foto) : null;
    });
    const [centro, direita, esquerda] = blobs;
    if (!centro || !direita || !esquerda) {
      setAnalise("erro-fotos");
      return;
    }
    try {
      const resposta = await submeterRastreioMultiGaze({ centro, direita, esquerda });
      // Com sessão, guarda-se só as medições. Falhar aqui não pode esconder
      // um resultado que já existe: segue-se para o ecrã de resultados.
      let id: string | null = null;
      if (user) {
        try {
          id = (await screeningsApi.registar(paraRegistoScreening(resposta))).id;
        } catch (err) {
          console.warn("Aviso ao guardar o histórico do rastreio:", err);
        }
      }
      fotos.current = [];
      sessionStorage.setItem(CHAVE_RESULTADO, JSON.stringify(paraResultadoEcra(resposta)));
      navigate(localizar(id ? `/scanner/resultados?id=${id}` : "/scanner/resultados"));
    } catch (err) {
      // O detalhe do scanner só se mostra se houver versão no idioma da
      // página (ex.: "não foi possível comparar as posições"); nunca o texto
      // técnico "Erro na análise (500)".
      // Sem detalhe, a causa: sem internet, diz-se isso; com internet, foi o
      // serviço que não respondeu (caso real: a mensagem mandava ver a internet).
      const detalhe = (err as { detail?: unknown } | null)?.detail;
      setMensagemErro(
        textoDoScannerNoIdioma(typeof detalhe === "string" ? detalhe : null) ??
          (navigator.onLine === false ? null : t("Rastreio.erroServicoTexto")),
      );
      setAnalise("erro-rede");
    }
  };

  const fotografar = () => {
    const foto = camera.fotografar();
    if (!foto) return;
    fotos.current[pose] = foto;
    if (pose < POSES.length - 1) {
      setPose(pose + 1);
      return;
    }
    // A câmara não fica ligada durante a análise: já não é precisa.
    camera.desligar();
    ir(4);
    void analisar();
  };

  const repetirFotografias = async () => {
    fotos.current = [];
    setPose(0);
    if (await camera.ligar()) ir(3);
    else ir(2);
  };

  const sair = () => {
    camera.desligar();
    fotos.current = [];
    navigate(localizar("/"));
  };

  const aLigar = camera.estado === "a-ligar";
  const semSuporte = camera.estado === "sem-suporte";
  const falhaCamera = camera.estado === "recusada" || camera.estado === "indisponivel" || semSuporte;

  const accao =
    passo === 1 ? (
      <Botao tamanho="g" larguraTotal disabled={!tudoPronto} onClick={() => ir(2)}>
        {t("Rastreio.estouPronto")} <ArrowRight />
      </Botao>
    ) : passo === 2 ? (
      // Sem suporte, tentar de novo não muda nada: não se oferece.
      semSuporte ? undefined : (
        <Botao tamanho="g" larguraTotal aCarregar={aLigar} onClick={() => void pedirCamera()}>
          {falhaCamera ? <RefreshCw /> : <Camera />}
          {falhaCamera ? t("Rastreio.tentarDeNovo") : t("Rastreio.permitir")}
        </Botao>
      )
    ) : passo === 3 ? (
      <Botao tamanho="g" larguraTotal disabled={!camera.podeFotografar} onClick={fotografar}>
        <Camera /> {t("Rastreio.tirarFotografia")}
      </Botao>
    ) : analise === "a-analisar" ? (
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

  const poseActual = POSES[pose] ?? POSES[0];
  const estadoCaptura = camera.escuro ? "escuro" : !camera.rostoOk ? "semRosto" : "pronto";
  const IconeCaptura = { escuro: Sun, semRosto: ScanFace, pronto: CheckCircle2 }[estadoCaptura];

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
      <TransicaoPasso chave={passo} direccao={direccao}>
        {passo === 1 && (
          <>
            <h1 className="text-titulo-m text-tinta">{t("Rastreio.prepararTitulo")}</h1>
            <p className="mt-3 text-corpo text-tinta-suave">{t("Rastreio.prepararTexto")}</p>
            <div className="mt-8 flex flex-col gap-3">
              {PREPARACAO.map((p) => (
                <OpcaoConfirmar
                  key={p.chave}
                  icone={p.icone}
                  rotulo={t(`Rastreio.${p.chave}`)}
                  descricao={t(`Rastreio.${p.chave}Descricao`)}
                  marcada={!!prontos[p.chave]}
                  aoMudar={(v) => setProntos((s) => ({ ...s, [p.chave]: v }))}
                />
              ))}
            </div>
            {/* Um botão desactivado sem explicação frustra: diz-se o que falta. */}
            <p role="status" className="mt-4 text-legenda text-tinta-suave">
              {tudoPronto ? t("Rastreio.tudoPronto") : t("Rastreio.faltaConfirmar")}
            </p>
            <p className="mt-8 flex items-center gap-2 text-legenda text-tinta-suave">
              <ShieldCheck className="size-4 shrink-0 text-accao" aria-hidden />
              {t("Rastreio.triagem")}
            </p>
          </>
        )}

        {passo === 2 && (
          <>
            <h1 className="text-titulo-m text-tinta">{t("Rastreio.cameraTitulo")}</h1>
            <p className="mt-3 text-corpo text-tinta-suave">{t("Rastreio.cameraTexto")}</p>
            <ul className="mt-8 flex flex-col gap-5">
              {[
                { icone: Eye, texto: t("Rastreio.cameraPonto1") },
                { icone: Images, texto: t("Rastreio.cameraPonto2") },
                { icone: ShieldCheck, texto: t("Rastreio.cameraPonto3") },
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
                titulo={t(
                  camera.estado === "recusada"
                    ? "Rastreio.recusadaTitulo"
                    : semSuporte
                      ? "Rastreio.semSuporteTitulo"
                      : "Rastreio.indisponivelTitulo",
                )}
              >
                {t(
                  camera.estado === "recusada"
                    ? "Rastreio.recusadaTexto"
                    : semSuporte
                      ? "Rastreio.semSuporteTexto"
                      : "Rastreio.indisponivelTexto",
                )}
              </Aviso>
            )}
          </>
        )}

        {passo === 3 && (
          <>
            <p className="text-legenda font-medium text-tinta-suave">{t("Rastreio.fotografia", { n: pose + 1 })}</p>
            <div aria-live="polite">
              <h1 className="mt-1 text-titulo-m text-tinta">{t(`Rastreio.pose${poseActual.chave}Titulo`)}</h1>
              <p className="mt-2 text-corpo text-tinta-suave">{t(`Rastreio.pose${poseActual.chave}Texto`)}</p>
            </div>

            {/* Quadrado no telemóvel (cabe com o título e o botão, mesmo em ecrãs
                baixos); retrato estreito a partir do tablet. */}
            <div className="relative mx-auto mt-6 aspect-square w-full overflow-hidden rounded-cartao bg-tinta sm:aspect-retrato sm:max-w-xs">
              {/* Espelhado só no ecrã (é o que a pessoa espera ver); a
                  fotografia enviada é a imagem real, sem espelho. */}
              <video
                ref={camera.refVideo}
                autoPlay
                playsInline
                muted
                aria-label={t("Rastreio.videoRotulo")}
                className="size-full -scale-x-100 object-cover"
              />
              <EyeLandmarkOverlay
                videoRef={camera.videoRef}
                active={camera.estado === "ligada"}
                onLandmarks={camera.aoDetectar}
                desenhar={false}
              />
              {/* Guia do rosto: parado, sem animação (conforto visual). */}
              <div aria-hidden className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <div
                  className={cn(
                    "h-3/5 w-3/5 rounded-pilula border-2 transition-colors duration-feedback ease-padrao",
                    estadoCaptura === "pronto" ? "border-sucesso" : "border-superficie/70",
                  )}
                />
              </div>
              {/* O que falta para fotografar, no topo da imagem: é para onde a
                  pessoa está a olhar, e nunca fica por baixo da barra do botão,
                  nem em telemóveis baixos. */}
              <div className="pointer-events-none absolute inset-x-3 top-3 flex justify-center">
                <p
                  role="status"
                  className="flex items-center gap-2 rounded-pilula bg-superficie px-4 py-2 text-center text-legenda font-medium text-tinta shadow-nivel-1"
                >
                  <IconeCaptura className={cn("size-4 shrink-0", estadoCaptura === "pronto" ? "text-sucesso" : "text-accao")} aria-hidden />
                  {t(`Rastreio.${estadoCaptura}`)}
                </p>
              </div>
            </div>
          </>
        )}

        {passo === 4 && (
          <>
            <h1 className="text-titulo-m text-tinta">
              {analise === "a-analisar" ? t("Rastreio.analiseTitulo") : t("Rastreio.erroAnaliseTitulo")}
            </h1>
            {analise === "a-analisar" ? (
              <>
                <p className="mt-3 text-corpo text-tinta-suave">{t("Rastreio.analiseTexto")}</p>
                <p role="status" className="mt-8 text-legenda text-tinta-suave">
                  {t("Rastreio.analiseEstado")}
                </p>
              </>
            ) : (
              <Aviso className="mt-6" variante="erro" anunciar>
                {analise === "erro-fotos" ? t("Rastreio.erroPreparar") : (mensagemErro ?? t("Rastreio.erroAnaliseTexto"))}
              </Aviso>
            )}
          </>
        )}
      </TransicaoPasso>
    </LayoutTarefa>
  );
};

export default Scanner;
