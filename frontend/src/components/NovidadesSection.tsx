import { useRef } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, ChevronRight, ImageIcon } from "lucide-react";

const novidades = [
  {
    date: "Setembro 2026",
    title: "Rastreio ocular chega a mais três escolas em Luanda",
    excerpt:
      "Alargámos as campanhas de rastreio gratuito a novas escolas, identificando precocemente sinais de estrabismo e ambliopia.",
    to: "/impacto",
  },
  {
    date: "Agosto 2026",
    title: "Campanha de recolha de óculos usados ultrapassa meta",
    excerpt:
      "Graças aos nossos parceiros, mais óculos reaproveitados estão a devolver visão nítida a quem mais precisa.",
    to: "/circular",
  },
  {
    date: "Julho 2026",
    title: "Novos exercícios de terapia visual disponíveis na plataforma",
    excerpt:
      "Lançámos mais exercícios de acompanhamento ocular pensados para tornar a terapia visual mais acessível.",
    to: "/exercicios",
  },
];

const NovidadesSection = () => {
  const navigate = useNavigate();
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
    <section className="py-16 md:py-24 bg-muted/50">
      <div className="container">
        <div className="text-center mb-12 space-y-4">
          <span className="text-sm font-medium tracking-widest uppercase text-teal">
            Fique por dentro
          </span>
          <h2 className="text-3xl md:text-5xl font-bold text-foreground">Novidades</h2>
        </div>

        <div className="relative group/carousel">
          <div
            ref={scrollRef}
            className="flex gap-6 overflow-x-auto scroll-smooth snap-x snap-mandatory pb-4 -mx-4 px-4 scrollbar-hide touch-pan-x"
            style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
          >
            {novidades.map((item, i) => (
              <button
                key={i}
                onClick={() => navigate(item.to)}
                className="snap-start shrink-0 w-[85%] sm:w-[70%] md:w-[45%] lg:w-[32%] rounded-2xl overflow-hidden bg-card shadow-card border border-border/50 transition-all hover:shadow-elevated hover:scale-[1.02] cursor-pointer text-left focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 group flex flex-col"
              >
                <div className="relative aspect-[16/10] overflow-hidden bg-gradient-to-br from-teal/15 to-navy/10 flex items-center justify-center">
                  <ImageIcon className="w-10 h-10 text-teal/40" />
                  <span className="absolute top-4 left-4 bg-navy text-navy-foreground px-3 py-1 rounded-lg font-semibold text-xs">
                    {item.date}
                  </span>
                </div>
                <div className="p-6 space-y-3 flex flex-col flex-1">
                  <h3 className="text-lg font-bold text-foreground leading-snug">
                    {item.title}
                  </h3>
                  <p className="text-sm text-muted-foreground leading-relaxed line-clamp-3">
                    {item.excerpt}
                  </p>
                  <span className="inline-block text-sm text-teal font-medium mt-auto pt-2">
                    Saiba mais...
                  </span>
                </div>
              </button>
            ))}
          </div>

          <button
            onClick={() => scroll("left")}
            className="absolute left-0 top-1/3 -translate-y-1/2 -translate-x-2 flex lg:hidden items-center justify-center w-10 h-10 rounded-full bg-card shadow-elevated border border-border/50 text-foreground hover:bg-muted z-10 opacity-0 group-hover/carousel:opacity-100 transition-opacity duration-300"
            aria-label="Anterior"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button
            onClick={() => scroll("right")}
            className="absolute right-0 top-1/3 -translate-y-1/2 translate-x-2 flex lg:hidden items-center justify-center w-10 h-10 rounded-full bg-card shadow-elevated border border-border/50 text-foreground hover:bg-muted z-10 opacity-0 group-hover/carousel:opacity-100 transition-opacity duration-300"
            aria-label="Próximo"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>
    </section>
  );
};

export default NovidadesSection;
