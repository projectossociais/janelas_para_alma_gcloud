import { Link } from "react-router-dom";
import { Handshake, Recycle, ArrowRight } from "lucide-react";
import Navbar from "@/components/Navbar";
import AboutSection from "@/components/AboutSection";
import ImpactSection from "@/components/ImpactSection";
import Footer from "@/components/Footer";
import { useTranslation } from "react-i18next";
import i18n from "@/i18n";
import { localizar } from "@/i18n/rotas";

const valueProps = [
  {
    icon: Handshake,
    get title() {
      return i18n.t("Impacto.redeDeParceiros");
    },
    get description() {
      return i18n.t("Impacto.sistemaQueConectaPacientes");
    },
    color: "text-teal bg-teal/10",
    get to() {
      return localizar("/parceiros");
    },
  },
  {
    icon: Recycle,
    get title() {
      return i18n.t("Impacto.logisticaDeEconomiaCircular");
    },
    get description() {
      return i18n.t("Impacto.canalDedicadoARecolha");
    },
    color: "text-green bg-green/10",
    get to() {
      return localizar("/circular");
    },
  },
];

const Impacto = () => {
  const { t } = useTranslation();
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1 pt-16">
        <AboutSection />
        <div className="h-px bg-gradient-to-r from-transparent via-border to-transparent" />
        <ImpactSection />

        {/* A Nossa Proposta de Valor */}
        <section className="py-20 bg-background">
          <div className="container">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground text-center max-w-3xl mx-auto leading-tight">
              {t("Impacto.aNossaPropostaDe")}
            </h2>
            <p className="text-muted-foreground text-center mt-4 max-w-xl mx-auto">
              {t("Impacto.umaAbordagemIntegradaPara")}
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-14 max-w-4xl mx-auto">
              {valueProps.map((item) => (
                <Link
                  key={item.title}
                  to={item.to}
                  className="group relative flex flex-col rounded-2xl border border-border bg-card p-6 shadow-card cursor-pointer transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:border-primary/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  <div className={`inline-flex items-center justify-center w-12 h-12 rounded-xl ${item.color} mb-4`}>
                    <item.icon className="w-6 h-6" />
                  </div>
                  <h3 className="text-lg font-semibold text-foreground mb-2">{item.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{item.description}</p>
                  <div className="mt-4 flex items-center justify-end gap-1.5 text-sm font-medium text-green/70 group-hover:text-green transition-colors">
                    <span>{t("Impacto.saberMais")}</span>
                    <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
};

export default Impacto;
