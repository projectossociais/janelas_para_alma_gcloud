import { Layers } from "lucide-react";
import PremiumExercicioEsqueleto from "@/components/exercises/PremiumExercicioEsqueleto";
import { useTranslation } from "react-i18next";

const EstereopsiaExercise = () => {
  const { t } = useTranslation();
  return (
  <PremiumExercicioEsqueleto
    title={t("EstereopsiaExercise.estereopsiaVisao3d")}
    description={t("EstereopsiaExercise.padroesEstereoscopicosAvaliamE")}
    icon={Layers}
  />
);
};

export default EstereopsiaExercise;
