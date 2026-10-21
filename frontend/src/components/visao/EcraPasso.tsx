import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Moldura comum de um passo: ícone, título, texto, conteúdo e botão. */
export const EcraPasso = ({
  icone,
  titulo,
  children,
  accao,
}: {
  icone?: ReactNode;
  titulo: string;
  children?: ReactNode;
  accao?: ReactNode;
}) => (
  <section className="mx-auto flex max-w-xl flex-col items-center gap-4 text-center">
    {icone && (
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-teal/10 text-teal">{icone}</div>
    )}
    <h2 className="text-xl font-bold text-foreground">{titulo}</h2>
    {children}
    {accao && <div className="mt-2 flex w-full flex-col items-center gap-2 sm:w-auto">{accao}</div>}
  </section>
);

export const BotaoContinuar = ({
  aoClicar,
  children,
  desactivado,
}: {
  aoClicar: () => void;
  children?: ReactNode;
  desactivado?: boolean;
}) => {
  const { t } = useTranslation();
  return (
    <Button
      size="lg"
      onClick={aoClicar}
      disabled={desactivado}
      className="w-full gap-2 bg-teal text-teal-foreground hover:bg-teal/90 sm:w-auto sm:min-w-48"
    >
      {children ?? t("Visao.continuar")}
      <ArrowRight className="h-4 w-4" />
    </Button>
  );
};
