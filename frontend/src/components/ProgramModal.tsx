import { BookOpen, Target, Users, ListChecks, ChevronRight } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";

interface ProgramModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const objectives = [
  "Mobilizar jovens voluntários",
  "Promover a desestigmatização através da empatia",
  "Estabelecer uma rede activa de apoio comunitário",
  "Implementar acções de inclusão social, visual e ecológica",
];

const stages = [
  "Planeamento e Preparação",
  "Recrutamento e Selecção",
  "Capacitação dos Embaixadores",
  "Implementação",
  "Monitoramento",
  "Avaliação e Expansão",
];

const ProgramModal = ({ open, onOpenChange }: ProgramModalProps) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] p-0 overflow-hidden">
        <ScrollArea className="max-h-[85vh] px-6 py-6">
          <DialogHeader className="pb-4">
            <DialogTitle className="flex items-center gap-3 text-2xl">
              <div className="inline-flex items-center justify-center w-11 h-11 rounded-xl bg-teal/10 text-teal">
                <BookOpen className="w-5 h-5" />
              </div>
              Programa Meu Kamba Estrábico
            </DialogTitle>
            <DialogDescription>
              Uma iniciativa estratégica de inclusão visual e ecológica da Janelas para a Alma.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-8 pt-2 pb-4">
            {/* Sobre */}
            <div className="space-y-3">
              <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-teal" />
                Sobre
              </h3>
              <p className="text-muted-foreground leading-relaxed text-justify">
                O programa é uma iniciativa estratégica da Janelas para a Alma que busca criar uma rede de apoio nas comunidades,
                promovendo a inclusão e a solidariedade em torno do estrabismo. O nome visa
                desestigmatizar a condição por meio do afecto, mobilizando jovens voluntários como
                "Kambas" (Embaixadores da inclusão visual e ecológica).
              </p>
            </div>

            {/* Objectivos */}
            <div className="space-y-3">
              <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
                <Target className="w-4 h-4 text-teal" />
                Objectivos
              </h3>
              <ul className="space-y-2">
                {objectives.map((obj, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <ChevronRight className="w-4 h-4 text-teal shrink-0 mt-1" />
                    <span className="text-muted-foreground leading-relaxed">{obj}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Público-Alvo */}
            <div className="space-y-3">
              <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
                <Users className="w-4 h-4 text-teal" />
                Público-Alvo
              </h3>
              <div className="space-y-2">
                <div className="p-4 rounded-xl bg-teal/5 border border-teal/10">
                  <p className="text-sm font-medium text-foreground mb-1">Primário</p>
                  <p className="text-muted-foreground text-sm">Pessoas estrábicas e com deficiência visual.</p>
                </div>
                <div className="p-4 rounded-xl bg-muted/50 border border-border/50">
                  <p className="text-sm font-medium text-foreground mb-1">Secundário</p>
                  <p className="text-muted-foreground text-sm">
                    Famílias, voluntários, líderes comunitários, escolas e parceiros locais.
                  </p>
                </div>
              </div>
            </div>

            {/* Etapas */}
            <div className="space-y-3">
              <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
                <ListChecks className="w-4 h-4 text-teal" />
                Etapas do Programa
              </h3>
              <ol className="space-y-2">
                {stages.map((stage, i) => (
                  <li key={i} className="flex items-center gap-3">
                    <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-teal/10 text-teal text-xs font-bold shrink-0">
                      {i + 1}
                    </span>
                    <span className="text-muted-foreground leading-relaxed">{stage}</span>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};

export default ProgramModal;
