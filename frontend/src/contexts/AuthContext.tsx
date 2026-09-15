import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { toast } from "sonner";
import { authApi, mensagemDeErroApi, type UtilizadorPublico } from "@/lib/apiClient";

export type UserRole = "admin" | "comum" | "voluntario" | "oftalmologista" | "profissional" | "estrabico";

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  province: string;
  role: UserRole;
  gender?: string;
  avatarUrl?: string;
  // Estes três nunca vêm de /auth/eu (a API de autenticação não os conhece
  // ainda) — só existem aqui porque EditarPerfil.tsx os escreve de volta
  // depois de gravar o perfil (hoje ainda via Supabase directo), como
  // cache local para o resto da UI. Mesma limitação que já existia antes
  // desta reescrita.
  biografia?: string;
  telefone?: string;
  dataNascimento?: string;
}

interface RegisterInput {
  name: string;
  email: string;
  password: string;
  province: string;
  gender: string;
  role: UserRole;
}

interface ResultadoAuth {
  ok: boolean;
  error?: string;
}

interface AuthContextValue {
  isLoggedIn: boolean;
  /** true só durante a verificação inicial da sessão (pedido a /auth/eu). */
  loading: boolean;
  user: AuthUser | null;
  /** `papel === "admin"` na sessão da API própria — única fonte de verdade
   *  para acesso de administrador (ver `obter_utilizador_admin` na API).
   *  Substitui `useSupabaseRole`/`useAdminScope`: não há noção de permissões
   *  granulares aqui, "admin" é binário, tal como no backend. */
  isAdmin: boolean;
  registerUser: (input: RegisterInput) => Promise<ResultadoAuth>;
  signIn: (email: string, password: string) => Promise<ResultadoAuth>;
  logout: () => void;
  updateUser: (patch: Partial<AuthUser>) => void;
  updateUserProfile: (patch: Partial<AuthUser>) => void;
}

const paraAuthUser = (u: UtilizadorPublico): AuthUser => ({
  id: u.id,
  name: u.nome_completo ?? u.email.split("@")[0],
  email: u.email,
  province: u.provincia ?? "",
  role: (u.papel as UserRole) || "comum",
  gender: u.genero ?? undefined,
});

const mensagemDeFalha = mensagemDeErroApi;

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Ao abrir a app, a única forma de saber se há sessão é perguntar à API
    // — o cookie httpOnly não é legível por este código, de propósito.
    void (async () => {
      try {
        const utilizador = await authApi.eu();
        setUser(paraAuthUser(utilizador));
      } catch {
        setUser(null);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const registerUser: AuthContextValue["registerUser"] = async (input) => {
    try {
      // AUTH-02: registar já não inicia sessão -- a API não define cookies
      // (a conta fica por confirmar), por isso nunca marcar `user` aqui.
      // `ok: true` continua a significar "a conta foi criada", só isso.
      await authApi.registar({
        email: input.email,
        password: input.password,
        nome_completo: input.name,
        provincia: input.province,
        genero: input.gender,
        papel: input.role,
      });
      return { ok: true };
    } catch (err) {
      return { ok: false, error: mensagemDeFalha(err, "Não foi possível criar a conta.") };
    }
  };

  const signIn: AuthContextValue["signIn"] = async (email, password) => {
    try {
      const utilizador = await authApi.entrar(email, password);
      setUser(paraAuthUser(utilizador));
      // Ver Configuracoes.tsx: eliminar a conta agenda para 30 dias, não
      // apaga na hora. Voltar a entrar dentro do prazo cancela o pedido.
      if (utilizador.eliminacao_cancelada) {
        toast.success("A eliminação da sua conta foi cancelada. Bem-vindo de volta.");
      }
      return { ok: true };
    } catch (err) {
      return { ok: false, error: mensagemDeFalha(err, "Email ou palavra-passe incorretos.") };
    }
  };

  const logout = () => {
    setUser(null);
    // Best-effort: mesmo que o pedido falhe (rede em baixo, sessão já
    // expirada), o utilizador já deixou de estar autenticado deste lado.
    void authApi.sair().catch(() => {});
  };

  // Actualização local do utilizador em memória — não persiste nada na API.
  // Quem grava o perfil (EditarPerfil.tsx, hoje ainda via Supabase) chama
  // isto só para refletir o resultado sem precisar de um refetch completo.
  const updateUser = (patch: Partial<AuthUser>) => {
    setUser((prev) => (prev ? { ...prev, ...patch } : prev));
  };

  return (
    <AuthContext.Provider
      value={{
        isLoggedIn: !!user,
        loading,
        user,
        isAdmin: user?.role === "admin",
        registerUser,
        signIn,
        logout,
        updateUser,
        updateUserProfile: updateUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};

export const PROVINCES = [
  "Bengo",
  "Benguela",
  "Bié",
  "Cabinda",
  "Cuando",
  "Cuanza Norte",
  "Cuanza Sul",
  "Cubango",
  "Cunene",
  "Huambo",
  "Huíla",
  "Icolo e Bengo",
  "Luanda",
  "Lunda Norte",
  "Lunda Sul",
  "Malanje",
  "Moxico",
  "Moxico Leste",
  "Namibe",
  "Uíge",
  "Zaire",
];

export const ROLE_LABEL: Record<UserRole, string> = {
  admin: "Administrador",
  comum: "Pessoa Comum",
  estrabico: "Pessoa com Estrabismo",
  profissional: "Profissional de Saúde",
  oftalmologista: "Oftalmologista",
  voluntario: "Voluntário",
};
