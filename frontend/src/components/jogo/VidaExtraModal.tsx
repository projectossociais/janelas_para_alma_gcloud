import { useState } from "react";
import { Gem, Heart, Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useCarteiraJogo } from "@/contexts/CarteiraJogoContext";
import { jogoApi, mensagemDeErroApi, type OfertaVidaExtra, type VidaExtraJogo } from "@/lib/apiClient";

interface VidaExtraModalProps {
  /** A oferta devolvida pela API ao errar; `null` fecha o modal. */
  oferta: OfertaVidaExtra | null;
  tempoEsgotado: boolean;
  onVidaUsada: (vida: VidaExtraJogo) => void;
  /** Recusou (ou fechou o modal): a partida termina normalmente. */
  onEncerrar: () => void;
}

/**
 * "Vida Extra" -- aparece quando o jogador erra (ou o tempo esgota), antes do
 * ecrã final. Pagar mantém o patamar e dá outra tentativa na mesma pergunta,
 * sem a opção falhada. Custo, limite por partida e débito são decididos e
 * gravados pela API (`JogoService.usar_vida_extra`); aqui só se mostra.
 */
const VidaExtraModal = ({ oferta, tempoEsgotado, onVidaUsada, onEncerrar }: VidaExtraModalProps) => {
  const { t } = useTranslation();
  const { perfil, definirPerfil, recarregar } = useCarteiraJogo();
  const [aUsar, setAUsar] = useState(false);

  const saldo = perfil?.diamantes ?? 0;
  const custo = oferta?.custo ?? 0;
  const semSaldo = saldo < custo;

  const usar = async () => {
    setAUsar(true);
    try {
      const vida = await jogoApi.usarVidaExtra();
      definirPerfil(vida.perfil);
      onVidaUsada(vida);
    } catch (err) {
      // Nunca continuar a partida a partir daqui -- sem resposta da API a
      // vida extra não foi paga (CLAUDE.md secção 6).
      const status = (err as { status?: unknown } | null)?.status;
      if (status === 402) {
        toast.error(t("VidaExtra.diamantesInsuficientes"));
        void recarregar();
      } else {
        toast.error(mensagemDeErroApi(err, t("VidaExtra.naoFoiPossivelUsar")));
      }
    } finally {
      setAUsar(false);
    }
  };

  return (
    <Dialog open={oferta !== null} onOpenChange={(aberto) => !aberto && !aUsar && onEncerrar()}>
      <DialogContent className="sm:max-w-md text-center">
        <DialogHeader className="sm:text-center">
          <DialogTitle className="text-2xl text-center">{t("VidaExtra.titulo")}</DialogTitle>
          <DialogDescription className="text-center text-base text-foreground">
            {tempoEsgotado ? t("VidaExtra.tempoEsgotou") : t("VidaExtra.errou")}
          </DialogDescription>
        </DialogHeader>

        <p className="text-sm text-muted-foreground">{t("VidaExtra.explicacao")}</p>

        <div className="relative mx-auto my-2 w-24 h-24 rounded-full bg-destructive/10 border-2 border-destructive/30 flex items-center justify-center">
          <Heart className="w-12 h-12 text-destructive fill-destructive/20" />
          <Plus className="absolute w-5 h-5 text-destructive" strokeWidth={3} />
          <span
            className="absolute -top-1 -right-1 min-w-7 h-7 px-1.5 rounded-full bg-gold text-navy text-sm font-bold flex items-center justify-center"
            aria-label={t("VidaExtra.restantes", { restantes: oferta?.restantes ?? 0 })}
          >
            {oferta?.restantes ?? 0}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="rounded-xl bg-muted/60 p-3">
            <p className="text-muted-foreground">{t("VidaExtra.custo")}</p>
            <p className="inline-flex items-center gap-1 font-bold text-teal text-lg">
              <Gem className="w-4 h-4" />
              {custo}
            </p>
          </div>
          <div className="rounded-xl bg-muted/60 p-3">
            <p className="text-muted-foreground">{t("VidaExtra.oSeuSaldo")}</p>
            <p className="inline-flex items-center gap-1 font-bold text-teal text-lg" data-testid="saldo-vida-extra">
              <Gem className="w-4 h-4" />
              {saldo}
            </p>
          </div>
        </div>

        {semSaldo && <p className="text-xs text-destructive">{t("VidaExtra.saldoInsuficienteAviso")}</p>}

        <div className="flex flex-col gap-2 pt-1">
          <Button
            size="lg"
            onClick={() => void usar()}
            disabled={semSaldo || aUsar}
            className="w-full bg-green text-green-foreground hover:bg-green/90 text-base font-bold"
          >
            {aUsar && <Loader2 className="w-4 h-4 animate-spin" />}
            {semSaldo ? t("VidaExtra.diamantesInsuficientesBotao") : t("VidaExtra.usar", { custo })}
          </Button>
          <Button variant="outline" onClick={onEncerrar} disabled={aUsar} className="w-full">
            {t("VidaExtra.encerrar")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default VidaExtraModal;
