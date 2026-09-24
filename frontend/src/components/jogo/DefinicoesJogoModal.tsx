import { Music, Volume2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { useAudioJogo } from "@/contexts/AudioJogoContext";
import { cn } from "@/lib/utils";

interface DefinicoesJogoModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Definições do jogo -- música e efeitos sonoros, guardados neste dispositivo. */
const DefinicoesJogoModal = ({ open, onOpenChange }: DefinicoesJogoModalProps) => {
  const { t } = useTranslation();
  const { musica, efeitos, definirMusica, definirEfeitos, tocarEfeito } = useAudioJogo();

  const opcoes = [
    {
      id: "definicao-musica",
      icone: Music,
      titulo: t("DefinicoesJogo.musica"),
      descricao: t("DefinicoesJogo.musicaDescricao"),
      ligado: musica,
      mudar: definirMusica,
    },
    {
      id: "definicao-efeitos",
      icone: Volume2,
      titulo: t("DefinicoesJogo.efeitos"),
      descricao: t("DefinicoesJogo.efeitosDescricao"),
      ligado: efeitos,
      mudar: (ligados: boolean) => {
        definirEfeitos(ligados);
        // Uma amostra ao ligar -- o jogador ouve logo que resultou.
        if (ligados) setTimeout(() => tocarEfeito("clique"), 0);
      },
    },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-xl">{t("DefinicoesJogo.titulo")}</DialogTitle>
          <DialogDescription>{t("DefinicoesJogo.descricao")}</DialogDescription>
        </DialogHeader>

        <ul className="grid grid-cols-2 gap-3">
          {opcoes.map(({ id, icone: Icone, titulo, descricao, ligado, mudar }) => (
            <li key={id} className="rounded-2xl border border-border/60 bg-card p-4 flex flex-col items-center gap-3 text-center">
              <span
                className={cn(
                  "w-16 h-16 rounded-full flex items-center justify-center border-4 transition-colors",
                  ligado ? "bg-green/15 border-green text-green" : "bg-muted border-border text-muted-foreground"
                )}
                aria-hidden
              >
                <Icone className="w-7 h-7" />
              </span>
              <label htmlFor={id} className="font-semibold text-foreground">
                {titulo}
              </label>
              <Switch id={id} checked={ligado} onCheckedChange={mudar} aria-describedby={`${id}-descricao`} />
              <p id={`${id}-descricao`} className="text-xs text-muted-foreground">
                {ligado ? t("DefinicoesJogo.ligado") : t("DefinicoesJogo.desligado")} · {descricao}
              </p>
            </li>
          ))}
        </ul>

        <p className="text-xs text-muted-foreground text-center">{t("DefinicoesJogo.guardadoNesteDispositivo")}</p>
      </DialogContent>
    </Dialog>
  );
};

export default DefinicoesJogoModal;
