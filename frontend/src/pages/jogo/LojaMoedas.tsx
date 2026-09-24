import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Archive, Banknote, Coins, Gem, Info, Loader2, RefreshCw, ShoppingBag, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import BackButton from "@/components/BackButton";
import CarteiraJogo from "@/components/jogo/CarteiraJogo";
import CheckoutTransferencia from "@/components/jogo/CheckoutTransferencia";
import PedidosLojaLista from "@/components/jogo/PedidosLojaLista";
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
import { jogoApi, mensagemDeErroApi, type LojaMoedas as Loja, type PacoteMoedas, type PedidoLoja } from "@/lib/apiClient";
import { localizar } from "@/i18n/rotas";
import { comprovativoValido, pagarComTransferencia } from "@/lib/pagamentoLoja";
import { cn } from "@/lib/utils";
import { formatarKz } from "./jogoConfig";

// Só apresentação -- quantidades e preços vêm sempre da API
// (`GET /jogo/loja/moedas/pacotes`).
const DESTAQUE: Record<string, "maisPopular" | "melhorValor" | undefined> = {
  saco: "maisPopular",
  bau: "melhorValor",
};
const ICONE = { pilha: Coins, saco: ShoppingBag, bau: Archive } as const;
const TAMANHO_ICONE = ["w-10 h-10", "w-14 h-14", "w-16 h-16"];

const formatarMoedas = (valor: number) => valor.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");

/**
 * Loja de Moedas -- o mesmo desenho e o mesmo pagamento da Loja de Diamantes
 * (Kwanzas por transferência + comprovativo, creditado quando um admin
 * confirmar). As moedas servem para trocar por diamantes; também se ganham
 * a jogar. Em desenvolvimento (`pagamento_simulado`) credita logo.
 */
const LojaMoedas = () => {
  const { t } = useTranslation();
  const { profile } = useProfile();
  const { definirPerfil } = useCarteiraJogo();
  const [loja, setLoja] = useState<Loja | null>(null);
  const [aCarregar, setACarregar] = useState(true);
  const [erro, setErro] = useState(false);
  const [pacoteEscolhido, setPacoteEscolhido] = useState<PacoteMoedas | null>(null);
  const [aComprar, setAComprar] = useState(false);
  const [comprovativo, setComprovativo] = useState<File | null>(null);
  const [pedidos, setPedidos] = useState<PedidoLoja[]>([]);

  const carregar = useCallback(async () => {
    setACarregar(true);
    setErro(false);
    try {
      setLoja(await jogoApi.obterLojaMoedas());
    } catch (err) {
      console.error("Falha ao carregar a loja de moedas:", err);
      setErro(true);
    } finally {
      setACarregar(false);
    }
  }, []);

  const carregarPedidos = useCallback(async () => {
    try {
      setPedidos(await jogoApi.listarMeusPedidosLoja());
    } catch (err) {
      // Só informativo -- a loja funciona na mesma sem a lista.
      console.error("Falha ao carregar os pedidos da loja:", err);
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  useEffect(() => {
    if (profile) void carregarPedidos();
  }, [profile, carregarPedidos]);

  const simulado = !!loja?.pagamento_simulado;

  const fecharCompra = () => {
    if (aComprar) return;
    setPacoteEscolhido(null);
    setComprovativo(null);
  };

  const confirmarCompra = async () => {
    if (!pacoteEscolhido) return;
    if (!simulado) {
      if (!comprovativo) {
        toast.error(t("LojaMoedas.anexeOComprovativo"));
        return;
      }
      if (!comprovativoValido(comprovativo)) {
        toast.error(t("LojaMoedas.tipoDeComprovativoInvalido"));
        return;
      }
    }
    setAComprar(true);
    try {
      const quantidade = formatarMoedas(pacoteEscolhido.total_moedas);
      if (simulado) {
        definirPerfil(await jogoApi.comprarPacoteMoedas(pacoteEscolhido.id));
        toast.success(t("LojaMoedas.compraConcluida", { quantidade }));
      } else if (comprovativo) {
        await pagarComTransferencia(pacoteEscolhido.id, comprovativo, "moedas");
        toast.success(t("LojaMoedas.pedidoEnviado", { quantidade }));
        void carregarPedidos();
      }
      setPacoteEscolhido(null);
      setComprovativo(null);
    } catch (err) {
      // Nunca mostrar sucesso a partir daqui (CLAUDE.md secção 6).
      const status = (err as { status?: unknown } | null)?.status;
      if (status === 501) {
        toast.info(t("LojaMoedas.pagamentosEmBreve"));
        setPacoteEscolhido(null);
      } else {
        toast.error(mensagemDeErroApi(err, t("LojaMoedas.naoFoiPossivelComprar")));
      }
    } finally {
      setAComprar(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />
      <BackButton fallbackPath={localizar("/jogo-curiosidades")} label={t("LojaMoedas.voltarAoMenu")} />

      <main className="flex-1">
        <div className="container pb-16 max-w-4xl mx-auto">
          <div className="flex justify-center sm:justify-end mb-6">
            <CarteiraJogo />
          </div>

          <header className="text-center space-y-3 mb-8">
            <span className="text-sm font-medium tracking-widest uppercase text-gold">
              {t("LojaMoedas.inclusivamente")}
            </span>
            <h1 className="text-3xl md:text-4xl font-bold text-foreground">{t("LojaMoedas.titulo")}</h1>
            <p className="text-muted-foreground max-w-xl mx-auto">{t("LojaMoedas.descricao")}</p>
            <Link
              to={localizar("/jogo-curiosidades/loja")}
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-teal hover:underline"
            >
              <Gem className="w-4 h-4" />
              {t("LojaMoedas.irParaDiamantes")}
            </Link>
          </header>

          {aCarregar && (
            <div className="rounded-2xl bg-card border border-border/60 shadow-card p-16 flex justify-center">
              <Loader2 className="w-8 h-8 animate-spin text-gold" />
            </div>
          )}

          {!aCarregar && erro && (
            <div className="rounded-2xl bg-card border border-border/60 shadow-card p-8 text-center space-y-4">
              <p className="text-muted-foreground">{t("LojaMoedas.naoFoiPossivelCarregar")}</p>
              <Button variant="outline" onClick={() => void carregar()}>
                <RefreshCw className="w-4 h-4" />
                {t("LojaMoedas.tentarNovamente")}
              </Button>
            </div>
          )}

          {!aCarregar && loja && (
            <>
              <div
                className={cn(
                  "rounded-xl border p-4 mb-6 flex gap-3 text-sm",
                  simulado ? "bg-gold/10 border-gold/40" : "bg-muted border-border"
                )}
              >
                <Info className="w-5 h-5 shrink-0 text-gold" />
                <p className="text-muted-foreground">
                  {simulado ? t("LojaMoedas.avisoPagamentoSimulado") : t("LojaMoedas.avisoTransferencia")}
                </p>
              </div>

              <div className="grid grid-cols-1 min-[420px]:grid-cols-2 md:grid-cols-3 gap-4">
                {loja.pacotes.map((pacote, i) => {
                  const destaque = DESTAQUE[pacote.id];
                  const Icone = ICONE[pacote.id as keyof typeof ICONE] ?? Coins;
                  const quantidade = formatarMoedas(pacote.total_moedas);
                  return (
                    <div
                      key={pacote.id}
                      data-testid={`pacote-${pacote.id}`}
                      className={cn(
                        "relative rounded-2xl bg-card border shadow-card p-5 flex flex-col items-center text-center gap-3",
                        destaque ? "border-gold/60" : "border-border/60"
                      )}
                    >
                      {destaque && (
                        <span className="absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap text-[11px] font-bold uppercase tracking-wide bg-gold text-navy rounded-full px-3 py-1">
                          {t(`LojaMoedas.${destaque}`)}
                        </span>
                      )}
                      <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mt-2">
                        {t(`LojaMoedas.pacotes.${pacote.id}`, { defaultValue: pacote.id })}
                      </p>
                      <Icone className={cn("text-gold", TAMANHO_ICONE[Math.min(i, TAMANHO_ICONE.length - 1)])} />
                      <p className="text-3xl font-bold text-foreground">{quantidade}</p>
                      <p className={cn("text-xs font-semibold", pacote.bonus ? "text-gold" : "invisible")}>
                        <Sparkles className="w-3.5 h-3.5 inline -mt-0.5 mr-1" />
                        {t("LojaMoedas.bonus", { quantidade: formatarMoedas(pacote.bonus) })}
                      </p>
                      {profile ? (
                        <Button
                          className="w-full mt-auto bg-gold text-navy hover:bg-gold/90"
                          onClick={() => setPacoteEscolhido(pacote)}
                          aria-label={t("LojaMoedas.comprarPacote", { quantidade, preco: formatarKz(pacote.preco_kz) })}
                        >
                          <Banknote className="w-4 h-4" />
                          {formatarKz(pacote.preco_kz)}
                        </Button>
                      ) : (
                        <div className="w-full mt-auto space-y-2">
                          <p className="font-bold text-foreground">{formatarKz(pacote.preco_kz)}</p>
                          <Button asChild variant="outline" className="w-full">
                            <Link to={localizar("/auth")}>{t("LojaMoedas.entrarParaComprar")}</Link>
                          </Button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {profile && <PedidosLojaLista pedidos={pedidos} />}
            </>
          )}
        </div>
      </main>

      <Dialog open={pacoteEscolhido !== null} onOpenChange={(open) => !open && fecharCompra()}>
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {simulado ? t("LojaMoedas.confirmarCompra") : t("LojaMoedas.pagarPorTransferencia")}
            </DialogTitle>
            <DialogDescription>
              {pacoteEscolhido &&
                t("LojaMoedas.confirmarCompraDescricao", {
                  quantidade: formatarMoedas(pacoteEscolhido.total_moedas),
                  preco: formatarKz(pacoteEscolhido.preco_kz),
                })}
            </DialogDescription>
          </DialogHeader>

          {simulado ? (
            <p className="text-xs text-muted-foreground">{t("LojaMoedas.avisoPagamentoSimulado")}</p>
          ) : (
            <CheckoutTransferencia comprovativo={comprovativo} onComprovativo={setComprovativo} />
          )}

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={fecharCompra} disabled={aComprar}>
              {t("LojaMoedas.cancelar")}
            </Button>
            <Button
              onClick={() => void confirmarCompra()}
              disabled={aComprar || (!simulado && !comprovativo)}
              className="bg-gold text-navy hover:bg-gold/90"
            >
              {aComprar && <Loader2 className="w-4 h-4 animate-spin" />}
              {simulado ? t("LojaMoedas.pagarSimulado") : t("LojaMoedas.enviarComprovativo")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Footer />
    </div>
  );
};

export default LojaMoedas;
