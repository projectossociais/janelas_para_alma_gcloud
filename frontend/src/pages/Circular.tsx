import { Recycle, Wrench, Sparkles, Glasses, Scissors, ShoppingBag, HeartHandshake, ArrowRight } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import BackButton from "@/components/BackButton";
import heroImg from "@/assets/circular-hero.jpg";
import oculos3dImg from "@/assets/oculos-3d-prototipo.jpg";
import { Trans, useTranslation } from "react-i18next";
import i18n from "@/i18n";

const steps = [
  {
    icon: Recycle,
    number: "01",
    get title() {
      return i18n.t("Circular.recolhaDeArmacoesUsadas");
    },
    get description() {
      return i18n.t("Circular.implementacaoDeCanaisDe");
    },
  },
  {
    icon: Wrench,
    number: "02",
    get title() {
      return i18n.t("Circular.recondicionamento");
    },
    get description() {
      return i18n.t("Circular.processoRigorosoDeLimpeza");
    },
  },
  {
    icon: Sparkles,
    number: "03",
    get title() {
      return i18n.t("Circular.reutilizacaoTerapeutica");
    },
    get description() {
      return i18n.t("Circular.transformamosResiduosEmMateriais");
    },
  },
];

// Óculos 3D: um produto da plataforma, não uma etapa do processo circular.
// Nenhum texto diz que são feitos de material doado ou reaproveitado -- se
// isso um dia passar a ser verdade (cartão de embalagens recolhidas), é aqui
// que se acrescenta, com a equipa a confirmar.
const passosOculos3d = [
  {
    icon: Scissors,
    get title() {
      return i18n.t("Circular.producao");
    },
  },
  {
    icon: ShoppingBag,
    get title() {
      return i18n.t("Circular.venda");
    },
  },
  {
    icon: HeartHandshake,
    get title() {
      return i18n.t("Circular.reinvestimentoNoPrograma");
    },
  },
];


const Circular = () => {
  const { t } = useTranslation();
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />
      <main className="flex-1">
        {/* Hero */}
        <section className="relative min-h-[70vh] flex items-center overflow-hidden">
          <img
            src={heroImg}
            alt={t("Circular.oculosASeremReciclados")}
            className="absolute inset-0 w-full h-full object-cover"
            width={1920}
            height={1088}
          />
          <div className="absolute inset-0 bg-gradient-to-r from-primary/95 via-primary/80 to-primary/50" />
          <div className="container relative z-10 py-24 md:py-32">
            <div className="max-w-2xl animate-fade-in">
              <span className="inline-block px-4 py-1.5 rounded-full bg-green/20 text-primary-foreground border border-green/40 text-sm font-medium mb-6 backdrop-blur-sm">
                {t("Circular.sustentabilidade")}
              </span>
              <h1 className="text-4xl md:text-6xl font-bold text-primary-foreground leading-tight mb-6">
                {t("Circular.logisticaDeEconomiaCircular")}
              </h1>
              <p className="text-lg md:text-xl text-primary-foreground/90 leading-relaxed">
                {t("Circular.cuidamosDaSaudeVisual")}
              </p>
            </div>
          </div>
        </section>

        <BackButton />

        {/* Process Steps */}
        <section className="py-20 md:py-28">
          <div className="container">
            <div className="text-center max-w-2xl mx-auto mb-14">
              <h2 className="text-3xl md:text-4xl font-bold text-foreground leading-tight">
                {t("Circular.oNossoProcessoCircular")}
              </h2>
              <p className="text-muted-foreground mt-4">
                {t("Circular.tresEtapasQueTransformam")}
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
              {steps.map((step, i) => (
                <div
                  key={step.title}
                  className="group relative flex flex-col rounded-2xl border border-border bg-card p-8 shadow-card transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:border-green/40 animate-fade-in"
                  style={{ animationDelay: `${i * 100}ms` }}
                >
                  <span className="text-5xl font-bold text-green/20 mb-2">{step.number}</span>
                  <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-green/10 text-green mb-4">
                    <step.icon className="w-6 h-6" />
                  </div>
                  <h3 className="text-xl font-semibold text-foreground mb-3">{step.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{step.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Óculos 3D para os exercícios visuais (produto da plataforma) */}
        <section id="oculos-3d" className="pb-20 md:pb-28 scroll-mt-24">
          <div className="container">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-14 items-center max-w-5xl mx-auto">
              <div className="animate-fade-in">
                <span className="inline-block px-3 py-1 rounded-full bg-green/10 text-green text-xs font-bold uppercase tracking-widest mb-4">
                  {t("Circular.produtoDaPlataforma")}
                </span>
                <h2 className="text-3xl md:text-4xl font-bold text-foreground leading-tight mb-6">
                  {t("Circular.oculos3dParaOsExercicios")}
                </h2>
                <div className="space-y-4 text-muted-foreground leading-relaxed">
                  <p>{t("Circular.oculos3dProduto")}</p>
                  <p>{t("Circular.oculos3dRendimento")}</p>
                </div>
              </div>

              <div
                className="relative flex flex-col rounded-2xl border border-border bg-card p-6 md:p-8 shadow-card animate-fade-in"
                style={{ animationDelay: "100ms" }}
              >
                <img
                  src={oculos3dImg}
                  alt={t("Circular.prototipoDosOculos3d")}
                  className="w-full aspect-[4/3] object-cover rounded-xl mb-6"
                  width={900}
                  height={671}
                  loading="lazy"
                />
                <h3 className="flex items-center gap-3 text-xl font-semibold text-foreground mb-4">
                  <span className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-green/10 text-green">
                    <Glasses className="w-5 h-5" />
                  </span>
                  {t("Circular.oculos3d")}
                </h3>
                <ol className="flex flex-col sm:flex-row sm:items-stretch gap-2">
                  {passosOculos3d.map((passo, i) => (
                    <li key={passo.title} className="flex flex-col sm:flex-row items-center gap-2 sm:flex-1">
                      <div className="flex w-full items-center gap-3 sm:flex-col sm:text-center rounded-xl bg-green/5 border border-green/20 px-4 py-3 h-full">
                        <passo.icon className="w-5 h-5 shrink-0 text-green" />
                        <span className="text-sm font-medium text-foreground leading-snug">{passo.title}</span>
                      </div>
                      {i < passosOculos3d.length - 1 && (
                        <ArrowRight className="w-4 h-4 shrink-0 text-green/60 rotate-90 sm:rotate-0" aria-hidden="true" />
                      )}
                    </li>
                  ))}
                </ol>
              </div>
            </div>
          </div>
        </section>

        {/* Impact Block */}
        <section className="py-20 bg-gradient-to-br from-primary to-primary/80">
          <div className="container">
            <div className="max-w-4xl mx-auto text-center">
              <Recycle className="w-12 h-12 text-green mx-auto mb-6" />
              <p className="text-2xl md:text-4xl font-bold text-primary-foreground leading-tight">
                <Trans i18nKey="Circular.aNossaLogisticaReduz" components={{ span: <span className="text-green" /> }} />
              </p>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
};

export default Circular;
