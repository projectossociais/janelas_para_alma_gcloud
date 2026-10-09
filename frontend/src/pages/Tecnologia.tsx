import { CalendarCheck, ShoppingBag, MessageCircle, Wifi, Battery, Signal, Search, Bell, Calendar as CalendarIcon, Stethoscope, Eye, ArrowRight } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import BackButton from "@/components/BackButton";
import heroImg from "@/assets/tecnologia-hero.jpg";
import { Trans, useTranslation } from "react-i18next";
import i18n from "@/i18n";

const features = [
  {
    icon: CalendarCheck,
    get title() {
      return i18n.t("Tecnologia.agendamentoCentralizado");
    },
    get description() {
      return i18n.t("Tecnologia.sistemaInteligenteParaAgendar");
    },
    color: "text-teal bg-teal/10",
  },
  {
    icon: ShoppingBag,
    get title() {
      return i18n.t("Tecnologia.marketplaceDeServicosE");
    },
    get description() {
      return i18n.t("Tecnologia.acessoDirectoAProdutos");
    },
    color: "text-green bg-green/10",
  },
  {
    icon: MessageCircle,
    get title() {
      return i18n.t("Tecnologia.canalDeComunicacaoDirecta");
    },
    get description() {
      return i18n.t("Tecnologia.facilitaAComunicacaoFluida");
    },
    color: "text-sky bg-sky/10",
  },
];

const Tecnologia = () => {
  const { t } = useTranslation();
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1">
        {/* Hero */}
        <section className="relative min-h-[70vh] flex items-center overflow-hidden">
          <img
            src={heroImg}
            alt={t("Tecnologia.plataformaTecnologicaAssistiva")}
            className="absolute inset-0 w-full h-full object-cover"
            width={1920}
            height={1088}
          />
          <div className="absolute inset-0 bg-gradient-to-r from-primary/95 via-primary/85 to-primary/60" />
          <div className="container relative z-10 py-24 md:py-32">
            <div className="max-w-2xl animate-fade-in">
              <span className="inline-block px-4 py-1.5 rounded-full bg-teal/20 text-teal-foreground border border-teal/30 text-sm font-medium mb-6 backdrop-blur-sm">
                {t("Tecnologia.inovacaoAssistiva")}
              </span>
              <h1 className="text-4xl md:text-6xl font-bold text-primary-foreground leading-tight mb-6">
                {t("Tecnologia.interfaceTecnologicaEAssistiva")}
              </h1>
              <p className="text-lg md:text-xl text-primary-foreground/90 leading-relaxed">
                {t("Tecnologia.umaPlataformaSimplesE")}
              </p>
            </div>
          </div>
        </section>

        <BackButton />

        {/* Funcionalidades */}
        <section className="py-20 bg-background">
          <div className="container">
            <div className="text-center max-w-2xl mx-auto mb-14">
              <h2 className="text-3xl md:text-4xl font-bold text-foreground leading-tight">
                {t("Tecnologia.funcionalidadesCentrais")}
              </h2>
              <p className="text-muted-foreground mt-4">
                {t("Tecnologia.tudoOQuePrecisa")}
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
              {features.map((f, i) => (
                <div
                  key={f.title}
                  className="group rounded-2xl border border-border bg-card p-7 shadow-card hover:shadow-elevated hover:-translate-y-1 transition-all duration-300 animate-fade-in"
                  style={{ animationDelay: `${i * 100}ms` }}
                >
                  <div className={`inline-flex items-center justify-center w-14 h-14 rounded-2xl ${f.color} mb-5 group-hover:scale-110 transition-transform duration-300`}>
                    <f.icon className="w-7 h-7" />
                  </div>
                  <h3 className="text-lg font-semibold text-foreground mb-3">{f.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{f.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Impacto da Tecnologia */}
        <section className="py-20 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-primary via-primary to-teal/40" />
          <div className="absolute inset-0 opacity-20" style={{
            backgroundImage: "radial-gradient(circle at 20% 30%, hsl(var(--teal)) 0%, transparent 40%), radial-gradient(circle at 80% 70%, hsl(var(--green)) 0%, transparent 40%)",
          }} />
          <div className="container relative z-10">
            <div className="max-w-3xl mx-auto text-center">
              <span className="inline-block px-4 py-1.5 rounded-full bg-primary-foreground/10 text-primary-foreground border border-primary-foreground/20 text-sm font-medium mb-6 backdrop-blur-sm">
                {t("Tecnologia.oImpactoDaTecnologia")}
              </span>
              <p className="text-2xl md:text-3xl font-medium text-primary-foreground leading-relaxed">
                <Trans i18nKey="Tecnologia.oNossoFocoE" components={{ span: <span className="text-teal" /> }} />
              </p>
            </div>
          </div>
        </section>

        {/* Mockup */}
        <section className="py-20 bg-muted/40">
          <div className="container">
            <div className="grid md:grid-cols-2 gap-12 items-center max-w-5xl mx-auto">
              <div className="animate-fade-in">
                <h2 className="text-3xl md:text-4xl font-bold text-foreground leading-tight mb-5">
                  {t("Tecnologia.desenhadaParaTodos")}
                </h2>
                <p className="text-muted-foreground leading-relaxed mb-8">
                  {t("Tecnologia.umaInterfaceLimpaCom")}
                </p>
                <ul className="space-y-3">
                  {[
                    t("Tecnologia.botoesAmplosELegiveis"),
                    t("Tecnologia.tipografiaDeAltoContraste"),
                    t("Tecnologia.navegacaoSimplificada"),
                    t("Tecnologia.suporteABaixaLiteracia"),
                  ].map((item) => (
                    <li key={item} className="flex items-center gap-3 text-foreground">
                      <span className="w-1.5 h-1.5 rounded-full bg-teal" />
                      <span className="text-sm">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Phone mockup */}
              <div className="flex justify-center animate-fade-in">
                <div className="relative w-[280px] h-[570px] rounded-[3rem] bg-gradient-to-b from-foreground to-foreground/90 p-3 shadow-elevated">
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-6 bg-foreground rounded-b-2xl z-20" />
                  <div className="w-full h-full rounded-[2.3rem] bg-gradient-to-br from-primary via-primary to-primary/90 overflow-hidden relative">
                    {/* Status bar */}
                    <div className="flex items-center justify-between px-6 pt-3 text-primary-foreground text-xs">
                      <span className="font-semibold">9:41</span>
                      <div className="flex items-center gap-1">
                        <Signal className="w-3 h-3" />
                        <Wifi className="w-3 h-3" />
                        <Battery className="w-3.5 h-3.5" />
                      </div>
                    </div>

                    {/* App content */}
                    <div className="px-5 pt-8">
                      <div className="flex items-center justify-between mb-6">
                        <div>
                          <p className="text-primary-foreground/70 text-[11px]">{t("Tecnologia.ola")}</p>
                          <p className="text-primary-foreground font-semibold text-base">{t("Tecnologia.bemVindo")}</p>
                        </div>
                        <div className="w-9 h-9 rounded-full bg-primary-foreground/10 flex items-center justify-center">
                          <Bell className="w-4 h-4 text-primary-foreground" />
                        </div>
                      </div>

                      {/* Search */}
                      <div className="bg-primary-foreground/10 backdrop-blur-sm rounded-2xl px-4 py-3 flex items-center gap-2 mb-5 border border-primary-foreground/10">
                        <Search className="w-4 h-4 text-primary-foreground/60" />
                        <span className="text-primary-foreground/60 text-xs">{t("Tecnologia.procurarServico")}</span>
                      </div>

                      {/* Quick actions */}
                      <div className="grid grid-cols-3 gap-2 mb-5">
                        {[
                          { icon: CalendarIcon, label: t("Tecnologia.agendar") },
                          { icon: Stethoscope, label: t("Tecnologia.consulta") },
                          { icon: Eye, label: t("Tecnologia.rastreio") },
                        ].map((a) => (
                          <div key={a.label} className="bg-primary-foreground/10 rounded-2xl p-3 flex flex-col items-center gap-1.5">
                            <div className="w-8 h-8 rounded-lg bg-teal/30 flex items-center justify-center">
                              <a.icon className="w-4 h-4 text-teal-foreground" />
                            </div>
                            <span className="text-[10px] text-primary-foreground font-medium">{a.label}</span>
                          </div>
                        ))}
                      </div>

                      {/* CTA */}
                      <div className="bg-teal rounded-2xl p-4 mb-3">
                        <p className="text-[11px] text-teal-foreground/80 mb-1">{t("Tecnologia.proximaConsulta")}</p>
                        <p className="text-sm text-teal-foreground font-semibold mb-2">{t("Tecnologia.rastreioVisual")}</p>
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] text-teal-foreground/80">{t("Tecnologia.sex1430")}</span>
                          <ArrowRight className="w-3.5 h-3.5 text-teal-foreground" />
                        </div>
                      </div>

                      <button className="w-full bg-primary-foreground text-primary rounded-2xl py-3 text-sm font-semibold">
                        {t("Tecnologia.agendarAgora")}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
};

export default Tecnologia;
