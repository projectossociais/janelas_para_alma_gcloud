import { useState } from "react";
import { Gem, Heart } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { Botao } from "@/design/componentes/Botao";
import { Dialogo, DialogoConteudo } from "@/design/componentes/Dialogo";
import { useCarteiraJogo } from "@/contexts/CarteiraJogoContext";
import { jogoApi, mensagemDeErroApi, type OfertaVidaExtra, type VidaExtraJogo } from "@/lib/apiClient";

interface VidaExtraModalProps {
  /** A oferta devolvida pela API ao errar; `null` fecha o modal. */
  oferta: OfertaVidaExtra | null;
  tempoEsgotado: boolean;
  onVidaUsada: (vida: VidaExtraJogo) => void;
  /** "Encerrar partida" -- a única saída do modal além de usar a vida extra.
   *  Leva sempre ao ecrã da resposta certa e da explicação. */
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
    // Sem "×", sem Esc, sem clique fora (`obrigaEscolha`): o jogador escolhe
    // usar a vida extra ou "Encerrar partida" -- e encerrar passa sempre pelo
    // ecrã educativo (resposta certa + explicação). Até 2026-09-24 o "×" ia
    // directo ao menu e saltava esse ecrã.
    <Dialogo open={oferta !== null}>
      <DialogoConteudo
        className="max-w-md"
        obrigaEscolha
        titulo={t("VidaExtra.titulo")}
        descricao={tempoEsgotado ? t("VidaExtra.tempoEsgotou") : t("VidaExtra.errou")}
        rodape={
          <>
            <Botao variante="secundario" onClick={onEncerrar} disabled={aUsar}>
              {t("VidaExtra.encerrar")}
            </Botao>
            <Botao onClick={() => void usar()} disabled={semSaldo} aCarregar={aUsar}>
              {semSaldo ? t("VidaExtra.diamantesInsuficientesBotao") : t("VidaExtra.usar", { custo })}
            </Botao>
          </>
        }
      >
        <div className="flex items-start gap-4">
          <span aria-hidden className="relative flex size-14 shrink-0 items-center justify-center rounded-pilula bg-erro-suave text-erro">
            <Heart className="size-7" />
          </span>
          <p className="text-corpo text-tinta-suave">{t("VidaExtra.explicacao")}</p>
        </div>

        <dl className="mt-5 grid grid-cols-3 gap-3 text-center">
          <div className="rounded-controlo bg-superficie-alt p-3">
            <dt className="text-legenda text-tinta-suave">{t("VidaExtra.custo")}</dt>
            <dd className="mt-1 inline-flex items-center gap-1 text-corpo-g font-medium tabular-nums text-tinta">
              <Gem className="size-4 text-accao" aria-hidden />
              {custo}
            </dd>
          </div>
          <div className="rounded-controlo bg-superficie-alt p-3">
            <dt className="text-legenda text-tinta-suave">{t("VidaExtra.oSeuSaldo")}</dt>
            <dd
              className="mt-1 inline-flex items-center gap-1 text-corpo-g font-medium tabular-nums text-tinta"
              data-testid="saldo-vida-extra"
            >
              <Gem className="size-4 text-accao" aria-hidden />
              {saldo}
            </dd>
          </div>
          <div className="rounded-controlo bg-superficie-alt p-3">
            <dt className="text-legenda text-tinta-suave">{t("VidaExtra.restantesCurto")}</dt>
            <dd
              className="mt-1 text-corpo-g font-medium tabular-nums text-tinta"
              aria-label={t("VidaExtra.restantes", { restantes: oferta?.restantes ?? 0 })}
            >
              {oferta?.restantes ?? 0}
            </dd>
          </div>
        </dl>

        {semSaldo && <p className="mt-4 text-legenda text-erro">{t("VidaExtra.saldoInsuficienteAviso")}</p>}
      </DialogoConteudo>
    </Dialogo>
  );
};

export default VidaExtraModal;
