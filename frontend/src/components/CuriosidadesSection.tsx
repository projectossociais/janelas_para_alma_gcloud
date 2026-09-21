import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Lightbulb, Gamepad2 } from "lucide-react";

const CURIOSIDADES = [
  "O estrabismo afecta cerca de 4% da população mundial, mas grande parte dos casos nunca chega a ser diagnosticada.",
  "Cerca de 80% de tudo o que aprendemos sobre o mundo chega até nós através da visão.",
  "A ambliopia (\"olho preguiçoso\") só pode ser tratada com sucesso se for identificada cedo, de preferência antes dos 7 anos de idade.",
  "Óculos usados e devidamente reaproveitados podem devolver a visão nítida a alguém que nunca teve acesso a um exame oftalmológico.",
  "Os dois olhos trabalham em equipa: pequenos desalinhamentos podem ser corrigidos com exercícios de terapia visual, sem cirurgia.",
  "Em Angola, a maioria dos casos de estrabismo infantil só é detectada quando já afecta o desempenho escolar da criança.",
  "Piscar os olhos regularmente ao usar ecrãs ajuda a prevenir fadiga ocular, já que piscamos muito menos quando estamos concentrados num ecrã.",
];

const getDailyCuriosidade = () => {
  const dayOfMonth = new Date().getDate();
  return CURIOSIDADES[dayOfMonth % CURIOSIDADES.length];
};

const CuriosidadesSection = () => {
  const navigate = useNavigate();
  const curiosidade = useMemo(getDailyCuriosidade, []);

  return (
    <section className="py-16 md:py-24 bg-muted/50">
      <div className="container px-4">
        <div className="max-w-2xl mx-auto rounded-2xl bg-card border border-border/50 shadow-card p-6 sm:p-8 space-y-5">
          <div className="flex items-center gap-3">
            <div className="inline-flex items-center justify-center w-11 h-11 shrink-0 rounded-xl bg-teal/10 text-teal">
              <Lightbulb className="w-5 h-5" />
            </div>
            <span className="text-sm font-medium tracking-widest uppercase text-teal">
              Curiosidades
            </span>
          </div>

          <p className="text-base md:text-lg font-semibold text-foreground leading-relaxed">
            {curiosidade}
          </p>

          <div className="border-t border-border/50 pt-5">
            <button
              onClick={() => navigate("/jogo-curiosidades")}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-gold text-gold-foreground font-bold transition-all hover:opacity-90 hover:translate-y-[-2px]"
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
