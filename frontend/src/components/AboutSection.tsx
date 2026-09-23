import { useState } from "react";
import { Eye, Heart, Leaf, ExternalLink } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Trans, useTranslation } from "react-i18next";
import i18n from "@/i18n";

const stats = [
  {
    value: "2.2B",
    get label() {
      return i18n.t("AboutSection.pessoasComDeficienciaVisual");
    },
    icon: Eye,
    get modalTitle() {
      return i18n.t("AboutSection.deficienciaVisualNoMundo");
    },
    get modalContent() {
      return i18n.t("AboutSection.segundoORelatorioDa");
    },
    get sourceLabel() {
      return i18n.t("AboutSection.lerRelatorioMundialDa");
    },
    sourceUrl: "https://www.who.int/publications/i/item/9789241516570",
  },
  {
    value: "0.8%",
    get label() {
      return i18n.t("AboutSection.prevalenciaDeEstrabismoEm");
    },
    icon: Heart,
    get modalTitle() {
      return i18n.t("AboutSection.prevalenciaDeEstrabismoEm2");
    },
    get modalContent() {
      return i18n.t("AboutSection.deAcordoAPesquisa");
    },
    get sourceLabel() {
      return i18n.t("AboutSection.lerArtigoAcademicoSobre");
    },
    sourceUrl: "https://www.tandfonline.com/doi/full/10.1080/09273972.2022.2157023",
  },
  {
    value: "80%",
    get label() {
      return i18n.t("AboutSection.daInformacaoECaptada");
    },
    icon: Leaf,
    get modalTitle() {
      return i18n.t("AboutSection.aVisaoComoPrincipal");
    },
    get modalContent() {
      return i18n.t("AboutSection.estudosCientificosIndicamQue");
    },
    get sourceLabel() {
      return i18n.t("AboutSection.lerMaisSobrePercepcao");
    },
    sourceUrl: "https://en.wikipedia.org/wiki/Visual_perception",
  },
];

const AboutSection = () => {
  const { t } = useTranslation();
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <section id="sobre" className="py-20 md:py-28 bg-background">
      <div className="container">
        <div className="max-w-3xl mx-auto text-center space-y-6 mb-16">
          <span className="text-sm font-medium tracking-widest uppercase text-teal">{t("AboutSection.conhecaNos")}</span>
          <h2 className="text-3xl md:text-5xl font-bold text-foreground leading-tight">
            <Trans i18nKey="AboutSection.umOlharAlinhadoUma" components={{ span: <span className="text-gradient-brand" /> }} />
          </h2>
          <p className="text-lg text-muted-foreground leading-relaxed text-justify">
            {t("AboutSection.oJanelasParaA")}
          </p>
          <p className="text-lg text-muted-foreground leading-relaxed text-justify">
            {t("AboutSection.aoMesmoTempoO")}
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {stats.map((stat, i) => (
            <button
              key={i}
              onClick={() => setOpenIndex(i)}
              className="text-center p-8 rounded-2xl bg-card shadow-card border border-border/50 transition-all hover:shadow-elevated hover:scale-[1.03] cursor-pointer focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
            >
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-xl bg-teal/10 text-teal mb-4">
                <stat.icon className="w-7 h-7" />
              </div>
              <div className="text-4xl font-bold text-foreground mb-2">{stat.value}</div>
              <p className="text-muted-foreground">{stat.label}</p>
              <p className="text-xs text-teal mt-3 font-medium">{t("AboutSection.cliqueParaSaberMais")}</p>
            </button>
          ))}
        </div>
      </div>

      {stats.map((stat, i) => (
        <Dialog key={i} open={openIndex === i} onOpenChange={(v) => !v && setOpenIndex(null)}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-3 text-xl">
                <div className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-teal/10 text-teal">
                  <stat.icon className="w-5 h-5" />
                </div>
                {stat.modalTitle}
              </DialogTitle>
              <DialogDescription className="sr-only">
                <Trans i18nKey="AboutSection.detalhesSobre" values={{ label: stat.label }} />
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="text-5xl font-bold text-teal text-center py-4">{stat.value}</div>
              <p className="text-muted-foreground leading-relaxed text-justify">{stat.modalContent}</p>
              {stat.sourceUrl && (
                <a
                  href={stat.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-sm font-medium text-teal hover:underline transition-colors mt-2"
                >
                  <ExternalLink className="w-4 h-4" />
                  {stat.sourceLabel}
                </a>
              )}
            </div>
          </DialogContent>
        </Dialog>
      ))}
    </section>
  );
};

export default AboutSection;
