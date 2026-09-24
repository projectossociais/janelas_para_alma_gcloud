import { Flame, Gem, Sparkles } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export interface RecompensaSequenciaMostrada {
  sequencia: number;
  /** Os diamantes que entraram mesmo na conta. */
  diamantes: number;
  /** O limite diário cortou (parte d)o crédito -- avisa-se, mas celebra-se na mesma. */
  limiteDiarioAtingido?: boolean;
}

interface RecompensaSequenciaModalProps {
  /** `null` fecha o modal. */
  recompensa: RecompensaSequenciaMostrada | null;
  onContinuar: () => void;
}

/**
 * "Level Up!" -- celebra um marco de acertos seguidos (3, 6, 9...). Os
 * diamantes já foram creditados pela API quando o acerto foi validado; aqui
 * só se mostra quanto foi. O jogo fica em pausa até o jogador continuar.
 */
const RecompensaSequenciaModal = ({ recompensa, onContinuar }: RecompensaSequenciaModalProps) => {
  const { t } = useTranslation();

  return (
    <Dialog open={recompensa !== null} onOpenChange={(aberto) => !aberto && onContinuar()}>
      <DialogContent className="sm:max-w-sm text-center overflow-hidden">
        {/* Brilhos decorativos -- só visuais. */}
        <div aria-hidden className="pointer-events-none absolute inset-0">
          <Sparkles className="absolute top-6 left-6 w-5 h-5 text-gold animate-pulse" />
          <Sparkles className="absolute top-10 right-8 w-4 h-4 text-teal animate-pulse" />
          <Sparkles className="absolute bottom-24 left-10 w-4 h-4 text-teal animate-pulse" />
        </div>

        <div className="relative mx-auto mt-2 w-24 h-24 rounded-full bg-gradient-to-br from-gold to-teal flex items-center justify-center shadow-elevated animate-scale-in">
          <div className="w-20 h-20 rounded-full bg-navy flex flex-col items-center justify-center text-white">
            <Flame className="w-6 h-6 text-gold" />
            <span className="text-2xl font-bold leading-none">{recompensa?.sequencia}</span>
          </div>
        </div>

        <DialogHeader className="sm:text-center">
          <DialogTitle className="text-3xl font-extrabold text-center tracking-wide text-gold">
            {t("RecompensaSequencia.titulo")}
          </DialogTitle>
          <DialogDescription className="text-center text-base text-foreground">
            {t("RecompensaSequencia.acertosSeguidos", { sequencia: recompensa?.sequencia ?? 0 })}
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-2xl border-2 border-gold/50 bg-gold/5 p-4">
          <p className="text-xs font-bold uppercase tracking-widest text-gold mb-2">
            {t("RecompensaSequencia.aSuaRecompensa")}
          </p>
          <p
            className="inline-flex items-center gap-2 text-4xl font-bold text-teal"
            aria-label={t("RecompensaSequencia.diamantesGanhos", { diamantes: recompensa?.diamantes ?? 0 })}
          >
            <Gem className="w-9 h-9" />+{recompensa?.diamantes}
          </p>
        </div>

        {recompensa?.limiteDiarioAtingido ? (
          <p className="text-xs font-medium text-orange-700 bg-orange-500/10 rounded-lg px-3 py-2" role="status">
            {t("RecompensaSequencia.limiteDiarioAtingido")}
          </p>
        ) : (
          <p className="text-xs text-muted-foreground">{t("RecompensaSequencia.proximoMarco")}</p>
        )}

        <Button
          size="lg"
          onClick={onContinuar}
          className="w-full bg-green text-green-foreground hover:bg-green/90 text-base font-bold"
        >
          {t("RecompensaSequencia.continuar")}
        </Button>
      </DialogContent>
    </Dialog>
  );
};

export default RecompensaSequenciaModal;
