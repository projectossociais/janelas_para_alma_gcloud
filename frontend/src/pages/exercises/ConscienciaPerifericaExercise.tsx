import { Radar } from "lucide-react";
import PremiumExercicioEsqueleto from "@/components/exercises/PremiumExercicioEsqueleto";
import { useTranslation } from "react-i18next";

const ConscienciaPerifericaExercise = () => {
  const { t } = useTranslation();
  return (
  <PremiumExercicioEsqueleto
    title={t("ConscienciaPerifericaExercise.conscienciaPeriferica")}
    description={t("ConscienciaPerifericaExercise.detecteEstimulosNaPeriferia")}
    icon={Radar}
  />
);
};

export default ConscienciaPerifericaExercise;
