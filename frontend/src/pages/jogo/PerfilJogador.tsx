import { useEffect, useState, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Coins, Flame, Loader2, Play, RefreshCw, Shield, Swords, Trophy } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import BackButton from "@/components/BackButton";
import CarteiraJogo from "@/components/jogo/CarteiraJogo";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/contexts/ProfileContext";
import { useCarteiraJogo } from "@/contexts/CarteiraJogoContext";
import { jogoApi, mensagemDeErroApi, type EstatisticasJogador } from "@/lib/apiClient";
import { localizar } from "@/i18n/rotas";
import { cn } from "@/lib/utils";
import { TOTAL_PATAMARES, formatarKz, valorDoPatamar } from "./jogoConfig";
import { CATEGORIAS_VISUAIS, NIVEIS_VISUAIS, emPercentagem } from "./perfilJogoConfig";

const formatarNumero = (valor: number) => valor.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");

const PerfilJogador = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { isLoggedIn, loading: authLoading } = useAuth();
  const { profile } = useProfile();
  const { definirPerfil } = useCarteiraJogo();
  const [estatisticas, setEstatisticas] = useState<EstatisticasJogador | null>(null);
  const [aCarregar, setACarregar] = useState(true);
  const [erro, setErro] = useState(false);

  useEffect(() => {
    if (!authLoading && !isLoggedIn) navigate(localizar("/auth"));
  }, [authLoading, isLoggedIn, navigate]);

  const carregar = async () => {
    setACarregar(true);
    setErro(false);
    try {
      const resposta = await jogoApi.obterEstatisticas();
      setEstatisticas(resposta);
      // Aproveita para acertar a barra da carteira com o saldo mais recente.
      definirPerfil(resposta.perfil);
    } catch (err) {
      setErro(true);
      toast.error(mensagemDeErroApi(err, t("PerfilJogador.naoFoiPossivelCarregar")));
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
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />
      <BackButton fallbackPath={localizar("/jogo-curiosidades")} label={t("PerfilJogador.voltarAoMenu")} />

      <main className="flex-1">
        <div className="container pb-16 max-w-2xl mx-auto space-y-5">
          <div className="flex justify-center">
            <CarteiraJogo />
          </div>

          {/* Cabeçalho: avatar, nome e crachá do nível */}
          <section className="rounded-3xl bg-gradient-to-b from-navy to-navy/85 text-white shadow-elevated p-6 text-center space-y-4">
            <span className="text-xs font-medium tracking-widest uppercase text-teal">{t("PerfilJogador.inclusivamente")}</span>
            {profile && (
              <div className="flex flex-col items-center gap-2">
                <Avatar className="h-20 w-20 ring-4 ring-teal/60">
                  {profile.avatar_url && <AvatarImage src={profile.avatar_url} alt={nome} />}
                  <AvatarFallback className="bg-primary text-primary-foreground text-2xl font-semibold">
                    {nome[0]?.toUpperCase() ?? "?"}
                  </AvatarFallback>
                </Avatar>
                <h1 className="text-xl font-bold truncate max-w-full">{nome}</h1>
              </div>
            )}

            {estatisticas && <CrachaNivel nivel={estatisticas.nivel} />}
          </section>

          {aCarregar && !estatisticas && (
            <div className="rounded-2xl bg-card border border-border/60 shadow-card p-16 flex justify-center">
              <Loader2 className="w-8 h-8 animate-spin text-teal" aria-label={t("PerfilJogador.aCarregar")} />
            </div>
          )}

          {erro && !aCarregar && !estatisticas && (
            <div className="rounded-2xl bg-card border border-border/60 shadow-card p-6 text-center space-y-3">
              <p className="text-sm text-muted-foreground">{t("PerfilJogador.naoFoiPossivelCarregar")}</p>
              <Button variant="outline" onClick={() => void carregar()}>
                <RefreshCw className="w-4 h-4" />
                {t("PerfilJogador.tentarNovamente")}
              </Button>
            </div>
          )}

          {estatisticas && (
            <>
              {/* Estatísticas gerais */}
              <section className="grid grid-cols-2 gap-3">
                <Estatistica
                  icone={<Coins className="w-5 h-5 text-gold" />}
                  valor={formatarNumero(estatisticas.perfil.moedas_ganhas_total ?? 0)}
                  rotulo={t("PerfilJogador.moedasGanhas")}
                />
                <Estatistica
                  icone={<Flame className="w-5 h-5 text-orange-500" />}
                  valor={String(estatisticas.perfil.melhor_sequencia ?? 0)}
                  rotulo={t("PerfilJogador.melhorSequencia")}
                />
                <Estatistica
                  icone={<Swords className="w-5 h-5 text-navy" />}
                  valor={String(estatisticas.perfil.partidas_jogadas)}
                  rotulo={t("PerfilJogador.partidasJogadas")}
                />
                <Estatistica
                  icone={<Trophy className="w-5 h-5 text-gold" />}
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
              </section>

              {/* Estatísticas por categoria */}
              <section className="rounded-3xl bg-card border border-border/60 shadow-card p-5 space-y-4">
                <h2 className="text-center text-sm font-bold tracking-widest uppercase text-foreground">
                  {t("PerfilJogador.estatisticasPorCategoria")}
                </h2>
                <ul className="grid grid-cols-2 min-[480px]:grid-cols-3 gap-x-3 gap-y-5">
                  {estatisticas.categorias.map((c) => (
                    <CategoriaCartao
                      key={c.categoria}
                      categoria={c.categoria}
                      respostas={c.respostas}
                      acertos={c.acertos}
                      taxa={c.taxa_acerto}
                    />
                  ))}
                </ul>
                {estatisticas.categorias.every((c) => c.respostas === 0) && (
                  <p className="text-center text-xs text-muted-foreground">{t("PerfilJogador.semRespostasAinda")}</p>
                )}
              </section>
            </>
          )}

          <Button asChild size="lg" className="w-full bg-teal text-teal-foreground hover:bg-teal/90">
            <Link to={localizar("/jogo-curiosidades/jogar")}>
              <Play className="w-4 h-4" />
              {t("PerfilJogador.jogarAgora")}
            </Link>
          </Button>
        </div>
      </main>

      <Footer />
    </div>
  );
};

const CrachaNivel = ({ nivel }: { nivel: EstatisticasJogador["nivel"] }) => {
  const { t } = useTranslation();
  const nomeNivel = t(`PerfilJogador.niveis.${nivel.id}`);
  const percentagem = emPercentagem(nivel.progresso);
  return (
    <div className="flex items-center gap-4 rounded-2xl bg-white/10 p-4 text-left" data-testid="cracha-nivel">
      <div
        className={cn(
          "relative w-16 h-16 shrink-0 rounded-2xl bg-gradient-to-br flex items-center justify-center shadow-elevated",
          NIVEIS_VISUAIS[nivel.id].cor
        )}
        aria-hidden
      >
        <Shield className="w-10 h-10 text-white/90" />
        <span className="absolute text-lg font-extrabold text-navy">{nivel.numero}</span>
      </div>
      <div className="flex-1 min-w-0 space-y-1.5">
        <p className="text-[11px] uppercase tracking-widest text-white/70">
          {t("PerfilJogador.nivelNumero", { numero: nivel.numero })}
        </p>
        <p className="text-lg font-bold leading-tight">{nomeNivel}</p>
        <div
          className="h-2.5 rounded-full bg-white/20 overflow-hidden"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percentagem}
          aria-label={t("PerfilJogador.progressoNivel")}
        >
          <div className="h-full rounded-full bg-gold" style={{ width: `${percentagem}%` }} />
        </div>
        <p className="text-xs text-white/80">
          {nivel.proximo_minimo === null
            ? t("PerfilJogador.nivelMaximo", { total: nivel.patamares_total })
            : t("PerfilJogador.faltamPatamares", {
                faltam: nivel.proximo_minimo - nivel.patamares_total,
                total: nivel.patamares_total,
              })}
        </p>
      </div>
    </div>
  );
};

const Estatistica = ({ icone, valor, rotulo }: { icone: ReactNode; valor: string; rotulo: string }) => (
  <div className="rounded-2xl bg-card border border-border/60 shadow-card p-4 flex flex-col items-center text-center gap-1.5">
    {icone}
    <p className="text-xl font-bold text-foreground">{valor}</p>
    <p className="text-[11px] text-muted-foreground uppercase tracking-wide leading-tight">{rotulo}</p>
  </div>
);

const TAMANHO_ANEL = 72;
const ESPESSURA_ANEL = 6;
const RAIO_ANEL = (TAMANHO_ANEL - ESPESSURA_ANEL) / 2;
const CIRCUNFERENCIA_ANEL = 2 * Math.PI * RAIO_ANEL;

const CategoriaCartao = ({
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
  const { icone: Icone, cor, anel } = CATEGORIAS_VISUAIS[categoria];
  const percentagem = emPercentagem(taxa);
  const nome = t(`PerfilJogador.categorias.${categoria}`);
  return (
    <li className="flex flex-col items-center text-center gap-1.5" data-testid={`categoria-${categoria}`}>
      <div className="relative" style={{ width: TAMANHO_ANEL, height: TAMANHO_ANEL }}>
        <svg width={TAMANHO_ANEL} height={TAMANHO_ANEL} className="-rotate-90" aria-hidden>
          <circle
            cx={TAMANHO_ANEL / 2}
            cy={TAMANHO_ANEL / 2}
            r={RAIO_ANEL}
            strokeWidth={ESPESSURA_ANEL}
            className="fill-none stroke-muted"
          />
          <circle
            cx={TAMANHO_ANEL / 2}
            cy={TAMANHO_ANEL / 2}
            r={RAIO_ANEL}
            strokeWidth={ESPESSURA_ANEL}
            strokeDasharray={CIRCUNFERENCIA_ANEL}
            strokeDashoffset={CIRCUNFERENCIA_ANEL * (1 - percentagem / 100)}
            strokeLinecap="round"
            className={cn("fill-none", anel)}
          />
        </svg>
        <span className={cn("absolute inset-2 rounded-full flex items-center justify-center", cor)}>
          <Icone className="w-6 h-6" />
        </span>
      </div>
      <p className="text-sm font-semibold text-foreground leading-tight">{nome}</p>
      <p
        className="text-xs text-muted-foreground"
        aria-label={t("PerfilJogador.acertosCategoria", { nome, acertos, respostas, percentagem })}
      >
        {respostas > 0 ? `${acertos}/${respostas} · ${percentagem}%` : t("PerfilJogador.semRespostas")}
      </p>
    </li>
  );
};

export default PerfilJogador;
