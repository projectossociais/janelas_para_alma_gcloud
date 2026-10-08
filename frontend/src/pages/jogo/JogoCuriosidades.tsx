import { Link } from "react-router-dom";
import {
  Check,
  ChevronDown,
  Flame,
  Home,
  Loader2,
  RefreshCw,
  Share2,
  Shuffle,
  Store,
  Trophy,
  Users,
  WifiOff,
  X,
} from "lucide-react";
import { Trans, useTranslation } from "react-i18next";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import BackButton from "@/components/BackButton";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import CarteiraJogo from "@/components/jogo/CarteiraJogo";
import MercadoModal from "@/components/jogo/MercadoModal";
import VidaExtraModal from "@/components/jogo/VidaExtraModal";
import RecompensaSequenciaModal from "@/components/jogo/RecompensaSequenciaModal";
import { localizar } from "@/i18n/rotas";
import { OPCOES, TOTAL_PATAMARES, formatarKz, valorDoPatamar } from "./jogoConfig";
import { usePartidaJogo, TEMPO_POR_PERGUNTA } from "./partida/usePartidaJogo";
import { EscadaPatamares } from "./partida/EscadaPatamares";
import { RecompensaGanha } from "./partida/RecompensaGanha";
import { TemporizadorCircular } from "./partida/TemporizadorCircular";

const JogoCuriosidades = () => {
  const { t: tr } = useTranslation();
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

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />
      <BackButton fallbackPath={localizar("/jogo-curiosidades")} label={tr("JogoCuriosidades.voltarAoMenu")} />

      <main className="flex-1">
        <div className="container pb-16">
          {mostrarSplash ? (
            <div className="max-w-lg mx-auto rounded-2xl bg-card border border-border/60 shadow-elevated p-6 sm:p-8 text-center space-y-6 animate-scale-in">
              <div>
                <span className="text-sm font-medium tracking-widest uppercase text-teal">
                  {tr("JogoCuriosidades.inclusivamente")}
                </span>
                <h1 className="text-2xl md:text-3xl font-bold text-foreground mt-1">
                  {tr("JogoCuriosidades.prepareSeParaSubir")}
                </h1>
                <p className="text-sm text-muted-foreground mt-2">
                  <Trans i18nKey="JogoCuriosidades.respondaCorrectamenteEAvance" values={{ valor: formatarKz(valorDoPatamar(TOTAL_PATAMARES)) }} />
                </p>
              </div>
              <EscadaPatamares patamarAtual={1} />
              <Button
                onClick={() => setMostrarSplash(false)}
                size="lg"
                className="w-full bg-teal text-teal-foreground hover:bg-teal/90"
              >
                {tr("JogoCuriosidades.comecar")}
              </Button>
            </div>
          ) : (
            <>
              <div className="max-w-5xl mx-auto flex justify-center sm:justify-end mb-4">
                <CarteiraJogo />
              </div>
              <header className="max-w-2xl mx-auto text-center space-y-3 mb-8">
                <span className="text-sm font-medium tracking-widest uppercase text-teal">
                  {tr("JogoCuriosidades.inclusivamente")}
                </span>
                <h1 className="text-3xl md:text-4xl font-bold text-foreground">
                  {tr("JogoCuriosidades.oJogoDaSaude")}
                </h1>
                <p className="text-muted-foreground">
                  {tr("JogoCuriosidades.subaOs15Patamares")}
                </p>
              </header>

              {!usaServidor && (
                <div className="max-w-2xl mx-auto mb-6 rounded-xl border border-gold/40 bg-gold/10 px-4 py-3 text-sm text-foreground text-center">
                  {profile ? (
                    tr("JogoCuriosidades.modoTreinoIngles")
                  ) : (
                    <>
                      {tr("JogoCuriosidades.modoConvidado")}{" "}
                      <Link to={localizar("/auth")} className="font-semibold text-teal hover:underline">
                        {tr("JogoCuriosidades.entrarParaGanhar")}
                      </Link>
                    </>
                  )}
                </div>
              )}

              {/* Patamar atual em mobile -- gaveta com a escada completa. */}
              <div className="md:hidden max-w-2xl mx-auto mb-6">
                <Sheet>
                  <SheetTrigger asChild>
                    <button
                      type="button"
                      className="w-full flex items-center justify-between rounded-2xl bg-card border border-border/60 shadow-card px-5 py-4"
                    >
                      <span className="text-sm text-muted-foreground">
                        <Trans i18nKey="JogoCuriosidades.patamarDe" components={{ span: <span className="font-bold text-foreground" /> }} values={{ patamar, TOTAL_PATAMARES }} />
                      </span>
                      <span className="inline-flex items-center gap-2 font-bold text-gold">
                        {formatarKz(valorDoPatamar(patamar))}
                        <ChevronDown className="w-4 h-4" />
                      </span>
                    </button>
                  </SheetTrigger>
                  <SheetContent side="bottom" className="max-h-[75vh] overflow-y-auto rounded-t-2xl">
                    <SheetHeader>
                      <SheetTitle>{tr("JogoCuriosidades.escadaDePremios")}</SheetTitle>
                    </SheetHeader>
                    <EscadaPatamares patamarAtual={patamar} className="mt-4" />
                  </SheetContent>
                </Sheet>
              </div>

              <div className="max-w-5xl mx-auto grid md:grid-cols-[minmax(0,1fr)_240px] gap-6 items-start">
                {/* Área central */}
                <div className="order-2 md:order-1">
                  {aCarregarPergunta && (
                    <div className="rounded-2xl bg-card border border-border/60 shadow-card p-16 flex justify-center">
                      <Loader2 className="w-8 h-8 animate-spin text-teal" />
                    </div>
                  )}

                  {!aCarregarPergunta && jogoTerminado && (
                    <div className="rounded-2xl bg-card border border-gold/40 shadow-elevated p-8 sm:p-12 text-center space-y-5">
                      <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-gold to-teal mx-auto shadow-elevated">
                        <Trophy className="w-8 h-8 text-navy" />
                      </div>
                      <h2 className="text-2xl md:text-3xl font-bold text-foreground">{tr("JogoCuriosidades.parabens")}</h2>
                      <p className="text-muted-foreground max-w-md mx-auto">
                        {tr("JogoCuriosidades.completouOs15Patamares")}
                      </p>
                      <p className="text-3xl font-bold text-gold">{formatarKz(valorDoPatamar(TOTAL_PATAMARES))}</p>
                      <RecompensaGanha recompensa={recompensaLocal} modo={modoRecompensa} comPerguntasOffline={partidaComPerguntasOffline} />
                      <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
                        <Button onClick={partilhar} variant="outline" className="border-teal text-teal hover:bg-teal/10">
                          <Share2 className="w-4 h-4" />
                          {tr("JogoCuriosidades.partilhar")}
                        </Button>
                        <Button onClick={reiniciarJogo} className="bg-teal text-teal-foreground hover:bg-teal/90">
                          <RefreshCw className="w-4 h-4" />
                          {tr("JogoCuriosidades.jogarNovamente")}
                        </Button>
                      </div>
                    </div>
                  )}

                  {!aCarregarPergunta && !jogoTerminado && !pergunta && erroPerguntaServidor && (
                    <div className="rounded-2xl bg-card border border-border/60 shadow-card p-8 text-center space-y-4">
                      <p className="text-muted-foreground">{tr("JogoCuriosidades.naoFoiPossivelCarregarPergunta")}</p>
                      {detalheErroPergunta && <p className="text-xs text-muted-foreground/80">{detalheErroPergunta}</p>}
                      <Button variant="outline" onClick={() => void carregarPergunta(patamar)}>
                        <RefreshCw className="w-4 h-4" />
                        {tr("JogoCuriosidades.tentarNovamente")}
                      </Button>
                    </div>
                  )}

                  {!aCarregarPergunta && !jogoTerminado && pergunta && (
                    <div className="rounded-2xl bg-card border border-border/60 shadow-card p-6 sm:p-8 space-y-6">
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <p className="text-xs font-medium tracking-widest uppercase text-muted-foreground">
                            <Trans i18nKey="JogoCuriosidades.patamarDe2" values={{ patamar, TOTAL_PATAMARES }} />
                          </p>
                          <p className="text-2xl font-bold text-gold">{formatarKz(valorDoPatamar(patamar))}</p>
                          {emModoOffline && usaServidor && (
                            <span className="inline-flex items-center gap-1 mt-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground bg-muted rounded-full px-2 py-0.5">
                              <WifiOff className="w-3 h-3" />
                              {tr("JogoCuriosidades.modoOffline")}
                            </span>
                          )}
                          {usaServidor && sequenciaAcertos > 0 && (
                            <span
                              className="inline-flex items-center gap-1 mt-1 ml-1 text-[11px] font-bold uppercase tracking-wide text-orange-600 bg-orange-500/10 rounded-full px-2 py-0.5"
                              aria-label={tr("RecompensaSequencia.sequenciaAtual", { sequencia: sequenciaAcertos })}
                            >
                              <Flame className="w-3 h-3" />
                              {sequenciaAcertos}
                            </span>
                          )}
                        </div>
                        <TemporizadorCircular tempoRestante={tempoRestante} tempoTotal={TEMPO_POR_PERGUNTA} />
                      </div>

                      <p className="text-lg md:text-xl font-semibold text-foreground leading-relaxed">
                        {pergunta.texto_pergunta}
                      </p>

                      <div className="grid sm:grid-cols-2 gap-3 sm:gap-4">
                        {OPCOES.map((opcao) => {
                          const eliminada = opcoesEliminadas.includes(opcao);
                          const ehSelecionada = opcaoSelecionada === opcao;
                          const ehCorreta = resultado?.resposta_correta === opcao;
                          const mostrarComoErrada = !!resultado && ehSelecionada && !resultado.correta;
                          const mostrarComoCerta = !!resultado && ehCorreta;

                          return (
                            <button
                              key={opcao}
                              type="button"
                              disabled={!!resultado || aValidar || eliminada}
                              onClick={() => void selecionarOpcao(opcao)}
                              className={cn(
                                "flex items-center gap-3 rounded-xl border-2 px-4 py-3.5 text-left transition-all duration-300",
                                "disabled:cursor-not-allowed",
                                eliminada && "opacity-30",
                                !resultado &&
                                  !eliminada &&
                                  "border-border bg-background hover:border-teal hover:bg-teal/5",
                                mostrarComoCerta && "border-green bg-green/10",
                                mostrarComoErrada && "border-destructive bg-destructive/10"
                              )}
                            >
                              <span
                                className={cn(
                                  "flex items-center justify-center w-8 h-8 shrink-0 rounded-full border-2 font-bold text-sm",
                                  mostrarComoCerta && "border-green bg-green text-green-foreground",
                                  mostrarComoErrada && "border-destructive bg-destructive text-destructive-foreground",
                                  !mostrarComoCerta && !mostrarComoErrada && "border-teal text-teal"
                                )}
                              >
                                {mostrarComoCerta ? <Check className="w-4 h-4" /> : mostrarComoErrada ? <X className="w-4 h-4" /> : opcao}
                              </span>
                              <span className="text-sm sm:text-base text-foreground flex-1">{textoDaOpcao(opcao)}</span>
                              {sugestaoMercado?.resposta_sugerida === opcao && !resultado && (
                                <span className="shrink-0 inline-flex items-center gap-1 rounded-full bg-gold/15 text-gold text-[11px] font-bold px-2 py-0.5">
                                  <Store className="w-3 h-3" />
                                  {tr(`Mercado.vendedores.${sugestaoMercado.vendedor_id}.nome`)}
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>

                      <div className="flex flex-wrap items-center justify-center gap-3 border-t border-border/50 pt-5">
                        <Button
                          variant="outline"
                          onClick={() => void usar5050()}
                          disabled={ajudaCincoUsada || !!resultado || aValidar}
                          className="border-teal/50 text-teal hover:bg-teal/10"
                        >
                          50:50
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => void usarOpiniaoPublico()}
                          disabled={ajudaPublicoUsada || !!resultado || aValidar}
                          className="border-teal/50 text-teal hover:bg-teal/10"
                        >
                          <Users className="w-4 h-4" />
                          {tr("JogoCuriosidades.opiniaoDoPublico")}
                        </Button>
                        <Button
                          variant="outline"
                          onClick={trocarPergunta}
                          disabled={ajudaTrocarUsada || !!resultado || aValidar}
                          className="border-teal/50 text-teal hover:bg-teal/10"
                        >
                          <Shuffle className="w-4 h-4" />
                          {tr("JogoCuriosidades.trocarPergunta")}
                        </Button>
                        {usaServidor && (
                          <Button
                            variant="outline"
                            onClick={() => setMostrarMercado(true)}
                            disabled={!!resultado || aValidar || emModoOffline}
                            className="border-gold/60 text-gold hover:bg-gold/10"
                          >
                            <Store className="w-4 h-4" />
                            {tr("Mercado.titulo")}
                          </Button>
                        )}
                      </div>
                      {usaServidor && emModoOffline && (
                        <p className="text-center text-xs text-muted-foreground -mt-2">
                          {tr("Mercado.indisponivelOffline")}
                        </p>
                      )}
                    </div>
                  )}
                </div>

                {/* Escada de prémios -- desktop */}
                <div className="order-1 md:order-2 hidden md:block sticky top-24">
                  <EscadaPatamares patamarAtual={patamar} />
                </div>
              </div>
            </>
          )}
        </div>
      </main>

      <Dialog
        open={mostrarModalErrado}
        onOpenChange={(open) => {
          // "×", Esc ou clique fora: sair para o menu, nunca recomeçar.
          if (!open) sairParaMenu();
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-xl">
              {resultado?.tempoEsgotado ? tr("JogoCuriosidades.tempoEsgotado") : tr("JogoCuriosidades.essaNaoEraA")}
            </DialogTitle>
            <DialogDescription>
              {tr("JogoCuriosidades.vejaARespostaCerta")}
            </DialogDescription>
          </DialogHeader>

          {resultado && (
            <div className="space-y-4">
              <div className="rounded-xl bg-green/10 border border-green/30 p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-green mb-1">
                  {tr("JogoCuriosidades.respostaCorrecta")}
                </p>
                {resultado.resposta_correta ? (
                  <p className="text-sm font-semibold text-foreground">
                    {resultado.resposta_correta}) {textoDaOpcao(resultado.resposta_correta)}
                  </p>
                ) : (
                  // Com sessão, a resposta chega com `terminarPartida`.
                  <Loader2 className="w-4 h-4 animate-spin text-green" aria-label={tr("JogoCuriosidades.aRevelar")} />
                )}
              </div>
              {resultado.explicacao && (
                <p className="text-sm text-muted-foreground leading-relaxed">{resultado.explicacao}</p>
              )}
              <p className="text-sm text-foreground">
                <Trans i18nKey="JogoCuriosidades.chegouAoPatamarDe" values={{ patamar, TOTAL_PATAMARES }} />
              </p>
              <RecompensaGanha recompensa={recompensaLocal} modo={modoRecompensa} comPerguntasOffline={partidaComPerguntasOffline} />
            </div>
          )}

          <DialogFooter className="flex-col gap-2 sm:flex-col sm:space-x-0">
            <Button onClick={reiniciarJogo} className="w-full bg-teal text-teal-foreground hover:bg-teal/90">
              <RefreshCw className="w-4 h-4" />
              {tr("JogoCuriosidades.tentarNovamente")}
            </Button>
            <Button variant="outline" onClick={sairParaMenu} className="w-full">
              <Home className="w-4 h-4" />
              {tr("JogoCuriosidades.voltarAoMenu")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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

      <Dialog open={mostrarModalPublico} onOpenChange={setMostrarModalPublico}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{tr("JogoCuriosidades.opiniaoDoPublico")}</DialogTitle>
            <DialogDescription>
              {tr("JogoCuriosidades.assimResponderamOutrosJogadores")}
            </DialogDescription>
          </DialogHeader>

          {opiniaoPublico && (
            <div className="space-y-4 py-2">
              {OPCOES.map((opcao) => (
                <div key={opcao} className="space-y-1.5">
                  <div className="flex items-center justify-between text-sm font-semibold text-foreground">
                    <span><Trans i18nKey="JogoCuriosidades.opcao" values={{ opcao }} /></span>
                    <span className="text-teal">{opiniaoPublico[opcao]}%</span>
                  </div>
                  <div className="h-3 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full bg-teal transition-all duration-700 ease-out"
                      style={{ width: `${opiniaoPublico[opcao]}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}

          <DialogFooter>
            <Button
              onClick={() => setMostrarModalPublico(false)}
              className="w-full bg-teal text-teal-foreground hover:bg-teal/90"
            >
              {tr("JogoCuriosidades.continuarAJogar")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Footer />
    </div>
  );
};

export default JogoCuriosidades;
