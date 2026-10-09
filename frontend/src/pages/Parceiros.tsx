import { useSearchParams } from "react-router-dom";
import { Eye, Tag, Handshake } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import BackButton from "@/components/BackButton";
import PartnerDialog from "@/components/PartnerDialog";
import ClinicalPartners from "@/components/ClinicalPartners";
import { useAuth } from "@/contexts/AuthContext";
import heroImg from "@/assets/parceiros-hero.jpg";
import { Trans, useTranslation } from "react-i18next";
import i18n from "@/i18n";

const benefits = [
  {
    icon: Eye,
    get title() {
      return i18n.t("Parceiros.acessoFacilitado");
    },
    get text() {
      return i18n.t("Parceiros.acessoDirectoARastreios");
    },
  },
  {
    icon: Tag,
    get title() {
      return i18n.t("Parceiros.precosAdaptados");
    },
    get text() {
      return i18n.t("Parceiros.estruturacaoDeAcordosE");
    },
  },
  {
    icon: Handshake,
    get title() {
      return i18n.t("Parceiros.maiorInclusao");
    },
    get text() {
      return i18n.t("Parceiros.eliminacaoDeBarreirasGeograficas");
    },
  },
];

const Parceiros = () => {
  const { t } = useTranslation();
  const { user, loading } = useAuth();
  const canViewPartnerSections = !loading && (user?.role === "admin" || user?.role === "profissional");
  const [searchParams] = useSearchParams();
  const abrirAgendamentoOptiotica = searchParams.get("agendar") === "optiotica";

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      {/* Hero */}
      <section className="relative w-full min-h-[80vh] flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0">
          <img
            src={heroImg}
            alt={t("Parceiros.especialistasEmSaudeVisual")}
            className="w-full h-full object-cover"
            width={1920}
            height={1080}
          />
          <div className="absolute inset-0 bg-hero-gradient opacity-90" />
        </div>

        <div className="relative z-10 container text-center px-6 animate-fade-in">
          <h1 className="text-4xl md:text-6xl font-bold leading-tight tracking-tight text-primary-foreground mb-6">
            <Trans i18nKey="Parceiros.redeDeParceirosDe" components={{ br: <br className="hidden md:block" /> }} />
          </h1>
          <p className="text-lg md:text-2xl text-primary-foreground/85 max-w-3xl mx-auto leading-relaxed">
            {t("Parceiros.conectandoEspecialistasAQuem")}
          </p>
        </div>
      </section>

      <BackButton className="pb-4 md:pb-6" />

      {/* Clinical Partners (Óptica Optioptika) */}
      <ClinicalPartners defaultOpen={abrirAgendamentoOptiotica} />

      {canViewPartnerSections && (
        <section className="py-20 md:py-28 bg-hero-gradient">
          <div className="container px-6">
            <div className="text-center max-w-2xl mx-auto mb-14 animate-fade-in">
              <h2 className="text-3xl md:text-4xl font-bold text-primary-foreground mb-4">
                {t("Parceiros.beneficiosParaParceiros")}
              </h2>
              <p className="text-primary-foreground/80 text-lg">
                {t("Parceiros.vantagensEstrategicasAoIntegrar")}
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-6 max-w-6xl mx-auto">
              {benefits.map((b, i) => (
                <div
                  key={b.title}
                  className="rounded-2xl p-8 bg-primary-foreground/5 backdrop-blur-sm border border-primary-foreground/10 hover:bg-primary-foreground/10 hover:-translate-y-1 transition-all duration-300 animate-fade-in"
                  style={{ animationDelay: `${i * 120}ms` }}
                >
                  <div className="w-14 h-14 rounded-xl bg-teal/20 text-teal flex items-center justify-center mb-5">
                    <b.icon className="w-7 h-7" />
                  </div>
                  <h3 className="text-xl font-bold text-primary-foreground mb-3">
                    {b.title}
                  </h3>
                  <p className="text-primary-foreground/75 leading-relaxed">
                    {b.text}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {canViewPartnerSections && (
        <section className="py-20 md:py-28 bg-background">
          <div className="container px-6">
            <div className="max-w-4xl mx-auto rounded-3xl bg-navy text-primary-foreground p-10 md:p-14 shadow-elevated text-center relative overflow-hidden animate-fade-in">
              <div className="absolute inset-0 bg-gradient-to-br from-teal/20 via-transparent to-transparent" />
              <div className="relative">
                <h2 className="text-3xl md:text-4xl font-bold mb-4">
                  {t("Parceiros.facaParteDestaVisao")}
                </h2>
                <p className="text-primary-foreground/85 text-lg mb-8 max-w-2xl mx-auto leading-relaxed">
                  {t("Parceiros.representaUmaClinicaComo")}
                </p>
                <PartnerDialog />
              </div>
            </div>
          </div>
        </section>
      )}

      <Footer />
    </div>
  );
};

export default Parceiros;
