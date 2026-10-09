import { useState } from "react";
import {
  Instagram,
  ArrowRight,
  Play,
  Lock,
  Clock,
  CheckCircle2,
  Contrast,
  Eye,
  UserPlus,
  Glasses,
  LineChart,
  RefreshCw,
  Layers,
  Minimize2,
  Sun,
  Target,
  type LucideIcon,
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import BackButton from "@/components/BackButton";
import { Button } from "@/components/ui/button";
import PremiumPaywallModal from "@/components/PremiumPaywallModal";
import FeedbackWidget from "@/components/FeedbackWidget";
import { useAcessoExercicios } from "@/contexts/AcessoExerciciosContext";
import { useProfile } from "@/contexts/ProfileContext";
import { useHistoricoVisao } from "@/components/visao/hooks";
import { nomeDoOlho } from "@/components/visao/rotulos";
import { evolucaoDestacada } from "@/lib/visao/tendencia";
import { ID_ACUIDADE, ID_ANEIS } from "@/lib/visao/ids";
import {
  useAcaoDesbloqueio,
  type GrupoExercicio,
  type TipoDesbloqueio,
} from "@/components/exercises/useAcaoDesbloqueio";
import { useTranslation } from "react-i18next";
import i18n from "@/i18n";
import { localizar } from "@/i18n/rotas";
import { cn } from "@/lib/utils";

interface Exercicio {
  /** Id tal como a API o conhece (`sessoes_exercicio.exercicio_id`). */
  id: string;
  /** Teste de triagem ou treino de apoio. */
  tipo: "teste" | "treino";
  title: string;
  description: string;
  icon: LucideIcon;
  route: string;
  /** Miniatura do vídeo do personagem animado, quando existir. */
  thumbnail?: string;
}

// Os ids são os históricos. Desde 2026-09-29 o Treino de Anéis está no
// trial no lugar da Convergência (docs/ANALISE_EXERCICIOS.md). O conteúdo
// mudou em 2026-09-28 -- ver api/app/services/acesso_exercicios_service.py.
const exerciciosTrial: Exercicio[] = [
  {
    id: "figure8",
    tipo: "teste",
    get title() {
      return i18n.t("Visao.acuidadeTitulo");
    },
    get description() {
      return i18n.t("Visao.acuidadeCartao");
    },
    icon: Eye,
    get route() {
      return localizar("/exercicios/acuidade");
    },
  },
  {
    id: "ambliopia",
    tipo: "treino",
    get title() {
      return i18n.t("Visao.aneisTitulo");
    },
    get description() {
      return i18n.t("Visao.aneisCartao");
    },
    icon: Glasses,
    get route() {
      return localizar("/exercicios/aneis");
    },
  },
  {
    id: "cerebro",
    tipo: "teste",
    get title() {
      return i18n.t("Visao.contrasteTitulo");
    },
    get description() {
      return i18n.t("Visao.contrasteCartao");
    },
    icon: Contrast,
    get route() {
      return localizar("/exercicios/contraste");
    },
  },
  {
    id: "relax",
    tipo: "teste",
    get title() {
      return i18n.t("Visao.astigmatismoTitulo");
    },
    get description() {
      return i18n.t("Visao.astigmatismoCartao");
    },
    icon: Sun,
    get route() {
      return localizar("/exercicios/astigmatismo");
    },
  },
];

const exerciciosPremium: Exercicio[] = [
  {
    id: "estereopsia",
    tipo: "teste",
    get title() {
      return i18n.t("Visao.estereoTitulo");
    },
    get description() {
      return i18n.t("Visao.estereoCartao");
    },
    icon: Layers,
    get route() {
      return localizar("/exercicios/estereopsia");
    },
  },
  {
    id: "sacadas-convergencia",
    tipo: "treino",
    get title() {
      return i18n.t("Visao.contrasteBlocosTitulo");
    },
    get description() {
      return i18n.t("Visao.contrasteBlocosCartao");
    },
    icon: Target,
    get route() {
      return localizar("/exercicios/contraste-em-blocos");
    },
  },
  {
    id: "flexibilidade-acomodativa",
    tipo: "treino",
    get title() {
      return i18n.t("Visao.pertoLongeTitulo");
    },
    get description() {
      return i18n.t("Visao.pertoLongeCartao");
    },
    icon: RefreshCw,
    get route() {
      return localizar("/exercicios/perto-e-longe");
    },
  },
  {
    id: "convergence",
    tipo: "treino",
    get title() {
      return i18n.t("Visao.convergenciaTitulo");
    },
    get description() {
      return i18n.t("Visao.convergenciaCartao");
    },
    icon: Minimize2,
    get route() {
      return localizar("/exercicios/convergencia");
    },
  },
];

const BOTAO_CARTAO: Record<TipoDesbloqueio, { chave: string; icon: LucideIcon }> = {
  criar_conta: { chave: "Exercicios.cartaoCriarConta", icon: UserPlus },
  iniciar_trial: { chave: "Exercicios.cartaoIniciarTrial", icon: Play },
  premium: { chave: "Exercicios.cartaoPremium", icon: Lock },
};

/** Banner de estado no topo da página: um por cada estado de acesso. */
/** A partir destes dias restantes, o banner do trial mostra a evolução medida. */
const DIAS_FINAIS_TRIAL = 3;

/**
 * Fim do trial (Fase B, docs/ANALISE_EXERCICIOS.md): o melhor argumento para
 * continuar é a evolução medida da própria pessoa. Uma piora nunca se usa para
 * vender -- só para recomendar a consulta.
 */
const EvolucaoFimTrial = () => {
  const { t } = useTranslation();
  const { profile } = useProfile();
  const { sessoes } = useHistoricoVisao();
  const olhoFraco =
    profile?.olho_mais_fraco === "direito" || profile?.olho_mais_fraco === "esquerdo" ? profile.olho_mais_fraco : null;
  const e = sessoes ? evolucaoDestacada(sessoes, [ID_ANEIS, ID_ACUIDADE], olhoFraco) : null;
  if (!e) return null;
  const olho = nomeDoOlho(e.olho).toLocaleLowerCase();
  const { dias, passos } = e.tendencia;
  if (e.tendencia.tipo === "piorou")
    return <p className="mt-2 text-sm font-medium text-foreground">{t("Exercicios.evolucaoPiorou", { olho, dias })}</p>;
  return (
    <p className="mt-2 text-sm text-foreground">
      <span className="font-semibold">
        {passos === 1 ? t("Exercicios.evolucaoMelhorouUma", { olho, dias }) : t("Exercicios.evolucaoMelhorou", { olho, dias, n: passos })}
      </span>{" "}
      {t("Exercicios.evolucaoContinuar")}
    </p>
  );
};

const BannerEstado = ({ aoVerPremium }: { aoVerPremium: () => void }) => {
  const { t } = useTranslation();
  const { acesso, loading } = useAcessoExercicios();
  const { executar, aIniciarTrial } = useAcaoDesbloqueio();

  if (loading) return <div className="h-[88px]" aria-hidden />;

  if (acesso.estado === "premium") {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-teal/30 bg-teal/5 px-5 py-4">
        <CheckCircle2 className="h-5 w-5 shrink-0 text-teal" />
        <p className="text-sm text-foreground">
          <span className="font-semibold">{t("Exercicios.estadoPremium")}</span>
          {" · "}
          {t("Exercicios.bannerPremiumTexto")}
        </p>
      </div>
    );
  }

  if (acesso.estado === "trial_ativo") {
    const dias = acesso.trial_dias_restantes ?? 0;
    return (
      <div className="flex flex-col gap-3 rounded-xl border border-teal/30 bg-teal/5 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <Clock className="mt-0.5 h-5 w-5 shrink-0 text-teal" />
          <div>
            <p className="text-sm text-foreground">
              <span className="font-semibold">{t("Exercicios.estadoTrialAtivo")}</span>
              {" · "}
              {dias === 1
                ? t("Exercicios.bannerTrialAtivoUmDia")
                : t("Exercicios.bannerTrialAtivoDias", { dias })}
            </p>
            {dias <= DIAS_FINAIS_TRIAL && <EvolucaoFimTrial />}
          </div>
        </div>
        <Button size="sm" variant="ghost" className="self-start text-navy sm:self-auto" onClick={aoVerPremium}>
          {t("Exercicios.verPlanosPremium")}
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  const config = {
    sem_sessao: {
      titulo: t("Exercicios.bannerSemSessaoTitulo"),
      texto: t("Exercicios.bannerSemSessaoTexto"),
      botao: t("Exercicios.bannerSemSessaoBotao"),
      icon: UserPlus,
      acao: () => void executar("criar_conta"),
    },
    trial_disponivel: {
      titulo: t("Exercicios.estadoTrialDisponivel"),
      texto: t("Exercicios.bannerTrialDisponivelTexto"),
      botao: t("Exercicios.bannerTrialDisponivelBotao"),
      icon: Play,
      acao: () => void executar("iniciar_trial"),
    },
    trial_terminado: {
      titulo: t("Exercicios.estadoTrialTerminado"),
      texto: t("Exercicios.bannerTrialTerminadoTexto"),
      botao: t("Exercicios.verPlanosPremium"),
      icon: Lock,
      acao: aoVerPremium,
    },
  }[acesso.estado];
  const Icon = config.icon;

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-navy/15 bg-card px-5 py-5 shadow-card sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="font-semibold text-foreground">{config.titulo}</p>
        <p className="mt-1 text-sm text-muted-foreground">{config.texto}</p>
        {acesso.estado === "trial_terminado" && <EvolucaoFimTrial />}
      </div>
      <Button
        onClick={config.acao}
        disabled={aIniciarTrial}
        className="h-auto shrink-0 whitespace-normal bg-navy py-2.5 text-navy-foreground hover:bg-navy/90"
      >
        <Icon className="h-4 w-4 shrink-0" />
        {config.botao}
      </Button>
    </div>
  );
};

const CartaoExercicio = ({ ex, grupo }: { ex: Exercicio; grupo: GrupoExercicio }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { loading } = useAcessoExercicios();
  const { tipoPara, executar, aIniciarTrial } = useAcaoDesbloqueio();
  const Icon = ex.icon;
  const tipo = loading ? null : tipoPara(ex.id, grupo);
  const desbloqueado = !loading && tipo === null;
  // Visitante sem sessão: sem botão por cartão -- o único CTA é o do banner
  // ("Criar conta e começar teste de 7 dias"), para o ecrã não repetir 8 vezes.
  const semBotao = tipo === "criar_conta";
  const botao = tipo ? BOTAO_CARTAO[tipo] : null;
  const BotaoIcon = botao?.icon;

  return (
    <article
      className={cn(
        "flex flex-col overflow-hidden rounded-xl border bg-card shadow-card transition-shadow",
        desbloqueado ? "border-border hover:shadow-elevated" : "border-border/80",
      )}
    >
      {/* Miniatura: espaço reservado para o vídeo do personagem animado. */}
      <div className="relative aspect-video overflow-hidden bg-navy/[0.04]">
        {ex.thumbnail ? (
          <img
            src={ex.thumbnail}
            alt=""
            className={cn("h-full w-full object-cover", !desbloqueado && "opacity-60")}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-teal/10 text-teal">
              <Icon className="h-8 w-8" />
            </div>
          </div>
        )}
        <span
          className={cn(
            "absolute left-3 top-3 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium shadow-sm",
            desbloqueado ? "bg-teal text-teal-foreground" : "bg-card text-navy",
          )}
        >
          {desbloqueado ? (
            <CheckCircle2 className="h-3.5 w-3.5" />
          ) : (
            <Lock className="h-3.5 w-3.5" />
          )}
          {desbloqueado ? t("Exercicios.estadoDesbloqueado") : t("Exercicios.estadoBloqueado")}
        </span>
      </div>

      <div className="flex flex-1 flex-col p-5">
        <span
          className={cn(
            "mb-2 self-start rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide",
            ex.tipo === "teste" ? "bg-navy/10 text-navy dark:bg-foreground/10 dark:text-foreground" : "bg-teal/10 text-teal",
          )}
        >
          {ex.tipo === "teste" ? t("Visao.etiquetaTeste") : t("Visao.etiquetaTreino")}
        </span>
        <h3 className="mb-2 text-base font-semibold text-foreground">{ex.title}</h3>
        <p className={cn("flex-1 text-sm text-muted-foreground", !semBotao && "mb-5")}>{ex.description}</p>
        {desbloqueado ? (
          <Button onClick={() => navigate(ex.route)} className="w-full bg-teal text-teal-foreground hover:bg-teal/90">
            <Play className="h-4 w-4" />
            {t("Exercicios.iniciarExercicio")}
          </Button>
        ) : semBotao ? null : (
          <Button
            variant="outline"
            disabled={loading || aIniciarTrial || !tipo}
            onClick={() => tipo && void executar(tipo)}
            className="w-full border-navy/25 text-navy hover:bg-navy/5"
          >
            {BotaoIcon && <BotaoIcon className="h-4 w-4" />}
            {botao ? t(botao.chave) : t("Exercicios.estadoBloqueado")}
          </Button>
        )}
      </div>
    </article>
  );
};

const Exercicios = () => {
  const { t } = useTranslation();
  const { acesso } = useAcessoExercicios();
  const [paywallAberto, setPaywallAberto] = useState(false);

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1">
        <BackButton className="pt-20 md:pt-24" />
        <section className="pt-8 pb-8 bg-background">
          <div className="container text-center max-w-2xl mx-auto">
            <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
              {t("Exercicios.exerciciosVisuaisPraticos")}
            </h1>
            <p className="text-muted-foreground text-base md:text-lg">
              {t("Visao.listaIntro")}
            </p>
            <p className="mt-3 text-xs text-muted-foreground">{t("Visao.listaAviso")}</p>
            {acesso.estado !== "sem_sessao" && (
              <Button asChild variant="outline" size="sm" className="mt-5 gap-2 border-navy/25 text-navy hover:bg-navy/5 dark:text-foreground">
                <Link to={localizar("/exercicios/progresso")}>
                  <LineChart className="h-4 w-4" />
                  {t("Visao.verProgresso")}
                </Link>
              </Button>
            )}
          </div>
        </section>

        <section className="pb-10 bg-background">
          <div className="container">
            <div className="max-w-5xl mx-auto">
              <BannerEstado aoVerPremium={() => setPaywallAberto(true)} />
            </div>
          </div>
        </section>

        {/* Incluídos no teste de 7 dias */}
        <section className="pb-14 bg-background">
          <div className="container">
            <div className="max-w-5xl mx-auto">
              <div className="mb-6">
                <h2 className="text-xl md:text-2xl font-bold text-foreground">{t("Exercicios.grupoTrial")}</h2>
                <p className="mt-1 text-sm text-muted-foreground">{t("Exercicios.grupoTrialDescricao")}</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {exerciciosTrial.map((ex) => (
                  <CartaoExercicio key={ex.id} ex={ex} grupo="trial" />
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Premium */}
        <section className="pb-24 bg-background">
          <div className="container">
            <div className="max-w-5xl mx-auto">
              <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
                <div className="max-w-2xl">
                  <h2 className="text-xl md:text-2xl font-bold text-foreground">
                    {t("Exercicios.grupoPremium")}
                  </h2>
                  <p className="mt-1 text-sm text-muted-foreground">{t("Exercicios.grupoPremiumDescricao")}</p>
                </div>
                {acesso.estado !== "premium" && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-navy/25 text-navy hover:bg-navy/5"
                    onClick={() => setPaywallAberto(true)}
                  >
                    <Lock className="h-4 w-4" />
                    {t("Exercicios.verPlanosPremium")}
                  </Button>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {exerciciosPremium.map((ex) => (
                  <CartaoExercicio key={ex.id} ex={ex} grupo="premium" />
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Mais Dicas no Instagram */}
        <section className="pb-24 bg-background">
          <div className="container">
            <div className="max-w-5xl mx-auto">
              <div className="rounded-xl bg-navy text-navy-foreground overflow-hidden flex flex-col justify-center p-8">
                <h3 className="text-xl font-bold mb-2">
                  {t("Exercicios.maisDicasNoInstagram")}
                </h3>
                <p className="text-navy-foreground/70 text-sm mb-6 max-w-lg">
                  {t("Exercicios.acompanheANossaComunidade")}
                </p>
                <a
                  href="https://www.instagram.com/janelas_para_alma/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 self-start rounded-lg bg-navy-foreground text-navy px-5 py-2.5 text-sm font-semibold hover:opacity-90 transition-opacity"
                >
                  <Instagram className="w-4 h-4" />
                  {t("Exercicios.verNoInstagram")}
                </a>
              </div>
            </div>
          </div>
        </section>
      </main>
      <Footer />
      <FeedbackWidget />
      <PremiumPaywallModal open={paywallAberto} onOpenChange={setPaywallAberto} />
    </div>
  );
};

export default Exercicios;
