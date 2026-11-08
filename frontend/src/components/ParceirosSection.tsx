import logoDesafioGenial from "@/assets/partner-desafio-genial-logo.png";
import logoUnicef from "@/assets/partner-unicef-logo.jpg";
import logoArotec from "@/assets/partner-arotec-logo.png";
import logoOptioptika from "@/assets/partner-optioptika-logo.jpg";
import logoNeltGroup from "@/assets/partner-nelt-group-logo.png";
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
  { name: "UNICEF", logo: logoUnicef, onDark: false, url: "https://www.unicef.org/" },
  {
    name: "Arotec",
    logo: logoArotec,
    onDark: false,
    url: "https://www.arotec.ao/programas/desafio-genial",
  },
  {
    get name() {
      return i18n.t("ParceirosSection.opticaOptioptika");
    },
    logo: logoOptioptika,
    onDark: false,
    url: "https://www.optioptika.com/",
  },
  {
    get name() {
      return i18n.t("ParceirosSection.neltGroup");
    },
    logo: logoNeltGroup,
    onDark: true,
    url: "https://www.nelt.com/en/markets/angola/",
  },
];

/** E. Apoiadores, clínicas e parceiros na missão: grelha limpa de logótipos. */
const ParceirosSection = () => {
  const { t } = useTranslation();
  return (
    <section className="border-t border-marca-marinho/10 bg-marca-marfim py-16 md:py-20">
      <div className="container">
        <h2 className="text-center text-2xl font-bold text-marca-marinho md:text-3xl">
          {t("ParceirosSection.algunsDosNossos")}{" "}
          <span className="text-marca-azul">{t("ParceirosSection.apoiadoresEParceiros")}</span>{" "}
          {t("ParceirosSection.nestaMissao")}
        </h2>

        <ul className="mx-auto mt-10 grid max-w-5xl grid-cols-2 items-center gap-x-8 gap-y-10 sm:grid-cols-3 lg:grid-cols-5">
          {partners.map((partner) => (
            <li key={partner.name} className="flex justify-center">
              <a
                href={partner.url}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={partner.name}
                className="flex h-20 w-full max-w-[11rem] items-center justify-center rounded-xl p-2 grayscale transition hover:grayscale-0 focus-visible:grayscale-0"
              >
                {partner.onDark ? (
                  <span className="flex h-full w-full items-center justify-center rounded-lg bg-marca-marinho p-3">
                    <img src={partner.logo} alt={partner.name} className="max-h-full max-w-full object-contain" loading="lazy" />
                  </span>
                ) : (
                  <img src={partner.logo} alt={partner.name} className="max-h-full max-w-full object-contain" loading="lazy" />
                )}
              </a>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
};

export default ParceirosSection;
