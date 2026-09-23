import { Play, ArrowRight, Eye, Sparkles, Target, Wind } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useTranslation } from "react-i18next";
import i18n from "@/i18n";
import { localizar } from "@/i18n/rotas";

const exercises = [
  {
    id: "figure8",
    get title() {
      return i18n.t("ExercisesSection.acompanhamentoEmOito");
    },
    get description() {
      return i18n.t("ExercisesSection.fortalecaAMusculaturaOcular");
    },
    icon: Target,
    accent: "text-teal bg-teal/10",
    get route() {
      return localizar("/exercicios/tracking");
    },
  },
  {
    id: "convergence",
    get title() {
      return i18n.t("ExercisesSection.convergencia");
    },
    get description() {
      return i18n.t("ExercisesSection.treineACoordenacaoBinocular");
    },
    icon: Eye,
    accent: "text-navy bg-navy/10",
    get route() {
      return localizar("/exercicios/convergencia");
    },
  },
  {
    id: "depth",
    get title() {
      return i18n.t("ExercisesSection.focoDinamico");
    },
    get description() {
      return i18n.t("ExercisesSection.alterneOFocoEntre");
    },
    icon: Sparkles,
    accent: "text-gold bg-gold/10",
    get route() {
      return localizar("/exercicios/cerebro");
    },
  },
  {
    id: "relax",
    get title() {
      return i18n.t("ExercisesSection.relaxamento");
    },
    get description() {
      return i18n.t("ExercisesSection.sincronizeRespiracaoEPiscar");
    },
    icon: Wind,
    accent: "text-green bg-green/10",
    get route() {
      return localizar("/exercicios/relaxamento");
    },
  },
];

const ExercisesSection = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  return (
    <section id="exercicios-home" className="py-20 md:py-28 bg-gradient-to-b from-background to-muted/40">
      <div className="container">
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6 mb-12">
          <div className="max-w-2xl space-y-3">
            <span className="text-sm font-medium tracking-widest uppercase text-teal">
              {t("ExercisesSection.exerciciosVisuais")}
            </span>
            <h2 className="text-3xl md:text-5xl font-bold text-foreground leading-tight">
              {t("ExercisesSection.treineASuaVisao")}
            </h2>
            <p className="text-base md:text-lg text-muted-foreground leading-relaxed">
              {t("ExercisesSection.quatroExerciciosInteractivosCurtos")}
            </p>
          </div>
          <Button
            size="lg"
            onClick={() => navigate(localizar("/exercicios"))}
            className="self-start lg:self-auto bg-teal text-teal-foreground hover:bg-teal/90"
          >
            <Play className="w-4 h-4" />
            {t("ExercisesSection.iniciarExercicios")}
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
                {t("ExercisesSection.comecar")}{" "}<ArrowRight className="w-4 h-4" />
              </span>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
};

export default ExercisesSection;
