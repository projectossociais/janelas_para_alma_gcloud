import { useState } from "react";
import { z } from "zod";
import { Heart, Mail, MapPin, Send, CheckCircle, Star, Users, Award, BookOpen } from "lucide-react";
import ProgramModal from "@/components/ProgramModal";
import benefitTeamwork from "@/assets/benefit-teamwork.jpg";
import benefitPortrait from "@/assets/benefit-portrait.jpg";
import benefitMeeting from "@/assets/benefit-meeting.jpg";
import benefitCertificate from "@/assets/benefit-certificate.png";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { sendToEdgeFunction } from "@/lib/edgeFunction";
import { contactMessagesApi, mensagemDeErroApi } from "@/lib/apiClient";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

const contactSchema = z.object({
  name: z.string().trim().min(1, "Nome é obrigatório").max(100, "Máximo 100 caracteres"),
  email: z.string().trim().email("Email inválido").max(255, "Máximo 255 caracteres"),
  message: z.string().trim().min(1, "Mensagem é obrigatória").max(1000, "Máximo 1000 caracteres"),
});

const volunteerSchema = z.object({
  name: z.string().trim().min(1, "Nome é obrigatório").max(100, "Máximo 100 caracteres"),
  email: z.string().trim().email("Email inválido").max(255, "Máximo 255 caracteres"),
  phone: z.string().trim().min(1, "Telefone é obrigatório").max(20, "Máximo 20 caracteres"),
  motivation: z.string().trim().min(1, "Motivação é obrigatória").max(1000, "Máximo 1000 caracteres"),
});


const volunteerBenefits = [
  { icon: Star, text: "Certificado de participação em iniciativa social" },
  { icon: Users, text: "Integração numa rede de jovens activistas" },
  { icon: Award, text: "Desenvolvimento de competências de liderança" },
  { icon: Heart, text: "Impacto directo na vida de pessoas com estrabismo" },
  { icon: CheckCircle, text: "Experiência prática em economia circular" },
];

const ContactSection = () => {
  const { toast } = useToast();
  const [contactOpen, setContactOpen] = useState(false);
  const [volunteerInfoOpen, setVolunteerInfoOpen] = useState(false);
  const [signupOpen, setSignupOpen] = useState(false);
  const [programOpen, setProgramOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const openContactModal = () => {
    setContactOpen(true);
    setErrors({});
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrors({});

    const formData = new FormData(e.currentTarget);
    const data = {
      name: formData.get("name") as string,
      email: formData.get("email") as string,
      message: formData.get("message") as string,
    };

    const result = contactSchema.safeParse(data);
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.issues.forEach((err) => {
        if (err.path[0]) fieldErrors[err.path[0] as string] = err.message;
      });
      setErrors(fieldErrors);
      return;
    }

    setLoading(true);
    try {
      // Grava na API própria. A notificação por email à equipa fica
      // pendente (fornecedor de email por decidir) — mas a mensagem já não
      // se perde, e nunca mostramos "enviado" sem a gravação confirmar.
      await contactMessagesApi.enviar(result.data.name, result.data.email, result.data.message);
      toast({
        title: "Mensagem registada!",
        description: "Obrigado pelo contacto. A nossa equipa vai analisar e responder-lhe.",
      });
      setContactOpen(false);
      (e.target as HTMLFormElement).reset();
    } catch (err) {
      console.error("Contact form error:", err);
      toast({
        title: "Erro ao enviar",
        description: mensagemDeErroApi(err, "Verifique a sua ligação à internet e tente novamente."),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrors({});

    const formData = new FormData(e.currentTarget);
    const data = {
      name: formData.get("name") as string,
      email: formData.get("email") as string,
      phone: formData.get("phone") as string,
      motivation: formData.get("motivation") as string,
    };

    const result = volunteerSchema.safeParse(data);
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.issues.forEach((err) => {
        if (err.path[0]) fieldErrors[err.path[0] as string] = err.message;
      });
      setErrors(fieldErrors);
      return;
    }

    setLoading(true);
    try {
      const resp = await sendToEdgeFunction("send-volunteer-email", result.data);
      if (resp?.error) throw new Error(resp.error);
      toast({
        title: "Inscrição submetida com sucesso!",
        description: "Bem-vindo(a) à equipa! Entraremos em contacto em breve.",
      });
      setSignupOpen(false);
      (e.target as HTMLFormElement).reset();
    } catch (err) {
      console.error("Volunteer form error:", err);
      toast({
        title: "Erro ao submeter",
        description: err instanceof Error ? err.message : "Verifique a sua ligação à internet e tente novamente.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <section id="contacto" className="py-20 md:py-28 bg-muted/50">
      {/* Preload volunteer benefit images for instant modal rendering */}
      <div className="hidden" aria-hidden="true">
        <img src={benefitTeamwork} alt="" />
        <img src={benefitPortrait} alt="" />
        <img src={benefitCertificate} alt="" />
        <img src={benefitMeeting} alt="" />
      </div>
      <div className="container">
        <div className="max-w-5xl mx-auto">
          <div className="text-center space-y-6 mb-12">
            <span className="text-sm font-medium tracking-widest uppercase text-teal">
              Junte-se a Nós
            </span>
            <h2 className="text-3xl md:text-5xl font-bold text-foreground">
              Faça parte desta transformação
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Quer seja através de voluntariado, doação de óculos, parceria
              institucional ou apoio financeiro — cada contribuição faz a
              diferença.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
            {/* Voluntariado card */}
            <button
              onClick={() => setVolunteerInfoOpen(true)}
              className="p-6 rounded-2xl bg-card shadow-card border border-border/50 space-y-3 transition-all hover:shadow-elevated hover:scale-[1.03] text-center cursor-pointer focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
            >
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-teal/10 text-teal mx-auto">
                <Heart className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-foreground">Voluntariado</h3>
              <p className="text-muted-foreground text-sm">
                Participe nas nossas acções comunitárias e faça a diferença.
              </p>
              <p className="text-xs text-teal font-medium">Ver benefícios →</p>
            </button>

            {/* Email card */}
            <a
              href="mailto:janelasparaalma18@gmail.com"
              target="_blank"
              rel="noopener noreferrer"
              className="p-6 rounded-2xl bg-card shadow-card border border-border/50 space-y-3 transition-all hover:shadow-elevated hover:scale-[1.03] text-center block focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
            >
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-gold/10 text-gold mx-auto">
                <Mail className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-foreground">Email</h3>
              <p className="text-muted-foreground text-sm">
                janelasparaalma18@gmail.com
              </p>
              <p className="text-xs text-gold font-medium">Enviar mensagem →</p>
            </a>

            {/* Localização card */}
            <a
              href="https://www.google.com/maps/place/Luanda,+Angola"
              target="_top"
              rel="noopener noreferrer"
              className="p-6 rounded-2xl bg-card shadow-card border border-border/50 space-y-3 transition-all hover:shadow-elevated hover:scale-[1.03] text-center cursor-pointer block focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
            >
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-green/10 text-green mx-auto">
                <MapPin className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-foreground">Localização</h3>
              <p className="text-muted-foreground text-sm">Luanda, Angola</p>
              <p className="text-xs text-green font-medium">Ver no Google Maps →</p>
            </a>
          </div>

          <div className="text-center">
            <button
              onClick={openContactModal}
              className="inline-flex items-center gap-3 px-10 py-5 rounded-xl bg-teal text-teal-foreground font-bold text-lg transition-all hover:opacity-90 hover:translate-y-[-2px] hover:shadow-2xl shadow-elevated"
            >
              <Send className="w-5 h-5" />
              Envie-nos uma mensagem
            </button>
          </div>
        </div>
      </div>

      {/* Contact Modal */}
      <Dialog open={contactOpen} onOpenChange={setContactOpen}>
        <DialogContent className="sm:max-w-lg backdrop-blur-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3 text-xl">
              <div className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-teal/10 text-teal">
                <Send className="w-5 h-5" />
              </div>
              Envie-nos uma mensagem
            </DialogTitle>
            <DialogDescription>
              Preencha os campos abaixo e entraremos em contacto consigo.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-5 pt-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">Nome</label>
              <Input name="name" placeholder="O seu nome" maxLength={100} />
              {errors.name && <p className="text-sm text-destructive">{errors.name}</p>}
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Email</label>
              <Input name="email" type="email" placeholder="email@exemplo.com" maxLength={255} />
              {errors.email && <p className="text-sm text-destructive">{errors.email}</p>}
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Mensagem</label>
              <Textarea name="message" placeholder="Como podemos ajudar?" maxLength={1000} rows={4} />
              {errors.message && <p className="text-sm text-destructive">{errors.message}</p>}
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full inline-flex items-center justify-center px-6 py-3 rounded-lg bg-teal text-teal-foreground font-medium transition-all hover:opacity-90 shadow-elevated disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "A enviar..." : "Enviar Mensagem"}
            </button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Volunteer Benefits Modal */}
      <Dialog open={volunteerInfoOpen} onOpenChange={setVolunteerInfoOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3 text-xl">
              <div className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-teal/10 text-teal">
                <Heart className="w-5 h-5" />
              </div>
              Benefícios de ser um Kamba
            </DialogTitle>
            <DialogDescription>
              Descobre as vantagens de te juntares à nossa equipa de voluntários.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-5 pt-2">
            {/* Image grid — unique images, no descriptions */}
            <div className="grid grid-cols-2 gap-3">
              {[benefitTeamwork, benefitPortrait, benefitCertificate, benefitMeeting].map((src, i) => (
                <img
                  key={i}
                  src={src}
                  alt=""
                  className="h-32 md:h-40 w-full object-cover rounded-xl shadow-sm"
                />
              ))}
            </div>

            <ul className="space-y-3">
              {volunteerBenefits.map((benefit, i) => (
                <li key={i} className="flex items-start gap-3">
                  <div className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-teal/10 text-teal shrink-0 mt-0.5">
                    <benefit.icon className="w-4 h-4" />
                  </div>
                  <span className="text-muted-foreground leading-relaxed">{benefit.text}</span>
                </li>
              ))}
            </ul>

            <div className="flex flex-col gap-3">
              <button
                onClick={() => {
                  setVolunteerInfoOpen(false);
                  setTimeout(() => setSignupOpen(true), 150);
                }}
                className="w-full inline-flex items-center justify-center px-6 py-3 rounded-lg bg-teal text-teal-foreground font-medium transition-all hover:opacity-90 shadow-elevated"
              >
                Quero ser um Kamba
              </button>
              <button
                onClick={() => {
                  setVolunteerInfoOpen(false);
                  setTimeout(() => setProgramOpen(true), 150);
                }}
                className="w-full inline-flex items-center justify-center gap-2 px-6 py-3 rounded-lg border border-border bg-background text-foreground font-medium transition-all hover:bg-muted"
              >
                <BookOpen className="w-4 h-4" />
                Saber mais sobre o Programa
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Signup Modal (from benefits) */}
      <Dialog open={signupOpen} onOpenChange={setSignupOpen}>
        <DialogContent className="sm:max-w-lg backdrop-blur-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3 text-xl">
              <div className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-teal/10 text-teal">
                <Heart className="w-5 h-5" />
              </div>
              Formulário de Inscrição
            </DialogTitle>
            <DialogDescription>
              Preenche os campos abaixo para te inscreveres como voluntário.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSignup} className="space-y-5 pt-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Nome completo</label>
                <Input name="name" placeholder="O teu nome" maxLength={100} />
                {errors.name && <p className="text-sm text-destructive">{errors.name}</p>}
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Email</label>
                <Input name="email" type="email" placeholder="email@exemplo.com" maxLength={255} />
                {errors.email && <p className="text-sm text-destructive">{errors.email}</p>}
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Telefone</label>
              <Input name="phone" placeholder="+244 9XX XXX XXX" maxLength={20} />
              {errors.phone && <p className="text-sm text-destructive">{errors.phone}</p>}
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Breve Motivação</label>
              <Textarea name="motivation" placeholder="Porque queres ser um Kamba?" maxLength={1000} rows={4} />
              {errors.motivation && <p className="text-sm text-destructive">{errors.motivation}</p>}
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full inline-flex items-center justify-center px-6 py-3 rounded-lg bg-teal text-teal-foreground font-medium transition-all hover:opacity-90 shadow-elevated disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "A submeter..." : "Inscrever-me como Kamba"}
            </button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Program Info Modal */}
      <ProgramModal open={programOpen} onOpenChange={setProgramOpen} />
    </section>
  );
};

export default ContactSection;
