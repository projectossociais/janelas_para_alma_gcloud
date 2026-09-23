import { Sparkles } from "lucide-react";
import PremiumExercicioEsqueleto from "@/components/exercises/PremiumExercicioEsqueleto";
import { useTranslation } from "react-i18next";

const ProgramaIaExercise = () => {
  const { t } = useTranslation();
  return (
  <PremiumExercicioEsqueleto
    title={t("ProgramaIaExercise.programaAdaptativoComIa")}
    description={t("ProgramaIaExercise.umAlgoritmoAjustaA")}
    icon={Sparkles}
  />
);
};

export default ProgramaIaExercise;
