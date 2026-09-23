import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import BackButton from "@/components/BackButton";
import {
  Building2,
  FileCheck,
  MonitorSmartphone,
  Copyright,
  AlertTriangle,
  ShieldOff,
  Gavel,
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
      return i18n.t("TermosUtilizacao.n1IdentificacaoENatureza");
    },
    body: (
      <p>
        <Trans i18nKey="TermosUtilizacao.oJanelasParaA" components={{ strong: <strong className="text-foreground" /> }} />
      </p>
    ),
  },
  {
    icon: FileCheck,
    get title() {
      return i18n.t("TermosUtilizacao.n2AceitacaoDosTermos");
    },
    body: (
      <p>
        <Trans i18nKey="TermosUtilizacao.aoAcederEUtilizar" components={{ strong: <strong className="text-foreground" /> }} />
      </p>
    ),
  },
  {
    icon: MonitorSmartphone,
    get title() {
      return i18n.t("TermosUtilizacao.n3UtilizacaoDaPlataforma");
    },
    body: (
      <>
        <p>
          <Trans i18nKey="TermosUtilizacao.aPlataformaDestinaSe" />
        </p>
        <ul className="list-disc pl-5 space-y-1.5">
          <li><Trans i18nKey="TermosUtilizacao.fornecerInformacaoVerdadeiraE" /></li>
          <li><Trans i18nKey="TermosUtilizacao.naoUtilizarAPlataforma" /></li>
          <li><Trans i18nKey="TermosUtilizacao.naoTentarAcederIndevidamente" /></li>
          <li><Trans i18nKey="TermosUtilizacao.manterAConfidencialidadeDas" /></li>
        </ul>
      </>
    ),
  },
  {
    icon: Copyright,
    get title() {
      return i18n.t("TermosUtilizacao.n4PropriedadeIntelectual");
    },
    body: (
      <p>
        <Trans i18nKey="TermosUtilizacao.todosOsConteudosDisponibilizados" components={{ strong: <strong className="text-foreground" /> }} />
      </p>
    ),
  },
];

const TermosUtilizacao = () => {
  const { t } = useTranslation();
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />
      <main className="flex-1 pt-24 pb-16 px-4">
        <div className="max-w-3xl mx-auto">
          <BackButton />

          <div className="text-center mb-10">
            <h1 className="text-3xl md:text-4xl font-bold text-primary mb-3">
              {t("TermosUtilizacao.termosDeUtilizacao")}
            </h1>
            <p className="text-muted-foreground text-base md:text-lg max-w-2xl mx-auto">
              {t("TermosUtilizacao.asRegrasQueRegem")}
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

            {/* Aviso médico-legal — mantém em destaque visual, alinhado com o aviso já existente
                nos resultados do rastreio (ScannerResultados.tsx). */}
            <section>
              <div className="flex items-center gap-3 mb-3">
                <span className="w-10 h-10 rounded-xl bg-destructive/10 text-destructive flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-5 h-5" />
                </span>
                <h2 className="font-semibold text-foreground text-base md:text-lg">{t("TermosUtilizacao.n5AvisoMedicoLegal")}</h2>
              </div>
              <div className="ml-0 md:ml-[3.25rem] flex items-start gap-3 p-4 md:p-5 rounded-2xl bg-gold/10 border border-gold/30 text-sm text-foreground">
                <AlertTriangle className="w-5 h-5 text-gold shrink-0 mt-0.5" />
                <p className="leading-relaxed">
                  <Trans i18nKey="TermosUtilizacao.oRastreioDigitalDe" components={{ strong: <strong /> }} />
                </p>
              </div>
            </section>

            <section>
              <div className="flex items-center gap-3 mb-3">
                <span className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                  <ShieldOff className="w-5 h-5" />
                </span>
                <h2 className="font-semibold text-foreground text-base md:text-lg">{t("TermosUtilizacao.n6LimitacaoDeResponsabilidade")}</h2>
              </div>
              <div className="pl-13 md:pl-[3.25rem] text-muted-foreground text-[15px] leading-relaxed space-y-3">
                <p>
                  {t("TermosUtilizacao.oJanelasParaA2")}
                </p>
                <p>
                  <Trans i18nKey="TermosUtilizacao.estaLimitacaoNaoPrejudica" components={{ strong: <strong className="text-foreground" /> }} />
                </p>
              </div>
            </section>

            <section>
              <div className="flex items-center gap-3 mb-3">
                <span className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                  <RefreshCw className="w-5 h-5" />
                </span>
                <h2 className="font-semibold text-foreground text-base md:text-lg">{t("TermosUtilizacao.n7AlteracoesAosTermos")}</h2>
              </div>
              <p className="pl-13 md:pl-[3.25rem] text-muted-foreground text-[15px] leading-relaxed">
                {t("TermosUtilizacao.oJanelasParaA3")}
              </p>
            </section>

            <section>
              <div className="flex items-center gap-3 mb-3">
                <span className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                  <Gavel className="w-5 h-5" />
                </span>
                <h2 className="font-semibold text-foreground text-base md:text-lg">{t("TermosUtilizacao.n8LeiAplicavelE")}</h2>
              </div>
              <p className="pl-13 md:pl-[3.25rem] text-muted-foreground text-[15px] leading-relaxed">
                {t("TermosUtilizacao.estesTermosDeUtilizacao")}
              </p>
            </section>

            <section className="pt-2 border-t border-border/60">
              <div className="flex items-center gap-3 mb-3">
                <span className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                  <Mail className="w-5 h-5" />
                </span>
                <h2 className="font-semibold text-foreground text-base md:text-lg">{t("TermosUtilizacao.n9Contacto")}</h2>
              </div>
              <p className="pl-13 md:pl-[3.25rem] text-muted-foreground text-[15px] leading-relaxed">
                <Trans i18nKey="TermosUtilizacao.paraQualquerQuestaoSobre" components={{ a: <a href="mailto:janelasparaalma18@gmail.com" className="text-primary hover:underline font-medium" />, a2: <a href={localizar("/politica-de-privacidade")} className="text-primary hover:underline font-medium" />, a3: <a href={localizar("/faq")} className="text-primary hover:underline font-medium" /> }} />
              </p>
            </section>
          </div>

          <p className="text-center text-xs text-muted-foreground mt-8">
            <Trans i18nKey="TermosUtilizacao.ultimaActualizacaoSetembroDe" components={{ a: <a href="mailto:janelasparaalma18@gmail.com" className="text-primary hover:underline font-medium" /> }} />
          </p>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default TermosUtilizacao;
