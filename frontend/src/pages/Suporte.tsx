import { MessagesSquare, HeartHandshake, BookOpen, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import BackButton from "@/components/BackButton";
import heroImg from "@/assets/suporte-hero.jpg";

const features = [
  {
    icon: MessagesSquare,
    title: "Partilha de Experiências",
    description:
      "Um espaço seguro onde utilizadores podem trocar histórias, vitórias e aprendizagens, criando laços de pertença e empatia.",
  },
  {
    icon: HeartHandshake,
    title: "Apoio Emocional",
    description:
      "Acompanhamento humano e suporte para lidar com os desafios emocionais associados ao estrabismo, sem julgamentos.",
  },
  {
    icon: BookOpen,
    title: "Educação sobre Estrabismo",
    description:
      "Informação clara, acessível e baseada em evidências para desmistificar a condição e promover decisões informadas.",
  },
];

const Suporte = () => {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />
      <main className="flex-1">
        {/* Hero */}
        <section className="relative min-h-[70vh] flex items-center overflow-hidden">
          <img
            src={heroImg}
            alt="Comunidade acolhedora a sorrir em conjunto"
            className="absolute inset-0 w-full h-full object-cover"
            width={1920}
            height={1088}
          />
          <div className="absolute inset-0 bg-gradient-to-r from-primary/95 via-primary/80 to-primary/40" />
          <div className="container relative z-10 py-24 md:py-32">
            <div className="max-w-2xl animate-fade-in">
              <span className="inline-block px-4 py-1.5 rounded-full bg-gold/20 text-primary-foreground border border-gold/40 text-sm font-medium mb-6 backdrop-blur-sm">
                Comunidade & Inclusão
              </span>
              <h1 className="text-4xl md:text-6xl font-bold text-primary-foreground leading-tight mb-6">
                Programa de Suporte Psicossocial
              </h1>
              <p className="text-lg md:text-xl text-primary-foreground/90 leading-relaxed">
                Não estás sozinho. Uma comunidade digital para combater o estigma e promover a inclusão.
              </p>
            </div>
          </div>
        </section>

        <BackButton to="/produto" />

        {/* Features */}
        <section className="py-20 md:py-28">
          <div className="container">
            <div className="text-center max-w-2xl mx-auto mb-14">
              <h2 className="text-3xl md:text-4xl font-bold text-foreground leading-tight">
                Como Te Apoiamos
              </h2>
              <p className="text-muted-foreground mt-4">
                Três pilares para uma jornada acompanhada e segura.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
              {features.map((f, i) => (
                <div
                  key={f.title}
                  className="group relative flex flex-col rounded-2xl border border-border bg-card p-8 shadow-card transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:border-gold/40 animate-fade-in"
                  style={{ animationDelay: `${i * 100}ms` }}
                >
                  <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-gold/10 text-gold mb-4">
                    <f.icon className="w-6 h-6" />
                  </div>
                  <h3 className="text-xl font-semibold text-foreground mb-3">{f.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{f.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="py-20 bg-gradient-to-br from-primary to-primary/80">
          <div className="container">
            <div className="max-w-3xl mx-auto text-center animate-fade-in">
              <h2 className="text-3xl md:text-4xl font-bold text-primary-foreground mb-4 leading-tight">
                Junta-te à nossa comunidade digital e sente-te acolhido.
              </h2>
              <p className="text-primary-foreground/85 text-lg mb-8">
                Faz parte do programa <strong>Meu Kamba Estrábico</strong> e descobre uma rede que te apoia.
              </p>
              <Link
                to="/kamba"
                className="inline-flex items-center gap-2 bg-gold text-primary font-semibold px-8 py-4 rounded-xl hover:bg-gold/90 transition-all hover:-translate-y-0.5 shadow-lg"
              >
                Conhecer o Programa
                <ArrowRight className="w-5 h-5" />
              </Link>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
};

export default Suporte;
