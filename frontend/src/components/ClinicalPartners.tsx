import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { z } from "zod";
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
  Video,
  MapPinned,
  Star,
  ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

const OPTIOPTIKA_YELLOW = "#FFD500";

const optioptika = {
  name: "Óptica Optioptika",
  tagline: "Visão da Banda",
  location: "Urbanização Nova Vida, Rua 54, Centro Empresarial Living-Luanda",
  phone: "+244 931 240 304",
  email: "geral@optioptika.com",
  hours: "Seg–Qui · 08h–17h · Sáb · 08h–13h",
  description:
    "Parceiro clínico oficial do Janelas para a Alma, a Optioptika reúne uma equipa multidisciplinar dedicada à saúde visual — do rastreio à correcção óptica — com atendimento humanizado e tecnologia moderna.",
  badges: ["Parceiro Oficial", "Consultas Presenciais e Online", "Equipa Certificada"],
};

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

const appointmentSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Indique o seu nome")
    .max(100, "Máximo 100 caracteres"),
  email: z
    .string()
    .trim()
    .email("Email inválido")
    .max(255, "Máximo 255 caracteres"),
  phone: z
    .string()
    .trim()
    .min(6, "Telefone inválido")
    .max(30, "Máximo 30 caracteres"),
  date: z.string().min(1, "Escolha uma data"),
  period: z.string().min(1, "Escolha um período"),
  notes: z.string().trim().max(500, "Máximo 500 caracteres").optional(),
});

type Mode = "online" | "presencial";

interface BookingReceipt {
  id: string;
  createdAt: string;
  mode: Mode;
  name: string;
  email: string;
  phone: string;
  date: string;
  period: string;
  notes?: string;
}

interface ClinicalPartnersProps {
  defaultOpen?: boolean;
}

const ClinicalPartners = ({ defaultOpen = false }: ClinicalPartnersProps) => {
  const [open, setOpen] = useState(defaultOpen);
  const [mode, setMode] = useState<Mode>("presencial");
  const [receipt, setReceipt] = useState<BookingReceipt | null>(null);
  const [logoError, setLogoError] = useState(false);
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    date: "",
    period: "",
    notes: "",
  });

  useEffect(() => {
    if (defaultOpen) setOpen(true);
  }, [defaultOpen]);

  const update = (k: keyof typeof form, v: string) =>
    setForm((prev) => ({ ...prev, [k]: v }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const result = appointmentSchema.safeParse(form);
    if (!result.success) {
      toast.error(result.error.issues[0]?.message ?? "Verifique os campos do formulário.");
      return;
    }
    // Optimistic UI: create + show booking receipt instantly.
    const booking: BookingReceipt = {
      id: `OPT-${Date.now().toString(36).toUpperCase()}`,
      createdAt: new Date().toLocaleString("pt-PT"),
      mode,
      ...result.data,
    };
    setReceipt(booking);
    toast.success(
      `Pedido enviado à ${optioptika.name}. Entraremos em contacto para confirmar a sua consulta ${mode === "online" ? "online" : "presencial"}.`,
    );
    setForm({ name: "", email: "", phone: "", date: "", period: "", notes: "" });
  };

  const closeDialog = () => {
    setOpen(false);
    setReceipt(null);
  };


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

      {/* Agendar Consulta Modal */}
      <Dialog open={open} onOpenChange={(v) => (v ? setOpen(true) : closeDialog())}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          {receipt ? (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-xl">
                  <CalendarPlus className="w-5 h-5 text-teal" />
                  Pedido de Consulta Confirmado
                </DialogTitle>
                <DialogDescription>
                  A {optioptika.name} entrará em contacto por email ou telefone para
                  confirmar o horário definitivo.
                </DialogDescription>
              </DialogHeader>
              <div className="rounded-lg border border-border bg-muted/40 p-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Nº do pedido</span>
                  <span className="font-mono font-semibold">{receipt.id}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Emitido</span>
                  <span>{receipt.createdAt}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Modalidade</span>
                  <span className="capitalize">{receipt.mode}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Nome</span>
                  <span>{receipt.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Contactos</span>
                  <span className="text-right">{receipt.email}<br/>{receipt.phone}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Data / Período</span>
                  <span>{receipt.date} — {receipt.period}</span>
                </div>
              </div>
              <DialogFooter>
                <Button onClick={closeDialog} className="w-full">Fechar</Button>
              </DialogFooter>
            </>
          ) : (
          <>

          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              <CalendarPlus className="w-5 h-5 text-teal" />
              Agendar Consulta — {optioptika.name}
            </DialogTitle>
            <DialogDescription>
              Escolha a modalidade e preencha os seus dados. A clínica confirmará o horário por email ou telefone.
            </DialogDescription>
          </DialogHeader>

          <Tabs value={mode} onValueChange={(v) => setMode(v as Mode)} className="w-full">
            <TabsList className="grid grid-cols-2 w-full h-auto p-1.5 mb-4">
              <TabsTrigger
                value="presencial"
                className="flex items-center gap-2 py-2.5 data-[state=active]:bg-navy data-[state=active]:text-navy-foreground"
              >
                <MapPinned className="w-4 h-4" />
                Presencial
              </TabsTrigger>
              <TabsTrigger
                value="online"
                className="flex items-center gap-2 py-2.5 data-[state=active]:bg-teal data-[state=active]:text-teal-foreground"
              >
                <Video className="w-4 h-4" />
                Online
              </TabsTrigger>
            </TabsList>

            <TabsContent value="presencial" className="mt-0 mb-4">
              <div className="rounded-lg border border-navy/20 bg-navy/5 p-4 text-sm text-muted-foreground">
                Consulta presencial na clínica <strong className="text-foreground">{optioptika.name}</strong> em {optioptika.location}. Traga documento de identificação e prescrições anteriores, se disponíveis.
              </div>
            </TabsContent>
            <TabsContent value="online" className="mt-0 mb-4">
              <div className="rounded-lg border border-teal/20 bg-teal/5 p-4 text-sm text-muted-foreground">
                Consulta por videochamada. Receberá um link seguro por email antes da hora marcada. Ideal para triagem inicial e acompanhamento.
              </div>
            </TabsContent>
          </Tabs>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="ap-name">Nome completo</Label>
                <Input
                  id="ap-name"
                  value={form.name}
                  onChange={(e) => update("name", e.target.value)}
                  maxLength={100}
                  required
                  placeholder="Ex.: Ana Silva"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ap-email">Email</Label>
                <Input
                  id="ap-email"
                  type="email"
                  value={form.email}
                  onChange={(e) => update("email", e.target.value)}
                  maxLength={255}
                  required
                  placeholder="seu@email.com"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ap-phone">Telefone</Label>
                <Input
                  id="ap-phone"
                  type="tel"
                  value={form.phone}
                  onChange={(e) => update("phone", e.target.value)}
                  maxLength={30}
                  required
                  placeholder="+244 900 000 000"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ap-date">Data preferida</Label>
                <Input
                  id="ap-date"
                  type="date"
                  value={form.date}
                  onChange={(e) => update("date", e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ap-period">Período</Label>
                <Select
                  value={form.period}
                  onValueChange={(v) => update("period", v)}
                >
                  <SelectTrigger id="ap-period">
                    <SelectValue placeholder="Escolher período" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="manha">Manhã (08h30 – 12h00)</SelectItem>
                    <SelectItem value="tarde">Tarde (14h00 – 18h00)</SelectItem>
                    <SelectItem value="sabado">Sábado (09h00 – 13h00)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="ap-notes">Motivo da consulta (opcional)</Label>
                <Textarea
                  id="ap-notes"
                  value={form.notes}
                  onChange={(e) => update("notes", e.target.value)}
                  maxLength={500}
                  rows={3}
                  placeholder="Descreva sintomas, histórico ou dúvidas específicas."
                />
              </div>
            </div>

            <DialogFooter>
              <Button
                type="submit"
                className={`w-full ${mode === "online" ? "bg-teal text-teal-foreground hover:bg-teal/90" : "bg-navy text-navy-foreground hover:bg-navy/90"}`}
              >
                Solicitar Consulta {mode === "online" ? "Online" : "Presencial"}
              </Button>
            </DialogFooter>
            </form>
          </>
          )}
        </DialogContent>
      </Dialog>

    </section>
  );
};

export default ClinicalPartners;
