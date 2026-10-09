import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Archive, ArrowLeft, ArrowRight, Banknote, Coins, Gem, RefreshCw, ShoppingBag } from "lucide-react";
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
import { jogoApi, mensagemDeErroApi, type LojaMoedas as Loja, type PacoteMoedas, type PedidoLoja } from "@/lib/apiClient";
import { localizar } from "@/i18n/rotas";
import { comprovativoValido, pagarComTransferencia } from "@/lib/pagamentoLoja";
import { formatarKz } from "./jogoConfig";

// Só apresentação -- quantidades e preços vêm sempre da API
// (`GET /jogo/loja/moedas/pacotes`).
const DESTAQUE: Record<string, "maisPopular" | "melhorValor" | undefined> = {
  saco: "maisPopular",
  bau: "melhorValor",
};
const ICONE = { pilha: Coins, saco: ShoppingBag, bau: Archive } as const;

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
  const [erroCompra, setErroCompra] = useState<string | null>(null);
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
    setErroCompra(null);
  };

  const confirmarCompra = async () => {
    if (!pacoteEscolhido) return;
    setErroCompra(null);
    if (!simulado) {
      if (!comprovativo) {
        setErroCompra(t("LojaMoedas.anexeOComprovativo"));
        return;
      }
      if (!comprovativoValido(comprovativo)) {
        setErroCompra(t("LojaMoedas.tipoDeComprovativoInvalido"));
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
        setErroCompra(mensagemDeErroApi(err, t("LojaMoedas.naoFoiPossivelComprar")));
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
            <ArrowLeft aria-hidden /> {t("LojaMoedas.voltarAoMenu")}
          </Link>
        </Botao>
        {profile && <CarteiraJogo />}
      </div>

      <header className="mt-6 max-w-2xl">
        <p className="text-legenda font-medium text-accao">{t("LojaMoedas.inclusivamente")}</p>
        <h1 className="mt-2 text-titulo-g text-tinta">{t("LojaMoedas.titulo")}</h1>
        <p className="mt-4 text-corpo-g text-tinta-suave">{t("LojaMoedas.descricao")}</p>
        <Botao asChild variante="fantasma" className="-ml-3 mt-3 px-3">
          <Link to={localizar("/jogo-curiosidades/loja")}>
            <Gem aria-hidden />
            {t("LojaMoedas.irParaDiamantes")}
            <ArrowRight aria-hidden />
          </Link>
        </Botao>
      </header>

      <div className="mt-8">
        {aCarregar && (
          <p role="status" className="text-corpo text-tinta-suave">
            {t("LojaMoedas.aCarregar")}
          </p>
        )}

        {!aCarregar && erro && (
          <Aviso
            variante="erro"
            anunciar
            accao={
              <Botao variante="secundario" onClick={() => void carregar()}>
                <RefreshCw aria-hidden />
                {t("LojaMoedas.tentarNovamente")}
              </Botao>
            }
          >
            {t("LojaMoedas.naoFoiPossivelCarregar")}
          </Aviso>
        )}

        {!aCarregar && loja && (
          <>
            <Aviso variante={simulado ? "aviso" : "info"}>
              {simulado ? t("LojaMoedas.avisoPagamentoSimulado") : t("LojaMoedas.avisoTransferencia")}
            </Aviso>

            <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {loja.pacotes.map((pacote) => {
                const destaque = DESTAQUE[pacote.id];
                const Icone = ICONE[pacote.id as keyof typeof ICONE] ?? Coins;
                const quantidade = formatarMoedas(pacote.total_moedas);
                return (
                  <CartaoPacote
                    key={pacote.id}
                    testId={`pacote-${pacote.id}`}
                    destaque={destaque && t(`LojaMoedas.${destaque}`)}
                    nome={t(`LojaMoedas.pacotes.${pacote.id}`, { defaultValue: pacote.id })}
                    icone={<Icone className="text-aviso" />}
                    quantidade={quantidade}
                    bonus={pacote.bonus ? t("LojaMoedas.bonus", { quantidade: formatarMoedas(pacote.bonus) }) : undefined}
                  >
                    {profile ? (
                      <Botao
                        larguraTotal
                        onClick={() => setPacoteEscolhido(pacote)}
                        aria-label={t("LojaMoedas.comprarPacote", { quantidade, preco: formatarKz(pacote.preco_kz) })}
                      >
                        <Banknote aria-hidden />
                        {formatarKz(pacote.preco_kz)}
                      </Botao>
                    ) : (
                      <>
                        <p className="text-corpo font-medium text-tinta">{formatarKz(pacote.preco_kz)}</p>
                        <Botao asChild variante="secundario" larguraTotal>
                          <Link to={localizar("/auth")}>{t("LojaMoedas.entrarParaComprar")}</Link>
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
        aberto={pacoteEscolhido !== null}
        aoFechar={fecharCompra}
        titulo={simulado ? t("LojaMoedas.confirmarCompra") : t("LojaMoedas.pagarPorTransferencia")}
        descricao={
          pacoteEscolhido
            ? t("LojaMoedas.confirmarCompraDescricao", {
                quantidade: formatarMoedas(pacoteEscolhido.total_moedas),
                preco: formatarKz(pacoteEscolhido.preco_kz),
              })
            : ""
        }
        erro={erroCompra}
        aConfirmar={aComprar}
        podeConfirmar={simulado || !!comprovativo}
        rotuloConfirmar={simulado ? t("LojaMoedas.pagarSimulado") : t("LojaMoedas.enviarComprovativo")}
        aoConfirmar={() => void confirmarCompra()}
        textos={{ cancelar: t("LojaMoedas.cancelar"), fechar: t("LojaMoedas.fechar") }}
      >
        {simulado ? (
          <p className="text-legenda text-tinta-suave">{t("LojaMoedas.avisoPagamentoSimulado")}</p>
        ) : (
          <CheckoutTransferencia tipo="moedas" comprovativo={comprovativo} onComprovativo={setComprovativo} />
        )}
      </DialogoCompra>
    </Contentor>
  );
};

export default LojaMoedas;
