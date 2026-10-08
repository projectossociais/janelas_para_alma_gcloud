import { Flame, Gem } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Aviso } from "@/design/componentes/Aviso";
import { Botao } from "@/design/componentes/Botao";
import { Dialogo, DialogoConteudo } from "@/design/componentes/Dialogo";

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
 * só se mostra quanto foi. O jogo fica em pausa até o jogador continuar
 * (Continuar, ×, Esc ou clique fora: todos continuam).
 */
const RecompensaSequenciaModal = ({ recompensa, onContinuar }: RecompensaSequenciaModalProps) => {
  const { t } = useTranslation();

  return (
    <Dialogo open={recompensa !== null} onOpenChange={(aberto) => !aberto && onContinuar()}>
      <DialogoConteudo
        className="max-w-sm text-center"
        titulo={t("RecompensaSequencia.titulo")}
        descricao={t("RecompensaSequencia.acertosSeguidos", { sequencia: recompensa?.sequencia ?? 0 })}
        rotuloFechar={t("RecompensaSequencia.fechar")}
        rodape={
          <Botao tamanho="g" larguraTotal onClick={onContinuar}>
            {t("RecompensaSequencia.continuar")}
          </Botao>
        }
      >
        <span
          aria-hidden
          className="mx-auto flex size-20 flex-col items-center justify-center rounded-pilula bg-aviso-suave text-aviso"
        >
          <Flame className="size-6" />
          <span className="text-titulo-p font-medium leading-none tabular-nums">{recompensa?.sequencia}</span>
        </span>

        <div className="mt-5 rounded-controlo bg-superficie-alt p-4">
          <p className="text-legenda text-tinta-suave">{t("RecompensaSequencia.aSuaRecompensa")}</p>
          <p
            className="mt-1 inline-flex items-center gap-2 text-titulo-m font-medium tabular-nums text-tinta"
            aria-label={t("RecompensaSequencia.diamantesGanhos", { diamantes: recompensa?.diamantes ?? 0 })}
          >
            <Gem className="size-7 text-accao" aria-hidden />+{recompensa?.diamantes}
          </p>
        </div>

        {recompensa?.limiteDiarioAtingido ? (
          <Aviso variante="aviso" anunciar className="mt-4 text-left">
            {t("RecompensaSequencia.limiteDiarioAtingido")}
          </Aviso>
        ) : (
          <p className="mt-4 text-legenda text-tinta-suave">{t("RecompensaSequencia.proximoMarco")}</p>
        )}
      </DialogoConteudo>
    </Dialogo>
  );
};

export default RecompensaSequenciaModal;
