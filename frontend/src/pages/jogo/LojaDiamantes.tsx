import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Banknote, Coins, Gem, Info, Loader2, RefreshCw, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import BackButton from "@/components/BackButton";
import CopyRow from "@/components/CopyRow";
import FileDropzone from "@/components/FileDropzone";
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
import {
  comprovativosApi,
  jogoApi,
  mensagemDeErroApi,
  TIPOS_DE_COMPROVATIVO_ACEITES,
  type LojaDiamantes as Loja,
  type MetodoPagamentoDiamantes,
  type PacoteDiamantes,
  type PedidoDiamantes,
} from "@/lib/apiClient";
import { DEFAULT_BANK_DATA, ofuscarValor } from "@/lib/pagamento";
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

const formatarMoedas = (valor: number) => valor.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");

const COR_ESTADO: Record<PedidoDiamantes["estado"], string> = {
  pendente: "bg-gold/15 text-gold",
  aprovado: "bg-green/15 text-green",
  rejeitado: "bg-destructive/15 text-destructive",
};

interface CompraEscolhida {
  pacote: PacoteDiamantes;
  metodo: MetodoPagamentoDiamantes;
}

const LojaDiamantes = () => {
  const { t } = useTranslation();
  const { profile } = useProfile();
  const { perfil, definirPerfil } = useCarteiraJogo();
  const [loja, setLoja] = useState<Loja | null>(null);
  const [aCarregar, setACarregar] = useState(true);
  const [erro, setErro] = useState(false);
  const [compra, setCompra] = useState<CompraEscolhida | null>(null);
  const [aComprar, setAComprar] = useState(false);
  const [comprovativo, setComprovativo] = useState<File | null>(null);
  const [pedidos, setPedidos] = useState<PedidoDiamantes[]>([]);

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

  const carregarPedidos = useCallback(async () => {
    try {
      setPedidos(await jogoApi.listarMeusPedidosDiamantes());
    } catch (err) {
      // Só informativo -- a loja funciona na mesma sem a lista.
      console.error("Falha ao carregar os pedidos de diamantes:", err);
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  useEffect(() => {
    if (profile) void carregarPedidos();
  }, [profile, carregarPedidos]);

  const simulado = !!loja?.pagamento_simulado;
  // Kwanzas reais: transferência + comprovativo, como o Premium.
  const checkoutTransferencia = compra?.metodo === "kwanzas" && !simulado;
  const moedas = perfil?.moedas ?? 0;

  const fecharCompra = () => {
    if (aComprar) return;
    setCompra(null);
    setComprovativo(null);
  };

  const comprarDeImediato = async ({ pacote, metodo }: CompraEscolhida) => {
    const novoPerfil = await jogoApi.comprarPacoteDiamantes(pacote.id, metodo);
    definirPerfil(novoPerfil);
    toast.success(t("LojaDiamantes.compraConcluida", { quantidade: pacote.total_diamantes }));
  };

  const enviarPedidoTransferencia = async (pacote: PacoteDiamantes, ficheiro: File) => {
    const preparado = await comprovativosApi.preparar(ficheiro.type);
    await comprovativosApi.enviarParaStorage(preparado.url_de_upload, ficheiro);
    await jogoApi.pedirDiamantesKwanzas(pacote.id, preparado.chave);
    toast.success(t("LojaDiamantes.pedidoEnviado", { quantidade: pacote.total_diamantes }));
    void carregarPedidos();
  };

  const confirmarCompra = async () => {
    if (!compra) return;
    if (checkoutTransferencia) {
      if (!comprovativo) {
        toast.error(t("LojaDiamantes.anexeOComprovativo"));
        return;
      }
      if (!TIPOS_DE_COMPROVATIVO_ACEITES.includes(comprovativo.type as never)) {
        toast.error(t("LojaDiamantes.tipoDeComprovativoInvalido"));
        return;
      }
    }
    setAComprar(true);
    try {
      if (checkoutTransferencia && comprovativo) {
        await enviarPedidoTransferencia(compra.pacote, comprovativo);
      } else {
        await comprarDeImediato(compra);
      }
      setCompra(null);
      setComprovativo(null);
    } catch (err) {
      // Nunca mostrar sucesso a partir daqui (CLAUDE.md secção 6) -- o
      // saldo só muda com a resposta da API, acima. Duck-typing no `status`.
      const status = (err as { status?: unknown } | null)?.status;
      if (status === 501) {
        toast.info(t("LojaDiamantes.pagamentosEmBreve"));
        setCompra(null);
      } else if (status === 402) {
        toast.error(t("LojaDiamantes.moedasInsuficientes"));
      } else {
        toast.error(mensagemDeErroApi(err, t("LojaDiamantes.naoFoiPossivelComprar")));
      }
    } finally {
      setAComprar(false);
    }
  };

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
                  simulado ? "bg-gold/10 border-gold/40" : "bg-muted border-border"
                )}
              >
                <Info className="w-5 h-5 shrink-0 text-gold" />
                <p className="text-muted-foreground">
                  {simulado ? t("LojaDiamantes.avisoPagamentoSimulado") : t("LojaDiamantes.avisoDuasFormas")}
                </p>
              </div>

              <div className="grid grid-cols-1 min-[420px]:grid-cols-2 md:grid-cols-3 gap-4">
                {loja.pacotes.map((pacote, i) => {
                  const destaque = DESTAQUE[pacote.id];
                  const precoMoedas = pacote.preco_moedas;
                  const faltamMoedas = precoMoedas !== undefined && moedas < precoMoedas;
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
                        <div className="w-full mt-auto space-y-2">
                          <Button
                            className="w-full bg-teal text-teal-foreground hover:bg-teal/90"
                            onClick={() => setCompra({ pacote, metodo: "kwanzas" })}
                            aria-label={t("LojaDiamantes.comprarPacote", {
                              quantidade: pacote.total_diamantes,
                              preco: formatarKz(pacote.preco_kz),
                            })}
                          >
                            <Banknote className="w-4 h-4" />
                            {formatarKz(pacote.preco_kz)}
                          </Button>
                          {precoMoedas !== undefined && (
                            <Button
                              variant="outline"
                              className="w-full border-gold/60 text-gold hover:bg-gold/10"
                              disabled={faltamMoedas}
                              onClick={() => setCompra({ pacote, metodo: "moedas" })}
                              aria-label={t("LojaDiamantes.comprarPacoteMoedas", {
                                quantidade: pacote.total_diamantes,
                                moedas: formatarMoedas(precoMoedas),
                              })}
                            >
                              <Coins className="w-4 h-4" />
                              {t("LojaDiamantes.precoMoedas", { moedas: formatarMoedas(precoMoedas) })}
                            </Button>
                          )}
                          {faltamMoedas && precoMoedas !== undefined && (
                            <p className="text-[11px] text-muted-foreground">
                              {t("LojaDiamantes.faltamMoedas", { moedas: formatarMoedas(precoMoedas - moedas) })}
                            </p>
                          )}
                        </div>
                      ) : (
                        <div className="w-full mt-auto space-y-2">
                          <p className="font-bold text-foreground">{formatarKz(pacote.preco_kz)}</p>
                          {precoMoedas !== undefined && (
                            <p className="text-sm font-semibold text-gold">
                              {t("LojaDiamantes.ouPrecoMoedas", { moedas: formatarMoedas(precoMoedas) })}
                            </p>
                          )}
                          <Button asChild variant="outline" className="w-full">
                            <Link to={localizar("/auth")}>{t("LojaDiamantes.entrarParaComprar")}</Link>
                          </Button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {profile && pedidos.length > 0 && (
                <section className="mt-10 space-y-3" aria-labelledby="meus-pedidos">
                  <h2 id="meus-pedidos" className="text-lg font-bold text-foreground">
                    {t("LojaDiamantes.osMeusPedidos")}
                  </h2>
                  <ul className="rounded-2xl bg-card border border-border/60 divide-y divide-border/60">
                    {pedidos.map((pedido) => (
                      <li key={pedido.id} className="flex items-center justify-between gap-3 p-4 text-sm">
                        <span className="flex items-center gap-2 text-foreground">
                          <Gem className="w-4 h-4 text-teal" />
                          {pedido.diamantes} · {formatarKz(pedido.preco_kz)}
                          <span className="text-muted-foreground">
                            {new Date(pedido.created_at).toLocaleDateString()}
                          </span>
                        </span>
                        <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-semibold", COR_ESTADO[pedido.estado])}>
                          {t(`LojaDiamantes.estados.${pedido.estado}`)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </>
          )}
        </div>
      </main>

      <Dialog open={compra !== null} onOpenChange={(open) => !open && fecharCompra()}>
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {checkoutTransferencia ? t("LojaDiamantes.pagarPorTransferencia") : t("LojaDiamantes.confirmarCompra")}
            </DialogTitle>
            <DialogDescription>
              {compra?.metodo === "moedas" &&
                t("LojaDiamantes.confirmarCompraMoedas", {
                  quantidade: compra.pacote.total_diamantes,
                  moedas: formatarMoedas(compra.pacote.preco_moedas ?? 0),
                })}
              {compra?.metodo === "kwanzas" &&
                t("LojaDiamantes.confirmarCompraDescricao", {
                  quantidade: compra.pacote.total_diamantes,
                  preco: formatarKz(compra.pacote.preco_kz),
                })}
            </DialogDescription>
          </DialogHeader>

          {compra?.metodo === "kwanzas" && simulado && (
            <p className="text-xs text-muted-foreground">{t("LojaDiamantes.avisoPagamentoSimulado")}</p>
          )}

          {checkoutTransferencia && (
            <div className="space-y-4">
              <div className="space-y-2">
                <p className="text-xs uppercase tracking-wide text-muted-foreground font-medium">
                  {t("LojaDiamantes.n1Transfira")}
                </p>
                <div className="rounded-lg border border-navy/20 bg-navy/5 p-4 space-y-1 divide-y divide-navy/10">
                  <CopyRow label={t("LojaDiamantes.beneficiario")} value={DEFAULT_BANK_DATA.beneficiario} />
                  <CopyRow
                    label={DEFAULT_BANK_DATA.pagamento_rapido.metodo}
                    value={DEFAULT_BANK_DATA.pagamento_rapido.telefone}
                    displayValue={ofuscarValor(DEFAULT_BANK_DATA.pagamento_rapido.telefone)}
                  />
                  <CopyRow
                    label={`IBAN ${DEFAULT_BANK_DATA.transferencia_nacional.banco}`}
                    value={DEFAULT_BANK_DATA.transferencia_nacional.iban}
                    displayValue={ofuscarValor(DEFAULT_BANK_DATA.transferencia_nacional.iban)}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <p className="text-xs uppercase tracking-wide text-muted-foreground font-medium">
                  {t("LojaDiamantes.n2AnexeOComprovativo")}
                </p>
                <FileDropzone file={comprovativo} onFileChange={setComprovativo} />
              </div>
              <p className="text-xs text-muted-foreground">{t("LojaDiamantes.creditadoAposConfirmacao")}</p>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={fecharCompra} disabled={aComprar}>
              {t("LojaDiamantes.cancelar")}
            </Button>
            <Button
              onClick={() => void confirmarCompra()}
              disabled={aComprar || (checkoutTransferencia && !comprovativo)}
              className="bg-teal text-teal-foreground hover:bg-teal/90"
            >
              {aComprar && <Loader2 className="w-4 h-4 animate-spin" />}
              {compra?.metodo === "moedas"
                ? t("LojaDiamantes.trocarMoedas")
                : checkoutTransferencia
                  ? t("LojaDiamantes.enviarComprovativo")
                  : t("LojaDiamantes.pagarSimulado")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Footer />
    </div>
  );
};

export default LojaDiamantes;
