import { Eye, Dna, Layers, AlertTriangle, Stethoscope, BookOpen, ExternalLink } from "lucide-react";
import { Trans, useTranslation } from "react-i18next";
import i18n from "@/i18n";

const references = [
  {
    get label() {
      return i18n.t("StrabismusSection.bicasHEA");
    },
    href: "https://www.scielo.br/j/abo/a/9KXCHZM4pZ5jfTvVyKrpNPQ/?lang=pt",
  },
  {
    get label() {
      return i18n.t("StrabismusSection.machadoISGama");
    },
    href: "https://spoftalmologia.pt/wp-content/uploads/2016/10/estrabismo-para-totos-pdf.pdf",
  },
  {
    get label() {
      return i18n.t("StrabismusSection.brevesConsideracoesSobreO");
    },
    href: "https://repositorio-aberto.up.pt/bitstream/10216/16622/2/31_5_EMC_I_01_C.pdf",
  },
];

const StrabismusSection = () => {
  const { t } = useTranslation();
  return (
    <section id="estrabismo" className="py-20 md:py-28 bg-muted/50">
      <div className="container">
        <div className="text-center mb-16 space-y-4">
          <span className="text-sm font-medium tracking-widest uppercase text-teal">
            {t("StrabismusSection.compreenderOEstrabismo")}
          </span>
          <h2 className="text-3xl md:text-5xl font-bold text-foreground">
            {t("StrabismusSection.oQueEO")}
          </h2>
          <p className="max-w-2xl mx-auto text-muted-foreground leading-relaxed">
            {t("StrabismusSection.desmistificarACondicaoPara")}
          </p>
        </div>

        <article className="max-w-4xl mx-auto text-lg text-muted-foreground leading-relaxed space-y-6">
          <p>
            {t("StrabismusSection.oEstrabismoEUma")}
          </p>

          <h3 className="flex items-center gap-3 text-2xl md:text-3xl font-bold text-foreground !mt-12">
            <Eye className="w-6 h-6 text-teal shrink-0" />
            {t("StrabismusSection.oQueEO2")}
          </h3>
          <p>
            {t("StrabismusSection.oEstrabismoConsisteNo")}
          </p>
          <p>
            {t("StrabismusSection.aCondicaoPodeManifestar")}
          </p>

          <h3 className="flex items-center gap-3 text-2xl md:text-3xl font-bold text-foreground !mt-12">
            <Dna className="w-6 h-6 text-teal shrink-0" />
            {t("StrabismusSection.causasEFactoresDe")}
          </h3>
          <p>
            {t("StrabismusSection.asCausasDoEstrabismo")}
          </p>
          <p>
            {t("StrabismusSection.aPrematuridadeOBaixo")}
          </p>

          <h3 className="flex items-center gap-3 text-2xl md:text-3xl font-bold text-foreground !mt-12">
            <Layers className="w-6 h-6 text-teal shrink-0" />
            {t("StrabismusSection.tiposDeEstrabismo")}
          </h3>
          <p>
            {t("StrabismusSection.aClassificacaoMaisComum")}
          </p>
          <ul className="list-disc pl-6 space-y-2 marker:text-teal">
            <li>
              <Trans i18nKey="StrabismusSection.esotropiaDesvioDoOlho" components={{ strong: <strong className="text-foreground" /> }} />
            </li>
            <li>
              <Trans i18nKey="StrabismusSection.exotropiaDesvioDoOlho" components={{ strong: <strong className="text-foreground" /> }} />
            </li>
            <li>
              <Trans i18nKey="StrabismusSection.hipertropiaDesvioDoOlho" components={{ strong: <strong className="text-foreground" /> }} />
            </li>
            <li>
              <Trans i18nKey="StrabismusSection.hipotropiaDesvioDoOlho" components={{ strong: <strong className="text-foreground" /> }} />
            </li>
          </ul>
          <p>
            {t("StrabismusSection.paraAlemDaDireccao")}
          </p>

          <h3 className="flex items-center gap-3 text-2xl md:text-3xl font-bold text-foreground !mt-12">
            <AlertTriangle className="w-6 h-6 text-teal shrink-0" />
            {t("StrabismusSection.consequenciasClinicasEPsicossociais")}
          </h3>
          <p>
            <Trans i18nKey="StrabismusSection.aConsequenciaClinicaMais" components={{ strong: <strong className="text-foreground" /> }} />
          </p>
          <p>
            {t("StrabismusSection.oDesalinhamentoImpedeAinda")}
          </p>
          <p>
            {t("StrabismusSection.paraAlemDaComponente")}
          </p>

          <h3 className="flex items-center gap-3 text-2xl md:text-3xl font-bold text-foreground !mt-12">
            <Stethoscope className="w-6 h-6 text-teal shrink-0" />
            {t("StrabismusSection.tratamentoECorreccao")}
          </h3>
          <p>
            {t("StrabismusSection.oTratamentoDoEstrabismo")}
          </p>
          <ul className="list-disc pl-6 space-y-2 marker:text-teal">
            <li>
              <Trans i18nKey="StrabismusSection.correccaoOpticaOculosOu" components={{ strong: <strong className="text-foreground" /> }} />
            </li>
            <li>
              <Trans i18nKey="StrabismusSection.oclusaoPensoTaparO" components={{ strong: <strong className="text-foreground" /> }} />
            </li>
            <li>
              <Trans i18nKey="StrabismusSection.toxinaBotulinicaBotoxInjectada" components={{ strong: <strong className="text-foreground" /> }} />
            </li>
            <li>
              <Trans i18nKey="StrabismusSection.exerciciosVisuaisOrtopticaTerapia" components={{ strong: <strong className="text-foreground" /> }} />
            </li>
            <li>
              <Trans i18nKey="StrabismusSection.cirurgiaNosCasosQue" components={{ strong: <strong className="text-foreground" /> }} />
            </li>
          </ul>
          <p>
            {t("StrabismusSection.oTratamentoDaAmbliopia")}
          </p>

          <section className="!mt-16 pt-8 border-t border-border space-y-4 text-base">
            <h3 className="flex items-center gap-2 text-lg font-bold text-foreground">
              <BookOpen className="w-5 h-5 text-teal shrink-0" />
              {t("StrabismusSection.referenciasBibliograficas")}
            </h3>
            <ul className="space-y-3">
              {references.map((ref, idx) => (
                <li key={idx}>
                  <a
                    href={ref.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-start gap-2 text-teal hover:underline text-sm font-medium transition-colors"
                  >
                    <ExternalLink className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{ref.label}</span>
                  </a>
                </li>
              ))}
            </ul>
          </section>
        </article>
      </div>
    </section>
  );
};

export default StrabismusSection;
