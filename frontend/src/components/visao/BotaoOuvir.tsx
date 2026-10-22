import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Square, Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { calar, falar, vozDisponivel } from "@/lib/visao/voz";

/**
 * "Ouvir as instruções": lê o texto em voz alta só quando se carrega (mesmo
 * com o som desligado), e enquanto fala o botão passa a "Parar". Não aparece
 * sem síntese de voz.
 */
const BotaoOuvir = ({ texto }: { texto: string }) => {
  const { t, i18n } = useTranslation();
  const [aFalar, setAFalar] = useState(false);
  useEffect(() => calar, []);
  if (!vozDisponivel()) return null;
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={() => {
        if (aFalar) {
          calar();
          setAFalar(false);
        } else setAFalar(falar(texto, i18n.language, { pedido: true, aoAcabar: () => setAFalar(false) }));
      }}
    >
      {aFalar ? <Square className="h-4 w-4" aria-hidden /> : <Volume2 className="h-4 w-4" aria-hidden />}
      {aFalar ? t("Visao.pararDeOuvir") : t("Visao.ouvirInstrucoes")}
    </Button>
  );
};

export default BotaoOuvir;
