import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { calar, falar, vozDisponivel } from "@/lib/visao/voz";

/** "Ouvir as instruções": lê o texto em voz alta. Não aparece sem síntese de voz. */
const BotaoOuvir = ({ texto }: { texto: string }) => {
  const { t, i18n } = useTranslation();
  useEffect(() => calar, []);
  if (!vozDisponivel()) return null;
  return (
    <Button type="button" variant="outline" size="sm" onClick={() => falar(texto, i18n.language)}>
      <Volume2 className="h-4 w-4" aria-hidden />
      {t("Visao.ouvirInstrucoes")}
    </Button>
  );
};

export default BotaoOuvir;
