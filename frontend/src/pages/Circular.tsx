import { Recycle, Wrench, Sparkles } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import BackButton from "@/components/BackButton";
import heroImg from "@/assets/circular-hero.jpg";

const steps = [
  {
    icon: Recycle,
    number: "01",
    title: "Recolha de Armações Usadas",
    description:
      "Implementação de canais de recolha em parceria com clínicas, ópticas e comunidades. Cada par de óculos doado ganha uma nova vida.",
  },
  {
    icon: Wrench,
    number: "02",
    title: "Recondicionamento",
    description:
      "Processo rigoroso de limpeza, reparação e validação técnica. Garantimos que cada armação cumpre os padrões necessários para reutilização.",
  },
  {
    icon: Sparkles,
    number: "03",
    title: "Reutilização Terapêutica",
    description:
      "Transformamos resíduos em materiais terapêuticos: armações recondicionadas e kits sustentáveis para tratamento e prevenção em comunidades vulneráveis.",
  },
];

const Circular = () => {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />
      <main className="flex-1">
        {/* Hero */}
        <section className="relative min-h-[70vh] flex items-center overflow-hidden">
          <img
            src={heroImg}
            alt="Óculos a serem reciclados num ambiente sustentável"
            className="absolute inset-0 w-full h-full object-cover"
            width={1920}
            height={1088}
          />
          <div className="absolute inset-0 bg-gradient-to-r from-primary/95 via-primary/80 to-primary/50" />
          <div className="container relative z-10 py-24 md:py-32">
            <div className="max-w-2xl animate-fade-in">
              <span className="inline-block px-4 py-1.5 rounded-full bg-green/20 text-primary-foreground border border-green/40 text-sm font-medium mb-6 backdrop-blur-sm">
                Sustentabilidade
              </span>
              <h1 className="text-4xl md:text-6xl font-bold text-primary-foreground leading-tight mb-6">
                Logística de Economia Circular
              </h1>
              <p className="text-lg md:text-xl text-primary-foreground/90 leading-relaxed">
                Cuidamos da saúde visual e do futuro do nosso planeta.
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
                O Nosso Processo Circular
              </h2>
              <p className="text-muted-foreground mt-4">
                Três etapas que transformam resíduos em oportunidade.
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

        {/* Impact Block */}
        <section className="py-20 bg-gradient-to-br from-primary to-primary/80">
          <div className="container">
            <div className="max-w-4xl mx-auto text-center">
              <Recycle className="w-12 h-12 text-green mx-auto mb-6" />
              <p className="text-2xl md:text-4xl font-bold text-primary-foreground leading-tight">
                A nossa logística reduz drasticamente os{" "}
                <span className="text-green">custos para as famílias</span> e o{" "}
                <span className="text-green">impacto ambiental</span> das cidades angolanas.
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
