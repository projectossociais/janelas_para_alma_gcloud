import { Link } from "react-router-dom";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import BackButton from "@/components/BackButton";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { HelpCircle, ShieldCheck, Stethoscope, Trash2, Users, Cookie } from "lucide-react";

interface FaqItem {
  icon: typeof HelpCircle;
  question: string;
  answer: React.ReactNode;
}

const FAQ_ITEMS: FaqItem[] = [
  {
    icon: ShieldCheck,
    question: "Os meus dados de saúde ficam protegidos?",
    answer: (
      <>
        Sim. Os dados de saúde (como os resultados do rastreio de estrabismo) são tratados como categoria
        especial de dados, só são recolhidos mediante o seu consentimento explícito e são protegidos com
        medidas técnicas de segurança adequadas. Consulte as secções 3 e 9 da nossa{" "}
        <Link to="/politica-de-privacidade" className="text-primary hover:underline font-medium">
          Política de Privacidade
        </Link>{" "}
        para mais detalhes.
      </>
    ),
  },
  {
    icon: Trash2,
    question: "Posso apagar a minha conta e os meus dados?",
    answer: (
      <>
        Sim, a qualquer momento. Pode solicitar a eliminação da sua conta e dos dados associados através da
        área de Configurações ou contactando-nos directamente. Este é um dos seus direitos enquanto titular de
        dados pessoais — ver secção 7 (
        <Link to="/politica-de-privacidade" className="text-primary hover:underline font-medium">
          Direitos do Titular
        </Link>
        ) da Política de Privacidade.
      </>
    ),
  },
  {
    icon: Stethoscope,
    question: "O resultado da triagem substitui uma consulta médica?",
    answer: (
      <>
        Não. O rastreio digital e os exercícios interactivos têm carácter preventivo e orientador — não
        constituem diagnóstico médico e não substituem uma avaliação oftalmológica presencial. Ver o Aviso
        Médico-Legal na secção 5 dos{" "}
        <Link to="/termos-de-utilizacao" className="text-primary hover:underline font-medium">
          Termos de Utilização
        </Link>
        .
      </>
    ),
  },
  {
    icon: Users,
    question: "A plataforma partilha os meus dados com clínicas parceiras?",
    answer: (
      <>
        Só quando o utilizador demonstra interesse directo em ser encaminhado, mediante consentimento explícito.
        Não vendemos nem cedemos dados para fins comerciais de terceiros. Ver secção 5 (
        <Link to="/politica-de-privacidade" className="text-primary hover:underline font-medium">
          Partilha de Dados com Terceiros
        </Link>
        ).
      </>
    ),
  },
  {
    icon: Cookie,
    question: "O site utiliza cookies?",
    answer: (
      <>
        Utilizamos apenas cookies técnicos essenciais e, quando aplicável, cookies estatísticos para melhorar a
        experiência de utilização — nunca para fins publicitários de terceiros. Ver secção 11 (
        <Link to="/politica-de-privacidade" className="text-primary hover:underline font-medium">
          Cookies
        </Link>
        ).
      </>
    ),
  },
  // Para adicionar novas perguntas: incluir um novo objecto neste array, com o mesmo formato
  // { icon, question, answer }. O acordeão renderiza automaticamente cada novo item.
];

const Faq = () => {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />
      <main className="flex-1 pt-24 pb-16 px-4">
        <div className="max-w-3xl mx-auto">
          <BackButton />

          <div className="text-center mb-10">
            <h1 className="text-3xl md:text-4xl font-bold text-primary mb-3">
              Perguntas Frequentes
            </h1>
            <p className="text-muted-foreground text-base md:text-lg max-w-2xl mx-auto">
              Respostas rápidas sobre privacidade, dados de saúde e utilização da plataforma Janelas Para a
              Alma.
            </p>
          </div>

          <div className="bg-card border border-border/60 rounded-2xl shadow-lg p-4 md:p-8">
            <Accordion type="single" collapsible defaultValue="item-0" className="w-full">
              {FAQ_ITEMS.map((item, i) => {
                const Icon = item.icon;
                return (
                  <AccordionItem
                    key={item.question}
                    value={`item-${i}`}
                    className="border-b border-border/60 last:border-0"
                  >
                    <AccordionTrigger className="hover:no-underline py-5 group">
                      <div className="flex items-center gap-3 text-left">
                        <span className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0 group-hover:bg-primary/15 transition-colors">
                          <Icon className="w-5 h-5" />
                        </span>
                        <span className="font-semibold text-foreground text-base md:text-lg">
                          {item.question}
                        </span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="pl-13 md:pl-14 pr-2 text-muted-foreground text-[15px] leading-relaxed">
                      {item.answer}
                    </AccordionContent>
                  </AccordionItem>
                );
              })}
            </Accordion>
          </div>

          <p className="text-center text-xs text-muted-foreground mt-8">
            Não encontrou a resposta que procurava? Contacte-nos em{" "}
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

export default Faq;
