import { Check, Store, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/design/cn";

export type EstadoOpcao = "normal" | "certa" | "errada" | "eliminada";

/**
 * Uma das quatro respostas. Alvo grande (público com crianças) e o estado dito
 * por cor, ícone **e** texto escondido para leitores de ecrã, nunca só por cor.
 */
export const OpcaoResposta = ({
  letra,
  texto,
  estado,
  desactivada,
  sugeridaPor,
  aoEscolher,
}: {
  letra: string;
  texto: string;
  estado: EstadoOpcao;
  desactivada: boolean;
  /** Nome do profissional do Consultório que sugeriu esta resposta. */
  sugeridaPor?: string;
  aoEscolher: () => void;
}) => {
  const { t } = useTranslation();
  return (
    <button
      type="button"
      data-estado={estado}
      disabled={desactivada}
      onClick={aoEscolher}
      className={cn(
        "flex min-h-alvo-crianca w-full items-center gap-3 rounded-controlo border-2 px-4 py-3 text-left",
        "transition-colors duration-feedback ease-padrao disabled:cursor-not-allowed",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foco",
        estado === "normal" && "border-linha bg-superficie enabled:hover:border-accao enabled:hover:bg-accao-suave",
        estado === "certa" && "border-sucesso bg-sucesso-suave",
        estado === "errada" && "border-erro bg-erro-suave",
        estado === "eliminada" && "border-linha bg-superficie opacity-40",
      )}
    >
      <span
        aria-hidden
        className={cn(
          "flex size-9 shrink-0 items-center justify-center rounded-pilula border-2 text-legenda font-medium",
          estado === "certa" && "border-sucesso bg-sucesso text-superficie",
          estado === "errada" && "border-erro bg-erro text-sobre-erro",
          (estado === "normal" || estado === "eliminada") && "border-accao text-accao",
        )}
      >
        {estado === "certa" ? <Check className="size-5" /> : estado === "errada" ? <X className="size-5" /> : letra}
      </span>
      <span className="sr-only">{letra})</span>
      <span className="flex-1 text-corpo text-tinta">{texto}</span>
      {estado === "certa" && <span className="sr-only">{t("JogoCuriosidades.estadoCerta")}</span>}
      {estado === "errada" && <span className="sr-only">{t("JogoCuriosidades.estadoErrada")}</span>}
      {sugeridaPor && (
        <span className="inline-flex shrink-0 items-center gap-1 rounded-pilula bg-aviso-suave px-2 py-0.5 text-legenda font-medium text-aviso">
          <Store className="size-3.5" aria-hidden />
          {sugeridaPor}
        </span>
      )}
    </button>
  );
};
