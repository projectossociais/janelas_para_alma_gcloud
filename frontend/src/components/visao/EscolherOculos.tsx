import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Glasses, Hand } from "lucide-react";
import { BotaoContinuar, EcraPasso } from "@/components/visao/EcraPasso";
import { cn } from "@/lib/utils";

export type ComOuSemOculos = "sem" | "com";

interface Opcao {
  titulo: string;
  texto: string;
}

/**
 * Primeiro ecrã dos exercícios que têm uma versão com óculos 3D: sem óculos
 * vem primeiro e é a escolha por omissão (a maior parte das famílias não os
 * tem, decisão do dono do projecto, 2026-10-21).
 */
const EscolherOculos = ({
  titulo,
  sem,
  com,
  inicial,
  aoEscolher,
}: {
  titulo: string;
  sem: Opcao;
  com: Opcao;
  inicial: ComOuSemOculos | null;
  aoEscolher: (o: ComOuSemOculos) => void;
}) => {
  const { t } = useTranslation();
  const [escolha, setEscolha] = useState<ComOuSemOculos>(inicial ?? "sem");
  const opcoes: [ComOuSemOculos, Opcao][] = [
    ["sem", sem],
    ["com", com],
  ];
  return (
    <EcraPasso titulo={titulo} accao={<BotaoContinuar aoClicar={() => aoEscolher(escolha)} />}>
      <div role="radiogroup" aria-label={titulo} className="flex w-full flex-col gap-2">
        {opcoes.map(([valor, o]) => (
          <button
            key={valor}
            type="button"
            role="radio"
            aria-checked={escolha === valor}
            onClick={() => setEscolha(valor)}
            className={cn(
              "flex items-start gap-3 rounded-xl border-2 px-4 py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              escolha === valor ? "border-teal bg-teal/10" : "border-border hover:border-teal/50",
            )}
          >
            {valor === "sem" ? (
              <Hand className="mt-0.5 h-5 w-5 shrink-0 text-teal" aria-hidden />
            ) : (
              <Glasses className="mt-0.5 h-5 w-5 shrink-0 text-teal" aria-hidden />
            )}
            <span>
              <span className="block text-sm font-semibold text-foreground">{o.titulo}</span>
              <span className="block text-sm text-muted-foreground">{o.texto}</span>
            </span>
          </button>
        ))}
      </div>
      <p className="mt-2 text-xs text-muted-foreground">{t("Visao.escolhaFicaGuardada")}</p>
    </EcraPasso>
  );
};

export default EscolherOculos;
