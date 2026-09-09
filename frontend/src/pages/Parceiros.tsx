import { useSearchParams } from "react-router-dom";
import { Eye, Tag, Handshake } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import BackButton from "@/components/BackButton";
import PartnerDialog from "@/components/PartnerDialog";
import ClinicalPartners from "@/components/ClinicalPartners";
import { useSupabaseRole } from "@/hooks/useSupabaseRole";
import heroImg from "@/assets/parceiros-hero.jpg";
import visaoImg from "@/assets/parceiros-visao.jpg";

const benefits = [
  {
    icon: Eye,
    title: "Acesso Facilitado",
    text: "Acesso direto a rastreios e consultas de especialidade para tratar casos complexos identificados nas nossas campanhas.",
  },
  {
    icon: Tag,
    title: "Preços Adaptados",
    text: "Estruturação de acordos e serviços com preços ajustados à realidade dos nossos utilizadores, promovendo a inclusão.",
  },
  {
    icon: Handshake,
    title: "Maior Inclusão",
    text: "Eliminação de barreiras geográficas e socioeconómicas, tornando os cuidados visuais verdadeiramente acessíveis a todos.",
  },
];

const Parceiros = () => {
  const { role, loading } = useSupabaseRole();
  const canViewPartnerSections = !loading && (role === "admin" || role === "profissional");
  const [searchParams] = useSearchParams();
  const abrirAgendamentoOptiotica = searchParams.get("agendar") === "optiotica";

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      {/* Hero */}
      <section className="relative w-full min-h-[80vh] flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0">
          <img
            src={heroImg}
            alt="Especialistas em saúde visual a realizar exame oftalmológico"
            className="w-full h-full object-cover"
            width={1920}
            height={1080}
          />
          <div className="absolute inset-0 bg-hero-gradient opacity-90" />
        </div>

        <div className="relative z-10 container text-center px-6 animate-fade-in">
          <h1 className="text-4xl md:text-6xl font-bold leading-tight tracking-tight text-primary-foreground mb-6">
            Rede de Parceiros<br className="hidden md:block" /> de Saúde
          </h1>
          <p className="text-lg md:text-2xl text-primary-foreground/85 max-w-3xl mx-auto leading-relaxed">
            Conectando especialistas a quem mais precisa. Junte-se à plataforma que vai revolucionar o acesso aos cuidados visuais em Angola.
          </p>
        </div>
      </section>

      <BackButton to="/produto" />

      {/* Vision */}
      <section className="py-20 md:py-28 bg-background">
        <div className="container px-6">
          <div className="grid md:grid-cols-2 gap-12 items-center max-w-6xl mx-auto">
            <div className="animate-fade-in">
              <span className="inline-block px-4 py-1.5 rounded-full bg-teal/10 text-teal text-sm font-medium mb-4">
                A Nossa Visão
              </span>
              <h2 className="text-3xl md:text-4xl font-bold text-navy mb-6 leading-tight">
                O ecossistema que estamos a construir
              </h2>
              <p className="text-lg text-muted-foreground leading-relaxed">
                A nossa plataforma vai conectar utilizadores a clínicas, óticas e especialistas em saúde visual. O nosso plano inclui integrar parceiros numa plataforma centralizada para gestão de encaminhamentos e consultas, criando um ecossistema sustentável e inclusivo.
              </p>
            </div>
            <div className="rounded-2xl overflow-hidden shadow-elevated animate-fade-in">
              <img
                src={visaoImg}
                alt="Plataforma digital conectando profissionais de saúde visual"
                className="w-full h-auto object-cover"
                width={1024}
                height={1024}
                loading="lazy"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Clinical Partners (Optiótica) */}
      <ClinicalPartners defaultOpen={abrirAgendamentoOptiotica} />

      {canViewPartnerSections && (
        <section className="py-20 md:py-28 bg-hero-gradient">
          <div className="container px-6">
            <div className="text-center max-w-2xl mx-auto mb-14 animate-fade-in">
              <h2 className="text-3xl md:text-4xl font-bold text-primary-foreground mb-4">
                Benefícios para Parceiros
              </h2>
              <p className="text-primary-foreground/80 text-lg">
                Vantagens estratégicas ao integrar a Rede Janelas Para a Alma.
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-6 max-w-6xl mx-auto">
              {benefits.map((b, i) => (
                <div
                  key={b.title}
                  className="rounded-2xl p-8 bg-primary-foreground/5 backdrop-blur-sm border border-primary-foreground/10 hover:bg-primary-foreground/10 hover:-translate-y-1 transition-all duration-300 animate-fade-in"
                  style={{ animationDelay: `${i * 120}ms` }}
                >
                  <div className="w-14 h-14 rounded-xl bg-teal/20 text-teal flex items-center justify-center mb-5">
                    <b.icon className="w-7 h-7" />
                  </div>
                  <h3 className="text-xl font-bold text-primary-foreground mb-3">
                    {b.title}
                  </h3>
                  <p className="text-primary-foreground/75 leading-relaxed">
                    {b.text}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {canViewPartnerSections && (
        <section className="py-20 md:py-28 bg-background">
          <div className="container px-6">
            <div className="max-w-4xl mx-auto rounded-3xl bg-navy text-primary-foreground p-10 md:p-14 shadow-elevated text-center relative overflow-hidden animate-fade-in">
              <div className="absolute inset-0 bg-gradient-to-br from-teal/20 via-transparent to-transparent" />
              <div className="relative">
                <h2 className="text-3xl md:text-4xl font-bold mb-4">
                  Faça parte desta visão.
                </h2>
                <p className="text-primary-foreground/85 text-lg mb-8 max-w-2xl mx-auto leading-relaxed">
                  Representa uma clínica (como a Centroptico), uma ótica ou é profissional de saúde visual? Seja um dos nossos parceiros oftalmológicos pioneiros na transformação social.
                </p>
                <PartnerDialog />
              </div>
            </div>
          </div>
        </section>
      )}

      <Footer />
    </div>
  );
};

export default Parceiros;
