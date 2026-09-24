import { FileBadge } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useTranslation } from "react-i18next";

interface FirmaOlharAlinhadoModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Detalhe da novidade institucional sobre a constituição da firma.
 * Só texto público: sem nomes de sócios, BI, NIF, moradas nem capital social.
 */
const FirmaOlharAlinhadoModal = ({ open, onOpenChange }: FirmaOlharAlinhadoModalProps) => {
  const { t } = useTranslation();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] p-0 overflow-hidden">
        <ScrollArea className="max-h-[85vh] px-6 py-6">
          <DialogHeader className="pb-4">
            <DialogTitle className="flex items-center gap-3 text-2xl">
              <div className="inline-flex items-center justify-center w-11 h-11 shrink-0 rounded-xl bg-teal/10 text-teal">
                <FileBadge className="w-5 h-5" />
              </div>
              {t("FirmaOlharAlinhadoModal.titulo")}
            </DialogTitle>
            <DialogDescription>{t("FirmaOlharAlinhadoModal.subtitulo")}</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-2 pb-4">
            <p className="text-muted-foreground leading-relaxed text-justify">
              {t("FirmaOlharAlinhadoModal.paragrafo1")}
            </p>
            <p className="text-muted-foreground leading-relaxed text-justify">
              {t("FirmaOlharAlinhadoModal.paragrafo2")}
            </p>
            <p className="text-muted-foreground leading-relaxed text-justify">
              {t("FirmaOlharAlinhadoModal.paragrafo3")}
            </p>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};

export default FirmaOlharAlinhadoModal;
