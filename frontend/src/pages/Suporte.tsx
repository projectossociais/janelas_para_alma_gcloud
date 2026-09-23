import { MessagesSquare, HeartHandshake, BookOpen, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import BackButton from "@/components/BackButton";
import heroImg from "@/assets/suporte-hero.jpg";
import { Trans, useTranslation } from "react-i18next";
import i18n from "@/i18n";
import { localizar } from "@/i18n/rotas";

const features = [
  {
    icon: MessagesSquare,
    get title() {
      return i18n.t("Suporte.partilhaDeExperiencias");
    },
    get description() {
      return i18n.t("Suporte.umEspacoSeguroOnde");
    },
  },
  {
    icon: HeartHandshake,
    get title() {
      return i18n.t("Suporte.apoioEmocional");
    },
    get description() {
      return i18n.t("Suporte.acompanhamentoHumanoESuporte");
    },
  },
  {
    icon: BookOpen,
    get title() {
      return i18n.t("Suporte.educacaoSobreEstrabismo");
    },
    get description() {
      return i18n.t("Suporte.informacaoClaraAcessivelE");
    },
  },
];

const Suporte = () => {
  const { t } = useTranslation();
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />
      <main className="flex-1">
        {/* Hero */}
        <section className="relative min-h-[70vh] flex items-center overflow-hidden">
          <img
            src={heroImg}
            alt={t("Suporte.comunidadeAcolhedoraASorrir")}
            className="absolute inset-0 w-full h-full object-cover"
            width={1920}
            height={1088}
          />
          <div className="absolute inset-0 bg-gradient-to-r from-primary/95 via-primary/80 to-primary/40" />
          <div className="container relative z-10 py-24 md:py-32">
            <div className="max-w-2xl animate-fade-in">
              <span className="inline-block px-4 py-1.5 rounded-full bg-gold/20 text-primary-foreground border border-gold/40 text-sm font-medium mb-6 backdrop-blur-sm">
                {t("Suporte.comunidadeInclusao")}
              </span>
              <h1 className="text-4xl md:text-6xl font-bold text-primary-foreground leading-tight mb-6">
                {t("Suporte.programaDeSuportePsicossocial")}
              </h1>
              <p className="text-lg md:text-xl text-primary-foreground/90 leading-relaxed">
                {t("Suporte.naoEstasSozinhoUma")}
              </p>
            </div>
          </div>
        </section>

        <BackButton />

        {/* Features */}
        <section className="py-20 md:py-28">
          <div className="container">
            <div className="text-center max-w-2xl mx-auto mb-14">
              <h2 className="text-3xl md:text-4xl font-bold text-foreground leading-tight">
                {t("Suporte.comoTeApoiamos")}
              </h2>
              <p className="text-muted-foreground mt-4">
                {t("Suporte.tresPilaresParaQue")}
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
              {features.map((f, i) => (
                <div
                  key={f.title}
                  className="group relative flex flex-col rounded-2xl border border-border bg-card p-8 shadow-card transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:border-gold/40 animate-fade-in"
                  style={{ animationDelay: `${i * 100}ms` }}
                >
                  <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-gold/10 text-gold mb-4">
                    <f.icon className="w-6 h-6" />
                  </div>
                  <h3 className="text-xl font-semibold text-foreground mb-3">{f.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{f.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="py-20 bg-gradient-to-br from-primary to-primary/80">
          <div className="container">
            <div className="max-w-3xl mx-auto text-center animate-fade-in">
              <h2 className="text-3xl md:text-4xl font-bold text-primary-foreground mb-4 leading-tight">
                {t("Suporte.juntaTeANossa")}
              </h2>
              <p className="text-primary-foreground/85 text-lg mb-8">
                <Trans i18nKey="Suporte.fazParteDoPrograma" components={{ strong: <strong /> }} />
              </p>
              <Link
                to={localizar("/kamba")}
                className="inline-flex items-center gap-2 bg-gold text-primary font-semibold px-8 py-4 rounded-xl hover:bg-gold/90 transition-all hover:-translate-y-0.5 shadow-lg"
              >
                {t("Suporte.conhecerOPrograma")}
                <ArrowRight className="w-5 h-5" />
              </Link>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
};

export default Suporte;
