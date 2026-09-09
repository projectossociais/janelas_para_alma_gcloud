import { useState, useRef } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
const pillarSaude = "/pillar-saude.webp";
const pillarEconomia = "/pillar-economia.webp";
const pillarEducacao = "/pillar-educacao-kids.webp";


const pillars = [
  {
    number: "01",
    title: "Saúde Visual e Psicossocial",
    shortDescription:
      "Promovemos o bem-estar físico e psicológico da população afectada pelo estrabismo.",
    description:
      "Promovemos o bem-estar físico e psicológico da população afectada pelo estrabismo. Incluímos triagem, rastreio, encaminhamento para tratamento, apoio psicossocial e sessões terapêuticas para restaurar a auto-estima.",
    image: pillarSaude,
    items: [
      "Triagem e rastreio ocular gratuito",
      "Encaminhamento para tratamento",
      "Apoio psicossocial e sessões terapêuticas",
    ],
  },
  {
    number: "02",
    title: "Economia Circular",
    shortDescription:
      "Sustentabilidade e inovação através do reaproveitamento de materiais e empreendedorismo social.",
    description:
      "Focado na sustentabilidade e inovação, este pilar promove o reaproveitamento de materiais e o empreendedorismo social através de campanhas de recolha, reciclagem e redistribuição de óculos.",
    image: pillarEconomia,
    items: [
      "Recolha e reciclagem de óculos usados",
      "Redistribuição a preços simbólicos",
      "Revenda de materiais reutilizados",
    ],
  },
  {
    number: "03",
    title: "Educação Visual e Ambiental",
    shortDescription:
      "Transformar mentalidades e promover uma cultura de cuidado com a visão e o meio ambiente.",
    description:
      "Transformar mentalidades e promover uma cultura de cuidado com a visão e o meio ambiente por meio de palestras, seminários, rodas de conversa e materiais educativos.",
    image: pillarEducacao,
    items: [
      "Palestras e seminários educativos",
      "Combate ao estigma social",
      "Preservação ambiental",
    ],
  },
];

const PillarsSection = () => {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const scroll = (direction: "left" | "right") => {
    if (!scrollRef.current) return;
    const amount = scrollRef.current.offsetWidth * 0.85;
    scrollRef.current.scrollBy({
      left: direction === "left" ? -amount : amount,
      behavior: "smooth",
    });
  };

  return (
    <section id="pilares" className="py-20 md:py-28 bg-muted/50">
      {/* Preload all pillar images for instant carousel transitions */}
      <div className="hidden" aria-hidden="true">
        {pillars.map((pillar, i) => (
          <img key={i} src={pillar.image} alt="" />
        ))}
      </div>
      <div className="container">
        <div className="text-center mb-16 space-y-4">
          <span className="text-sm font-medium tracking-widest uppercase text-teal">Os Nossos Pilares</span>
          <h2 className="text-3xl md:text-5xl font-bold text-foreground">
            Três pilares de transformação
          </h2>
        </div>

        {/* Carousel */}
        <div className="relative group/carousel">
          <div
            ref={scrollRef}
            className="flex gap-6 overflow-x-auto scroll-smooth snap-x snap-mandatory pb-4 -mx-4 px-4 scrollbar-hide touch-pan-x"
            style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
          >
            {pillars.map((pillar, i) => (
              <button
                key={i}
                onClick={() => setOpenIndex(i)}
                className="snap-start shrink-0 w-[85%] sm:w-[70%] md:w-[45%] lg:w-[32%] rounded-2xl overflow-hidden bg-card shadow-card border border-border/50 transition-all hover:shadow-elevated hover:scale-[1.02] cursor-pointer text-left focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 group"
              >
                <div className="relative aspect-[4/3] overflow-hidden">
                  <img
                    src={pillar.image}
                    alt={pillar.title}
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                  />
                  <div className="absolute top-4 left-4 bg-navy text-navy-foreground px-3 py-1.5 rounded-lg font-bold text-sm">
                    {pillar.number}
                  </div>
                </div>
                <div className="p-6 space-y-3">
                  <h3 className="text-xl font-bold text-foreground">{pillar.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed line-clamp-2">
                    {pillar.shortDescription}
                  </p>
                  <span className="inline-block text-xs text-teal font-medium">Saber mais →</span>
                </div>
              </button>
            ))}
          </div>

          {/* Navigation arrows — visible below lg, fade on hover */}
          <button
            onClick={() => scroll("left")}
            className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-2 flex lg:hidden items-center justify-center w-10 h-10 rounded-full bg-card shadow-elevated border border-border/50 text-foreground hover:bg-muted z-10 opacity-0 group-hover/carousel:opacity-100 transition-opacity duration-300"
            aria-label="Anterior"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button
            onClick={() => scroll("right")}
            className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-2 flex lg:hidden items-center justify-center w-10 h-10 rounded-full bg-card shadow-elevated border border-border/50 text-foreground hover:bg-muted z-10 opacity-0 group-hover/carousel:opacity-100 transition-opacity duration-300"
            aria-label="Próximo"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Modals */}
      {pillars.map((pillar, i) => (
        <Dialog key={i} open={openIndex === i} onOpenChange={(v) => !v && setOpenIndex(null)}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-3 text-xl">
                <span className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-navy text-navy-foreground font-bold text-sm">
                  {pillar.number}
                </span>
                {pillar.title}
              </DialogTitle>
              <DialogDescription className="sr-only">
                Detalhes sobre {pillar.title}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-5 pt-2">
              <div className="rounded-xl overflow-hidden">
                <img
                  src={pillar.image}
                  alt={pillar.title}
                  className="w-full aspect-video object-cover"
                />
              </div>
              <p className="text-muted-foreground leading-relaxed">{pillar.description}</p>
              <ul className="space-y-2">
                {pillar.items.map((item, j) => (
                  <li key={j} className="flex items-start gap-3">
                    <span className="mt-1.5 w-2 h-2 rounded-full bg-teal flex-shrink-0" />
                    <span className="text-foreground text-sm">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </DialogContent>
        </Dialog>
      ))}
    </section>
  );
};

export default PillarsSection;
