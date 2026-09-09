import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type UserRole = Database["public"]["Enums"]["app_role"];

export interface AuthUser {
  name: string;
  email: string;
  province: string;
  role: UserRole;
  gender?: string;
  avatarUrl?: string;
  biografia?: string;
  telefone?: string;
  dataNascimento?: string;
}

export interface StoredUser extends AuthUser {
  password: string;
}

interface RegisterInput extends AuthUser {
  password: string;
}

interface AuthContextValue {
  isLoggedIn: boolean;
  user: AuthUser | null;
  registerUser: (input: RegisterInput) => { ok: boolean; error?: string };
  signIn: (email: string, password: string) => { ok: boolean; error?: string };
  logout: () => void;
  updateUser: (patch: Partial<AuthUser>) => void;
  updateUserProfile: (patch: Partial<AuthUser>) => void;
  /** @deprecated use registerUser or signIn */
  login: (user: AuthUser) => void;
}

const USERS_KEY = "jpa_registered_users";
const CURRENT_KEY = "jpa_current_user";
const LEGACY_KEY = "jpa_auth_user";

const readUsers = (): StoredUser[] => {
  try {
    const raw = localStorage.getItem(USERS_KEY);
    return raw ? (JSON.parse(raw) as StoredUser[]) : [];
  } catch {
    return [];
  }
};

const writeUsers = (users: StoredUser[]) =>
  localStorage.setItem(USERS_KEY, JSON.stringify(users));

const stripPassword = (u: StoredUser): AuthUser => {
  const { password: _pw, ...rest } = u;
  return rest;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    // Hydrate from local storage first (legacy accounts).
    try {
      const email = localStorage.getItem(CURRENT_KEY);
      if (email) {
        const found = readUsers().find(
          (u) => u.email.toLowerCase() === email.toLowerCase()
        );
        if (found) {
          setUser(stripPassword(found));
        }
      } else {
        const legacy = localStorage.getItem(LEGACY_KEY);
        if (legacy) setUser(JSON.parse(legacy) as AuthUser);
      }
    } catch {}

    // Also mirror the Supabase session so admin/cloud logins reflect in the UI.
    const fromSupabase = (sbUser: any): AuthUser | null => {
      if (!sbUser) return null;
      const md = sbUser.user_metadata || {};
      return {
        name: md.name || sbUser.email?.split("@")[0] || "Utilizador",
        email: sbUser.email || "",
        province: md.province || "",
        role: (md.role as UserRole) || "comum",
        gender: md.gender,
        avatarUrl: md.avatar_url,
      };
    };

    // Se a conta tiver uma eliminação agendada (ver Configuracoes.tsx e
    // supabase/migrations/20260831120000_eliminacao_agendada_contas.sql),
    // voltar a entrar dentro do período de 30 dias cancela o pedido — é o
    // sinal mais claro de "mudei de ideias", sem precisar de um passo extra.
    // Nunca crítico: se isto falhar (ex.: coluna ainda não existe em
    // produção), a sessão continua a abrir normalmente.
    const cancelarEliminacaoSeAgendada = async (userId: string) => {
      try {
        const { data, error } = await supabase
          .from("profiles")
          .select("eliminar_agendado_para")
          .eq("id", userId)
          .maybeSingle();
        if (error || !data?.eliminar_agendado_para) return;

        const { error: cancelError } = await supabase
          .from("profiles")
          .update({ eliminar_agendado_para: null })
          .eq("id", userId);
        if (!cancelError) {
          toast.success("A eliminação da sua conta foi cancelada. Bem-vindo de volta.");
        }
      } catch (err) {
        // silencioso de propósito — nunca deve impedir o login de continuar
        console.warn("cancelarEliminacaoSeAgendada: falha não crítica:", err);
      }
    };

    supabase.auth.getSession().then(({ data }) => {
      const mapped = fromSupabase(data.session?.user);
      if (mapped) setUser((prev) => prev ?? mapped);
      if (data.session?.user?.id) void cancelarEliminacaoSeAgendada(data.session.user.id);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_evt, session) => {
      // O Supabase autentica o utilizador com um token de recuperação assim
      // que ele clica no link do email. Sem esta intercepção, o resto da
      // app trataria isso como um login normal e mandaria o utilizador para
      // a zona autenticada sem nunca lhe pedir a nova palavra-passe. Um
      // redirecionamento "duro" (não `navigate()`) garante que isto vence
      // qualquer outra navegação já em curso nesse instante.
      if (_evt === "PASSWORD_RECOVERY") {
        if (window.location.pathname !== "/atualizar-password") {
          window.location.replace("/atualizar-password");
          return;
        }
      }

      const mapped = fromSupabase(session?.user);
      if (mapped) {
        setUser(mapped);
      } else if (!localStorage.getItem(CURRENT_KEY)) {
        setUser(null);
      }
      if (_evt === "SIGNED_IN" && session?.user?.id) {
        void cancelarEliminacaoSeAgendada(session.user.id);
      }
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const registerUser: AuthContextValue["registerUser"] = (input) => {
    const users = readUsers();
    const exists = users.some(
      (u) => u.email.toLowerCase() === input.email.toLowerCase()
    );
    if (exists) return { ok: false, error: "Este email já está registado." };
    const record: StoredUser = { ...input };
    users.push(record);
    writeUsers(users);
    localStorage.setItem(CURRENT_KEY, input.email);
    setUser(stripPassword(record));
    return { ok: true };
  };

  const signIn: AuthContextValue["signIn"] = (email, password) => {
    const users = readUsers();
    const match = users.find(
      (u) =>
        u.email.toLowerCase() === email.toLowerCase() && u.password === password
    );
    if (!match) return { ok: false, error: "Email ou palavra-passe incorretos." };
    localStorage.setItem(CURRENT_KEY, match.email);
    setUser(stripPassword(match));
    return { ok: true };
  };

  // Legacy helper — creates or replaces an entry with a placeholder password.
  const login = (u: AuthUser) => {
    const users = readUsers();
    const idx = users.findIndex(
      (x) => x.email.toLowerCase() === u.email.toLowerCase()
    );
    if (idx === -1) users.push({ ...u, password: "" });
    else users[idx] = { ...users[idx], ...u };
    writeUsers(users);
    localStorage.setItem(CURRENT_KEY, u.email);
    setUser(u);
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem(CURRENT_KEY);
    localStorage.removeItem(LEGACY_KEY);
    void supabase.auth.signOut();
  };

  const updateUser = (patch: Partial<AuthUser>) => {
    setUser((prev) => {
      if (!prev) return prev;
      const next = { ...prev, ...patch };
      const users = readUsers();
      const idx = users.findIndex(
        (u) => u.email.toLowerCase() === prev.email.toLowerCase()
      );
      if (idx !== -1) {
        users[idx] = { ...users[idx], ...patch };
        writeUsers(users);
      }
      return next;
    });
  };

  return (
    <AuthContext.Provider
      value={{
        isLoggedIn: !!user,
        user,
        registerUser,
        signIn,
        login,
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
