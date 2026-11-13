import { CalendarDays, MapPin } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useTranslation } from "react-i18next";
import fotoPalco from "@/assets/novidade-vitoria-desafio-genial.jpg";
import fotoCertificado from "@/assets/novidade-vitoria-certificado.jpg";

/** Fotografia da entrega do prémio, usada também na miniatura do cartão. */
export const FOTO_VITORIA_DESAFIO_GENIAL = fotoPalco;

/** Vídeos servidos pelo próprio site (`public/videos`). */
export const VIDEO_VITORIA_PREMIO = "/videos/vitoria-desafio-genial-premio.mp4";
export const VIDEO_VITORIA_CELEBRACAO = "/videos/vitoria-desafio-genial-celebracao.mp4";
export const VIDEO_FEIRA_INOVACAO = "/videos/feira-inovacao-desafio-genial.mp4";

interface VitoriaDesafioGenialModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Detalhe da novidade: o projecto venceu o Desafio Genial Geração Digital
 *  (final a 13 de Novembro de 2026, no Centro de Ciências de Luanda). */
const VitoriaDesafioGenialModal = ({ open, onOpenChange }: VitoriaDesafioGenialModalProps) => {
  const { t } = useTranslation();
  const videos = [
    { src: VIDEO_VITORIA_PREMIO, legenda: t("VitoriaDesafioGenialModal.videoPremio") },
    { src: VIDEO_VITORIA_CELEBRACAO, legenda: t("VitoriaDesafioGenialModal.videoCelebracao") },
    { src: VIDEO_FEIRA_INOVACAO, legenda: t("VitoriaDesafioGenialModal.videoApresentacao") },
  ];
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] p-0 overflow-hidden">
        <ScrollArea className="max-h-[90vh] px-6 py-6">
          <DialogHeader className="pb-4">
            <DialogTitle className="text-2xl text-marca-marinho">{t("VitoriaDesafioGenialModal.titulo")}</DialogTitle>
            <DialogDescription>{t("VitoriaDesafioGenialModal.subtitulo")}</DialogDescription>
          </DialogHeader>

          <img
            src={fotoPalco}
            alt={t("VitoriaDesafioGenialModal.fotoPalcoAlt")}
            className="w-full rounded-xl"
          />

          <div className="space-y-4 pt-5 pb-4 text-marca-marinho/80 leading-relaxed">
            <p>{t("VitoriaDesafioGenialModal.paragrafo1")}</p>
            <p>{t("VitoriaDesafioGenialModal.paragrafo2")}</p>
            <p>{t("VitoriaDesafioGenialModal.paragrafo3")}</p>
            <ul className="space-y-2 font-medium text-marca-marinho">
              <li className="flex items-center gap-2">
                <MapPin className="w-4 h-4 shrink-0" aria-hidden="true" />
                {t("VitoriaDesafioGenialModal.local")}
              </li>
              <li className="flex items-center gap-2">
                <CalendarDays className="w-4 h-4 shrink-0" aria-hidden="true" />
                {t("VitoriaDesafioGenialModal.data")}
              </li>
            </ul>

            {/* Só tocam quando a pessoa carrega no play: nada de som sozinho. */}
            {open &&
              videos.map((video) => (
                <figure key={video.src} className="space-y-2">
                  <video
                    src={video.src}
                    controls
                    playsInline
                    preload="metadata"
                    aria-label={video.legenda}
                    className="w-full max-h-[60vh] rounded-xl bg-black"
                  />
                  <figcaption className="text-sm">{video.legenda}</figcaption>
                </figure>
              ))}

            <figure className="space-y-2">
              <img
                src={fotoCertificado}
                alt={t("VitoriaDesafioGenialModal.fotoCertificadoAlt")}
                loading="lazy"
                className="w-full max-h-[70vh] object-contain rounded-xl"
              />
              <figcaption className="text-sm">{t("VitoriaDesafioGenialModal.fotoCertificadoLegenda")}</figcaption>
            </figure>

            <p className="pt-2 text-sm italic">{t("VitoriaDesafioGenialModal.lema")}</p>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};

export default VitoriaDesafioGenialModal;
