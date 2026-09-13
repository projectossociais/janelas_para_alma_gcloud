import { useState } from "react";
import { CalendarDays, MapPin, PlayCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

interface GalleryVideo {
  src: string;
  description: string;
}

const galleryVideos: GalleryVideo[] = [
  {
    src: "/assets/kamba/campanha-conscientizacao.mp4",
    description: "Resumo da Campanha de Conscientização nas ruas da Gamek.",
  },
  {
    src: "/assets/kamba/dalva-introducao.mp4",
    description: "Dalva apresenta o impacto e a missão do projeto.",
  },
  {
    src: "/assets/kamba/jpa-grupo.mp4",
    description: "A nossa equipa unida pela causa Janelas Para a Alma.",
  },
  {
    src: "/assets/kamba/kambas.mp4",
    description: "Os nossos Kambas em ação no terreno.",
  },
];

const ActivitiesFeed = () => {
  const [galleryOpen, setGalleryOpen] = useState(false);

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

            <div className="relative bg-navy/5 flex items-center justify-center p-4 md:p-6">
              <img
                src="/assets/kamba/campanha-gamek-poster.jpg"
                alt="Cartaz da Campanha de Conscientização sobre o Estrabismo na Gamek"
                className="w-full h-auto max-h-[420px] object-contain rounded-lg"
                loading="lazy"
              />
              <button
                onClick={() => setGalleryOpen(true)}
                className="absolute bottom-8 inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-teal text-teal-foreground font-bold shadow-elevated transition-all hover:opacity-90 hover:translate-y-[-2px]"
              >
                <PlayCircle className="w-5 h-5" />
                Ver Campanha Completa
              </button>
            </div>
          </CardContent>
        </Card>
      </div>

      <Dialog open={galleryOpen} onOpenChange={setGalleryOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Campanha de Conscientização sobre o Estrabismo</DialogTitle>
            <DialogDescription>
              Reviva os momentos da campanha na Gamek através dos vídeos abaixo.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
            {galleryVideos.map((video) => (
              <div key={video.src} className="space-y-2">
                <video controls preload="metadata" className="w-full rounded-lg" src={video.src} />
                <p className="text-sm text-muted-foreground">{video.description}</p>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
};

export default ActivitiesFeed;
