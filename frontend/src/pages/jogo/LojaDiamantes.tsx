import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Gem, Info, Loader2, RefreshCw, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import BackButton from "@/components/BackButton";
import CarteiraJogo from "@/components/jogo/CarteiraJogo";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useCarteiraJogo } from "@/contexts/CarteiraJogoContext";
import { useProfile } from "@/contexts/ProfileContext";
import { jogoApi, mensagemDeErroApi, type LojaDiamantes as Loja, type PacoteDiamantes } from "@/lib/apiClient";
import { localizar } from "@/i18n/rotas";
import { cn } from "@/lib/utils";
import { formatarKz } from "./jogoConfig";

// Destaques visuais por pacote -- só apresentação; quantidades e preços vêm
// sempre da API (`GET /jogo/loja/pacotes`).
const DESTAQUE: Record<string, "popular" | "melhorValor" | undefined> = {
  medio: "popular",
  grande: "melhorValor",
};

const TAMANHO_ICONE = ["w-10 h-10", "w-14 h-14", "w-16 h-16"];

const LojaDiamantes = () => {
  const { t } = useTranslation();
  const { profile } = useProfile();
  const { definirPerfil } = useCarteiraJogo();
  const [loja, setLoja] = useState<Loja | null>(null);
  const [aCarregar, setACarregar] = useState(true);
  const [erro, setErro] = useState(false);
  const [pacoteEscolhido, setPacoteEscolhido] = useState<PacoteDiamantes | null>(null);
  const [aComprar, setAComprar] = useState(false);

  const carregar = useCallback(async () => {
    setACarregar(true);
    setErro(false);
    try {
      setLoja(await jogoApi.obterLojaDiamantes());
    } catch (err) {
      console.error("Falha ao carregar a loja de diamantes:", err);
      setErro(true);
    } finally {
      setACarregar(false);
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const confirmarCompra = async () => {
    if (!pacoteEscolhido) return;
    setAComprar(true);
    try {
      const perfil = await jogoApi.comprarPacoteDiamantes(pacoteEscolhido.id);
      definirPerfil(perfil);
      toast.success(t("LojaDiamantes.compraConcluida", { quantidade: pacoteEscolhido.total_diamantes }));
      setPacoteEscolhido(null);
    } catch (err) {
      // Nunca mostrar sucesso a partir daqui (CLAUDE.md secção 6) -- o
      // saldo só muda com a resposta da API, acima.
      toast.error(mensagemDeErroApi(err, t("LojaDiamantes.naoFoiPossivelComprar")));
    } finally {
      setAComprar(false);
    }
  };

  const compraDisponivel = !!loja?.pagamento_simulado;

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />
      <BackButton fallbackPath={localizar("/jogo-curiosidades")} label={t("LojaDiamantes.voltarAoMenu")} />

      <main className="flex-1">
        <div className="container pb-16 max-w-4xl mx-auto">
          <div className="flex justify-center sm:justify-end mb-6">
            <CarteiraJogo />
          </div>

          <header className="text-center space-y-3 mb-8">
            <span className="text-sm font-medium tracking-widest uppercase text-teal">
              {t("LojaDiamantes.inclusivamente")}
            </span>
            <h1 className="text-3xl md:text-4xl font-bold text-foreground">{t("LojaDiamantes.titulo")}</h1>
            <p className="text-muted-foreground max-w-xl mx-auto">{t("LojaDiamantes.descricao")}</p>
          </header>

          {aCarregar && (
            <div className="rounded-2xl bg-card border border-border/60 shadow-card p-16 flex justify-center">
              <Loader2 className="w-8 h-8 animate-spin text-teal" />
            </div>
          )}

          {!aCarregar && erro && (
            <div className="rounded-2xl bg-card border border-border/60 shadow-card p-8 text-center space-y-4">
              <p className="text-muted-foreground">{t("LojaDiamantes.naoFoiPossivelCarregar")}</p>
              <Button variant="outline" onClick={() => void carregar()}>
                <RefreshCw className="w-4 h-4" />
                {t("LojaDiamantes.tentarNovamente")}
              </Button>
            </div>
          )}

          {!aCarregar && loja && (
            <>
              <div
                className={cn(
                  "rounded-xl border p-4 mb-6 flex gap-3 text-sm",
                  compraDisponivel ? "bg-gold/10 border-gold/40" : "bg-muted border-border"
                )}
              >
                <Info className="w-5 h-5 shrink-0 text-gold" />
                <p className="text-muted-foreground">
                  {compraDisponivel ? t("LojaDiamantes.avisoPagamentoSimulado") : t("LojaDiamantes.avisoEmBreve")}
                </p>
              </div>

              <div className="grid grid-cols-1 min-[420px]:grid-cols-2 md:grid-cols-3 gap-4">
                {loja.pacotes.map((pacote, i) => {
                  const destaque = DESTAQUE[pacote.id];
                  return (
                    <div
                      key={pacote.id}
                      data-testid={`pacote-${pacote.id}`}
                      className={cn(
                        "relative rounded-2xl bg-card border shadow-card p-5 flex flex-col items-center text-center gap-3",
                        destaque ? "border-teal/60" : "border-border/60"
                      )}
                    >
                      {destaque && (
                        <span className="absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap text-[11px] font-bold uppercase tracking-wide bg-teal text-teal-foreground rounded-full px-3 py-1">
                          {t(`LojaDiamantes.${destaque}`)}
                        </span>
                      )}
                      <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mt-2">
                        {t(`LojaDiamantes.pacotes.${pacote.id}`, { defaultValue: pacote.id })}
                      </p>
                      <Gem className={cn("text-teal", TAMANHO_ICONE[Math.min(i, TAMANHO_ICONE.length - 1)])} />
                      <p className="text-3xl font-bold text-foreground">{pacote.total_diamantes}</p>
                      <p className={cn("text-xs font-semibold", pacote.bonus ? "text-gold" : "invisible")}>
                        <Sparkles className="w-3.5 h-3.5 inline -mt-0.5 mr-1" />
                        {t("LojaDiamantes.bonus", { quantidade: pacote.bonus })}
                      </p>
                      {profile ? (
                        <Button
                          className="w-full mt-auto bg-teal text-teal-foreground hover:bg-teal/90"
                          disabled={!compraDisponivel}
                          onClick={() => setPacoteEscolhido(pacote)}
                          aria-label={t("LojaDiamantes.comprarPacote", {
                            quantidade: pacote.total_diamantes,
                            preco: formatarKz(pacote.preco_kz),
                          })}
                        >
                          {formatarKz(pacote.preco_kz)}
                        </Button>
                      ) : (
                        <div className="w-full mt-auto space-y-2">
                          <p className="font-bold text-foreground">{formatarKz(pacote.preco_kz)}</p>
                          <Button asChild variant="outline" className="w-full">
                            <Link to={localizar("/auth")}>{t("LojaDiamantes.entrarParaComprar")}</Link>
                          </Button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </main>

      <Dialog open={pacoteEscolhido !== null} onOpenChange={(open) => !open && !aComprar && setPacoteEscolhido(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("LojaDiamantes.confirmarCompra")}</DialogTitle>
            <DialogDescription>
              {pacoteEscolhido &&
                t("LojaDiamantes.confirmarCompraDescricao", {
                  quantidade: pacoteEscolhido.total_diamantes,
                  preco: formatarKz(pacoteEscolhido.preco_kz),
                })}
            </DialogDescription>
          </DialogHeader>
          <p className="text-xs text-muted-foreground">{t("LojaDiamantes.avisoPagamentoSimulado")}</p>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setPacoteEscolhido(null)} disabled={aComprar}>
              {t("LojaDiamantes.cancelar")}
            </Button>
            <Button
              onClick={() => void confirmarCompra()}
              disabled={aComprar}
              className="bg-teal text-teal-foreground hover:bg-teal/90"
            >
              {aComprar && <Loader2 className="w-4 h-4 animate-spin" />}
              {t("LojaDiamantes.pagarSimulado")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Footer />
    </div>
  );
};

export default LojaDiamantes;
