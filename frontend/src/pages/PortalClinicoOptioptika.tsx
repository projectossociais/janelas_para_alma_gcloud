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
} from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import BackButton from "@/components/BackButton";
import { Button } from "@/components/ui/button";

const OPTIOPTIKA_YELLOW = "#FFD500";

const consultasBasicas = [
  { icon: Stethoscope, label: "Optometria Clínica e Oftalmologia" },
  { icon: Baby, label: "Oftalmologia Pediátrica (1 aos 5 anos)" },
  { icon: Baby, label: "Oftalmologia Neonatal (1 aos 12 meses)" },
  { icon: Eye, label: "Teste do Olhinho" },
];

const examesESaude = [
  { icon: Activity, label: "Catarata" },
  { icon: Activity, label: "Glaucoma" },
  { icon: Eye, label: "Visão das Cores" },
  { icon: ScanEye, label: "Retinografia" },
  { icon: ScanEye, label: "Campimetria" },
  { icon: ScanEye, label: "Topografia Corneal" },
  { icon: Activity, label: "Curva Tensional" },
  { icon: ScanEye, label: "OCT" },
  { icon: ScanEye, label: "Tonometria" },
  { icon: Activity, label: "TSH" },
];

const horario = [
  { dias: "Segunda a Quinta", horas: "8h às 17h00" },
  { dias: "Sexta-feira", horas: "Feriado" },
  { dias: "Sábado", horas: "8h às 13h00" },
];

const whatsappLink = "https://wa.me/244931240304";
const siteLink = "https://www.optioptika.com";

const PortalClinicoOptioptika = () => {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />
      <BackButton fallbackPath="/portal-clinico" label="Voltar ao Portal Clínico" />

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
                Parceiro Clínico Oficial
              </span>
              <h1 className="text-4xl md:text-6xl font-black text-black leading-tight tracking-tight">
                OPTIOPTIKA
              </h1>
              <p className="text-lg md:text-xl font-semibold text-black/80 mt-2 mb-8">
                Visão da Banda
              </p>
              <p className="text-base md:text-lg text-black/80 max-w-2xl mx-auto leading-relaxed">
                Um centro de saúde ocular em Luanda e a primeira Carteira de Desconto Digital
                em Angola. Baixe a aplicação e receba 5.000Kz no seu cartão virtual.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center mt-8">
                <Button
                  asChild
                  size="lg"
                  className="bg-black text-white hover:bg-black/80 font-semibold"
                >
                  <a href={whatsappLink} target="_blank" rel="noopener noreferrer">
                    <Phone className="w-5 h-5 mr-2" />
                    Agendar Consulta via WhatsApp
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
                    Visitar Site
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
                Serviços
              </span>
              <h2 className="text-3xl md:text-4xl font-bold text-foreground">
                Consultas Básicas e Especiais
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
                Acompanhamento
              </span>
              <h2 className="text-3xl md:text-4xl font-bold">
                Exames de Saúde Ocular
              </h2>
              <p className="text-white/70">
                Rastreio e acompanhamento contínuo de Catarata, Glaucoma e Visão das Cores.
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
            <div className="max-w-4xl mx-auto rounded-3xl bg-card border border-border/60 shadow-elevated p-8 md:p-12 text-center">
              <div
                className="inline-flex items-center justify-center w-14 h-14 rounded-2xl text-black mb-6"
                style={{ backgroundColor: OPTIOPTIKA_YELLOW }}
              >
                <Smartphone className="w-7 h-7" />
              </div>
              <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-4">
                Baixe agora o aplicativo Optioptika
              </h2>
              <p className="text-muted-foreground max-w-2xl mx-auto leading-relaxed mb-2">
                Tenha acesso à primeira Carteira de Desconto Digital em Angola e receba
                5.000Kz no seu Cartão Virtual.
              </p>
              <p className="text-sm text-muted-foreground max-w-2xl mx-auto leading-relaxed">
                Marque a sua consulta e exames oculares diretamente pelo aplicativo, disponível
                na Google Play e App Store.
              </p>
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
                    Horário de Funcionamento
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

              <div className="rounded-2xl border border-border/60 bg-card p-8">
                <div className="flex items-center gap-3 mb-6">
                  <MapPin className="w-5 h-5" style={{ color: "#B89600" }} />
                  <h3 className="text-xl font-bold text-foreground">Onde Estamos</h3>
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Urbanização Nova Vida, Rua 54 (rua do tribunal provincial), Centro
                  Empresarial Living-Luanda, Lote 9, Luanda, Angola.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Contactos */}
        <section className="py-16 md:py-24 bg-muted/40">
          <div className="container px-6">
            <div className="max-w-3xl mx-auto text-center mb-10">
              <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-3">
                Contactos e Agendamento
              </h2>
              <p className="text-muted-foreground">
                Fale connosco por WhatsApp, email ou visite o nosso site.
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
                <span className="text-sm font-semibold text-foreground">Email</span>
                <span className="text-xs text-muted-foreground break-all">geral@optioptika.com</span>
              </a>
              <a
                href={siteLink}
                target="_blank"
                rel="noopener noreferrer"
                className="flex flex-col items-center gap-3 p-6 rounded-xl border border-border/60 bg-card hover:shadow-card transition-all text-center"
              >
                <Globe className="w-6 h-6" style={{ color: "#B89600" }} />
                <span className="text-sm font-semibold text-foreground">Site</span>
                <span className="text-xs text-muted-foreground">www.optioptika.com</span>
              </a>
            </div>
            <div className="flex justify-center">
              <Button
                asChild
                size="lg"
                className="font-semibold text-black hover:opacity-90"
                style={{ backgroundColor: OPTIOPTIKA_YELLOW }}
              >
                <a href={whatsappLink} target="_blank" rel="noopener noreferrer">
                  Agendar a Minha Consulta
                </a>
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
                Acompanhe o programa <strong className="text-white">"Visão da Banda!"</strong> todas as
                Quartas-feiras, das 13h às 14h, na rádio MFM 91.7, com o Dr. Djalme Fonseca,
                Optometrista.
              </p>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
};

export default PortalClinicoOptioptika;
