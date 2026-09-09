import { useState } from "react";
import { Eye, Heart, Leaf, ExternalLink } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

const stats = [
  {
    value: "2.2B",
    label: "Pessoas com deficiência visual no mundo",
    icon: Eye,
    modalTitle: "Deficiência Visual no Mundo",
    modalContent:
      "Segundo o relatório da Organização Mundial da Saúde (OMS) sobre a saúde visual mundial publicado em 2019, pelo menos 2,2 bilhões de pessoas ao redor do mundo têm deficiência visual. Destas, pelo menos 1 bilhão tem uma deficiência visual que poderia ter sido prevenida ou que ainda não foi tratada. A maioria das pessoas com deficiência visual tem mais de 50 anos, mas a condição afecta pessoas de todas as idades.",
    sourceLabel: "Ler Relatório Mundial da Visão (OMS) ↗",
    sourceUrl: "https://www.who.int/publications/i/item/9789241516570",
  },
  {
    value: "0.8%",
    label: "Prevalência de estrabismo em África",
    icon: Heart,
    modalTitle: "Prevalência de Estrabismo em África",
    modalContent:
       "De acordo a pesquisa feita pela National Library of Medicine através da National Center Of Biotechnology Information em 2023, a prevalência geral de estrabismo na África foi estimada em 0,8%. Esta condição, quando não tratada, pode levar a ambliopia (olho preguiçoso) e perda permanente da visão binocular, afectando significativamente a qualidade de vida e o desenvolvimento educacional das crianças africanas.",
    sourceLabel: "Ler Artigo Académico sobre Estrabismo ↗",
    sourceUrl: "https://www.tandfonline.com/doi/full/10.1080/09273972.2022.2157023",
  },
  {
    value: "80%",
    label: "Da informação é captada pela visão",
    icon: Leaf,
    modalTitle: "A Visão como Principal Sentido",
    modalContent:
      "Estudos científicos indicam que aproximadamente 80% de toda a informação que o ser humano capta do mundo exterior é processada através da visão. Este dado sublinha a importância crítica da saúde ocular para o desenvolvimento cognitivo, o desempenho escolar e profissional, e a autonomia individual. Quando a visão é comprometida, o impacto estende-se a todas as áreas da vida, desde a aprendizagem até à interacção social e à capacidade de trabalhar.",
    sourceLabel: "Ler mais sobre percepção visual ↗",
    sourceUrl: "https://en.wikipedia.org/wiki/Visual_perception",
  },
];

const AboutSection = () => {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <section id="sobre" className="py-20 md:py-28 bg-background">
      <div className="container">
        <div className="max-w-3xl mx-auto text-center space-y-6 mb-16">
          <span className="text-sm font-medium tracking-widest uppercase text-teal">Sobre a Janelas para a Alma</span>
          <h2 className="text-3xl md:text-5xl font-bold text-foreground leading-tight">
            Um Olhar Alinhado,{" "}
            <span className="text-gradient-brand">Uma Vida Transformada</span>
          </h2>
          <p className="text-lg text-muted-foreground leading-relaxed text-justify">
            A Janelas para a Alma é uma start up angolana direccionada a pessoas com estrabismo — condição que afecta o alinhamento dos olhos, podendo causar visão dupla, ambliopia ou cegueira. Em Angola, muitas crianças, jovens e adultos convivem com esta condição sem o devido apoio, o que afecta a auto-estima, desempenho escolar e integração social.
          </p>
          <p className="text-lg text-muted-foreground leading-relaxed text-justify">
            Ao mesmo tempo, o meio ambiente sofre com o descarte inadequado de resíduos reutilizáveis. O Janelas para a Alma actua na intersecção destas duas problemáticas, propondo soluções que beneficiam tanto as pessoas quanto o planeta.
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {stats.map((stat, i) => (
            <button
              key={i}
              onClick={() => setOpenIndex(i)}
              className="text-center p-8 rounded-2xl bg-card shadow-card border border-border/50 transition-all hover:shadow-elevated hover:scale-[1.03] cursor-pointer focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
            >
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-xl bg-teal/10 text-teal mb-4">
                <stat.icon className="w-7 h-7" />
              </div>
              <div className="text-4xl font-bold text-foreground mb-2">{stat.value}</div>
              <p className="text-muted-foreground">{stat.label}</p>
              <p className="text-xs text-teal mt-3 font-medium">Clique para saber mais →</p>
            </button>
          ))}
        </div>
      </div>

      {stats.map((stat, i) => (
        <Dialog key={i} open={openIndex === i} onOpenChange={(v) => !v && setOpenIndex(null)}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-3 text-xl">
                <div className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-teal/10 text-teal">
                  <stat.icon className="w-5 h-5" />
                </div>
                {stat.modalTitle}
              </DialogTitle>
              <DialogDescription className="sr-only">
                Detalhes sobre {stat.label}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="text-5xl font-bold text-teal text-center py-4">{stat.value}</div>
              <p className="text-muted-foreground leading-relaxed text-justify">{stat.modalContent}</p>
              {stat.sourceUrl && (
                <a
                  href={stat.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-sm font-medium text-teal hover:underline transition-colors mt-2"
                >
                  <ExternalLink className="w-4 h-4" />
                  {stat.sourceLabel}
                </a>
              )}
            </div>
          </DialogContent>
        </Dialog>
      ))}
    </section>
  );
};

export default AboutSection;
