import { useNavigate } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import teamGroupPhoto from "@/assets/team-group-stairs.jpg";

const AboutTeaserSection = () => {
  const navigate = useNavigate();

  return (
    <section id="quem-somos" className="py-16 md:py-24 bg-muted/50">
      <div className="container">
        <div className="grid md:grid-cols-2 gap-10 md:gap-16 md:items-stretch max-w-5xl mx-auto">
          <div className="relative rounded-2xl overflow-hidden shadow-elevated h-64 sm:h-80 md:h-auto">
            <img
              src={teamGroupPhoto}
              alt="Equipa do Janelas Para a Alma reunida"
              className="absolute inset-0 w-full h-full object-cover"
              decoding="async"
              width={1080}
              height={560}
            />
          </div>

          <div className="space-y-5 flex flex-col justify-center">
            <span className="text-sm font-medium tracking-widest uppercase text-teal">
              Sobre Nós
            </span>
            <h2 className="text-3xl md:text-4xl font-bold text-foreground leading-tight">
              Uma equipa jovem a transformar a saúde visual em Angola
            </h2>
            <p className="text-muted-foreground leading-relaxed text-base md:text-lg text-justify">
              Somos jovens angolanos que decidimos olhar de frente para uma condição
              que a maioria prefere ignorar. Todos os dias trabalhamos ao lado de
              crianças, famílias e clínicas parceiras para detectar cedo o estrabismo
              e a ambliopia, e para devolver a quem mais precisa o simples direito de
              ver bem.
            </p>
            <p className="text-muted-foreground leading-relaxed text-base md:text-lg text-justify">
              Cada rastreio feito, cada óculo reaproveitado e cada sessão de terapia
              visual é um passo para mudar não só um olhar, mas a vida inteira à
              volta dele.
            </p>
            <button
              onClick={() => navigate("/impacto")}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-teal text-teal-foreground font-semibold transition-all hover:opacity-90 hover:gap-3 self-start"
            >
              Ler mais
              <ArrowRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};

export default AboutTeaserSection;
