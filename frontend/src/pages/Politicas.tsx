import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import BackButton from "@/components/BackButton";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Database, Target, Users, UserCheck, Lock } from "lucide-react";

const SECTIONS = [
  {
    icon: Database,
    title: "Coleta de Dados",
    body:
      "Recolhemos informações básicas (nome, email, telefone, província) e dados voluntários de saúde visual (tipo de estrabismo, histórico partilhado) fornecidos diretamente por si durante o registo ou formulários da plataforma, além de dados básicos de navegação para melhorar o funcionamento do site.",
  },
  {
    icon: Target,
    title: "Finalidade do Uso",
    body:
      "Os seus dados são utilizados estritamente para personalizar a sua experiência (ex: recomendar exercícios visuais adequados), conectar pacientes a clínicas parceiras (apenas quando solicitado), e enviar comunicações vitais sobre o projeto Janelas Para a Alma.",
  },
  {
    icon: Users,
    title: "Compartilhamento com Terceiros",
    body:
      "A sua privacidade é absoluta. Não vendemos dados. As suas informações só são partilhadas com profissionais de saúde e clínicas oftalmológicas parceiras quando o utilizador demonstra interesse direto (ex: agendamento de consultas) ou mediante consentimento explícito na página da Comunidade.",
  },
  {
    icon: UserCheck,
    title: "Direitos do Usuário",
    body:
      "Em total conformidade com as boas práticas globais de proteção de dados (como LGPD e GDPR), o utilizador tem o direito de aceder, corrigir, descarregar ou solicitar a eliminação definitiva da sua conta e informações a qualquer momento através da aba de Configurações.",
  },
  {
    icon: Lock,
    title: "Segurança e Armazenamento",
    body:
      "Implementamos medidas técnicas rigorosas e protocolos de segurança padrão da indústria para proteger as suas informações contra acessos não autorizados, perdas ou vazamentos, garantindo um ambiente digital seguro e acolhedor.",
  },
];

const Politicas = () => {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />
      <main className="flex-1 pt-24 pb-16 px-4">
        <div className="max-w-3xl mx-auto">
          <BackButton />

          <div className="text-center mb-10">
            <h1 className="text-3xl md:text-4xl font-bold text-primary mb-3">
              Políticas de Privacidade e Termos de Uso
            </h1>
            <p className="text-muted-foreground text-base md:text-lg max-w-2xl mx-auto">
              O nosso compromisso com a sua privacidade, segurança e proteção de dados médicos e pessoais.
            </p>
          </div>

          <div className="bg-card border border-border/60 rounded-2xl shadow-lg p-4 md:p-8">
            <p className="text-sm text-muted-foreground mb-6 leading-relaxed">
              Esta página é mantida pela equipa do <strong className="text-foreground">Janelas Para a Alma</strong> para
              responder às perguntas mais comuns sobre privacidade e utilização da plataforma. O conteúdo abaixo descreve
              práticas visíveis na aplicação e não constitui certificação legal independente.
            </p>

            <Accordion type="single" collapsible defaultValue="item-0" className="w-full">
              {SECTIONS.map((s, i) => {
                const Icon = s.icon;
                return (
                  <AccordionItem
                    key={s.title}
                    value={`item-${i}`}
                    className="border-b border-border/60 last:border-0"
                  >
                    <AccordionTrigger className="hover:no-underline py-5 group">
                      <div className="flex items-center gap-3 text-left">
                        <span className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0 group-hover:bg-primary/15 transition-colors">
                          <Icon className="w-5 h-5" />
                        </span>
                        <span className="font-semibold text-foreground text-base md:text-lg">
                          {s.title}
                        </span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="pl-13 md:pl-14 pr-2 text-muted-foreground text-[15px] leading-relaxed">
                      {s.body}
                    </AccordionContent>
                  </AccordionItem>
                );
              })}
            </Accordion>
          </div>

          <p className="text-center text-xs text-muted-foreground mt-8">
            Última atualização: Julho de 2026. Para dúvidas legais, contacte{" "}
            <a
              href="mailto:janelasparaalma18@gmail.com"
              className="text-primary hover:underline font-medium"
            >
              janelasparaalma18@gmail.com
            </a>
            .
          </p>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default Politicas;
