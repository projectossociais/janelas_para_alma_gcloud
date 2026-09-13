import { useEffect, useState } from "react";
import Autoplay from "embla-carousel-autoplay";
import { HeartHandshake, BookOpen, Images } from "lucide-react";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  type CarouselApi,
} from "@/components/ui/carousel";
import { cn } from "@/lib/utils";

interface KambaHeroCarouselProps {
  onOpenForm: () => void;
  onOpenProgram: () => void;
}

const KambaHeroCarousel = ({ onOpenForm, onOpenProgram }: KambaHeroCarouselProps) => {
  const [api, setApi] = useState<CarouselApi>();
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    if (!api) return;

    setCurrent(api.selectedScrollSnap());
    api.on("select", () => setCurrent(api.selectedScrollSnap()));
  }, [api]);

  const scrollToAcoes = () => {
    document.getElementById("acoes-recentes")?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div className="relative">
      <Carousel
        setApi={setApi}
        opts={{ loop: true }}
        plugins={[Autoplay({ delay: 6000, stopOnInteraction: false })]}
      >
        <CarouselContent className="-ml-0">
          {/* Slide 1: Programa Meu Kamba Estrábico */}
          <CarouselItem className="pl-0">
            <div className="container">
              <div className="max-w-4xl mx-auto text-center space-y-6 py-4">
                <span className="text-sm font-medium tracking-widest uppercase text-teal">
                  Programa Meu Kamba Estrábico
                </span>
                <h2 className="text-3xl md:text-5xl font-bold">
                  Torna-te um Kamba
                </h2>
                <p className="text-lg text-navy-foreground/70 max-w-2xl mx-auto">
                  Junta-te a nós como voluntário e ajuda a transformar vidas. Cada
                  "kamba" (amigo) faz a diferença na luta pela inclusão visual.
                </p>
                <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                  <button
                    onClick={onOpenForm}
                    className="inline-flex items-center gap-3 px-10 py-5 rounded-xl bg-teal text-teal-foreground font-bold text-lg transition-all hover:opacity-90 hover:translate-y-[-2px] hover:shadow-2xl shadow-elevated"
                  >
                    <HeartHandshake className="w-6 h-6" />
                    Quero ser um Kamba
                  </button>
                  <button
                    onClick={onOpenProgram}
                    className="inline-flex items-center gap-3 px-8 py-5 rounded-xl border border-navy-foreground/20 text-navy-foreground font-medium text-lg transition-all hover:bg-navy-foreground/10 hover:translate-y-[-2px]"
                  >
                    <BookOpen className="w-5 h-5" />
                    Saber Mais
                  </button>
                </div>
              </div>
            </div>
          </CarouselItem>

          {/* Slide 2: Campanha de Conscientização na Gamek */}
          <CarouselItem className="pl-0">
            <div className="container">
              <div className="max-w-5xl mx-auto grid md:grid-cols-2 gap-8 items-center py-4">
                <div className="text-center md:text-left space-y-5">
                  <span className="text-sm font-medium tracking-widest uppercase text-teal">
                    Ação no Terreno
                  </span>
                  <h2 className="text-3xl md:text-4xl font-bold leading-tight">
                    Campanha de Conscientização na Gamek
                  </h2>
                  <p className="text-lg text-navy-foreground/70">
                    A comunidade Meu Kamba Estrábico esteve nas ruas da Gamek, em
                    Luanda, a sensibilizar a população sobre o estrabismo e a
                    apresentar a plataforma Janelas para a Alma.
                  </p>
                  <div className="flex flex-col sm:flex-row items-center justify-center md:justify-start gap-4">
                    <button
                      onClick={scrollToAcoes}
                      className="inline-flex items-center gap-3 px-8 py-4 rounded-xl bg-teal text-teal-foreground font-bold transition-all hover:opacity-90 hover:translate-y-[-2px] hover:shadow-2xl shadow-elevated"
                    >
                      <Images className="w-5 h-5" />
                      Ver Galeria da Ação
                    </button>
                  </div>
                </div>
                <div className="rounded-2xl overflow-hidden shadow-elevated border border-navy-foreground/10 aspect-[4/5] md:aspect-square">
                  <video
                    className="w-full h-full object-cover"
                    src="/assets/kamba/campanha-gamek-equipa.mp4"
                    poster="/assets/kamba/campanha-gamek-poster.jpg"
                    autoPlay
                    muted
                    loop
                    playsInline
                  />
                </div>
              </div>
            </div>
          </CarouselItem>
        </CarouselContent>
      </Carousel>

      <div className="flex items-center justify-center gap-2 mt-8">
        {[0, 1].map((index) => (
          <button
            key={index}
            aria-label={`Ir para o slide ${index + 1}`}
            onClick={() => api?.scrollTo(index)}
            className={cn(
              "h-2.5 rounded-full transition-all",
              current === index ? "w-8 bg-teal" : "w-2.5 bg-navy-foreground/20",
            )}
          />
        ))}
      </div>
    </div>
  );
};

export default KambaHeroCarousel;
