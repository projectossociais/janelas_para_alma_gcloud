import { useNavigate } from "react-router-dom";
import { Eye, ArrowRight } from "lucide-react";

const strabismusIntro = "/estrabismo-intro-boy.jpg";


const StrabismusIntroCard = () => {
  const navigate = useNavigate();

  return (
    <section className="py-16 md:py-24 bg-background">
      <div className="container">
        <div
          onClick={() => navigate("/sobre")}
          className="relative max-w-5xl mx-auto rounded-2xl overflow-hidden bg-card border border-border/50 shadow-elevated cursor-pointer group transition-all hover:shadow-[0_20px_60px_-12px_hsl(207_85%_15%/0.2)] hover:scale-[1.01]"
        >
          {/* Decorative gradient bar */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-teal via-navy to-gold z-10" />

          <div className="grid md:grid-cols-2 gap-0">
            {/* Image */}
            <div className="relative aspect-[4/3] md:aspect-auto md:min-h-[360px] overflow-hidden">
              <img
                src={strabismusIntro}
                alt="Rastreio visual de uma criança angolana, promovendo a inclusão visual"
                className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                decoding="async"
                fetchPriority="high"
                width={1024}
                height={768}
              />

            </div>

            {/* Content */}
            <div className="p-8 md:p-12 flex flex-col justify-center gap-5">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-teal/10 text-teal">
                <Eye className="w-7 h-7" />
              </div>
              <div className="space-y-1">
                <span className="text-sm font-medium tracking-widest uppercase text-teal">
                  Sabia que...
                </span>
                <h3 className="text-2xl md:text-3xl font-bold text-foreground leading-tight">
                  O que é o Estrabismo?
                </h3>
              </div>
              <p className="text-muted-foreground leading-relaxed text-base md:text-lg text-justify">
                Estrabismo é uma condição em que os olhos não se encontram correctamente alinhados fazendo com que eles apontem em direcções diferentes.
              </p>
              <div className="inline-flex items-center gap-2 text-teal font-semibold group-hover:gap-3 transition-all">
                Ler mais sobre o Estrabismo
                <ArrowRight className="w-5 h-5" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default StrabismusIntroCard;
