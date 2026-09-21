import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Lightbulb, Gamepad2 } from "lucide-react";
import meuKambaLogo from "@/assets/meu-kamba-estrabico-logo.png";

const CURIOSIDADES = [
  "O estrabismo afecta cerca de 4% da população mundial, mas grande parte dos casos nunca chega a ser diagnosticada.",
  "Cerca de 80% de tudo o que aprendemos sobre o mundo chega até nós através da visão.",
  "A ambliopia (\"olho preguiçoso\") só pode ser tratada com sucesso se for identificada cedo, de preferência antes dos 7 anos de idade.",
  "Óculos usados e devidamente reaproveitados podem devolver a visão nítida a alguém que nunca teve acesso a um exame oftalmológico.",
  "Os dois olhos trabalham em equipa: pequenos desalinhamentos podem ser corrigidos com exercícios de terapia visual, sem cirurgia.",
  "Em Angola, a maioria dos casos de estrabismo infantil só é detectada quando já afecta o desempenho escolar da criança.",
  "Piscar os olhos regularmente ao usar ecrãs ajuda a prevenir fadiga ocular — em média, piscamos menos quando estamos concentrados num ecrã.",
];

const getDailyCuriosidade = () => {
  const dayOfMonth = new Date().getDate();
  return CURIOSIDADES[dayOfMonth % CURIOSIDADES.length];
};

const CuriosidadesSection = () => {
  const navigate = useNavigate();
  const curiosidade = useMemo(getDailyCuriosidade, []);

  return (
    <section className="py-16 md:py-24 bg-background">
      <div className="container">
        <div className="grid md:grid-cols-2 gap-6 md:gap-8 max-w-5xl mx-auto items-stretch">
          {/* Curiosidade do dia */}
          <div className="rounded-2xl bg-card border border-border/50 shadow-card p-8 md:p-10 flex flex-col gap-4">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-teal/10 text-teal">
              <Lightbulb className="w-7 h-7" />
            </div>
            <span className="text-sm font-medium tracking-widest uppercase text-teal">
              Curiosidades
            </span>
            <p className="text-xl md:text-2xl font-semibold text-foreground leading-snug">
              {curiosidade}
            </p>
            <p className="text-sm text-muted-foreground mt-auto pt-4">
              Uma curiosidade diferente todos os dias.
            </p>
          </div>

          {/* Jogo */}
          <div className="rounded-2xl bg-navy text-navy-foreground shadow-card p-8 md:p-10 flex flex-col items-start gap-5">
            <div className="bg-white rounded-xl px-4 py-3 inline-block">
              <img
                src={meuKambaLogo}
                alt="Meu Kamba Estrábico"
                className="h-10 w-auto object-contain"
              />
            </div>
            <p className="text-navy-foreground/80 leading-relaxed">
              Ponha à prova o que sabe sobre saúde visual com o nosso jogo de
              curiosidades — rápido, divertido e feito para todas as idades.
            </p>
            <button
              onClick={() => navigate("/jogo-curiosidades")}
              className="mt-auto inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gold text-gold-foreground font-bold transition-all hover:opacity-90 hover:translate-y-[-2px]"
            >
              <Gamepad2 className="w-5 h-5" />
              Tente o nosso Jogo: Você Sabia Que...
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};

export default CuriosidadesSection;
