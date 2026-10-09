import { ReactNode, useCallback, useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { RefreshCw } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/contexts/AuthContext";
import { Aviso } from "@/design/componentes/Aviso";
import { Botao } from "@/design/componentes/Botao";
import { clinicasApi, type ClinicaParceiraAdmin } from "@/lib/apiClient";

interface RequireClinicaProps {
  children: (clinica: ClinicaParceiraAdmin) => ReactNode;
}

type Estado =
  | { tipo: "a_verificar" }
  | { tipo: "com_clinica"; clinica: ClinicaParceiraAdmin }
  | { tipo: "sem_acesso" }
  | { tipo: "erro" };

/**
 * Porta do portal da clínica (`DashboardPro.tsx`). `papel: "profissional"`
 * é auto-registável sem verificação nenhuma -- por isso o acesso nunca
 * depende desse papel, só de `GET /clinica/eu` devolver uma clínica real
 * (ligação criada por um admin). Mesmo padrão de `RequireAdmin.tsx`.
 *
 * Sem clínica (ou 401/403) -> página inicial. Uma falha de rede ou do servidor
 * não é "sem acesso": até 2026-10-09 mandava a pessoa para a página inicial
 * sem explicação; agora diz que não conseguiu verificar e deixa tentar de
 * novo -- e o portal continua a nunca abrir sem a API confirmar a clínica.
 */
const RequireClinica = ({ children }: RequireClinicaProps) => {
  const { t } = useTranslation();
  const { loading: authLoading, isLoggedIn } = useAuth();
  const [estado, setEstado] = useState<Estado>({ tipo: "a_verificar" });

  const verificar = useCallback(async () => {
    setEstado({ tipo: "a_verificar" });
    try {
      const clinica = await clinicasApi.aMinhaClinica();
      setEstado(clinica ? { tipo: "com_clinica", clinica } : { tipo: "sem_acesso" });
    } catch (err) {
      const status = (err as { status?: unknown } | null)?.status;
      setEstado(status === 401 || status === 403 || status === 404 ? { tipo: "sem_acesso" } : { tipo: "erro" });
    }
  }, []);

  useEffect(() => {
    if (authLoading || !isLoggedIn) return;
    void verificar();
  }, [authLoading, isLoggedIn, verificar]);

  if (!authLoading && !isLoggedIn) return <Navigate to="/auth" replace />;

  if (authLoading || estado.tipo === "a_verificar") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-fundo">
        <p role="status" className="text-corpo text-tinta-suave">
          {t("RequireClinica.aVerificar")}
        </p>
      </div>
    );
  }

  if (estado.tipo === "erro") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-fundo px-4">
        <Aviso
          variante="erro"
          anunciar
          titulo={t("RequireClinica.naoFoiPossivelVerificar")}
          className="max-w-md"
          accao={
            <Botao variante="secundario" onClick={() => void verificar()}>
              <RefreshCw aria-hidden />
              {t("RequireClinica.tentarDeNovo")}
            </Botao>
          }
        >
          {t("RequireClinica.verifiqueALigacao")}
        </Aviso>
      </div>
    );
  }

  if (estado.tipo === "sem_acesso") return <Navigate to="/" replace />;

  return <>{children(estado.clinica)}</>;
};

export default RequireClinica;
