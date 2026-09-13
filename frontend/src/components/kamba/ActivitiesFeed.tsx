import { CalendarDays, MapPin } from "lucide-react";
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

        <Card className="max-w-5xl mx-auto overflow-hidden shadow-elevated">
          <CardContent className="p-0 grid md:grid-cols-2">
            <div className="p-8 md:p-10 space-y-4 flex flex-col justify-center">
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
              <h3 className="text-xl font-bold">
                Campanha de Conscientização sobre o Estrabismo
              </h3>
              <p className="text-muted-foreground leading-relaxed whitespace-pre-line">
                Hoje realizou-se a campanha de conscientização sobre o estrabismo pelas ruas da Gamek, na cidade de Luanda.{"\n\n"}
                A comunidade Meu Kamba Estrábico, pertencente ao Janelas para a Alma, efectivou hoje, pelas 9h30 a campanha de conscientização e sensibilização cujo objectivo principal foi transmitir às pessoas informações importantes sobre a condição e apresentar a nossa proposta de valor, a plataforma Janelas para a Alma, onde foi possível abordar diversas pessoas portadoras da condição ou ainda próximos à pessoas com a condição.{"\n\n"}
                Reafirmamos o nosso compromisso com a difusão da informação sobre o estrabismo e saúde visual.{"\n\n"}
                Janelas para a alma - Um olhar alinhado, uma vida transformada.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-1 bg-navy/5">
              <div className="aspect-square sm:aspect-video">
                <video
                  className="w-full h-full object-cover"
                  src="/assets/kamba/campanha-gamek-equipa.mp4"
                  poster="/assets/kamba/campanha-gamek-poster.jpg"
                  controls
                  playsInline
                />
              </div>
              <div className="aspect-square sm:aspect-video">
                <video
                  className="w-full h-full object-cover"
                  src="/assets/kamba/campanha-gamek-rua.mp4"
                  controls
                  playsInline
                />
              </div>
              <div className="col-span-2 aspect-[4/5] sm:aspect-video">
                <img
                  src="/assets/kamba/campanha-gamek-poster.jpg"
                  alt="Cartaz da Campanha de Conscientização sobre o Estrabismo na Gamek"
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </section>
  );
};

export default ActivitiesFeed;
