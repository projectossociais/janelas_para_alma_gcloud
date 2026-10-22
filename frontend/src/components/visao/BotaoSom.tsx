import { useSyncExternalStore } from "react";
import { useTranslation } from "react-i18next";
import { Volume2, VolumeX } from "lucide-react";
import { aoMudarSom, definirSom, somLigado } from "@/lib/visao/voz";

/** O som ligado ou desligado (a mesma escolha em todos os exercícios, guardada no aparelho). */
const useSom = (): boolean => useSyncExternalStore(aoMudarSom, somLigado, () => false);

/**
 * Ligar ou desligar o som (voz e bips) a qualquer momento do exercício. Fica
 * fixo no canto do ecrã, por cima também dos ecrãs inteiros (régua, luz,
 * mãozinha), e desligar cala logo o que estiver a ser dito.
 */
const BotaoSom = () => {
  const { t } = useTranslation();
  const ligado = useSom();
  const Icone = ligado ? Volume2 : VolumeX;
  return (
    <button
      type="button"
      onClick={() => definirSom(!ligado)}
      className="fixed bottom-4 left-4 z-[110] flex items-center gap-2 rounded-full border px-3 py-2 text-sm font-medium shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      style={{ backgroundColor: "#ffffff", color: "#1f2937", borderColor: "#d1d5db", marginBottom: "env(safe-area-inset-bottom)" }}
    >
      <Icone className="h-4 w-4" aria-hidden />
      {ligado ? t("Visao.somDesligar") : t("Visao.somLigar")}
    </button>
  );
};

export default BotaoSom;
