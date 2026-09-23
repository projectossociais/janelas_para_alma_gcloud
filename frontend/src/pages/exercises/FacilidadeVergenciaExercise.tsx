import { GitMerge } from "lucide-react";
import PremiumExercicioEsqueleto from "@/components/exercises/PremiumExercicioEsqueleto";
import { useTranslation } from "react-i18next";

const FacilidadeVergenciaExercise = () => {
  const { t } = useTranslation();
  return (
  <PremiumExercicioEsqueleto
    title={t("FacilidadeVergenciaExercise.facilidadeDeVergencia")}
    description={t("FacilidadeVergenciaExercise.alternaEntreConvergenciaE")}
    icon={GitMerge}
  />
);
};

export default FacilidadeVergenciaExercise;
