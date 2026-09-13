import { Link } from "react-router-dom";
import { CalendarDays, MapPin, PlayCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

const ActivitiesFeed = () => {
  return (
    <section id="acoes-recentes" className="py-20 md:py-28 bg-background">
      <div className="container">
        <div className="max-w-2xl mx-auto text-center space-y-4 mb-12">
          <span className="text-sm font-medium tracking-widest uppercase text-teal">
            Ações Recentes
          </span>
          <h2 className="text-3xl md:text-4xl font-bold">
            No Terreno com a Comunidade
          </h2>
        </div>

        <Card className="max-w-3xl mx-auto overflow-hidden shadow-elevated">
          <CardContent className="p-8 md:p-10 flex flex-col items-center text-center gap-6">
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <CalendarDays className="w-4 h-4" />
                12 de Setembro
              </span>
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="w-4 h-4" />
                Gamek, Luanda
              </span>
            </div>

            <h3 className="text-2xl font-bold">
              Campanha de Conscientização sobre o Estrabismo
            </h3>

            <p className="text-muted-foreground leading-relaxed max-w-xl">
              Acompanhe de perto a nossa ação nas ruas da Gamek, onde os nossos jovens embaixadores partilharam informação, combateram o estigma e apresentaram a plataforma Janelas Para a Alma à comunidade. Clique abaixo para viver esta experiência!
            </p>

            <img
              src="/assets/kamba/campanha-gamek-poster.jpg"
              alt="Cartaz da Campanha de Conscientização sobre o Estrabismo na Gamek"
              className="w-full max-w-xl mx-auto rounded-xl object-contain"
              loading="lazy"
            />

            <Link
              to="/meu-kamba/campanha-gamek"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-teal text-teal-foreground font-bold shadow-elevated transition-all hover:opacity-90 hover:translate-y-[-2px]"
            >
              <PlayCircle className="w-5 h-5" />
              Ver Campanha Completa
            </Link>
          </CardContent>
        </Card>
      </div>
    </section>
  );
};

export default ActivitiesFeed;
