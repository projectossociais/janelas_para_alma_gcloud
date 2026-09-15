import { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2 } from "lucide-react";

interface RequireAdminProps {
  children: ReactNode;
}

/**
 * Porta do painel de administração — usa a sessão da API própria
 * (`useAuth`), nunca o Supabase. Antes disto verificava
 * `supabase.auth.getSession()`, que é sempre `null` para qualquer conta
 * criada pela API nova (o registo/login novos nunca criam sessão no
 * Supabase) — na prática, nenhum admin do sistema novo conseguia entrar.
 */
const RequireAdmin = ({ children }: RequireAdminProps) => {
  const { loading, isLoggedIn, isAdmin } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-teal" />
      </div>
    );
  }

  if (!isLoggedIn) return <Navigate to="/auth" replace />;
  if (!isAdmin) return <Navigate to="/" replace />;

  return <>{children}</>;
};

export default RequireAdmin;
