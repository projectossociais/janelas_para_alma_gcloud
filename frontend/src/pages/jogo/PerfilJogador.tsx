import { useEffect, useState, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Coins, Flame, Play, RefreshCw, Shield, Swords, Trophy } from "lucide-react";
import { useTranslation } from "react-i18next";
import CarteiraJogo from "@/components/jogo/CarteiraJogo";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/contexts/ProfileContext";
import { useCarteiraJogo } from "@/contexts/CarteiraJogoContext";
import { Aviso } from "@/design/componentes/Aviso";
import { Botao } from "@/design/componentes/Botao";
import { Cartao } from "@/design/componentes/Cartao";
import { Contentor } from "@/design/layouts/Contentor";
import { jogoApi, mensagemDeErroApi, type EstatisticasJogador } from "@/lib/apiClient";
import { localizar } from "@/i18n/rotas";
import { TOTAL_PATAMARES, formatarKz, valorDoPatamar } from "./jogoConfig";
import { ICONE_CATEGORIA, emPercentagem } from "./perfilJogoConfig";

const formatarNumero = (valor: number) => valor.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");

/**
 * Perfil do jogador no Inclusivamente (só com sessão): o nível e quanto falta
 * para o próximo, os números gerais e os acertos por categoria. Tudo vem da
 * API (`GET /jogo/perfil/estatisticas`).
 */
const PerfilJogador = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { isLoggedIn, loading: authLoading } = useAuth();
  const { profile } = useProfile();
  const { definirPerfil } = useCarteiraJogo();
  const [estatisticas, setEstatisticas] = useState<EstatisticasJogador | null>(null);
  const [aCarregar, setACarregar] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !isLoggedIn) navigate(localizar("/auth"));
  }, [authLoading, isLoggedIn, navigate]);

  const carregar = async () => {
    setACarregar(true);
    setErro(null);
    try {
      const resposta = await jogoApi.obterEstatisticas();
      setEstatisticas(resposta);
      // Aproveita para acertar a barra da carteira com o saldo mais recente.
      definirPerfil(resposta.perfil);
    } catch (err) {
      setErro(mensagemDeErroApi(err, t("PerfilJogador.naoFoiPossivelCarregar")));
    } finally {
      setACarregar(false);
    }
  };

  useEffect(() => {
    if (!isLoggedIn) return;
    void carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoggedIn]);

  const nome = profile?.nome_completo || profile?.email || "";

  return (
    <Contentor className="py-12 lg:py-16">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <Botao asChild variante="fantasma" className="-ml-3 px-3">
          <Link to={localizar("/jogo-curiosidades")}>
            <ArrowLeft aria-hidden /> {t("PerfilJogador.voltarAoMenu")}
          </Link>
        </Botao>
        <CarteiraJogo />
      </div>

      <header className="mt-6 flex items-center gap-4">
        {profile &&
          (profile.avatar_url ? (
            <img src={profile.avatar_url} alt="" className="size-16 shrink-0 rounded-pilula object-cover" />
          ) : (
            <span
              aria-hidden
              className="flex size-16 shrink-0 items-center justify-center rounded-pilula bg-accao text-titulo-p font-medium text-sobre-accao"
            >
              {nome[0]?.toUpperCase() ?? "?"}
            </span>
          ))}
        <div className="min-w-0">
          <p className="text-legenda font-medium text-accao">{t("PerfilJogador.inclusivamente")}</p>
          {profile && <h1 className="truncate text-titulo-m text-tinta">{nome}</h1>}
        </div>
      </header>

      <div className="mt-8 space-y-8">
        {aCarregar && !estatisticas && (
          <p role="status" className="text-corpo text-tinta-suave">
            {t("PerfilJogador.aCarregar")}
          </p>
        )}

        {erro && !aCarregar && !estatisticas && (
          <Aviso
            variante="erro"
            anunciar
            titulo={t("PerfilJogador.naoFoiPossivelCarregar")}
            accao={
              <Botao variante="secundario" onClick={() => void carregar()}>
                <RefreshCw aria-hidden />
                {t("PerfilJogador.tentarNovamente")}
              </Botao>
            }
          >
            {erro !== t("PerfilJogador.naoFoiPossivelCarregar") ? erro : null}
          </Aviso>
        )}

        {estatisticas && (
          <>
            <CrachaNivel nivel={estatisticas.nivel} />

            <dl className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <Estatistica
                icone={<Coins className="text-aviso" />}
                valor={formatarNumero(estatisticas.perfil.moedas_ganhas_total ?? 0)}
                rotulo={t("PerfilJogador.moedasGanhas")}
              />
              <Estatistica
                icone={<Flame className="text-aviso" />}
                valor={String(estatisticas.perfil.melhor_sequencia ?? 0)}
                rotulo={t("PerfilJogador.melhorSequencia")}
              />
              <Estatistica
                icone={<Swords className="text-accao" />}
                valor={String(estatisticas.perfil.partidas_jogadas)}
                rotulo={t("PerfilJogador.partidasJogadas")}
              />
              <Estatistica
                icone={<Trophy className="text-aviso" />}
                valor={
                  estatisticas.perfil.patamar_maximo_alcancado
                    ? formatarKz(valorDoPatamar(estatisticas.perfil.patamar_maximo_alcancado))
                    : "--"
                }
                rotulo={t("PerfilJogador.melhorResultado", {
                  patamar: estatisticas.perfil.patamar_maximo_alcancado,
                  total: TOTAL_PATAMARES,
                })}
              />
            </dl>

            <section aria-labelledby="perfil-categorias">
              <h2 id="perfil-categorias" className="text-titulo-p text-tinta">
                {t("PerfilJogador.estatisticasPorCategoria")}
              </h2>
              {estatisticas.categorias.every((c) => c.respostas === 0) && (
                <p className="mt-2 text-corpo text-tinta-suave">{t("PerfilJogador.semRespostasAinda")}</p>
              )}
              <ul className="mt-4 divide-y divide-linha rounded-cartao border border-linha bg-superficie">
                {estatisticas.categorias.map((c) => (
                  <CategoriaLinha
                    key={c.categoria}
                    categoria={c.categoria}
                    respostas={c.respostas}
                    acertos={c.acertos}
                    taxa={c.taxa_acerto}
                  />
                ))}
              </ul>
            </section>
          </>
        )}

        <Botao asChild tamanho="g" larguraTotal className="sm:w-auto">
          <Link to={localizar("/jogo-curiosidades/jogar")}>
            <Play aria-hidden />
            {t("PerfilJogador.jogarAgora")}
          </Link>
        </Botao>
      </div>
    </Contentor>
  );
};

const CrachaNivel = ({ nivel }: { nivel: EstatisticasJogador["nivel"] }) => {
  const { t } = useTranslation();
  const percentagem = emPercentagem(nivel.progresso);
  return (
    <Cartao className="flex items-center gap-4 border-0 bg-accao-suave" data-testid="cracha-nivel">
      <span aria-hidden className="relative flex size-16 shrink-0 items-center justify-center text-accao">
        <Shield className="size-16" strokeWidth={1.5} />
        <span className="absolute text-corpo-g font-medium text-tinta">{nivel.numero}</span>
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-legenda text-tinta-suave">{t("PerfilJogador.nivelNumero", { numero: nivel.numero })}</p>
        <p className="text-titulo-p text-tinta">{t(`PerfilJogador.niveis.${nivel.id}`)}</p>
        <div
          className="mt-2 h-2.5 overflow-hidden rounded-pilula bg-superficie"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percentagem}
          aria-label={t("PerfilJogador.progressoNivel")}
        >
          <div className="h-full rounded-pilula bg-accao" style={{ width: `${percentagem}%` }} />
        </div>
        <p className="mt-2 text-legenda text-tinta-suave">
          {nivel.proximo_minimo === null
            ? t("PerfilJogador.nivelMaximo", { total: nivel.patamares_total })
            : t("PerfilJogador.faltamPatamares", {
                faltam: nivel.proximo_minimo - nivel.patamares_total,
                total: nivel.patamares_total,
              })}
        </p>
      </div>
    </Cartao>
  );
};

const Estatistica = ({ icone, valor, rotulo }: { icone: ReactNode; valor: string; rotulo: string }) => (
  <div className="flex flex-col rounded-cartao border border-linha bg-superficie p-4">
    <span aria-hidden className="order-1 [&_svg]:size-5">
      {icone}
    </span>
    <dt className="order-3 mt-1 text-legenda text-tinta-suave">{rotulo}</dt>
    <dd className="order-2 mt-2 text-titulo-p font-medium tabular-nums text-tinta">{valor}</dd>
  </div>
);

const CategoriaLinha = ({
  categoria,
  respostas,
  acertos,
  taxa,
}: {
  categoria: EstatisticasJogador["categorias"][number]["categoria"];
  respostas: number;
  acertos: number;
  taxa: number;
}) => {
  const { t } = useTranslation();
  const Icone = ICONE_CATEGORIA[categoria];
  const percentagem = emPercentagem(taxa);
  const nome = t(`PerfilJogador.categorias.${categoria}`);
  return (
    <li className="flex items-center gap-3 px-4 py-3" data-testid={`categoria-${categoria}`}>
      <span aria-hidden className="flex size-9 shrink-0 items-center justify-center rounded-pilula bg-accao-suave text-accao">
        <Icone className="size-5" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3">
          <p className="text-corpo font-medium text-tinta">{nome}</p>
          <p
            className="text-legenda tabular-nums text-tinta-suave"
            aria-label={t("PerfilJogador.acertosCategoria", { nome, acertos, respostas, percentagem })}
          >
            {respostas > 0 ? `${acertos}/${respostas} · ${percentagem}%` : t("PerfilJogador.semRespostas")}
          </p>
        </div>
        <div className="mt-1.5 h-2 overflow-hidden rounded-pilula bg-superficie-alt" aria-hidden>
          <div className="h-full rounded-pilula bg-accao" style={{ width: `${respostas > 0 ? percentagem : 0}%` }} />
        </div>
      </div>
    </li>
  );
};

export default PerfilJogador;
