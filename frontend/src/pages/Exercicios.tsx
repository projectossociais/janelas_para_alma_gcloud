import { useState } from "react";
import {
  Instagram,
  ArrowRight,
  Play,
  Lock,
  Crown,
  Sparkles,
  Glasses,
  Zap,
  RefreshCw,
  Focus,
  Layers,
  GitMerge,
  Radar,
  Infinity as InfinityIcon,
  Minimize2,
  Target,
  Wind,
  type LucideIcon,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import BackButton from "@/components/BackButton";
import { Button } from "@/components/ui/button";
import LockedVideoOverlay from "@/components/LockedVideoOverlay";
import PremiumPaywallModal from "@/components/PremiumPaywallModal";
import FeedbackWidget from "@/components/FeedbackWidget";
import { useProfile } from "@/contexts/ProfileContext";

interface ExercicioBase {
  id: string;
  title: string;
  description: string;
  icon: LucideIcon;
  route: string;
}

const exerciciosBase: ExercicioBase[] = [
  {
    id: "figure8",
    title: "Acompanhamento Ocular em Oito",
    description:
      "Siga o ponto com os olhos o mais suavemente possível, sem mover a cabeça. Ajuda a fortalecer a musculatura ocular.",
    icon: InfinityIcon,
    route: "/exercicios/tracking",
  },
  {
    id: "convergence",
    title: "Treino de Convergência",
    description:
      "Foque nos pontos enquanto eles se unem no centro. Tente manter a imagem única o máximo de tempo possível.",
    icon: Minimize2,
    route: "/exercicios/convergencia",
  },
  {
    id: "depth",
    title: "Foco Dinâmico",
    description:
      "Encontre e fixe o olhar na forma que pulsa entre as restantes, treinando o foco e a atenção visual.",
    icon: Target,
    route: "/exercicios/cerebro",
  },
  {
    id: "relax",
    title: "Relaxamento e Respiração",
    description:
      "Sincronize a sua respiração com a orbe. Pode cobrir os olhos a qualquer momento (Palming) para relaxar ainda mais.",
    icon: Wind,
    route: "/exercicios/relaxamento",
  },
];

interface ExercicioPremium {
  id: string;
  title: string;
  description: string;
  icon: LucideIcon;
  route: string;
}

const exerciciosPremium: ExercicioPremium[] = [
  {
    id: "ambliopia",
    title: "Anti-Supressão / Ambliopia",
    description:
      "Encontre o alvo entre distractores cada vez mais parecidos, forçando o olho mais fraco a trabalhar sozinho.",
    icon: Glasses,
    route: "/exercicios/ambliopia",
  },
  {
    id: "sacadas-convergencia",
    title: "Convergência com Saltos (Sacadas)",
    description:
      "Alterna rapidamente o foco entre alvos próximos e distantes, treinando a convergência dinâmica.",
    icon: Zap,
    route: "/exercicios/sacadas-convergencia",
  },
  {
    id: "flexibilidade-acomodativa",
    title: "Flexibilidade Acomodativa",
    description:
      "Muda de foco entre perto e longe a um ritmo crescente para treinar a rapidez de acomodação do olho.",
    icon: RefreshCw,
    route: "/exercicios/flexibilidade-acomodativa",
  },
  {
    id: "sacadas-distratores",
    title: "Sacadas com Distratores",
    description:
      "Encontre o alvo certo entre distractores em movimento, apurando o controlo dos movimentos sacádicos.",
    icon: Focus,
    route: "/exercicios/sacadas-distratores",
  },
  {
    id: "estereopsia",
    title: "Estereopsia (Visão 3D)",
    description: "Padrões estereoscópicos avaliam e treinam a percepção de profundidade binocular.",
    icon: Layers,
    route: "/exercicios/estereopsia",
  },
  {
    id: "facilidade-vergencia",
    title: "Facilidade de Vergência",
    description:
      "Alterna entre convergência e divergência em ciclos cronometrados para ganhar resistência binocular.",
    icon: GitMerge,
    route: "/exercicios/facilidade-vergencia",
  },
  {
    id: "consciencia-periferica",
    title: "Consciência Periférica",
    description: "Detecte estímulos na periferia do campo visual sem desviar o olhar do centro.",
    icon: Radar,
    route: "/exercicios/consciencia-periferica",
  },
  {
    id: "programa-ia",
    title: "Programa Adaptativo com IA",
    description:
      "Um algoritmo ajusta a dificuldade de cada sessão em tempo real, de acordo com o seu progresso.",
    icon: Sparkles,
    route: "/exercicios/programa-ia",
  },
];

const Exercicios = () => {
  const navigate = useNavigate();
  const { profile } = useProfile();
  const [paywallAberto, setPaywallAberto] = useState(false);

  const temAcessoPremium = !!profile && (profile.premium_ativo || profile.papel === "admin");

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1">
        <BackButton className="pt-20 md:pt-24" />
        <section className="pt-8 pb-12 bg-background">
          <div className="container text-center max-w-2xl mx-auto">
            <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
              Exercícios Visuais Práticos
            </h1>
            <p className="text-muted-foreground text-base md:text-lg">
              Aprende técnicas simples e interativas para fortalecer a tua visão
              no dia a dia.
            </p>
          </div>
        </section>

        {/* Plano Gratuito */}
        <section className="pb-16 bg-background">
          <div className="container">
            <div className="max-w-5xl mx-auto">
              <div className="mb-8 flex items-center gap-3">
                <h2 className="text-xl md:text-2xl font-bold text-foreground">Plano Gratuito</h2>
                <span className="rounded-full bg-teal/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-teal">
                  Incluído
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {exerciciosBase.map((ex) => {
                  const Icon = ex.icon;
                  return (
                    <div
                      key={ex.id}
                      className="rounded-xl border border-border bg-card shadow-card overflow-hidden flex flex-col"
                    >
                      <div className="aspect-video flex items-center justify-center bg-gradient-to-br from-slate-800 to-slate-900">
                        <Icon className="w-12 h-12 text-white/80" />
                      </div>
                      <div className="p-6 flex flex-col flex-1">
                        <h3 className="text-lg font-semibold text-foreground mb-2">
                          {ex.title}
                        </h3>
                        <p className="text-sm text-muted-foreground mb-4 flex-1">
                          {ex.description}
                        </p>
                        <Button onClick={() => navigate(ex.route)} className="self-start">
                          <Play className="w-4 h-4" />
                          Iniciar Exercício Interativo
                          <ArrowRight className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        {/* Plano Premium */}
        <section className="pb-32 bg-gradient-to-b from-navy/[0.04] via-background to-background">
          <div className="container">
            <div className="max-w-5xl mx-auto">
              <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <h2 className="text-xl md:text-2xl font-bold text-foreground">Plano Premium</h2>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-teal to-navy px-3 py-1 text-xs font-semibold uppercase tracking-wider text-primary-foreground shadow-sm">
                    <Sparkles className="h-3 w-3" />
                    Exercícios Avançados
                  </span>
                </div>
                {!temAcessoPremium && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-gold/40 text-navy hover:bg-gold/10"
                    onClick={() => setPaywallAberto(true)}
                  >
                    <Crown className="h-4 w-4" />
                    Desbloquear tudo
                  </Button>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {exerciciosPremium.map((ex) => {
                  const Icon = ex.icon;

                  if (temAcessoPremium) {
                    return (
                      <div
                        key={ex.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => navigate(ex.route)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") navigate(ex.route);
                        }}
                        className="cursor-pointer rounded-xl border border-border bg-card shadow-card overflow-hidden flex flex-col transition-all hover:-translate-y-0.5 hover:shadow-elevated"
                      >
                        <div className="aspect-video flex items-center justify-center bg-gradient-to-br from-navy to-teal/70">
                          <Icon className="h-10 w-10 text-primary-foreground" />
                        </div>
                        <div className="p-5 flex flex-col flex-1">
                          <h3 className="text-base font-semibold text-foreground mb-2">
                            {ex.title}
                          </h3>
                          <p className="text-sm text-muted-foreground flex-1">{ex.description}</p>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div
                      key={ex.id}
                      className="rounded-xl border border-gold/30 bg-gradient-to-b from-navy/[0.06] to-card shadow-card overflow-hidden flex flex-col"
                    >
                      <LockedVideoOverlay title={ex.title} />
                      <div
                        role="button"
                        tabIndex={0}
                        onClick={() => setPaywallAberto(true)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") setPaywallAberto(true);
                        }}
                        className="cursor-pointer p-5 flex flex-col flex-1"
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="text-base font-semibold text-foreground">{ex.title}</h3>
                          <Lock className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        </div>
                        <p className="text-sm text-muted-foreground flex-1">{ex.description}</p>
                      </div>
                    </div>
                  );
                })}
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
                  Mais Dicas no Instagram
                </h3>
                <p className="text-navy-foreground/70 text-sm mb-6 max-w-lg">
                  Acompanhe a nossa comunidade de Kambas nas redes sociais para
                  desafios visuais diários, dicas de saúde e atualizações sobre
                  o projeto.
                </p>
                <a
                  href="https://www.instagram.com/janelas_para_alma/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 self-start rounded-lg bg-navy-foreground text-navy px-5 py-2.5 text-sm font-semibold hover:opacity-90 transition-opacity"
                >
                  <Instagram className="w-4 h-4" />
                  Ver no Instagram
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
