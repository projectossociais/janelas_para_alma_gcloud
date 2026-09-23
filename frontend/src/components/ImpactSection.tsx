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
import { Trans, useTranslation } from "react-i18next";
import i18n from "@/i18n";

const impacts = [
  {
    icon: Users,
    get title() {
      return i18n.t("ImpactSection.impactoSocial");
    },
    get description() {
      return i18n.t("ImpactSection.inclusaoVisualComOculos");
    },
    color: "bg-teal/10 text-teal",
    image: impactSocial,
    get modalContent() {
      return i18n.t("ImpactSection.oJanelasParaA");
    },
  },
  {
    icon: Recycle,
    get title() {
      return i18n.t("ImpactSection.impactoEcologico");
    },
    get description() {
      return i18n.t("ImpactSection.reducaoDeResiduosAtraves");
    },
    color: "bg-green/10 text-green",
    image: impactEcologico,
    get modalContent() {
      return i18n.t("ImpactSection.atravesDaRecolhaE");
    },
  },
  {
    icon: TreePine,
    get title() {
      return i18n.t("ImpactSection.impactoClimatico");
    },
    get description() {
      return i18n.t("ImpactSection.menorConsumoIndustrialE");
    },
    color: "bg-gold/10 text-gold",
    image: impactClimatico,
    get modalContent() {
      return i18n.t("ImpactSection.aoReduzirANecessidade");
    },
  },
  {
    icon: Glasses,
    get title() {
      return i18n.t("ImpactSection.impactoEducacional");
    },
    get description() {
      return i18n.t("ImpactSection.oficinasECampanhasPara");
    },
    color: "bg-sky/10 text-sky",
    image: impactEducacional,
    get modalContent() {
      return i18n.t("ImpactSection.asOficinasEducativasE");
    },
  },
];

const ImpactSection = () => {
  const { t } = useTranslation();
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
          <span className="text-sm font-medium tracking-widest uppercase text-teal">{t("ImpactSection.impacto")}</span>
          <h2 className="text-3xl md:text-5xl font-bold">
            {t("ImpactSection.cuidarDasPessoasE")}
          </h2>
          <p className="text-lg text-navy-foreground/70 max-w-2xl mx-auto">
            {t("ImpactSection.aoTransformarDesafiosEm")}
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
                <p className="text-xs text-teal mt-4 font-medium">{t("ImpactSection.saberMais")}</p>
              </button>
            ))}
          </div>

          {/* Navigation arrows — visible below lg, fade on hover */}
          <button
            onClick={() => scroll("left")}
            className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-2 flex lg:hidden items-center justify-center w-10 h-10 rounded-full bg-navy-foreground/10 border border-navy-foreground/10 text-navy-foreground hover:bg-navy-foreground/20 z-10 opacity-0 group-hover/carousel:opacity-100 transition-opacity duration-300"
            aria-label={t("ImpactSection.anterior")}
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button
            onClick={() => scroll("right")}
            className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-2 flex lg:hidden items-center justify-center w-10 h-10 rounded-full bg-navy-foreground/10 border border-navy-foreground/10 text-navy-foreground hover:bg-navy-foreground/20 z-10 opacity-0 group-hover/carousel:opacity-100 transition-opacity duration-300"
            aria-label={t("ImpactSection.proximo")}
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
                <Trans i18nKey="ImpactSection.detalhesSobre" values={{ title: impact.title }} />
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
