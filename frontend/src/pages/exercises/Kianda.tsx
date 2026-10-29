import { useState } from "react";
import { useTranslation } from "react-i18next";
import { AlertTriangle } from "lucide-react";
import BaseExercise from "@/components/exercises/BaseExercise";
import AssistenteTreino from "@/components/visao/AssistenteTreino";
import BotaoOuvir from "@/components/visao/BotaoOuvir";
import EscolherOculos from "@/components/visao/EscolherOculos";
import JogoKianda from "@/components/visao/JogoKianda";
import PaginaExercicio from "@/components/visao/PaginaExercicio";
import PescaKianda from "@/components/visao/PescaKianda";
import { ID_ANEIS } from "@/lib/visao/ids";
import { guardarModoKianda, lerModoKianda, type ModoKianda } from "@/lib/visao/kianda";

const EXERCICIO_ID = ID_ANEIS;

/** Primeiro ecrã: sem óculos (tapa-olho, por omissão) ou com óculos 3D. Lembra a última escolha. */
export const EscolherModoKianda = ({ aoEscolher }: { aoEscolher: (m: ModoKianda) => void }) => {
  const { t } = useTranslation();
  const guardado = lerModoKianda();
  return (
    <EscolherOculos
      titulo={t("Visao.kiandaModoTitulo")}
      sem={{ titulo: t("Visao.kiandaModoTapaOlho"), texto: t("Visao.kiandaModoTapaOlhoTexto") }}
      com={{ titulo: t("Visao.kiandaModoOculos"), texto: t("Visao.kiandaModoOculosTexto") }}
      inicial={guardado === "oculos" ? "com" : guardado === "tapaOlho" ? "sem" : null}
      aoEscolher={(o) => {
        const m: ModoKianda = o === "com" ? "oculos" : "tapaOlho";
        guardarModoKianda(m);
        aoEscolher(m);
      }}
    />
  );
};

const AvisoKianda = () => {
  const { t } = useTranslation();
  return (
    <div className="space-y-3 text-left text-sm">
      <p className="flex gap-2 rounded-lg border border-gold/60 bg-gold/10 p-3 text-foreground" role="note">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-gold" aria-hidden />
        <span>{t("Visao.kiandaAvisoParar")}</span>
      </p>
      <p className="flex gap-2 rounded-lg border border-gold/60 bg-gold/10 p-3 text-foreground" role="note">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-gold" aria-hidden />
        <span>{t("Visao.kiandaAvisoAdultos")}</span>
      </p>
      <p className="text-muted-foreground">{t("Visao.kiandaComoJogar")}</p>
    </div>
  );
};

const AvisoPesca = () => {
  const { t } = useTranslation();
  return (
    <div className="space-y-3 text-left text-sm">
      <p className="text-foreground">{t("Visao.pescaComoJogar")}</p>
      <p className="text-muted-foreground">{t("Visao.pescaTapaOlho")}</p>
      <BotaoOuvir texto={`${t("Visao.pescaComoJogar")} ${t("Visao.pescaTapaOlho")}`} />
    </div>
  );
};

/**
 * Kianda (id `ambliopia`, no teste de 90 dias). Sem óculos (por omissão): a
 * pesca com o olho mais forte tapado (`PescaKianda`). Com óculos 3D: o jogo
 * dicóptico (`JogoKianda`). Ver `lib/visao/pescaKianda.ts` e `lib/visao/kianda.ts`.
 */
const Kianda = () => {
  const { t } = useTranslation();
  const [modo, setModo] = useState<ModoKianda | null>(null);

  if (modo === "tapaOlho")
    return (
      <PaginaExercicio>
        <AssistenteTreino
          exercicioId={EXERCICIO_ID}
          titulo={t("Visao.aneisTitulo")}
          descricao={t("Visao.pescaDescricao")}
          monocular
          aviso={<AvisoPesca />}
          tarefa={(api, ctx, resultado) => <PescaKianda api={api} ctx={ctx} resultado={resultado} />}
        />
      </PaginaExercicio>
    );

  if (modo === "oculos")
    return (
      <PaginaExercicio>
        <AssistenteTreino
          exercicioId={EXERCICIO_ID}
          titulo={t("Visao.aneisTitulo")}
          descricao={t("Visao.kiandaDescricaoOculos")}
          monocular={false}
          olhoFraco
          comDistancia
          oculos3D
          aviso={<AvisoKianda />}
          tarefa={(api, ctx, resultado) => <JogoKianda api={api} ctx={ctx} resultado={resultado} />}
        />
      </PaginaExercicio>
    );

  return (
    <PaginaExercicio>
      <BaseExercise
        title={t("Visao.aneisTitulo")}
        description={t("Visao.aneisDescricao")}
        exercicioId={EXERCICIO_ID}
        tipo="treino"
      >
        <EscolherModoKianda aoEscolher={setModo} />
      </BaseExercise>
    </PaginaExercicio>
  );
};

export default Kianda;
