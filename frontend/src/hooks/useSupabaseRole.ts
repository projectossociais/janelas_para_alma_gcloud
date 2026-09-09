import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type AppRole = Database["public"]["Enums"]["app_role"];

const PRIORIDADE_PAPEIS: AppRole[] = [
  "admin",
  "profissional",
  "oftalmologista",
  "estrabico",
  "voluntario",
  "comum",
];

export function useSupabaseRole() {
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const uid = sessionData.session?.user.id ?? null;
      if (cancelled) return;
      setUserId(uid);
      if (!uid) {
        setRole(null);
        setIsAdmin(false);
        setLoading(false);
        return;
      }
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", uid);
      if (cancelled) return;
      if (error || !data?.length) {
        setRole("comum");
        setIsAdmin(false);
      } else {
        const roles = data.map((r) => r.role);
        setIsAdmin(roles.includes("admin"));
        setRole(PRIORIDADE_PAPEIS.find((r) => roles.includes(r)) ?? "comum");
      }
      setLoading(false);
    };

    load();

    const { data: sub } = supabase.auth.onAuthStateChange(() => {
      load();
    });
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  return { loading, userId, role, isAdmin };
}
