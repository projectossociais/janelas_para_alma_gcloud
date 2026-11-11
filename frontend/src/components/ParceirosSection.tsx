import logoDesafioGenial from "@/assets/partner-desafio-genial-logo.png";
import logoOptioptika from "@/assets/partner-optioptika-logo.jpg";
import { useTranslation } from "react-i18next";
import i18n from "@/i18n";

const partners = [
  {
    get name() {
      return i18n.t("ParceirosSection.desafioGenial");
    },
    logo: logoDesafioGenial,
    onDark: true,
    url: "https://www.unicef.org/angola/desafio-genial-gera%C3%A7%C3%A3o-digital",
  },
  {
    get name() {
      return i18n.t("ParceirosSection.opticaOptioptika");
    },
    logo: logoOptioptika,
    onDark: false,
    url: "https://www.optioptika.com/",
  },
];

const ParceirosSection = () => {
  const { t } = useTranslation();
  return (
    <section className="py-16 md:py-24 bg-white">
      <div className="container">
        <div className="text-center mb-12 space-y-4">
          <span className="text-sm font-medium tracking-widest uppercase text-marca-azul">
            {t("ParceirosSection.juntosVemosMaisLonge")}
          </span>
          <h2 className="text-3xl md:text-5xl font-bold text-marca-marinho">{t("ParceirosSection.parceiros")}</h2>
        </div>

        {/* Ecrãs estreitos: os cartões ficam lado a lado e desliza-se para o
            lado (nunca uns por cima dos outros); o segundo aparece cortado,
            para se perceber que há mais. A partir de md cabem todos e ficam
            centrados. */}
        <div className="-mx-4 flex snap-x snap-mandatory scroll-px-4 gap-4 overflow-x-auto px-4 pb-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:mx-0 md:justify-center md:gap-6 md:overflow-visible md:px-0">
          {partners.map((partner) => (
            <a
              key={partner.name}
              href={partner.url}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={partner.name}
              className="snap-start shrink-0 w-44 sm:w-56 h-32 sm:h-36 rounded-2xl bg-white border border-border/50 shadow-card flex items-center justify-center p-6 transition-all hover:shadow-elevated hover:scale-[1.02]"
            >
              {partner.onDark ? (
                <div className="w-full h-full rounded-lg bg-marca-marinho flex items-center justify-center p-4">
                  <img
                    src={partner.logo}
                    alt={partner.name}
                    className="max-w-full max-h-full object-contain"
                  />
                </div>
              ) : (
                <img
                  src={partner.logo}
                  alt={partner.name}
                  className="max-w-full max-h-full object-contain"
                />
              )}
            </a>
          ))}
        </div>
      </div>
    </section>
  );
};

export default ParceirosSection;
