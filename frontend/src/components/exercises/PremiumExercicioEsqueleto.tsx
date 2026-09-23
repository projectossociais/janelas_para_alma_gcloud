import { ArrowLeft, type LucideIcon } from "lucide-react";
import { Link } from "react-router-dom";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import BaseExercise from "@/components/exercises/BaseExercise";

interface PremiumExercicioEsqueletoProps {
  title: string;
  description: string;
  icon: LucideIcon;
}

/**
 * Esqueleto funcional para os exercícios Premium ainda por desenvolver:
 * navegável e desbloqueável (via BaseExercise isPremium), mas sem mecânica
 * própria. Ver AmbliopiaExercise.tsx para o primeiro exercício completo --
 * os restantes seguem o mesmo padrão quando forem desenvolvidos.
 */
const PremiumExercicioEsqueleto = ({
  title,
  description,
  icon: Icon,
}: PremiumExercicioEsqueletoProps) => {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1 pt-24 pb-16">
        <div className="container max-w-4xl mx-auto">
          <Button variant="ghost" asChild className="mb-6">
            <Link to="/exercicios">
              <ArrowLeft className="w-4 h-4" />
              Voltar ao Menu
            </Link>
          </Button>

          <BaseExercise title={title} description={description} isPremium={true}>
            <div className="flex h-[350px] flex-col items-center justify-center gap-4 p-6 text-center">
              <Icon className="h-10 w-10 text-teal" />
              <p className="max-w-sm text-sm text-muted-foreground">
                Este exercício ainda está a ser preparado e chega em breve. O seu
                acesso Premium já está activo, por isso vai poder usá-lo assim que
                estiver pronto.
              </p>
            </div>
          </BaseExercise>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default PremiumExercicioEsqueleto;
