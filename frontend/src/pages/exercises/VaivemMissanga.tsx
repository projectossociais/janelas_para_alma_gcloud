import { useState } from "react";
import { useTranslation } from "react-i18next";
import { AlertTriangle } from "lucide-react";
import BaseExercise from "@/components/exercises/BaseExercise";
import AssistenteTreino from "@/components/visao/AssistenteTreino";
import { EcraPasso } from "@/components/visao/EcraPasso";
import EscolherOculos, { TrocarModo, type ComOuSemOculos } from "@/components/visao/EscolherOculos";
import PaginaExercicio from "@/components/visao/PaginaExercicio";
import TreinoFio from "@/components/visao/TreinoFio";
import { eComputador } from "@/components/visao/desenhoFio";
import { ID_CONVERGENCIA } from "@/lib/visao/ids";
import { DesenhoComoSegurar } from "./FioMissangas";
import PontesFusao from "./PontesFusao";

const EXERCICIO_ID = ID_CONVERGENCIA;
/** A mesma chave do Olho Mágico: quem já tinha escolhido "sem óculos" entra directo no treino novo. */
const CHAVE_OCULOS = "jpa.visao.convergencia.oculos";

const lerOculos = (): ComOuSemOculos | null => {
  try {
    const v = window.localStorage.getItem(CHAVE_OCULOS);
    return v === "com" || v === "sem" ? v : null;
  } catch {
    return null;
  }
};

const AvisoVaivem = ({ aoTrocar }: { aoTrocar: () => void }) => {
  const { t } = useTranslation();
  return (
    <div className="space-y-3 text-left text-sm">
      <p className="text-muted-foreground">{t("Visao.fioTreinoParaQueServe")}</p>
      <DesenhoComoSegurar />
      <ol className="list-decimal space-y-1 pl-5 text-base text-foreground">
        {[1, 2, 3, 4].map((n) => (
          <li key={n}>{t(`Visao.fioTreinoComo${n}`)}</li>
        ))}
      </ol>
      <p className="flex gap-2 rounded-lg border border-gold/60 bg-gold/10 p-3 text-foreground" role="note">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-gold" aria-hidden />
        <span>{t("Visao.convergenciaAvisoParar")}</span>
      </p>
      <p className="flex gap-2 rounded-lg border border-gold/60 bg-gold/10 p-3 text-foreground" role="note">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-gold" aria-hidden />
        <span>{t("Visao.fioTreinoAvisoEstrabismo")}</span>
      </p>
      <TrocarModo para="com" aoTrocar={aoTrocar} />
    </div>
  );
};

/** Num computador não se encosta o ecrã ao nariz: explica e oferece as Pontes de Fusão (com óculos 3D). */
const SoTelemovel = ({ aoTrocar }: { aoTrocar: () => void }) => {
  const { t } = useTranslation();
  return (
    <EcraPasso titulo={t("Visao.fioSoTelemovelTitulo")}>
      <div className="w-full space-y-3 text-left text-sm">
        <DesenhoComoSegurar />
        <p className="text-base text-foreground">{t("Visao.fioSoTelemovelTexto")}</p>
        <p className="text-muted-foreground">{t("Visao.fioTreinoParaQueServe")}</p>
        <TrocarModo para="com" aoTrocar={aoTrocar} />
      </div>
    </EcraPasso>
  );
};

/**
 * Vaivém da Missanga (id `convergence`, desde 2026-11-11; antes, Olho Mágico).
 * Sem óculos (por omissão): o Fio de Missangas em treino diário
 * (`TreinoFio`, `lib/visao/fioTreino.ts`). Com óculos 3D: as Pontes de Fusão,
 * como antes.
 */
const VaivemMissanga = () => {
  const { t } = useTranslation();
  // Com a escolha guardada neste aparelho, entra directo nesse modo.
  const [oculos, setOculos] = useState<ComOuSemOculos | null>(() => lerOculos());
  const escolher = (o: ComOuSemOculos) => {
    try {
      window.localStorage.setItem(CHAVE_OCULOS, o);
    } catch {
      // armazenamento bloqueado: pergunta-se outra vez
    }
    setOculos(o);
  };

  if (oculos === "com") return <PontesFusao aoTrocarModo={() => escolher("sem")} />;

  if (oculos === "sem")
    return (
      <PaginaExercicio>
        <AssistenteTreino
          exercicioId={EXERCICIO_ID}
          titulo={t("Visao.convergenciaTitulo")}
          descricao={t("Visao.convergenciaDescricao")}
          monocular={false}
          aviso={<AvisoVaivem aoTrocar={() => escolher("com")} />}
          requisito={() => (eComputador() ? <SoTelemovel aoTrocar={() => escolher("com")} /> : null)}
          tarefa={(api, ctx, resultado) => <TreinoFio api={api} ctx={ctx} resultado={resultado} />}
        />
      </PaginaExercicio>
    );

  return (
    <PaginaExercicio>
      <BaseExercise title={t("Visao.convergenciaTitulo")} description={t("Visao.convergenciaDescricao")} exercicioId={EXERCICIO_ID} tipo="treino">
        <EscolherOculos
          titulo={t("Visao.olhoMagicoOculosTitulo")}
          sem={{ titulo: t("Visao.fioTreinoSemOculos"), texto: t("Visao.fioTreinoSemOculosTexto") }}
          com={{ titulo: t("Visao.olhoMagicoComOculos"), texto: t("Visao.olhoMagicoComOculosTexto") }}
          inicial={null}
          aoEscolher={escolher}
        />
      </BaseExercise>
    </PaginaExercicio>
  );
};

export default VaivemMissanga;
