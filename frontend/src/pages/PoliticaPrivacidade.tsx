import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import BackButton from "@/components/BackButton";
import {
  Building2,
  Scale,
  Database,
  Target,
  Share2,
  Globe,
  UserCheck,
  ShieldAlert,
  Lock,
  Clock,
  Cookie,
  RefreshCw,
  Mail,
} from "lucide-react";
import { Trans, useTranslation } from "react-i18next";
import i18n from "@/i18n";
import { localizar } from "@/i18n/rotas";
import NotaTraducaoLegal from "@/components/NotaTraducaoLegal";

interface Secao {
  icon: typeof Building2;
  title: string;
  body: React.ReactNode;
}

const SECCOES: Secao[] = [
  {
    icon: Building2,
    get title() {
      return i18n.t("PoliticaPrivacidade.n1IdentificacaoDoResponsavel");
    },
    body: (
      <>
        <p>
          <Trans i18nKey="PoliticaPrivacidade.oJanelasParaA" components={{ strong: <strong className="text-foreground" /> }} />
        </p>
        <p>
          <Trans i18nKey="PoliticaPrivacidade.paraQualquerQuestaoRelativa" components={{ a: <a href="mailto:janelasparaalma18@gmail.com" className="text-primary hover:underline font-medium" /> }} />
        </p>
      </>
    ),
  },
  {
    icon: Scale,
    get title() {
      return i18n.t("PoliticaPrivacidade.n2BaseLegal");
    },
    body: (
      <>
        <p>
          <Trans i18nKey="PoliticaPrivacidade.oTratamentoDeDados" components={{ strong: <strong className="text-foreground" /> }} />
        </p>
        <p>
          <Trans i18nKey="PoliticaPrivacidade.nosTermosDoArtigo" components={{ strong: <strong className="text-foreground" /> }} />
        </p>
      </>
    ),
  },
  {
    icon: Database,
    get title() {
      return i18n.t("PoliticaPrivacidade.n3DadosPessoaisRecolhidos");
    },
    body: (
      <>
        <p><Trans i18nKey="PoliticaPrivacidade.consoanteAFormaComo" /></p>
        <ul className="list-disc pl-5 space-y-1.5">
          <li><Trans i18nKey="PoliticaPrivacidade.dadosDeIdentificacaoE" /></li>
          <li><Trans i18nKey="PoliticaPrivacidade.dadosDeContaCredenciais" /></li>
          <li>
            <Trans i18nKey="PoliticaPrivacidade.dadosDeSaudeE" components={{ strong: <strong className="text-foreground" /> }} />
          </li>
          <li><Trans i18nKey="PoliticaPrivacidade.dadosDeNavegacaoE" /></li>
        </ul>
        <div className="mt-4 flex items-start gap-3 p-4 rounded-xl bg-destructive/5 border border-destructive/20">
          <ShieldAlert className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
          <p className="text-sm">
            <Trans i18nKey="PoliticaPrivacidade.osDadosDeSaude" components={{ strong: <strong className="text-foreground" /> }} />
          </p>
        </div>
      </>
    ),
  },
  {
    icon: Target,
    get title() {
      return i18n.t("PoliticaPrivacidade.n4FinalidadeDoTratamento");
    },
    body: (
      <>
        <p><Trans i18nKey="PoliticaPrivacidade.osDadosRecolhidosSao" /></p>
        <ul className="list-disc pl-5 space-y-1.5">
          <li><Trans i18nKey="PoliticaPrivacidade.personalizarASuaExperiencia" /></li>
          <li>
            <Trans i18nKey="PoliticaPrivacidade.estabelecerALigacaoA" components={{ strong: <strong className="text-foreground" /> }} />
          </li>
          <li><Trans i18nKey="PoliticaPrivacidade.enviarComunicacoesRelevantesSobre" /></li>
          <li><Trans i18nKey="PoliticaPrivacidade.cumprirObrigacoesLegaisE" /></li>
        </ul>
      </>
    ),
  },
  {
    icon: Share2,
    get title() {
      return i18n.t("PoliticaPrivacidade.n5PartilhaDeDados");
    },
    body: (
      <p>
        <Trans i18nKey="PoliticaPrivacidade.naoVendemosNemCedemos" />
      </p>
    ),
  },
  {
    icon: Globe,
    get title() {
      return i18n.t("PoliticaPrivacidade.n6TransferenciaInternacionalDe");
    },
    body: (
      <p>
        <Trans i18nKey="PoliticaPrivacidade.aInfraEstruturaTecnica" components={{ strong: <strong className="text-foreground" /> }} />
      </p>
    ),
  },
  {
    icon: UserCheck,
    get title() {
      return i18n.t("PoliticaPrivacidade.n7OsSeusDireitos");
    },
    body: (
      <>
        <p><Trans i18nKey="PoliticaPrivacidade.nosTermosDaLei" /></p>
        <ul className="list-disc pl-5 space-y-1.5">
          <li><Trans i18nKey="PoliticaPrivacidade.informacaoArtigo25Ser" components={{ strong: <strong className="text-foreground" /> }} /></li>
          <li><Trans i18nKey="PoliticaPrivacidade.acessoArtigo26Obter" components={{ strong: <strong className="text-foreground" /> }} /></li>
          <li><Trans i18nKey="PoliticaPrivacidade.oposicaoArtigo27Opor" components={{ strong: <strong className="text-foreground" /> }} /></li>
          <li><Trans i18nKey="PoliticaPrivacidade.rectificacaoActualizacaoEEliminacao" components={{ strong: <strong className="text-foreground" /> }} /></li>
          <li><Trans i18nKey="PoliticaPrivacidade.retiradaDoConsentimentoA" components={{ strong: <strong className="text-foreground" /> }} /></li>
          <li>
            <Trans i18nKey="PoliticaPrivacidade.portabilidadeAindaQueA" components={{ strong: <strong className="text-foreground" /> }} />
          </li>
        </ul>
        <p>
          <Trans i18nKey="PoliticaPrivacidade.podeExercerEstesDireitos" components={{ a: <a href="mailto:janelasparaalma18@gmail.com" className="text-primary hover:underline font-medium" /> }} />
        </p>
      </>
    ),
  },
  {
    icon: ShieldAlert,
    get title() {
      return i18n.t("PoliticaPrivacidade.n8EntidadeDeSupervisao");
    },
    body: (
      <p>
        <Trans i18nKey="PoliticaPrivacidade.aAutoridadeDeControlo" components={{ strong: <strong className="text-foreground" /> }} />
      </p>
    ),
  },
  {
    icon: Lock,
    get title() {
      return i18n.t("PoliticaPrivacidade.n9SegurancaDaInformacao");
    },
    body: (
      <p>
        <Trans i18nKey="PoliticaPrivacidade.nosTermosDoArtigo2" components={{ strong: <strong className="text-foreground" /> }} />
      </p>
    ),
  },
  {
    icon: Clock,
    get title() {
      return i18n.t("PoliticaPrivacidade.n10ConservacaoDeDados");
    },
    body: (
      <p>
        <Trans i18nKey="PoliticaPrivacidade.conservamosOsSeusDados" />
      </p>
    ),
  },
  {
    icon: Cookie,
    get title() {
      return i18n.t("PoliticaPrivacidade.n11Cookies");
    },
    body: (
      <p>
        <Trans i18nKey="PoliticaPrivacidade.esteWebsiteUtilizaCookies" />
      </p>
    ),
  },
  {
    icon: RefreshCw,
    get title() {
      return i18n.t("PoliticaPrivacidade.n12AlteracoesAEsta");
    },
    body: (
      <p>
        <Trans i18nKey="PoliticaPrivacidade.podemosReverEActualizar" />
      </p>
    ),
  },
];

const PoliticaPrivacidade = () => {
  const { t } = useTranslation();
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />
      <main className="flex-1 pt-24 pb-16 px-4">
        <div className="max-w-3xl mx-auto">
          <BackButton />

          <div className="text-center mb-10">
            <h1 className="text-3xl md:text-4xl font-bold text-primary mb-3">
              {t("PoliticaPrivacidade.politicaDePrivacidade")}
            </h1>
            <p className="text-muted-foreground text-base md:text-lg max-w-2xl mx-auto">
              {t("PoliticaPrivacidade.oNossoCompromissoCom")}
            </p>
            <NotaTraducaoLegal />
          </div>

          <div className="bg-card border border-border/60 rounded-2xl shadow-lg p-4 md:p-8 space-y-10">
            {SECCOES.map((s) => {
              const Icon = s.icon;
              return (
                <section key={s.title}>
                  <div className="flex items-center gap-3 mb-3">
                    <span className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                      <Icon className="w-5 h-5" />
                    </span>
                    <h2 className="font-semibold text-foreground text-base md:text-lg">{s.title}</h2>
                  </div>
                  <div className="pl-13 md:pl-[3.25rem] text-muted-foreground text-[15px] leading-relaxed space-y-3">
                    {s.body}
                  </div>
                </section>
              );
            })}

            <section className="pt-2 border-t border-border/60">
              <div className="flex items-center gap-3 mb-3">
                <span className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                  <Mail className="w-5 h-5" />
                </span>
                <h2 className="font-semibold text-foreground text-base md:text-lg">{t("PoliticaPrivacidade.n13Contacto")}</h2>
              </div>
              <p className="pl-13 md:pl-[3.25rem] text-muted-foreground text-[15px] leading-relaxed">
                <Trans i18nKey="PoliticaPrivacidade.paraExercerOsSeus" components={{ a: <a href="mailto:janelasparaalma18@gmail.com" className="text-primary hover:underline font-medium" />, a2: <a href={localizar("/faq")} className="text-primary hover:underline font-medium" /> }} />
              </p>
            </section>
          </div>

          <p className="text-center text-xs text-muted-foreground mt-8">
            <Trans i18nKey="PoliticaPrivacidade.ultimaActualizacaoSetembroDe" components={{ a: <a href="mailto:janelasparaalma18@gmail.com" className="text-primary hover:underline font-medium" /> }} />
          </p>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default PoliticaPrivacidade;
