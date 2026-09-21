import logoDesafioGenial from "@/assets/partner-desafio-genial-logo.png";
import logoUnicef from "@/assets/partner-unicef-logo.jpg";
import logoArotec from "@/assets/partner-arotec-logo.png";
import logoOptioptika from "@/assets/optioptika-logo.png";
import logoNeltGroup from "@/assets/partner-nelt-group-logo.png";

const partners = [
  { name: "Desafio Genial", logo: logoDesafioGenial, onDark: true },
  { name: "UNICEF", logo: logoUnicef, onDark: false },
  { name: "Arotec", logo: logoArotec, onDark: false },
  { name: "Óptica Optioptika", logo: logoOptioptika, onDark: false },
  { name: "Nelt Group", logo: logoNeltGroup, onDark: true },
];

const ParceirosSection = () => {
  return (
    <section className="py-16 md:py-24 bg-background">
      <div className="container">
        <div className="text-center mb-12 space-y-4">
          <span className="text-sm font-medium tracking-widest uppercase text-teal">
            Juntos, vemos mais longe
          </span>
          <h2 className="text-3xl md:text-5xl font-bold text-foreground">Parceiros</h2>
        </div>

        <div className="flex flex-wrap justify-center gap-6 max-w-5xl mx-auto">
          {partners.map((partner) => (
            <div
              key={partner.name}
              className="w-40 sm:w-44 h-28 rounded-2xl bg-card border border-border/50 shadow-card flex items-center justify-center p-5 transition-all hover:shadow-elevated"
            >
              {partner.onDark ? (
                <div className="w-full h-full rounded-lg bg-navy flex items-center justify-center p-3">
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
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default ParceirosSection;
