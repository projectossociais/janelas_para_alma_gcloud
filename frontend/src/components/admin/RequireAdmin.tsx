import { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useSupabaseRole } from "@/hooks/useSupabaseRole";
import { Loader2 } from "lucide-react";

interface RequireAdminProps {
  children: ReactNode;
}

const RequireAdmin = ({ children }: RequireAdminProps) => {
  const { loading, isAdmin, userId } = useSupabaseRole();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-teal" />
      </div>
    );
  }

  if (!userId) return <Navigate to="/auth" replace />;
  if (!isAdmin) return <Navigate to="/" replace />;

  return <>{children}</>;
};

export default RequireAdmin;
