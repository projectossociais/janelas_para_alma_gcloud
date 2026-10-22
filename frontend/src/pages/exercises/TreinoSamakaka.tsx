import { useTranslation } from "react-i18next";
import AssistenteTreino from "@/components/visao/AssistenteTreino";
import BotaoOuvir from "@/components/visao/BotaoOuvir";
import PaginaExercicio from "@/components/visao/PaginaExercicio";
import PintarSamakaka from "@/components/visao/PintarSamakaka";
import { ID_CONTRASTE_BLOCOS } from "@/lib/visao/ids";

/** O id histórico `sacadas-convergencia` (antes, Treino de Contraste em blocos). */
const EXERCICIO_ID = ID_CONTRASTE_BLOCOS;

const AvisoSamakaka = () => {
  const { t } = useTranslation();
  const texto = `${t("Visao.samakakaComoFazer")} ${t("Visao.samakakaTapaOlho")}`;
  return (
    <div className="space-y-3 text-left text-sm">
      <p className="text-foreground">{t("Visao.samakakaComoFazer")}</p>
      <p className="text-muted-foreground">{t("Visao.samakakaTapaOlho")}</p>
      <BotaoOuvir texto={texto} />
    </div>
  );
};

/**
 * Pintar o Samakaka (id `sacadas-convergencia`, Premium): com o olho forte
 * tapado, o olho fraco guia o dedo pelos motivos do pano. Ver
 * `lib/visao/samakaka.ts`.
 */
const TreinoSamakaka = () => {
  const { t } = useTranslation();
  return (
    <PaginaExercicio>
      <AssistenteTreino
        exercicioId={EXERCICIO_ID}
        grupo="premium"
        titulo={t("Visao.contrasteBlocosTitulo")}
        descricao={t("Visao.contrasteBlocosDescricao")}
        monocular
        aviso={<AvisoSamakaka />}
        tarefa={(api, ctx, resultado) => <PintarSamakaka api={api} ctx={ctx} resultado={resultado} />}
      />
    </PaginaExercicio>
  );
};

export default TreinoSamakaka;
