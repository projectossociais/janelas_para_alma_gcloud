import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Banknote, Coins, Gem, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import CarteiraJogo from "@/components/jogo/CarteiraJogo";
import CheckoutTransferencia from "@/components/jogo/CheckoutTransferencia";
import { CartaoPacote, DialogoCompra } from "@/components/jogo/PecasLoja";
import PedidosLojaLista from "@/components/jogo/PedidosLojaLista";
import { Aviso } from "@/design/componentes/Aviso";
import { Botao } from "@/design/componentes/Botao";
import { Contentor } from "@/design/layouts/Contentor";
import { useCarteiraJogo } from "@/contexts/CarteiraJogoContext";
import { useProfile } from "@/contexts/ProfileContext";
import {
  jogoApi,
  mensagemDeErroApi,
  type LojaDiamantes as Loja,
  type MetodoPagamentoDiamantes,
  type PacoteDiamantes,
  type PedidoLoja,
} from "@/lib/apiClient";
import { localizar } from "@/i18n/rotas";
import { comprovativoValido, pagarComTransferencia } from "@/lib/pagamentoLoja";
import { formatarKz } from "./jogoConfig";

// Destaques visuais por pacote -- só apresentação; quantidades e preços vêm
// sempre da API (`GET /jogo/loja/pacotes`).
const DESTAQUE: Record<string, "popular" | "melhorValor" | undefined> = {
  medio: "popular",
  grande: "melhorValor",
};

const formatarMoedas = (valor: number) => valor.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");

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
  const [erroCompra, setErroCompra] = useState<string | null>(null);
  const [pedidos, setPedidos] = useState<PedidoLoja[]>([]);

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
      setPedidos(await jogoApi.listarMeusPedidosLoja());
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
    setErroCompra(null);
  };

  const comprarDeImediato = async ({ pacote, metodo }: CompraEscolhida) => {
    const novoPerfil = await jogoApi.comprarPacoteDiamantes(pacote.id, metodo);
    definirPerfil(novoPerfil);
    toast.success(t("LojaDiamantes.compraConcluida", { quantidade: pacote.total_diamantes }));
  };

  const enviarPedidoTransferencia = async (pacote: PacoteDiamantes, ficheiro: File) => {
    await pagarComTransferencia(pacote.id, ficheiro, "diamantes");
    toast.success(t("LojaDiamantes.pedidoEnviado", { quantidade: pacote.total_diamantes }));
    void carregarPedidos();
  };

  const confirmarCompra = async () => {
    if (!compra) return;
    setErroCompra(null);
    if (checkoutTransferencia) {
      if (!comprovativo) {
        setErroCompra(t("LojaDiamantes.anexeOComprovativo"));
        return;
      }
      if (!comprovativoValido(comprovativo)) {
        setErroCompra(t("LojaDiamantes.tipoDeComprovativoInvalido"));
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
        setErroCompra(t("LojaDiamantes.moedasInsuficientes"));
      } else {
        setErroCompra(mensagemDeErroApi(err, t("LojaDiamantes.naoFoiPossivelComprar")));
      }
    } finally {
      setAComprar(false);
    }
  };

  return (
    <Contentor className="py-12 lg:py-16">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <Botao asChild variante="fantasma" className="-ml-3 px-3">
          <Link to={localizar("/jogo-curiosidades")}>
            <ArrowLeft aria-hidden /> {t("LojaDiamantes.voltarAoMenu")}
          </Link>
        </Botao>
        {profile && <CarteiraJogo />}
      </div>

      <header className="mt-6 max-w-2xl">
        <p className="text-legenda font-medium text-accao">{t("LojaDiamantes.inclusivamente")}</p>
        <h1 className="mt-2 text-titulo-g text-tinta">{t("LojaDiamantes.titulo")}</h1>
        <p className="mt-4 text-corpo-g text-tinta-suave">{t("LojaDiamantes.descricao")}</p>
      </header>

      <div className="mt-10">
        {aCarregar && (
          <p role="status" className="text-corpo text-tinta-suave">
            {t("LojaDiamantes.aCarregar")}
          </p>
        )}

        {!aCarregar && erro && (
          <Aviso
            variante="erro"
            anunciar
            accao={
              <Botao variante="secundario" onClick={() => void carregar()}>
                <RefreshCw aria-hidden />
                {t("LojaDiamantes.tentarNovamente")}
              </Botao>
            }
          >
            {t("LojaDiamantes.naoFoiPossivelCarregar")}
          </Aviso>
        )}

        {!aCarregar && loja && (
          <>
            <Aviso variante={simulado ? "aviso" : "info"}>
              {simulado ? t("LojaDiamantes.avisoPagamentoSimulado") : t("LojaDiamantes.avisoDuasFormas")}
            </Aviso>

            <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {loja.pacotes.map((pacote) => {
                const destaque = DESTAQUE[pacote.id];
                const precoMoedas = pacote.preco_moedas;
                const faltamMoedas = precoMoedas !== undefined && moedas < precoMoedas;
                return (
                  <CartaoPacote
                    key={pacote.id}
                    testId={`pacote-${pacote.id}`}
                    destaque={destaque && t(`LojaDiamantes.${destaque}`)}
                    nome={t(`LojaDiamantes.pacotes.${pacote.id}`, { defaultValue: pacote.id })}
                    icone={<Gem className="text-accao" />}
                    quantidade={String(pacote.total_diamantes)}
                    bonus={pacote.bonus ? t("LojaDiamantes.bonus", { quantidade: pacote.bonus }) : undefined}
                  >
                    {profile ? (
                      <>
                        <Botao
                          larguraTotal
                          onClick={() => setCompra({ pacote, metodo: "kwanzas" })}
                          aria-label={t("LojaDiamantes.comprarPacote", {
                            quantidade: pacote.total_diamantes,
                            preco: formatarKz(pacote.preco_kz),
                          })}
                        >
                          <Banknote aria-hidden />
                          {formatarKz(pacote.preco_kz)}
                        </Botao>
                        {precoMoedas !== undefined && (
                          <Botao
                            variante="secundario"
                            larguraTotal
                            disabled={faltamMoedas}
                            onClick={() => setCompra({ pacote, metodo: "moedas" })}
                            aria-label={t("LojaDiamantes.comprarPacoteMoedas", {
                              quantidade: pacote.total_diamantes,
                              moedas: formatarMoedas(precoMoedas),
                            })}
                          >
                            <Coins aria-hidden />
                            {t("LojaDiamantes.precoMoedas", { moedas: formatarMoedas(precoMoedas) })}
                          </Botao>
                        )}
                        {faltamMoedas && precoMoedas !== undefined && (
                          <p className="text-center text-legenda text-tinta-suave">
                            {t("LojaDiamantes.faltamMoedas", { moedas: formatarMoedas(precoMoedas - moedas) })}
                          </p>
                        )}
                      </>
                    ) : (
                      <>
                        <p className="text-corpo font-medium text-tinta">
                          {formatarKz(pacote.preco_kz)}
                          {precoMoedas !== undefined && (
                            <span className="font-normal text-tinta-suave">
                              {" "}
                              {t("LojaDiamantes.ouPrecoMoedas", { moedas: formatarMoedas(precoMoedas) })}
                            </span>
                          )}
                        </p>
                        <Botao asChild variante="secundario" larguraTotal>
                          <Link to={localizar("/auth")}>{t("LojaDiamantes.entrarParaComprar")}</Link>
                        </Botao>
                      </>
                    )}
                  </CartaoPacote>
                );
              })}
            </div>

            {profile && <PedidosLojaLista pedidos={pedidos} />}
          </>
        )}
      </div>

      <DialogoCompra
        aberto={compra !== null}
        aoFechar={fecharCompra}
        titulo={checkoutTransferencia ? t("LojaDiamantes.pagarPorTransferencia") : t("LojaDiamantes.confirmarCompra")}
        descricao={
          compra?.metodo === "moedas"
            ? t("LojaDiamantes.confirmarCompraMoedas", {
                quantidade: compra.pacote.total_diamantes,
                moedas: formatarMoedas(compra.pacote.preco_moedas ?? 0),
              })
            : compra
              ? t("LojaDiamantes.confirmarCompraDescricao", {
                  quantidade: compra.pacote.total_diamantes,
                  preco: formatarKz(compra.pacote.preco_kz),
                })
              : ""
        }
        erro={erroCompra}
        aConfirmar={aComprar}
        podeConfirmar={!(checkoutTransferencia && !comprovativo)}
        rotuloConfirmar={
          compra?.metodo === "moedas"
            ? t("LojaDiamantes.trocarMoedas")
            : checkoutTransferencia
              ? t("LojaDiamantes.enviarComprovativo")
              : t("LojaDiamantes.pagarSimulado")
        }
        aoConfirmar={() => void confirmarCompra()}
        textos={{ cancelar: t("LojaDiamantes.cancelar"), fechar: t("LojaDiamantes.fechar") }}
      >
        {compra?.metodo === "kwanzas" && simulado && (
          <p className="text-legenda text-tinta-suave">{t("LojaDiamantes.avisoPagamentoSimulado")}</p>
        )}
        {checkoutTransferencia && (
          <CheckoutTransferencia tipo="diamantes" comprovativo={comprovativo} onComprovativo={setComprovativo} />
        )}
      </DialogoCompra>
    </Contentor>
  );
};

export default LojaDiamantes;
