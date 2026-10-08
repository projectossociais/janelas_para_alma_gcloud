import { Link, useNavigate } from "react-router-dom";
import { Flame, ListOrdered, Loader2, RefreshCw, Share2, Shuffle, Store, Trophy, Users, WifiOff } from "lucide-react";
import { Trans, useTranslation } from "react-i18next";
import CarteiraJogo from "@/components/jogo/CarteiraJogo";
import MercadoModal from "@/components/jogo/MercadoModal";
import VidaExtraModal from "@/components/jogo/VidaExtraModal";
import RecompensaSequenciaModal from "@/components/jogo/RecompensaSequenciaModal";
import { Aviso } from "@/design/componentes/Aviso";
import { Botao } from "@/design/componentes/Botao";
import { Dialogo, DialogoConteudo, DialogoGatilho } from "@/design/componentes/Dialogo";
import { LayoutTarefa } from "@/design/layouts/LayoutTarefa";
import { localizar } from "@/i18n/rotas";
import { OPCOES, TOTAL_PATAMARES, formatarKz, valorDoPatamar } from "./jogoConfig";
import { usePartidaJogo, TEMPO_POR_PERGUNTA } from "./partida/usePartidaJogo";
import { EscadaPatamares } from "./partida/EscadaPatamares";
import { ModalOpiniaoPublico, ModalRespostaErrada } from "./partida/ModaisPartida";
import { OpcaoResposta, type EstadoOpcao } from "./partida/OpcaoResposta";
import { RecompensaGanha } from "./partida/RecompensaGanha";
import { TemporizadorCircular } from "./partida/TemporizadorCircular";

/**
 * Uma partida do Inclusivamente, no arquétipo Tarefa (docs/LAYOUTS.md §2.3):
 * sem navegação do site, o patamar e o prémio no lugar do passo, e "Sair", que
 * pede confirmação a meio. Uma pergunta de cada vez, numa coluna; a escada de
 * prémios abre-se quando se quer. A lógica toda vive em `usePartidaJogo`.
 */
const JogoCuriosidades = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const {
    profile,
    aCarregarPergunta,
    aValidar,
    ajudaCincoUsada,
    ajudaPublicoUsada,
    ajudaTrocarUsada,
    aoRecusarVidaExtra,
    aoUsarVidaExtra,
    carregarPergunta,
    detalheErroPergunta,
    emModoOffline,
    erroPerguntaServidor,
    jogoTerminado,
    modoRecompensa,
    mostrarMercado,
    mostrarModalErrado,
    mostrarModalPublico,
    mostrarSplash,
    ofertaVidaExtra,
    opcaoSelecionada,
    opcoesEliminadas,
    opiniaoPublico,
    partidaComPerguntasOffline,
    partilhar,
    patamar,
    pergunta,
    recompensaLocal,
    recompensaSequencia,
    reiniciarJogo,
    resultado,
    sairParaMenu,
    selecionarOpcao,
    sequenciaAcertos,
    setMostrarMercado,
    setMostrarModalPublico,
    setMostrarSplash,
    setRecompensaSequencia,
    setSugestaoMercado,
    sugestaoMercado,
    tempoRestante,
    textoDaOpcao,
    trocarPergunta,
    usaServidor,
    usar5050,
    usarOpiniaoPublico,
  } = usePartidaJogo();


  const emJogo = !mostrarSplash && !jogoTerminado && !mostrarModalErrado;
  const rotuloPasso = mostrarSplash
    ? t("JogoCuriosidades.inclusivamente")
    : t("JogoCuriosidades.rotuloPatamar", { patamar, total: TOTAL_PATAMARES, valor: formatarKz(valorDoPatamar(patamar)) });

  const estadoDaOpcao = (opcao: (typeof OPCOES)[number]): EstadoOpcao => {
    if (resultado?.resposta_correta === opcao) return "certa";
    if (resultado && opcaoSelecionada === opcao && !resultado.correta) return "errada";
    if (opcoesEliminadas.includes(opcao)) return "eliminada";
    return "normal";
  };
  const ajudaBloqueada = !!resultado || aValidar;

  return (
    <LayoutTarefa
      tema="claro"
      passo={{ actual: mostrarSplash ? 0 : patamar, total: TOTAL_PATAMARES, rotulo: rotuloPasso }}
      sair={{
        rotulo: t("JogoCuriosidades.sair"),
        aoSair: mostrarSplash ? () => navigate(localizar("/jogo-curiosidades")) : sairParaMenu,
      }}
      confirmarSaida={
        emJogo
          ? {
              titulo: t("JogoCuriosidades.confirmarSaidaTitulo"),
              descricao: t("JogoCuriosidades.confirmarSaidaTexto"),
              ficar: t("JogoCuriosidades.continuarAJogar"),
              sair: t("JogoCuriosidades.sair"),
              fechar: t("JogoCuriosidades.fechar"),
            }
          : undefined
      }
      textoSaltar={t("JogoCuriosidades.saltar")}
    >
      {mostrarSplash ? (
        <section aria-labelledby="jogo-apresentacao">
          <h1 id="jogo-apresentacao" className="text-titulo-m text-tinta">
            {t("JogoCuriosidades.prepareSeParaSubir")}
          </h1>
          <p className="mt-3 text-corpo text-tinta-suave">
            <Trans
              i18nKey="JogoCuriosidades.respondaCorrectamenteEAvance"
              values={{ valor: formatarKz(valorDoPatamar(TOTAL_PATAMARES)) }}
            />
          </p>
          <EscadaPatamares patamarAtual={1} className="mt-6 rounded-cartao border border-linha p-3" />
          <Botao tamanho="g" larguraTotal className="mt-8" onClick={() => setMostrarSplash(false)}>
            {t("JogoCuriosidades.comecar")}
          </Botao>
        </section>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h1 className="text-legenda font-medium text-tinta-suave">{t("JogoCuriosidades.inclusivamente")}</h1>
            {profile && <CarteiraJogo />}
          </div>

          {!usaServidor && (
            <Aviso className="mt-4">
              {profile ? (
                t("JogoCuriosidades.modoTreinoIngles")
              ) : (
                <>
                  {t("JogoCuriosidades.modoConvidado")}{" "}
                  <Link to={localizar("/auth")} className="font-medium text-accao underline underline-offset-2">
                    {t("JogoCuriosidades.entrarParaGanhar")}
                  </Link>
                </>
              )}
            </Aviso>
          )}

          <div className="mt-6">
            {aCarregarPergunta && (
              <p role="status" className="flex items-center gap-2 py-16 text-corpo text-tinta-suave">
                <Loader2 className="size-5 animate-spin text-accao" aria-hidden />
                {t("JogoCuriosidades.aCarregarPergunta")}
              </p>
            )}

            {!aCarregarPergunta && jogoTerminado && (
              <section aria-labelledby="jogo-vitoria" className="text-center">
                <span
                  aria-hidden
                  className="mx-auto flex size-16 items-center justify-center rounded-pilula bg-aviso-suave text-aviso [&_svg]:size-8"
                >
                  <Trophy />
                </span>
                <h2 id="jogo-vitoria" className="mt-5 text-titulo-m text-tinta">
                  {t("JogoCuriosidades.parabens")}
                </h2>
                <p className="mt-2 text-corpo text-tinta-suave">{t("JogoCuriosidades.completouOs15Patamares")}</p>
                <p className="mb-4 mt-4 text-titulo-p font-medium tabular-nums text-tinta">
                  {formatarKz(valorDoPatamar(TOTAL_PATAMARES))}
                </p>
                <RecompensaGanha
                  recompensa={recompensaLocal}
                  modo={modoRecompensa}
                  comPerguntasOffline={partidaComPerguntasOffline}
                />
                <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
                  <Botao variante="secundario" onClick={() => void partilhar()}>
                    <Share2 aria-hidden />
                    {t("JogoCuriosidades.partilhar")}
                  </Botao>
                  <Botao onClick={reiniciarJogo}>
                    <RefreshCw aria-hidden />
                    {t("JogoCuriosidades.jogarNovamente")}
                  </Botao>
                </div>
              </section>
            )}

            {!aCarregarPergunta && !jogoTerminado && !pergunta && erroPerguntaServidor && (
              <Aviso
                variante="erro"
                anunciar
                accao={
                  <Botao variante="secundario" onClick={() => void carregarPergunta(patamar)}>
                    <RefreshCw aria-hidden />
                    {t("JogoCuriosidades.tentarNovamente")}
                  </Botao>
                }
              >
                <p>{t("JogoCuriosidades.naoFoiPossivelCarregarPergunta")}</p>
                {detalheErroPergunta && <p className="mt-1 text-legenda">{detalheErroPergunta}</p>}
              </Aviso>
            )}

            {!aCarregarPergunta && !jogoTerminado && pergunta && (
              <section aria-labelledby="jogo-pergunta">
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-legenda text-tinta-suave">{t("JogoCuriosidades.premioEmJogo")}</p>
                    <p className="text-titulo-p font-medium tabular-nums text-tinta">{formatarKz(valorDoPatamar(patamar))}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      <Dialogo>
                        <DialogoGatilho className="inline-flex min-h-alvo-app items-center gap-1.5 rounded-controlo text-legenda font-medium text-accao underline underline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-foco">
                          <ListOrdered className="size-4" aria-hidden />
                          {t("JogoCuriosidades.verEscada")}
                        </DialogoGatilho>
                        <DialogoConteudo
                          className="max-w-sm"
                          titulo={t("JogoCuriosidades.escadaDePremios")}
                          rotuloFechar={t("JogoCuriosidades.fechar")}
                        >
                          <EscadaPatamares patamarAtual={patamar} />
                        </DialogoConteudo>
                      </Dialogo>
                      {emModoOffline && usaServidor && (
                        <span className="inline-flex items-center gap-1 rounded-pilula bg-superficie-alt px-2 py-0.5 text-legenda text-tinta-suave">
                          <WifiOff className="size-3.5" aria-hidden />
                          {t("JogoCuriosidades.modoOffline")}
                        </span>
                      )}
                      {usaServidor && sequenciaAcertos > 0 && (
                        <span
                          className="inline-flex items-center gap-1 rounded-pilula bg-aviso-suave px-2 py-0.5 text-legenda font-medium text-aviso"
                          aria-label={t("RecompensaSequencia.sequenciaAtual", { sequencia: sequenciaAcertos })}
                        >
                          <Flame className="size-3.5" aria-hidden />
                          {sequenciaAcertos}
                        </span>
                      )}
                    </div>
                  </div>
                  <TemporizadorCircular tempoRestante={tempoRestante} tempoTotal={TEMPO_POR_PERGUNTA} />
                </div>

                <h2 id="jogo-pergunta" className="mt-6 text-corpo-g font-medium text-tinta">
                  {pergunta.texto_pergunta}
                </h2>

                <div className="mt-6 grid gap-3">
                  {OPCOES.map((opcao) => (
                    <OpcaoResposta
                      key={opcao}
                      letra={opcao}
                      texto={textoDaOpcao(opcao)}
                      estado={estadoDaOpcao(opcao)}
                      desactivada={!!resultado || aValidar || opcoesEliminadas.includes(opcao)}
                      sugeridaPor={
                        sugestaoMercado?.resposta_sugerida === opcao && !resultado
                          ? t(`Mercado.vendedores.${sugestaoMercado.vendedor_id}.nome`)
                          : undefined
                      }
                      aoEscolher={() => void selecionarOpcao(opcao)}
                    />
                  ))}
                </div>

                <div className="mt-8 border-t border-linha pt-5">
                  <h3 className="sr-only">{t("JogoCuriosidades.ajudas")}</h3>
                  <div className="flex flex-wrap justify-center gap-3">
                    <Botao variante="secundario" onClick={() => void usar5050()} disabled={ajudaCincoUsada || ajudaBloqueada}>
                      50:50
                    </Botao>
                    <Botao
                      variante="secundario"
                      onClick={() => void usarOpiniaoPublico()}
                      disabled={ajudaPublicoUsada || ajudaBloqueada}
                    >
                      <Users aria-hidden />
                      {t("JogoCuriosidades.opiniaoDoPublico")}
                    </Botao>
                    <Botao variante="secundario" onClick={trocarPergunta} disabled={ajudaTrocarUsada || ajudaBloqueada}>
                      <Shuffle aria-hidden />
                      {t("JogoCuriosidades.trocarPergunta")}
                    </Botao>
                    {usaServidor && (
                      <Botao
                        variante="secundario"
                        onClick={() => setMostrarMercado(true)}
                        disabled={ajudaBloqueada || emModoOffline}
                      >
                        <Store aria-hidden />
                        {t("Mercado.titulo")}
                      </Botao>
                    )}
                  </div>
                  {usaServidor && emModoOffline && (
                    <p className="mt-3 text-center text-legenda text-tinta-suave">{t("Mercado.indisponivelOffline")}</p>
                  )}
                </div>
              </section>
            )}
          </div>
        </>
      )}

      <ModalRespostaErrada
        aberto={mostrarModalErrado}
        resultado={resultado}
        patamar={patamar}
        textoDaOpcao={textoDaOpcao}
        recompensa={recompensaLocal}
        modoRecompensa={modoRecompensa}
        comPerguntasOffline={partidaComPerguntasOffline}
        aoRecomecar={reiniciarJogo}
        aoSair={sairParaMenu}
      />

      <RecompensaSequenciaModal recompensa={recompensaSequencia} onContinuar={() => setRecompensaSequencia(null)} />

      <VidaExtraModal
        oferta={ofertaVidaExtra}
        tempoEsgotado={!!resultado?.tempoEsgotado}
        onVidaUsada={aoUsarVidaExtra}
        onEncerrar={aoRecusarVidaExtra}
      />

      {pergunta && !emModoOffline && (
        <MercadoModal
          open={mostrarMercado}
          onOpenChange={setMostrarMercado}
          perguntaId={pergunta.id}
          opcoesExcluidas={opcoesEliminadas}
          onAjudaComprada={setSugestaoMercado}
        />
      )}

      <ModalOpiniaoPublico aberto={mostrarModalPublico} aoMudar={setMostrarModalPublico} opiniao={opiniaoPublico} />
    </LayoutTarefa>
  );
};

export default JogoCuriosidades;
