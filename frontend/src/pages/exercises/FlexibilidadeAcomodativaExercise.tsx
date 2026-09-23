import { RefreshCw } from "lucide-react";
import PremiumExercicioEsqueleto from "@/components/exercises/PremiumExercicioEsqueleto";
import { useTranslation } from "react-i18next";

const FlexibilidadeAcomodativaExercise = () => {
  const { t } = useTranslation();
  return (
  <PremiumExercicioEsqueleto
    title={t("FlexibilidadeAcomodativaExercise.flexibilidadeAcomodativa")}
    description={t("FlexibilidadeAcomodativaExercise.mudaDeFocoEntre")}
    icon={RefreshCw}
  />
);
};

export default FlexibilidadeAcomodativaExercise;
