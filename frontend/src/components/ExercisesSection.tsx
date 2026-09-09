import { Play, ArrowRight, Eye, Sparkles, Target, Wind } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";

const exercises = [
  {
    id: "figure8",
    title: "Acompanhamento em Oito",
    description: "Fortaleça a musculatura ocular seguindo o movimento suave em forma de oito.",
    icon: Target,
    accent: "text-teal bg-teal/10",
    route: "/exercicios/tracking",
  },
  {
    id: "convergence",
    title: "Convergência",
    description: "Treine a coordenação binocular, unindo os pontos no centro do olhar.",
    icon: Eye,
    accent: "text-navy bg-navy/10",
    route: "/exercicios/convergencia",
  },
  {
    id: "depth",
    title: "Foco Dinâmico",
    description: "Alterne o foco entre perto e longe para trabalhar a flexibilidade visual.",
    icon: Sparkles,
    accent: "text-gold bg-gold/10",
    route: "/exercicios/cerebro",
  },
  {
    id: "relax",
    title: "Relaxamento",
    description: "Sincronize respiração e piscar para aliviar a tensão dos ecrãs.",
    icon: Wind,
    accent: "text-green bg-green/10",
    route: "/exercicios/relaxamento",
  },
];

const ExercisesSection = () => {
  const navigate = useNavigate();

  return (
    <section id="exercicios-home" className="py-20 md:py-28 bg-gradient-to-b from-background to-muted/40">
      <div className="container">
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6 mb-12">
          <div className="max-w-2xl space-y-3">
            <span className="text-sm font-medium tracking-widest uppercase text-teal">
              Exercícios Visuais
            </span>
            <h2 className="text-3xl md:text-5xl font-bold text-foreground leading-tight">
              Treine a sua visão, todos os dias
            </h2>
            <p className="text-base md:text-lg text-muted-foreground leading-relaxed">
              Quatro exercícios interactivos, curtos e cientificamente inspirados para fortalecer
              os músculos oculares, aliviar a tensão e melhorar o foco.
            </p>
          </div>
          <Button
            size="lg"
            onClick={() => navigate("/exercicios")}
            className="self-start lg:self-auto bg-teal text-teal-foreground hover:bg-teal/90"
          >
            <Play className="w-4 h-4" />
            Iniciar Exercícios
          </Button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {exercises.map((ex) => (
            <button
              key={ex.id}
              type="button"
              onClick={() => navigate(ex.route)}
              className="group text-left rounded-2xl border border-border/60 bg-card p-6 shadow-card hover:shadow-elevated hover:-translate-y-1 transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
            >
              <div className={`inline-flex items-center justify-center w-12 h-12 rounded-xl ${ex.accent} mb-4`}>
                <ex.icon className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-2">{ex.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed mb-4">
                {ex.description}
              </p>
              <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-teal group-hover:gap-2 transition-all">
                Começar <ArrowRight className="w-4 h-4" />
              </span>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
};

export default ExercisesSection;
