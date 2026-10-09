import { ReactNode, useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { clinicasApi, type ClinicaParceiraAdmin } from "@/lib/apiClient";
import { Loader2 } from "lucide-react";

interface RequireClinicaProps {
  children: (clinica: ClinicaParceiraAdmin) => ReactNode;
}

/**
 * Porta do portal da clínica (`DashboardPro.tsx`). `papel: "profissional"`
 * é auto-registável sem verificação nenhuma -- por isso o acesso nunca
 * depende desse papel, só de `GET /clinica/eu` devolver uma clínica real
 * (ligação criada por um admin). Mesmo padrão de `RequireAdmin.tsx`, com
 * um pedido extra à API em vez de um campo já presente em `useAuth()`.
 */
const RequireClinica = ({ children }: RequireClinicaProps) => {
  const { loading: authLoading, isLoggedIn } = useAuth();
  const [clinica, setClinica] = useState<ClinicaParceiraAdmin | null>(null);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    if (authLoading || !isLoggedIn) {
      setCarregando(false);
      return;
    }
    clinicasApi
      .aMinhaClinica()
      .then(setClinica)
      .catch(() => setClinica(null))
      .finally(() => setCarregando(false));
  }, [authLoading, isLoggedIn]);

  if (authLoading || carregando) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-teal" />
      </div>
    );
  }

  if (!isLoggedIn) return <Navigate to="/auth" replace />;
  if (!clinica) return <Navigate to="/" replace />;

  return <>{children(clinica)}</>;
};

export default RequireClinica;
