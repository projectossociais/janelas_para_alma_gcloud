import { CalendarDays, ExternalLink, MapPin } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { useTranslation } from "react-i18next";

/** Vídeo da apresentação (servido pelo próprio site, em `public/videos`). */
export const VIDEO_FEIRA_INOVACAO = "/videos/feira-inovacao-desafio-genial.mp4";

/** Formulário de inscrição da Feira de Inovação (Google Forms da organização). */
export const INSCRICAO_FEIRA_INOVACAO =
  "https://docs.google.com/forms/d/e/1FAIpQLSdDAh19syn6gjcASoehpz57PREe4M1lo_91IDBBw_LMNunQiA/viewform";

interface FeiraInovacaoModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Detalhe da novidade: o projecto é finalista do Desafio Genial Geração
 *  Digital e apresenta-se na Feira de Inovação (13 de Novembro de 2026). */
const FeiraInovacaoModal = ({ open, onOpenChange }: FeiraInovacaoModalProps) => {
  const { t } = useTranslation();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] p-0 overflow-hidden">
        <ScrollArea className="max-h-[90vh] px-6 py-6">
          <DialogHeader className="pb-4">
            <DialogTitle className="text-2xl text-marca-marinho">{t("FeiraInovacaoModal.titulo")}</DialogTitle>
            <DialogDescription>{t("FeiraInovacaoModal.subtitulo")}</DialogDescription>
          </DialogHeader>

          {/* Só toca quando a pessoa carrega no play: nada de som sozinho. */}
          {open && (
            <video
              src={VIDEO_FEIRA_INOVACAO}
              controls
              playsInline
              preload="metadata"
              aria-label={t("FeiraInovacaoModal.titulo")}
              className="w-full max-h-[60vh] rounded-xl bg-black"
            />
          )}

          <div className="space-y-4 pt-5 pb-4 text-marca-marinho/80 leading-relaxed">
            <p>{t("FeiraInovacaoModal.paragrafo1")}</p>
            <p>{t("FeiraInovacaoModal.paragrafo2")}</p>
            <p>{t("FeiraInovacaoModal.paragrafo3")}</p>
            <ul className="space-y-2 font-medium text-marca-marinho">
              <li className="flex items-center gap-2">
                <MapPin className="w-4 h-4 shrink-0" aria-hidden="true" />
                {t("FeiraInovacaoModal.local")}
              </li>
              <li className="flex items-center gap-2">
                <CalendarDays className="w-4 h-4 shrink-0" aria-hidden="true" />
                {t("FeiraInovacaoModal.dataHora")}
              </li>
            </ul>
            <Button asChild className="w-full sm:w-auto">
              <a href={INSCRICAO_FEIRA_INOVACAO} target="_blank" rel="noopener noreferrer">
                {t("FeiraInovacaoModal.inscrever")}
                <ExternalLink className="w-4 h-4" aria-hidden="true" />
              </a>
            </Button>
            <p className="pt-2 text-sm italic">{t("FeiraInovacaoModal.lema")}</p>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};

export default FeiraInovacaoModal;
