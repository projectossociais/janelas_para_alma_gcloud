import logoDesafioGenial from "@/assets/partner-desafio-genial-logo.png";
import logoUnicef from "@/assets/partner-unicef-logo.jpg";
import logoArotec from "@/assets/partner-arotec-logo.png";
import logoOptioptika from "@/assets/partner-optioptika-logo.jpg";
import logoNeltGroup from "@/assets/partner-nelt-group-logo.png";

const partners = [
  {
    name: "Desafio Genial",
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
    name: "Óptica Optioptika",
    logo: logoOptioptika,
    onDark: false,
    url: "https://www.optioptika.com/",
  },
  {
    name: "Nelt Group",
    logo: logoNeltGroup,
    onDark: true,
    url: "https://www.nelt.com/en/markets/angola/",
  },
];

const ParceirosSection = () => {
  return (
    <section className="py-16 md:py-24 bg-muted/50">
      <div className="container">
        <div className="text-center mb-12 space-y-4">
          <span className="text-sm font-medium tracking-widest uppercase text-teal">
            Juntos, vemos mais longe
          </span>
          <h2 className="text-3xl md:text-5xl font-bold text-foreground">Parceiros</h2>
        </div>

        <div className="flex gap-6 overflow-x-auto snap-x pb-4 -mx-4 px-4 scrollbar-hide touch-pan-x justify-start md:justify-center md:flex-wrap">
          {partners.map((partner) => (
            <a
              key={partner.name}
              href={partner.url}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={partner.name}
              className="snap-start shrink-0 w-52 sm:w-56 h-36 rounded-2xl bg-card border border-border/50 shadow-card flex items-center justify-center p-6 transition-all hover:shadow-elevated hover:scale-[1.02]"
            >
              {partner.onDark ? (
                <div className="w-full h-full rounded-lg bg-navy flex items-center justify-center p-4">
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
