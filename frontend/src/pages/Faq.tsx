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
import { Trans, useTranslation } from "react-i18next";
import i18n from "@/i18n";
import { localizar } from "@/i18n/rotas";

interface FaqItem {
  icon: typeof HelpCircle;
  question: string;
  answer: React.ReactNode;
}

const FAQ_ITEMS: FaqItem[] = [
  {
    icon: ShieldCheck,
    get question() {
      return i18n.t("Faq.osMeusDadosDe");
    },
    get answer() {
      return (
        <>
          <Trans i18nKey="Faq.simOsDadosDe" components={{ ligacao: <Link to={localizar("/politica-de-privacidade")} className="text-primary hover:underline font-medium" /> }} />
        </>
      );
    },
  },
  {
    icon: Trash2,
    get question() {
      return i18n.t("Faq.possoApagarAMinha");
    },
    get answer() {
      return (
        <>
          <Trans i18nKey="Faq.simAQualquerMomento" components={{ ligacao: <Link to={localizar("/politica-de-privacidade")} className="text-primary hover:underline font-medium" /> }} />
        </>
      );
    },
  },
  {
    icon: Stethoscope,
    get question() {
      return i18n.t("Faq.oResultadoDaTriagem");
    },
    get answer() {
      return (
        <>
          <Trans i18nKey="Faq.naoORastreioDigital" components={{ ligacao: <Link to={localizar("/termos-de-utilizacao")} className="text-primary hover:underline font-medium" /> }} />
        </>
      );
    },
  },
  {
    icon: Users,
    get question() {
      return i18n.t("Faq.aPlataformaPartilhaOs");
    },
    get answer() {
      return (
        <>
          <Trans i18nKey="Faq.soQuandoOUtilizador" components={{ ligacao: <Link to={localizar("/politica-de-privacidade")} className="text-primary hover:underline font-medium" /> }} />
        </>
      );
    },
  },
  {
    icon: Cookie,
    get question() {
      return i18n.t("Faq.oSiteUtilizaCookies");
    },
    get answer() {
      return (
        <>
          <Trans i18nKey="Faq.utilizamosApenasCookiesTecnicos" components={{ ligacao: <Link to={localizar("/politica-de-privacidade")} className="text-primary hover:underline font-medium" /> }} />
        </>
      );
    },
  },
  // Para adicionar novas perguntas: incluir um novo objecto neste array, com o mesmo formato
  // { icon, question, answer }. O acordeão renderiza automaticamente cada novo item.
];

const Faq = () => {
  const { t } = useTranslation();
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />
      <main className="flex-1 pt-24 pb-16 px-4">
        <div className="max-w-3xl mx-auto">
          <BackButton />

          <div className="text-center mb-10">
            <h1 className="text-3xl md:text-4xl font-bold text-primary mb-3">
              {t("Faq.perguntasFrequentes")}
            </h1>
            <p className="text-muted-foreground text-base md:text-lg max-w-2xl mx-auto">
              {t("Faq.respostasRapidasSobrePrivacidade")}
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
            <Trans i18nKey="Faq.naoEncontrouAResposta" components={{ a: <a href="mailto:janelasparaalma18@gmail.com" className="text-primary hover:underline font-medium" /> }} />
          </p>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default Faq;
