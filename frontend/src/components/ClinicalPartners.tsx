import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Building2,
  MapPin,
  Phone,
  Mail,
  Clock,
  Stethoscope,
  Baby,
  Eye,
  ScanEye,
  CalendarPlus,
  Star,
  ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import OptioptikaBookingDialog from "@/components/OptioptikaBookingDialog";
import { optioptika, OPTIOPTIKA_YELLOW } from "@/data/optioptika";

const services = [
  {
    icon: Stethoscope,
    title: "Optometria e Oftalmologia",
    text: "Consultas de optometria clínica e oftalmologia geral.",
  },
  {
    icon: Baby,
    title: "Pediátrica e Neonatal",
    text: "Oftalmologia pediátrica, neonatal e teste do olhinho.",
  },
  {
    icon: ScanEye,
    title: "Exames de Saúde Ocular",
    text: "Retinografia, campimetria, topografia corneal, OCT e tonometria.",
  },
  {
    icon: Eye,
    title: "Catarata, Glaucoma e Cores",
    text: "Rastreio e acompanhamento de catarata, glaucoma e visão das cores.",
  },
];

interface ClinicalPartnersProps {
  defaultOpen?: boolean;
}

const ClinicalPartners = ({ defaultOpen = false }: ClinicalPartnersProps) => {
  const [open, setOpen] = useState(defaultOpen);
  const [logoError, setLogoError] = useState(false);

  useEffect(() => {
    if (defaultOpen) setOpen(true);
  }, [defaultOpen]);

  return (
    <section id="parceiros-clinicos" className="pt-8 pb-20 md:pt-12 md:pb-28 bg-muted/40">
      <div className="container px-6">
        <div className="text-center max-w-2xl mx-auto mb-14 space-y-3">
          <span className="text-sm font-medium tracking-widest uppercase text-teal">
            Parceiros Clínicos
          </span>
          <h2 className="text-3xl md:text-5xl font-bold text-foreground leading-tight">
            Clínicas de confiança da nossa rede
          </h2>
          <p className="text-base md:text-lg text-muted-foreground leading-relaxed">
            Profissionais e instituições certificadas que colaboram directamente com o Janelas para a Alma no atendimento aos nossos beneficiários.
          </p>
        </div>

        {/* Óptica Optioptika Profile Card */}
        <article className="max-w-5xl mx-auto rounded-3xl overflow-hidden bg-card border border-border/60 shadow-elevated">
          {/* Header banner — cores da marca Optioptika (amarelo, preto, branco) */}
          <div
            className="relative text-black p-8 md:p-10"
            style={{ backgroundColor: OPTIOPTIKA_YELLOW }}
          >
            <div
              className="absolute inset-0 opacity-10 pointer-events-none"
              style={{
                backgroundImage:
                  "radial-gradient(circle at 15% 20%, black 1.5px, transparent 1.5px)",
                backgroundSize: "22px 22px",
              }}
            />
            <div className="relative flex flex-col md:flex-row md:items-center gap-6">
              <div className="w-20 h-20 md:w-24 md:h-24 rounded-2xl bg-white shadow-card border border-black/10 flex items-center justify-center shrink-0 overflow-hidden">
                {logoError ? (
                  <Building2 className="w-10 h-10 md:w-12 md:h-12 text-black" />
                ) : (
                  <img
                    src="/optioptika-logo.png"
                    alt="Logótipo Optioptika"
                    className="w-full h-full object-contain p-2"
                    onError={() => setLogoError(true)}
                  />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 text-black/70 text-sm font-semibold mb-1">
                  <Star className="w-4 h-4 fill-black text-black" />
                  Parceiro Clínico Oficial
                </div>
                <h3 className="text-3xl md:text-4xl font-black leading-tight mb-2">
                  {optioptika.name}
                </h3>
                <p className="text-black/80 text-base md:text-lg font-medium">
                  {optioptika.tagline}
                </p>
                <div className="flex flex-wrap gap-2 mt-4">
                  {optioptika.badges.map((b) => (
                    <span
                      key={b}
                      className="text-xs font-medium px-3 py-1 rounded-full bg-black/10 border border-black/15"
                    >
                      {b}
                    </span>
                  ))}
                </div>
              </div>
              <div className="flex flex-col sm:flex-row gap-3 shrink-0">
                <Button
                  size="lg"
                  onClick={() => setOpen(true)}
                  className="bg-black text-white hover:bg-black/80 font-semibold"
                >
                  <CalendarPlus className="w-5 h-5 mr-2" />
                  Agendar Consulta
                </Button>
                <Button
                  asChild
                  size="lg"
                  variant="outline"
                  className="border-black/30 bg-transparent text-black hover:bg-black/10 font-semibold"
                >
                  <Link to="/portal-clinico/optioptika">
                    Saber mais
                    <ArrowRight className="w-5 h-5 ml-2" />
                  </Link>
                </Button>
              </div>
            </div>
          </div>

          {/* Body */}
          <div className="grid md:grid-cols-3 gap-0">
            {/* Left: about + contact */}
            <div className="md:col-span-1 p-8 md:border-r border-border/60 space-y-6 bg-background/60">
              <div>
                <h4 className="text-sm font-bold uppercase tracking-widest text-teal mb-3">
                  Sobre a Clínica
                </h4>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {optioptika.description}
                </p>
              </div>

              <div className="space-y-3 pt-2 border-t border-border/60">
                <div className="flex items-start gap-3">
                  <MapPin className="w-4 h-4 text-teal mt-0.5 shrink-0" />
                  <span className="text-sm text-foreground">{optioptika.location}</span>
                </div>
                <div className="flex items-start gap-3">
                  <Phone className="w-4 h-4 text-teal mt-0.5 shrink-0" />
                  <a
                    href={`tel:${optioptika.phone.replace(/\s/g, "")}`}
                    className="text-sm text-foreground hover:text-teal transition-colors"
                  >
                    {optioptika.phone}
                  </a>
                </div>
                <div className="flex items-start gap-3">
                  <Mail className="w-4 h-4 text-teal mt-0.5 shrink-0" />
                  <a
                    href={`mailto:${optioptika.email}`}
                    className="text-sm text-foreground hover:text-teal transition-colors break-all"
                  >
                    {optioptika.email}
                  </a>
                </div>
                <div className="flex items-start gap-3">
                  <Clock className="w-4 h-4 text-teal mt-0.5 shrink-0" />
                  <span className="text-sm text-foreground">{optioptika.hours}</span>
                </div>
              </div>
            </div>

            {/* Right: services */}
            <div className="md:col-span-2 p-8">
              <h4 className="text-sm font-bold uppercase tracking-widest text-teal mb-5">
                Serviços Disponíveis
              </h4>
              <div className="grid sm:grid-cols-2 gap-4">
                {services.map((s) => (
                  <div
                    key={s.title}
                    className="flex items-start gap-4 p-4 rounded-xl border border-border/60 bg-background/60 hover:border-teal/40 hover:shadow-card transition-all"
                  >
                    <div className="inline-flex items-center justify-center w-11 h-11 rounded-xl bg-teal/10 text-teal shrink-0">
                      <s.icon className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <h5 className="font-semibold text-foreground text-sm mb-1">
                        {s.title}
                      </h5>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        {s.text}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground italic mt-5">
                * Valores e disponibilidade confirmados directamente com a clínica no acto do agendamento.
              </p>
            </div>
          </div>
        </article>
      </div>

      <OptioptikaBookingDialog open={open} onOpenChange={setOpen} />

    </section>
  );
};

export default ClinicalPartners;
