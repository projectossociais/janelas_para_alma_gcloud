import { useEffect, useRef, useState } from "react";
import Autoplay from "embla-carousel-autoplay";
import { HeartHandshake, BookOpen, Target, Users, ChevronRight, Images } from "lucide-react";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  type CarouselApi,
} from "@/components/ui/carousel";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";
import i18n from "@/i18n";

const objectives = () => [
  i18n.t("KambaHeroCarousel.mobilizarJovensVoluntarios"),
  i18n.t("KambaHeroCarousel.promoverADesestigmatizacaoAtraves"),
  i18n.t("KambaHeroCarousel.estabelecerUmaRedeActiva"),
  i18n.t("KambaHeroCarousel.implementarAccoesDeInclusao"),
];

interface KambaHeroCarouselProps {
  onOpenForm: () => void;
}

const KambaHeroCarousel = ({ onOpenForm }: KambaHeroCarouselProps) => {
  const { t } = useTranslation();
  const [api, setApi] = useState<CarouselApi>();
  const [current, setCurrent] = useState(0);
  const groupVideoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (!api) return;

    setCurrent(api.selectedScrollSnap());
    api.on("select", () => setCurrent(api.selectedScrollSnap()));
  }, [api]);

  useEffect(() => {
    const videoEl = groupVideoRef.current;
    if (!videoEl || current !== 1) return;

    videoEl.play().catch(() => {
      // Autoplay pode ser bloqueado pelo browser; o utilizador pode dar play manualmente.
    });

    // Enquanto este slide estiver ativo, retoma a reprodução caso seja pausada inesperadamente.
    const handlePause = () => {
      if (current === 1) videoEl.play().catch(() => {});
    };
    videoEl.addEventListener("pause", handlePause);
    return () => videoEl.removeEventListener("pause", handlePause);
  }, [current]);

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
        <CarouselContent className="-ml-0 items-start">
          {/* Slide 1: Programa Meu Kamba Estrábico */}
          <CarouselItem className="pl-0">
            <div className="container">
              <div className="max-w-4xl mx-auto text-center space-y-6 py-4">
                <span className="text-sm font-medium tracking-widest uppercase text-teal">
                  {t("KambaHeroCarousel.programaMeuKambaEstrabico")}
                </span>
                <h2 className="text-3xl md:text-5xl font-bold">
                  {t("KambaHeroCarousel.tornaTeUmKamba")}
                </h2>
                <p className="text-lg text-navy-foreground/70 max-w-2xl mx-auto">
                  {t("KambaHeroCarousel.juntaTeANos")}
                </p>
                <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                  <button
                    onClick={onOpenForm}
                    className="inline-flex items-center gap-3 px-10 py-5 rounded-xl bg-teal text-teal-foreground font-bold text-lg transition-all hover:opacity-90 hover:translate-y-[-2px] hover:shadow-2xl shadow-elevated"
                  >
                    <HeartHandshake className="w-6 h-6" />
                    {t("KambaHeroCarousel.queroSerUmKamba")}
                  </button>
                </div>
              </div>

              <div className="max-w-4xl mx-auto mt-12 text-left space-y-3">
                <h3 className="text-base font-semibold text-navy-foreground flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-teal" />
                  {t("KambaHeroCarousel.sobreOPrograma")}
                </h3>
                <p className="text-navy-foreground/70 leading-relaxed">
                  {t("KambaHeroCarousel.oProgramaEUma")}
                </p>
              </div>

              <div className="max-w-4xl mx-auto mt-8 grid sm:grid-cols-2 gap-6">
                <div className="rounded-2xl bg-navy-foreground/5 border border-navy-foreground/10 p-6 space-y-3">
                  <h3 className="text-base font-semibold text-navy-foreground flex items-center gap-2">
                    <Target className="w-4 h-4 text-teal" />
                    {t("KambaHeroCarousel.objectivos")}
                  </h3>
                  <ul className="space-y-2">
                    {objectives().map((obj, i) => (
                      <li key={i} className="flex items-start gap-3">
                        <ChevronRight className="w-4 h-4 text-teal shrink-0 mt-1" />
                        <span className="text-navy-foreground/70 leading-relaxed text-sm">{obj}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="rounded-2xl bg-navy-foreground/5 border border-navy-foreground/10 p-6 space-y-3">
                  <h3 className="text-base font-semibold text-navy-foreground flex items-center gap-2">
                    <Users className="w-4 h-4 text-teal" />
                    {t("KambaHeroCarousel.publicoAlvo")}
                  </h3>
                  <div className="space-y-2">
                    <div className="p-3 rounded-xl bg-teal/10 border border-teal/20">
                      <p className="text-sm font-medium text-navy-foreground mb-1">{t("KambaHeroCarousel.primario")}</p>
                      <p className="text-navy-foreground/70 text-sm">{t("KambaHeroCarousel.pessoasEstrabicasECom")}</p>
                    </div>
                    <div className="p-3 rounded-xl bg-navy-foreground/5 border border-navy-foreground/10">
                      <p className="text-sm font-medium text-navy-foreground mb-1">{t("KambaHeroCarousel.secundario")}</p>
                      <p className="text-navy-foreground/70 text-sm">
                        {t("KambaHeroCarousel.familiasVoluntariosLideresComunitarios")}
                      </p>
                    </div>
                  </div>
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
                    {t("KambaHeroCarousel.accaoNoTerreno")}
                  </span>
                  <h2 className="text-3xl md:text-4xl font-bold leading-tight">
                    {t("KambaHeroCarousel.campanhaDeConsciencializacaoNa")}
                  </h2>
                  <p className="text-lg text-navy-foreground/70">
                    {t("KambaHeroCarousel.aComunidadeMeuKamba")}
                  </p>
                  <div className="flex flex-col sm:flex-row items-center justify-center md:justify-start gap-4">
                    <button
                      onClick={scrollToAcoes}
                      className="inline-flex items-center gap-3 px-8 py-4 rounded-xl bg-teal text-teal-foreground font-bold transition-all hover:opacity-90 hover:translate-y-[-2px] hover:shadow-2xl shadow-elevated"
                    >
                      <Images className="w-5 h-5" />
                      {t("KambaHeroCarousel.verGaleriaDaAccao")}
                    </button>
                  </div>
                </div>
                <div className="rounded-2xl overflow-hidden shadow-elevated border border-navy-foreground/10 aspect-[4/5] md:aspect-square">
                  <video
                    ref={groupVideoRef}
                    className="w-full h-full object-cover"
                    src="https://yjzqnjatrdngzfixrxcg.supabase.co/storage/v1/object/public/kamba-media/JPA%20Grupo.mov#t=0.001"
                    autoPlay
                    muted
                    loop
                    playsInline
                    preload="auto"
                  />
                </div>
              </div>
            </div>
          </CarouselItem>
          {/* Slide 3: A Nossa Equipa */}
          <CarouselItem className="pl-0">
            <div className="container">
              <div className="max-w-5xl mx-auto grid md:grid-cols-2 gap-8 items-center py-4">
                <div className="text-center md:text-left space-y-5">
                  <span className="text-sm font-medium tracking-widest uppercase text-teal">
                    {t("KambaHeroCarousel.aNossaEquipa")}
                  </span>
                  <h2 className="text-3xl md:text-4xl font-bold leading-tight">
                    {t("KambaHeroCarousel.kambasUnidosPelaMesma")}
                  </h2>
                  <p className="text-lg text-navy-foreground/70">
                    {t("KambaHeroCarousel.voluntariosEmbaixadoresEParceiros")}
                  </p>
                  <div className="flex flex-col sm:flex-row items-center justify-center md:justify-start gap-4">
                    <button
                      onClick={onOpenForm}
                      className="inline-flex items-center gap-3 px-8 py-4 rounded-xl bg-teal text-teal-foreground font-bold transition-all hover:opacity-90 hover:translate-y-[-2px] hover:shadow-2xl shadow-elevated"
                    >
                      <HeartHandshake className="w-5 h-5" />
                      {t("KambaHeroCarousel.queroSerUmKamba")}
                    </button>
                  </div>
                </div>
                <div className="rounded-2xl overflow-hidden shadow-elevated border border-navy-foreground/10 aspect-[4/5] md:aspect-square">
                  <img
                    src="/assets/kamba/equipa-auditorio.jpg"
                    alt={t("KambaHeroCarousel.equipaMeuKambaEstrabico")}
                    className="w-full h-full object-cover"
                  />
                </div>
              </div>
            </div>
          </CarouselItem>
        </CarouselContent>
      </Carousel>

      <div className="flex items-center justify-center gap-2 mt-8">
        {[0, 1, 2].map((index) => (
          <button
            key={index}
            aria-label={t("KambaHeroCarousel.irParaOSlide", { valor: index + 1 })}
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
