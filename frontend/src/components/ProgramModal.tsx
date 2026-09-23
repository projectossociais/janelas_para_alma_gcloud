import { BookOpen, Target, Users, ListChecks, ChevronRight } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useTranslation } from "react-i18next";
import i18n from "@/i18n";

interface ProgramModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const objectives = () => [
  i18n.t("ProgramModal.mobilizarJovensVoluntarios"),
  i18n.t("ProgramModal.promoverADesestigmatizacaoAtraves"),
  i18n.t("ProgramModal.estabelecerUmaRedeActiva"),
  i18n.t("ProgramModal.implementarAccoesDeInclusao"),
];

const stages = () => [
  i18n.t("ProgramModal.planeamentoEPreparacao"),
  i18n.t("ProgramModal.recrutamentoESeleccao"),
  i18n.t("ProgramModal.capacitacaoDosEmbaixadores"),
  i18n.t("ProgramModal.implementacao"),
  i18n.t("ProgramModal.monitoramento"),
  i18n.t("ProgramModal.avaliacaoEExpansao"),
];

const ProgramModal = ({ open, onOpenChange }: ProgramModalProps) => {
  const { t } = useTranslation();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] p-0 overflow-hidden">
        <ScrollArea className="max-h-[85vh] px-6 py-6">
          <DialogHeader className="pb-4">
            <DialogTitle className="flex items-center gap-3 text-2xl">
              <div className="inline-flex items-center justify-center w-11 h-11 rounded-xl bg-teal/10 text-teal">
                <BookOpen className="w-5 h-5" />
              </div>
              {t("ProgramModal.programaMeuKambaEstrabico")}
            </DialogTitle>
            <DialogDescription>
              {t("ProgramModal.umaIniciativaEstrategicaDe")}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-8 pt-2 pb-4">
            {/* Sobre */}
            <div className="space-y-3">
              <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-teal" />
                {t("ProgramModal.sobre")}
              </h3>
              <p className="text-muted-foreground leading-relaxed text-justify">
                {t("ProgramModal.oProgramaEUma")}
              </p>
            </div>

            {/* Objectivos */}
            <div className="space-y-3">
              <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
                <Target className="w-4 h-4 text-teal" />
                {t("ProgramModal.objectivos")}
              </h3>
              <ul className="space-y-2">
                {objectives().map((obj, i) => (
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
                {t("ProgramModal.publicoAlvo")}
              </h3>
              <div className="space-y-2">
                <div className="p-4 rounded-xl bg-teal/5 border border-teal/10">
                  <p className="text-sm font-medium text-foreground mb-1">{t("ProgramModal.primario")}</p>
                  <p className="text-muted-foreground text-sm">{t("ProgramModal.pessoasEstrabicasECom")}</p>
                </div>
                <div className="p-4 rounded-xl bg-muted/50 border border-border/50">
                  <p className="text-sm font-medium text-foreground mb-1">{t("ProgramModal.secundario")}</p>
                  <p className="text-muted-foreground text-sm">
                    {t("ProgramModal.familiasVoluntariosLideresComunitarios")}
                  </p>
                </div>
              </div>
            </div>

            {/* Etapas */}
            <div className="space-y-3">
              <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
                <ListChecks className="w-4 h-4 text-teal" />
                {t("ProgramModal.etapasDoPrograma")}
              </h3>
              <ol className="space-y-2">
                {stages().map((stage, i) => (
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
