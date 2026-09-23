import { Zap } from "lucide-react";
import PremiumExercicioEsqueleto from "@/components/exercises/PremiumExercicioEsqueleto";
import { useTranslation } from "react-i18next";

const SacadasConvergenciaExercise = () => {
  const { t } = useTranslation();
  return (
  <PremiumExercicioEsqueleto
    exercicioId="sacadas-convergencia"
    title={t("SacadasConvergenciaExercise.convergenciaComSaltosSacadas")}
    description={t("SacadasConvergenciaExercise.alternaRapidamenteOFoco")}
    icon={Zap}
  />
);
};

export default SacadasConvergenciaExercise;
