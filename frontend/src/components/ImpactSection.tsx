import { useState, useRef } from "react";
import { Recycle, TreePine, Users, Glasses, ChevronLeft, ChevronRight } from "lucide-react";
import impactSocial from "@/assets/impact-social.jpg";
import impactEcologico from "@/assets/impact-ecologico.jpg";
import impactClimatico from "@/assets/impact-climatico.jpg";
import impactEducacional from "@/assets/impact-educacional.jpg";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

const impacts = [
  {
    icon: Users,
    title: "Impacto Social",
    description: "Inclusão visual com óculos acessíveis e métodos de tratamento para maior auto-estima e qualidade de vida.",
    color: "bg-teal/10 text-teal",
    image: impactSocial,
    modalContent:
      "O Janelas para a Alma promove a inclusão visual através da distribuição de óculos acessíveis e métodos de tratamento adaptados à realidade angolana. Ao devolver a capacidade de ver correctamente, restauramos a auto-estima e qualidade de vida de crianças, jovens e adultos que vivem com estrabismo. O impacto estende-se às famílias e comunidades, quebrando o ciclo de exclusão social associado às condições visuais não tratadas.",
  },
  {
    icon: Recycle,
    title: "Impacto Ecológico",
    description: "Redução de resíduos através do reaproveitamento de óculos e materiais recicláveis.",
    color: "bg-green/10 text-green",
    image: impactEcologico,
    modalContent:
      "Através da recolha e reaproveitamento de óculos usados e materiais recicláveis, o Janelas para a Alma contribui directamente para a redução de resíduos sólidos. Cada par de óculos reutilizado representa menos lixo nos aterros e menos recursos naturais consumidos na fabricação de novos. Este modelo de economia circular transforma resíduos em instrumentos de transformação social.",
  },
  {
    icon: TreePine,
    title: "Impacto Climático",
    description: "Menor consumo industrial e pegada de carbono reduzida através de práticas sustentáveis.",
    color: "bg-gold/10 text-gold",
    image: impactClimatico,
    modalContent:
      "Ao reduzir a necessidade de fabricação de novos óculos e promover práticas sustentáveis, o Janelas para a Alma contribui para a diminuição da pegada de carbono. O menor consumo industrial significa menos emissões de gases de efeito estufa, menos energia consumida e menos recursos naturais extraídos. Cada acção local tem um efeito positivo no combate às alterações climáticas globais.",
  },
  {
    icon: Glasses,
    title: "Impacto Educacional",
    description: "Oficinas e campanhas para formar jovens conscientes e multiplicadores de conhecimento.",
    color: "bg-sky/10 text-sky",
    image: impactEducacional,
    modalContent:
      "As oficinas educativas e campanhas de sensibilização formam jovens conscientes que se tornam multiplicadores de conhecimento nas suas comunidades. Através da educação sobre saúde visual e sustentabilidade ambiental, criamos uma rede de agentes de mudança que perpetuam o impacto do Janelas para a Alma muito além do seu alcance directo.",
  },
];

const ImpactSection = () => {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const scroll = (direction: "left" | "right") => {
    if (!scrollRef.current) return;
    const amount = scrollRef.current.offsetWidth * 0.75;
    scrollRef.current.scrollBy({
      left: direction === "left" ? -amount : amount,
      behavior: "smooth",
    });
  };

  return (
    <section id="impacto" className="py-20 md:py-28 bg-navy text-navy-foreground">
      {/* Preload impact images */}
      <div className="hidden" aria-hidden="true">
        {impacts.map((impact, i) => (
          <img key={i} src={impact.image} alt="" />
        ))}
      </div>
      <div className="container">
        <div className="text-center mb-16 space-y-4">
          <span className="text-sm font-medium tracking-widest uppercase text-teal">Impacto</span>
          <h2 className="text-3xl md:text-5xl font-bold">
            Cuidar das pessoas e do planeta
          </h2>
          <p className="text-lg text-navy-foreground/70 max-w-2xl mx-auto">
            Ao transformar desafios em oportunidades, o Janelas para a Alma constrói uma ponte entre inclusão social e economia circular.
          </p>
        </div>

        {/* Carousel */}
        <div className="relative group/carousel">
          <div
            ref={scrollRef}
            className="flex gap-6 overflow-x-auto scroll-smooth snap-x snap-mandatory pb-4 -mx-4 px-4 touch-pan-x"
            style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
          >
            {impacts.map((impact, i) => (
              <button
                key={i}
                onClick={() => setOpenIndex(i)}
                className="snap-start shrink-0 w-[80%] sm:w-[60%] md:w-[45%] lg:w-[24%] p-8 rounded-2xl bg-navy-foreground/5 border border-navy-foreground/10 backdrop-blur transition-all hover:bg-navy-foreground/10 hover:scale-[1.03] cursor-pointer text-left focus:outline-none focus:ring-2 focus:ring-teal focus:ring-offset-2 focus:ring-offset-navy"
              >
                <div className={`inline-flex items-center justify-center w-14 h-14 rounded-xl ${impact.color} mb-6`}>
                  <impact.icon className="w-7 h-7" />
                </div>
                <h3 className="text-xl font-bold mb-3 text-navy-foreground">{impact.title}</h3>
                <p className="text-navy-foreground/70 leading-relaxed text-sm">{impact.description}</p>
                <p className="text-xs text-teal mt-4 font-medium">Saber mais →</p>
              </button>
            ))}
          </div>

          {/* Navigation arrows — visible below lg, fade on hover */}
          <button
            onClick={() => scroll("left")}
            className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-2 flex lg:hidden items-center justify-center w-10 h-10 rounded-full bg-navy-foreground/10 border border-navy-foreground/10 text-navy-foreground hover:bg-navy-foreground/20 z-10 opacity-0 group-hover/carousel:opacity-100 transition-opacity duration-300"
            aria-label="Anterior"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button
            onClick={() => scroll("right")}
            className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-2 flex lg:hidden items-center justify-center w-10 h-10 rounded-full bg-navy-foreground/10 border border-navy-foreground/10 text-navy-foreground hover:bg-navy-foreground/20 z-10 opacity-0 group-hover/carousel:opacity-100 transition-opacity duration-300"
            aria-label="Próximo"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>

      {impacts.map((impact, i) => (
        <Dialog key={i} open={openIndex === i} onOpenChange={(v) => !v && setOpenIndex(null)}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-3 text-xl">
                <div className={`inline-flex items-center justify-center w-10 h-10 rounded-xl ${impact.color}`}>
                  <impact.icon className="w-5 h-5" />
                </div>
                {impact.title}
              </DialogTitle>
              <DialogDescription className="sr-only">
                Detalhes sobre {impact.title}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-5 pt-2">
              <img
                src={impact.image}
                alt={impact.title}
                className="w-full h-48 md:h-64 object-cover rounded-xl mb-6 shadow-sm"
              />
              <p className="text-muted-foreground leading-relaxed text-justify">{impact.modalContent}</p>
            </div>
          </DialogContent>
        </Dialog>
      ))}
    </section>
  );
};

export default ImpactSection;
