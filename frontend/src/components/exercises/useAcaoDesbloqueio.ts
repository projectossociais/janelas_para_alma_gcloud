import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { useAcessoExercicios } from "@/contexts/AcessoExerciciosContext";
import { mensagemDeErroApi } from "@/lib/apiClient";
import { localizar } from "@/i18n/rotas";

export type GrupoExercicio = "trial" | "premium";
export type TipoDesbloqueio = "criar_conta" | "iniciar_trial" | "premium";

/**
 * O que desbloqueia um exercício bloqueado, conforme o estado de acesso e
 * o grupo do exercício. Uma só regra para a página /exercicios e para o
 * bloqueio dentro de cada exercício, para os estados nunca divergirem.
 * Devolve `null` quando o exercício já está desbloqueado.
 */
export const useAcaoDesbloqueio = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { acesso, temAcesso, iniciarTrial } = useAcessoExercicios();
  const [aIniciarTrial, setAIniciarTrial] = useState(false);

  const tipoPara = (exercicioId: string, grupo: GrupoExercicio): TipoDesbloqueio | null => {
    if (temAcesso(exercicioId)) return null;
    if (acesso.estado === "sem_sessao") return "criar_conta";
    if (grupo === "trial" && acesso.estado === "trial_disponivel") return "iniciar_trial";
    return "premium";
  };

  const executar = async (tipo: TipoDesbloqueio) => {
    if (tipo === "criar_conta") {
      // A rota de login é `/login` (ver `entrar` em i18n/rotas.ts) -- `/entrar`
      // não existe e dava 404.
      navigate(`${localizar("/login")}?modo=registo&next=${encodeURIComponent(localizar("/exercicios"))}`);
      return;
    }
    if (tipo === "premium") {
      navigate(localizar("/registo-premium"));
      return;
    }
    setAIniciarTrial(true);
    try {
      await iniciarTrial();
      toast.success(t("AcessoExercicios.testeIniciado"));
    } catch (err) {
      toast.error(mensagemDeErroApi(err, t("AcessoExercicios.naoFoiPossivelIniciar")));
    } finally {
      setAIniciarTrial(false);
    }
  };

  return { tipoPara, executar, aIniciarTrial };
};
