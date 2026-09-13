import { Link } from "react-router-dom";
import { Handshake, Recycle, Monitor, Heart, ArrowRight } from "lucide-react";
import Navbar from "@/components/Navbar";
import AboutSection from "@/components/AboutSection";
import ImpactSection from "@/components/ImpactSection";
import Footer from "@/components/Footer";

const valueProps = [
  {
    icon: Handshake,
    title: "Rede de Parceiros",
    description: "Prevemos criar um sistema que conecte pacientes a parceiros de saúde visual, facilitando o acesso a rastreios e consultas através de preços ajustados à realidade do utilizador.",
    color: "text-teal bg-teal/10",
    to: "/parceiros",
  },
  {
    icon: Recycle,
    title: "Logística de Economia Circular",
    description: "Desenvolvimento de um canal para a recolha e reutilização de armações. A meta é transformar resíduos em materiais terapêuticos, reduzindo custos e impacto ambiental.",
    color: "text-green bg-green/10",
    to: "/circular",
  },
  {
    icon: Monitor,
    title: "Interface Tecnológica",
    description: "Projeção de uma plataforma intuitiva que centralizará agendamentos e aquisições. O foco é eliminar barreiras geográficas através da tecnologia assistiva.",
    color: "text-sky bg-sky/10",
    to: "/tecnologia",
  },
  {
    icon: Heart,
    title: "Programa de Suporte",
    description: "Planeamento de uma comunidade digital para apoio psicossocial e partilha de experiências, visando combater o estigma associado ao estrabismo.",
    color: "text-gold bg-gold/10",
    to: "/suporte",
  },
];

const Impacto = () => {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1 pt-16">
        <AboutSection />
        <div className="h-px bg-gradient-to-r from-transparent via-border to-transparent" />
        <ImpactSection />

        {/* A Nossa Proposta de Valor */}
        <section className="py-20 bg-background">
          <div className="container">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground text-center max-w-3xl mx-auto leading-tight">
              A Nossa Proposta de Valor: Unindo Saúde, Ecologia e Inclusão
            </h2>
            <p className="text-muted-foreground text-center mt-4 max-w-xl mx-auto">
              Uma abordagem integrada para transformar a saúde visual em Angola.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mt-14 max-w-4xl mx-auto">
              {valueProps.map((item) => (
                <Link
                  key={item.title}
                  to={item.to}
                  className="group relative flex flex-col rounded-2xl border border-border bg-card p-6 shadow-card cursor-pointer transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:border-primary/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  <div className={`inline-flex items-center justify-center w-12 h-12 rounded-xl ${item.color} mb-4`}>
                    <item.icon className="w-6 h-6" />
                  </div>
                  <h3 className="text-lg font-semibold text-foreground mb-2">{item.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{item.description}</p>
                  <div className="mt-4 flex items-center justify-end gap-1.5 text-sm font-medium text-green/70 group-hover:text-green transition-colors">
                    <span>Saber mais</span>
                    <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
};

export default Impacto;
