import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type AdminScope = {
  user_id: string;
  is_super: boolean;
  can_overview: boolean;
  can_users: boolean;
  can_inbox: boolean;
  can_banners: boolean;
  can_notifications: boolean;
  can_content: boolean;
  can_manage_admins: boolean;
};

const FULL: Omit<AdminScope, "user_id"> = {
  is_super: true,
  can_overview: true,
  can_users: true,
  can_inbox: true,
  can_banners: true,
  can_notifications: true,
  can_content: true,
  can_manage_admins: true,
};

export function useAdminScope() {
  const [loading, setLoading] = useState(true);
  const [scope, setScope] = useState<AdminScope | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: s } = await supabase.auth.getSession();
      const uid = s.session?.user.id;
      if (!uid) {
        if (!cancelled) { setScope(null); setLoading(false); }
        return;
      }
      const { data } = await supabase
        .from("admin_permissions")
        .select("*")
        .eq("user_id", uid)
        .maybeSingle();
      if (cancelled) return;
      if (data) setScope(data as unknown as AdminScope);
      else setScope({ user_id: uid, ...FULL }); // legacy admins without row: full access
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  return { loading, scope };
}
