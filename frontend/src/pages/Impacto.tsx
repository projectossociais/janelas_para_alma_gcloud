import Navbar from "@/components/Navbar";
import AboutSection from "@/components/AboutSection";
import ImpactSection from "@/components/ImpactSection";
import Footer from "@/components/Footer";

const Impacto = () => {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1 pt-16">
        <section className="py-16 md:py-20 bg-background">
          <div className="container max-w-3xl mx-auto text-center space-y-4">
            <h1 className="text-3xl md:text-5xl font-bold text-foreground leading-tight">
              Conheça o Janelas para a Alma
            </h1>
            <p className="text-lg text-muted-foreground">
              A nossa missão, a nossa equipa e o impacto que estamos a construir para a saúde visual em Angola.
            </p>
          </div>
        </section>
        <AboutSection />
        <div className="h-px bg-gradient-to-r from-transparent via-border to-transparent" />
        <ImpactSection />
      </main>
      <Footer />
    </div>
  );
};

export default Impacto;
