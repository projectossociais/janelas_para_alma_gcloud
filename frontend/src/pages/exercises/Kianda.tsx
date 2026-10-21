import { useState } from "react";
import { useTranslation } from "react-i18next";
import { AlertTriangle, Glasses, Shield } from "lucide-react";
import BaseExercise from "@/components/exercises/BaseExercise";
import AssistenteTreino from "@/components/visao/AssistenteTreino";
import { BotaoContinuar, EcraPasso } from "@/components/visao/EcraPasso";
import JogoKianda from "@/components/visao/JogoKianda";
import PaginaExercicio from "@/components/visao/PaginaExercicio";
import { ID_ANEIS } from "@/lib/visao/ids";
import { guardarModoKianda, lerModoKianda, type ModoKianda } from "@/lib/visao/kianda";
import { cn } from "@/lib/utils";
import TreinoAneis from "./TreinoAneis";

const EXERCICIO_ID = ID_ANEIS;
const MODOS: readonly ModoKianda[] = ["oculos", "tapaOlho"];

/** Primeiro ecrã: com óculos 3D (os dois olhos) ou sem (tapa-olho). Lembra a última escolha. */
export const EscolherModoKianda = ({ aoEscolher }: { aoEscolher: (m: ModoKianda) => void }) => {
  const { t } = useTranslation();
  const [escolha, setEscolha] = useState<ModoKianda>(() => lerModoKianda() ?? "oculos");
  return (
    <EcraPasso
      titulo={t("Visao.kiandaModoTitulo")}
      accao={
        <BotaoContinuar
          aoClicar={() => {
            guardarModoKianda(escolha);
            aoEscolher(escolha);
          }}
        />
      }
    >
      <div role="radiogroup" aria-label={t("Visao.kiandaModoTitulo")} className="flex w-full flex-col gap-2">
        {MODOS.map((m) => (
          <button
            key={m}
            type="button"
            role="radio"
            aria-checked={escolha === m}
            onClick={() => setEscolha(m)}
            className={cn(
              "flex items-start gap-3 rounded-xl border-2 px-4 py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              escolha === m ? "border-teal bg-teal/10" : "border-border hover:border-teal/50",
            )}
          >
            {m === "oculos" ? (
              <Glasses className="mt-0.5 h-5 w-5 shrink-0 text-teal" aria-hidden />
            ) : (
              <Shield className="mt-0.5 h-5 w-5 shrink-0 text-teal" aria-hidden />
            )}
            <span>
              <span className="block text-sm font-semibold text-foreground">
                {m === "oculos" ? t("Visao.kiandaModoOculos") : t("Visao.kiandaModoTapaOlho")}
              </span>
              <span className="block text-sm text-muted-foreground">
                {m === "oculos" ? t("Visao.kiandaModoOculosTexto") : t("Visao.kiandaModoTapaOlhoTexto")}
              </span>
            </span>
          </button>
        ))}
      </div>
    </EcraPasso>
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

/**
 * Kianda (id `ambliopia`, no teste de 7 dias): com óculos 3D, o jogo
 * dicóptico (`JogoKianda`); sem óculos, o Treino de Anéis com tapa-olho de
 * sempre. Ver `lib/visao/kianda.ts`.
 */
const Kianda = () => {
  const { t } = useTranslation();
  const [modo, setModo] = useState<ModoKianda | null>(null);

  if (modo === "tapaOlho")
    return (
      <PaginaExercicio>
        <TreinoAneis />
      </PaginaExercicio>
    );

  if (modo === "oculos")
    return (
      <PaginaExercicio>
        <AssistenteTreino
          exercicioId={EXERCICIO_ID}
          grupo="trial"
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
        grupo="trial"
        tipo="treino"
      >
        <EscolherModoKianda aoEscolher={setModo} />
      </BaseExercise>
    </PaginaExercicio>
  );
};

export default Kianda;
