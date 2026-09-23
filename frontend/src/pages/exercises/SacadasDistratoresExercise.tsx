import { Focus } from "lucide-react";
import PremiumExercicioEsqueleto from "@/components/exercises/PremiumExercicioEsqueleto";
import { useTranslation } from "react-i18next";

const SacadasDistratoresExercise = () => {
  const { t } = useTranslation();
  return (
  <PremiumExercicioEsqueleto
    title={t("SacadasDistratoresExercise.sacadasComDistratores")}
    description={t("SacadasDistratoresExercise.encontreOAlvoCerto")}
    icon={Focus}
  />
);
};

export default SacadasDistratoresExercise;
