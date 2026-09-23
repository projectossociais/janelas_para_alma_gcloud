import { useState } from "react";
import {
  MapPin,
  Phone,
  Mail,
  Clock,
  Globe,
  Smartphone,
  Stethoscope,
  Eye,
  Baby,
  ScanEye,
  Activity,
  Radio,
  CalendarPlus,
} from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import BackButton from "@/components/BackButton";
import { Button } from "@/components/ui/button";
import OptioptikaBookingDialog from "@/components/OptioptikaBookingDialog";
import { OPTIOPTIKA_YELLOW } from "@/data/optioptika";
import optioptikaAppQr from "@/assets/optioptika-app-qr.png";
import { Trans, useTranslation } from "react-i18next";
import i18n from "@/i18n";
import { localizar } from "@/i18n/rotas";

const consultasBasicas = [
  { icon: Stethoscope, get label() {
    return i18n.t("PortalClinicoOptioptika.optometriaClinicaEOftalmologia");
  } },
  { icon: Baby, get label() {
    return i18n.t("PortalClinicoOptioptika.oftalmologiaPediatrica1Aos");
  } },
  { icon: Baby, get label() {
    return i18n.t("PortalClinicoOptioptika.oftalmologiaNeonatal1Aos");
  } },
  { icon: Eye, get label() {
    return i18n.t("PortalClinicoOptioptika.testeDoOlhinho");
  } },
];

const examesESaude = [
  { icon: Activity, get label() {
    return i18n.t("PortalClinicoOptioptika.catarata");
  } },
  { icon: Activity, get label() {
    return i18n.t("PortalClinicoOptioptika.glaucoma");
  } },
  { icon: Eye, get label() {
    return i18n.t("PortalClinicoOptioptika.visaoDasCores");
  } },
  { icon: ScanEye, get label() {
    return i18n.t("PortalClinicoOptioptika.retinografia");
  } },
  { icon: ScanEye, get label() {
    return i18n.t("PortalClinicoOptioptika.campimetria");
  } },
  { icon: ScanEye, get label() {
    return i18n.t("PortalClinicoOptioptika.topografiaCorneal");
  } },
  { icon: Activity, get label() {
    return i18n.t("PortalClinicoOptioptika.curvaTensional");
  } },
  { icon: ScanEye, label: "OCT" },
  { icon: ScanEye, get label() {
    return i18n.t("PortalClinicoOptioptika.tonometria");
  } },
  { icon: Activity, label: "TSH" },
];

const horario = [
  { get dias() {
    return i18n.t("PortalClinicoOptioptika.segundaAQuinta");
  }, get horas() {
    return i18n.t("PortalClinicoOptioptika.n8hAs17h00");
  } },
  { dias: "Sexta-feira", get horas() {
    return i18n.t("PortalClinicoOptioptika.fechado");
  } },
  { get dias() {
    return i18n.t("PortalClinicoOptioptika.sabado");
  }, get horas() {
    return i18n.t("PortalClinicoOptioptika.n8hAs13h00");
  } },
];

const enderecoCompleto =
  "Urbanização Nova Vida, Rua 54, Centro Empresarial Living-Luanda, Lote 9, Luanda, Angola";

const whatsappLink = "https://wa.me/244931240304";
const siteLink = "https://www.optioptika.com";
const mapsLink = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(enderecoCompleto)}`;

const PortalClinicoOptioptika = () => {
  const { t } = useTranslation();
  const [bookingOpen, setBookingOpen] = useState(false);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />
      <BackButton fallbackPath={localizar("/portal-clinico")} label={t("PortalClinicoOptioptika.voltarAoPortalClinico")} />

      <main className="flex-1">
        {/* Hero */}
        <section
          className="relative overflow-hidden py-16 md:py-24"
          style={{ backgroundColor: OPTIOPTIKA_YELLOW }}
        >
          <div
            className="absolute inset-0 opacity-[0.08] pointer-events-none"
            style={{
              backgroundImage:
                "radial-gradient(circle at 20% 30%, black 1.5px, transparent 1.5px)",
              backgroundSize: "26px 26px",
            }}
          />
          <div className="container px-6 relative">
            <div className="max-w-3xl mx-auto text-center">
              <span className="inline-block px-4 py-1.5 rounded-full bg-black text-white text-xs font-bold uppercase tracking-widest mb-6">
                {t("PortalClinicoOptioptika.parceiroClinicoOficial")}
              </span>
              <h1 className="text-4xl md:text-6xl font-black text-black leading-tight tracking-tight">
                OPTIOPTIKA
              </h1>
              <p className="text-lg md:text-xl font-semibold text-black/80 mt-2 mb-8">
                {t("PortalClinicoOptioptika.visaoDaBanda")}
              </p>
              <p className="text-base md:text-lg text-black/80 max-w-2xl mx-auto leading-relaxed">
                {t("PortalClinicoOptioptika.umCentroDeSaude")}
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center mt-8">
                <Button
                  asChild
                  size="lg"
                  className="bg-black text-white hover:bg-black/80 font-semibold"
                >
                  <a href={whatsappLink} target="_blank" rel="noopener noreferrer">
                    <Phone className="w-5 h-5 mr-2" />
                    {t("PortalClinicoOptioptika.agendarConsultaViaWhatsapp")}
                  </a>
                </Button>
                <Button
                  asChild
                  size="lg"
                  variant="outline"
                  className="border-black/40 bg-transparent text-black hover:bg-black/10"
                >
                  <a href={siteLink} target="_blank" rel="noopener noreferrer">
                    <Globe className="w-5 h-5 mr-2" />
                    {t("PortalClinicoOptioptika.visitarSite")}
                  </a>
                </Button>
              </div>
            </div>
          </div>
        </section>

        {/* Consultas básicas e especiais */}
        <section className="py-16 md:py-24 bg-background">
          <div className="container px-6">
            <div className="text-center max-w-2xl mx-auto mb-12 space-y-3">
              <span
                className="text-sm font-bold tracking-widest uppercase"
                style={{ color: "#B89600" }}
              >
                {t("PortalClinicoOptioptika.servicos")}
              </span>
              <h2 className="text-3xl md:text-4xl font-bold text-foreground">
                {t("PortalClinicoOptioptika.consultasBasicasEEspeciais")}
              </h2>
            </div>
            <div className="grid sm:grid-cols-2 gap-4 max-w-4xl mx-auto">
              {consultasBasicas.map((item) => (
                <div
                  key={item.label}
                  className="flex items-center gap-4 p-5 rounded-xl border border-border/60 bg-card hover:shadow-card transition-all"
                >
                  <div
                    className="inline-flex items-center justify-center w-11 h-11 rounded-xl text-black shrink-0"
                    style={{ backgroundColor: OPTIOPTIKA_YELLOW }}
                  >
                    <item.icon className="w-5 h-5" />
                  </div>
                  <p className="font-medium text-foreground text-sm">{item.label}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Exames de saúde ocular */}
        <section className="py-16 md:py-24 bg-black text-white">
          <div className="container px-6">
            <div className="text-center max-w-2xl mx-auto mb-12 space-y-3">
              <span
                className="text-sm font-bold tracking-widest uppercase"
                style={{ color: OPTIOPTIKA_YELLOW }}
              >
                {t("PortalClinicoOptioptika.acompanhamento")}
              </span>
              <h2 className="text-3xl md:text-4xl font-bold">
                {t("PortalClinicoOptioptika.examesDeSaudeOcular")}
              </h2>
              <p className="text-white/70">
                {t("PortalClinicoOptioptika.rastreioEAcompanhamentoContinuo")}
              </p>
            </div>
            <div className="grid sm:grid-cols-2 md:grid-cols-5 gap-4 max-w-5xl mx-auto">
              {examesESaude.map((item) => (
                <div
                  key={item.label}
                  className="flex flex-col items-center text-center gap-3 p-5 rounded-xl border border-white/15 bg-white/5"
                >
                  <div
                    className="inline-flex items-center justify-center w-11 h-11 rounded-xl text-black shrink-0"
                    style={{ backgroundColor: OPTIOPTIKA_YELLOW }}
                  >
                    <item.icon className="w-5 h-5" />
                  </div>
                  <p className="font-medium text-sm">{item.label}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* App / Carteira de Desconto */}
        <section className="py-16 md:py-24 bg-muted/40">
          <div className="container px-6">
            <div className="max-w-4xl mx-auto rounded-3xl bg-card border border-border/60 shadow-elevated p-8 md:p-12">
              <div className="grid md:grid-cols-[1fr_420px] gap-10 items-center">
                <div className="text-center md:text-left">
                  <div
                    className="inline-flex items-center justify-center w-14 h-14 rounded-2xl text-black mb-6"
                    style={{ backgroundColor: OPTIOPTIKA_YELLOW }}
                  >
                    <Smartphone className="w-7 h-7" />
                  </div>
                  <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-4">
                    {t("PortalClinicoOptioptika.baixeAgoraAAplicacao")}
                  </h2>
                  <p className="text-muted-foreground leading-relaxed mb-2">
                    {t("PortalClinicoOptioptika.tenhaAcessoAPrimeira")}
                  </p>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {t("PortalClinicoOptioptika.marqueASuaConsulta")}
                  </p>
                </div>
                <div className="flex flex-col items-center gap-3">
                  <div className="w-full rounded-2xl bg-white border-2 p-4" style={{ borderColor: OPTIOPTIKA_YELLOW }}>
                    <img
                      src={optioptikaAppQr}
                      alt={t("PortalClinicoOptioptika.codigosQrParaDescarregar")}
                      className="w-full h-auto object-contain"
                    />
                  </div>
                  <span className="text-xs text-muted-foreground text-center">
                    {t("PortalClinicoOptioptika.aponteACamaraDo")}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Horário e Localização */}
        <section className="py-16 md:py-24 bg-background">
          <div className="container px-6">
            <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
              <div className="rounded-2xl border border-border/60 bg-card p-8">
                <div className="flex items-center gap-3 mb-6">
                  <Clock className="w-5 h-5" style={{ color: "#B89600" }} />
                  <h3 className="text-xl font-bold text-foreground">
                    {t("PortalClinicoOptioptika.horarioDeFuncionamento")}
                  </h3>
                </div>
                <ul className="space-y-4">
                  {horario.map((h) => (
                    <li
                      key={h.dias}
                      className="flex items-center justify-between border-b border-border/40 pb-3 last:border-0 last:pb-0"
                    >
                      <span className="text-sm font-medium text-foreground">{h.dias}</span>
                      <span className="text-sm text-muted-foreground">{h.horas}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <a
                href={mapsLink}
                target="_blank"
                rel="noopener noreferrer"
                className="group rounded-2xl border border-border/60 bg-card p-8 hover:border-[#FFD500] hover:shadow-card transition-all"
              >
                <div className="flex items-center gap-3 mb-6">
                  <MapPin className="w-5 h-5" style={{ color: "#B89600" }} />
                  <h3 className="text-xl font-bold text-foreground group-hover:underline">
                    {t("PortalClinicoOptioptika.ondeEstamos")}
                  </h3>
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {t("PortalClinicoOptioptika.urbanizacaoNovaVidaRua")}
                </p>
                <p className="text-xs font-semibold mt-4" style={{ color: "#B89600" }}>
                  {t("PortalClinicoOptioptika.verNoGoogleMaps")}
                </p>
              </a>
            </div>
          </div>
        </section>

        {/* Contactos */}
        <section className="py-16 md:py-24 bg-muted/40">
          <div className="container px-6">
            <div className="max-w-3xl mx-auto text-center mb-10">
              <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-3">
                {t("PortalClinicoOptioptika.contactosEAgendamento")}
              </h2>
              <p className="text-muted-foreground">
                {t("PortalClinicoOptioptika.faleConnoscoPorWhatsapp")}
              </p>
            </div>
            <div className="grid sm:grid-cols-3 gap-4 max-w-4xl mx-auto mb-10">
              <a
                href={whatsappLink}
                target="_blank"
                rel="noopener noreferrer"
                className="flex flex-col items-center gap-3 p-6 rounded-xl border border-border/60 bg-card hover:shadow-card transition-all text-center"
              >
                <Phone className="w-6 h-6" style={{ color: "#B89600" }} />
                <span className="text-sm font-semibold text-foreground">WhatsApp</span>
                <span className="text-xs text-muted-foreground">+244 931 240 304</span>
              </a>
              <a
                href="mailto:geral@optioptika.com"
                className="flex flex-col items-center gap-3 p-6 rounded-xl border border-border/60 bg-card hover:shadow-card transition-all text-center"
              >
                <Mail className="w-6 h-6" style={{ color: "#B89600" }} />
                <span className="text-sm font-semibold text-foreground">{t("PortalClinicoOptioptika.email")}</span>
                <span className="text-xs text-muted-foreground break-all">geral@optioptika.com</span>
              </a>
              <a
                href={siteLink}
                target="_blank"
                rel="noopener noreferrer"
                className="flex flex-col items-center gap-3 p-6 rounded-xl border border-border/60 bg-card hover:shadow-card transition-all text-center"
              >
                <Globe className="w-6 h-6" style={{ color: "#B89600" }} />
                <span className="text-sm font-semibold text-foreground">{t("PortalClinicoOptioptika.site")}</span>
                <span className="text-xs text-muted-foreground">www.optioptika.com</span>
              </a>
            </div>
            <div className="flex justify-center">
              <Button
                size="lg"
                onClick={() => setBookingOpen(true)}
                className="font-semibold text-black hover:opacity-90"
                style={{ backgroundColor: OPTIOPTIKA_YELLOW }}
              >
                <CalendarPlus className="w-5 h-5 mr-2" />
                {t("PortalClinicoOptioptika.agendarAMinhaConsulta")}
              </Button>
            </div>
          </div>
        </section>

        {/* Extra: rádio */}
        <section className="py-10 bg-black text-white">
          <div className="container px-6">
            <div className="max-w-3xl mx-auto flex flex-col sm:flex-row items-center gap-4 text-center sm:text-left">
              <div
                className="inline-flex items-center justify-center w-12 h-12 rounded-xl text-black shrink-0"
                style={{ backgroundColor: OPTIOPTIKA_YELLOW }}
              >
                <Radio className="w-6 h-6" />
              </div>
              <p className="text-sm text-white/80 leading-relaxed">
                <Trans i18nKey="PortalClinicoOptioptika.acompanheOProgramaVisao" components={{ strong: <strong className="text-white" /> }} />
              </p>
            </div>
          </div>
        </section>
      </main>

      <Footer />

      <OptioptikaBookingDialog open={bookingOpen} onOpenChange={setBookingOpen} />
    </div>
  );
};

export default PortalClinicoOptioptika;
