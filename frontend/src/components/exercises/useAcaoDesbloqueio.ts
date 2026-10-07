import { useNavigate } from "react-router-dom";
import { useAcessoExercicios } from "@/contexts/AcessoExerciciosContext";
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
  const navigate = useNavigate();
  const { acesso, temAcesso } = useAcessoExercicios();

  const tipoPara = (exercicioId: string, grupo: GrupoExercicio): TipoDesbloqueio | null => {
    if (temAcesso(exercicioId)) return null;
    if (acesso.estado === "sem_sessao") return "criar_conta";
    if (grupo === "trial" && acesso.estado === "trial_disponivel") return "iniciar_trial";
    return "premium";
  };

  const executar = (tipo: TipoDesbloqueio) => {
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
    // O teste de 7 dias só se usa uma vez por conta: tem página própria, que
    // explica o que inclui e só começa quando a pessoa o confirma.
    navigate(localizar("/teste-de-7-dias"));
  };

  return { tipoPara, executar };
};
