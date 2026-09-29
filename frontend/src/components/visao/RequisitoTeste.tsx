import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ClipboardCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EcraPasso } from "@/components/visao/Passos";
import { localizar } from "@/i18n/rotas";
import type { SessaoExercicioPublica } from "@/lib/apiClient";
import type { Olho } from "@/lib/visao/resultados";

/** Última sessão v2 de um teste para um olho (histórico vem mais recente primeiro). */
export const ultimaDoTeste = (
  historico: readonly SessaoExercicioPublica[],
  exercicioId: string,
  olho: Olho | null,
): SessaoExercicioPublica | null =>
  historico.find((s) => s.exercicio_id === exercicioId && s.olho === olho) ?? null;

/** "Faça primeiro o Teste de X" -- o treino precisa de um limiar para começar. */
export const RequisitoTeste = ({ caminho, nomeDoTeste }: { caminho: string; nomeDoTeste: string }) => {
  const { t } = useTranslation();
  return (
    <EcraPasso
      icone={<ClipboardCheck className="h-7 w-7" />}
      titulo={t("Visao.primeiroOTeste", { teste: nomeDoTeste })}
      accao={
        <Button asChild size="lg" className="w-full bg-teal text-teal-foreground hover:bg-teal/90 sm:w-auto">
          <Link to={localizar(caminho)}>{t("Visao.fazerOTeste", { teste: nomeDoTeste })}</Link>
        </Button>
      }
    >
      <p className="text-sm text-muted-foreground">{t("Visao.primeiroOTesteTexto")}</p>
    </EcraPasso>
  );
};
