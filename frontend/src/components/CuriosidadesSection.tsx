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
      <div className="container">
        <div className="max-w-3xl mx-auto rounded-2xl bg-card border border-border/50 shadow-card p-8 md:p-10 space-y-6">
          <div className="flex items-center gap-4">
            <div className="inline-flex items-center justify-center w-14 h-14 shrink-0 rounded-2xl bg-teal/10 text-teal">
              <Lightbulb className="w-7 h-7" />
            </div>
            <span className="text-sm font-medium tracking-widest uppercase text-teal">
              Curiosidades
            </span>
          </div>

          <p className="text-xl md:text-2xl font-semibold text-foreground leading-snug">
            {curiosidade}
          </p>

          <div className="border-t border-border/50 pt-6 flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
            <img
              src={meuKambaLogo}
              alt="Meu Kamba Estrábico"
              className="h-9 w-auto object-contain shrink-0"
            />
            <button
              onClick={() => navigate("/jogo-curiosidades")}
              className="sm:ml-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-gold text-gold-foreground font-bold transition-all hover:opacity-90 hover:translate-y-[-2px]"
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
