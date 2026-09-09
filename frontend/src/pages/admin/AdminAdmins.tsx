import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Trash2, ShieldPlus } from "lucide-react";
import { useAdminScope } from "@/hooks/useAdminScope";

type Row = {
  user_id: string;
  is_super: boolean;
  can_overview: boolean;
  can_users: boolean;
  can_inbox: boolean;
  can_banners: boolean;
  can_notifications: boolean;
  can_content: boolean;
  can_manage_admins: boolean;
  profile?: { nome_completo: string | null; email: string };
};

const SCOPES: { key: keyof Row; label: string }[] = [
  { key: "can_overview", label: "Visão Geral" },
  { key: "can_users", label: "Utilizadores" },
  { key: "can_inbox", label: "Mensagens" },
  { key: "can_banners", label: "Banners" },
  { key: "can_notifications", label: "Notificações" },
  { key: "can_content", label: "Conteúdo" },
  { key: "can_manage_admins", label: "Gerir Admins" },
];

const AdminAdmins = () => {
  const { scope } = useAdminScope();
  const canManage = !!(scope?.is_super || scope?.can_manage_admins);
  const [rows, setRows] = useState<Row[]>([]);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const { data: perms, error } = await supabase
      .from("admin_permissions" as any)
      .select("*")
      .order("created_at" as any, { ascending: true });
    if (error) { toast.error(error.message); return; }
    const list = (perms ?? []) as unknown as Row[];
    const ids = list.map((r) => r.user_id);
    if (ids.length) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("id,nome_completo,email")
        .in("id", ids);
      const map = new Map((profs ?? []).map((p) => [p.id, p]));
      list.forEach((r) => {
        const p = map.get(r.user_id);
        if (p) r.profile = { nome_completo: p.nome_completo, email: p.email };
      });
    }
    setRows(list);
  };

  useEffect(() => { load(); }, []);

  const addAdmin = async () => {
    if (!canManage) return;
    const clean = email.trim().toLowerCase();
    if (!clean) return;
    setBusy(true);
    try {
      const { data: prof, error } = await supabase
        .from("profiles")
        .select("id,email")
        .ilike("email", clean)
        .maybeSingle();
      if (error) throw error;
      if (!prof) {
        toast.error("Utilizador não encontrado. Peça-lhe para criar conta primeiro.");
        return;
      }
      const { error: rErr } = await supabase
        .from("user_roles")
        .insert({ user_id: prof.id, role: "admin" as any });
      if (rErr && !String(rErr.message).includes("duplicate")) throw rErr;
      await supabase.from("profiles").update({ papel: "admin" }).eq("id", prof.id);
      const { error: pErr } = await supabase
        .from("admin_permissions" as any)
        .insert({ user_id: prof.id, is_super: false, can_overview: true });
      if (pErr && !String(pErr.message).includes("duplicate")) throw pErr;
      toast.success("Admin adicionado.");
      setEmail("");
      load();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  const toggleScope = async (row: Row, key: keyof Row, value: boolean) => {
    if (!canManage) return;
    if (row.is_super) { toast.error("Super admin tem sempre todas as permissões."); return; }
    const { error } = await supabase
      .from("admin_permissions" as any)
      .update({ [key]: value })
      .eq("user_id", row.user_id);
    if (error) { toast.error(error.message); return; }
    setRows((prev) => prev.map((r) => r.user_id === row.user_id ? { ...r, [key]: value } as Row : r));
  };

  const removeAdmin = async (row: Row) => {
    if (!canManage) return;
    if (row.is_super) { toast.error("Não é possível remover um super admin."); return; }
    if (!confirm(`Remover admin ${row.profile?.email ?? row.user_id}?`)) return;
    await supabase.from("admin_permissions" as any).delete().eq("user_id", row.user_id);
    await supabase.from("user_roles").delete().eq("user_id", row.user_id).eq("role", "admin" as any);
    await supabase.from("profiles").update({ papel: "comum" }).eq("id", row.user_id);
    toast.success("Admin removido.");
    load();
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><ShieldPlus className="w-5 h-5" /> Adicionar administrador</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col sm:flex-row gap-3">
          <Input
            placeholder="email@exemplo.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={!canManage || busy}
          />
          <Button onClick={addAdmin} disabled={!canManage || busy || !email.trim()}>
            Adicionar
          </Button>
        </CardContent>
        {!canManage && (
          <CardContent className="pt-0 text-sm text-muted-foreground">
            Precisas da permissão "Gerir Admins" para adicionar ou editar administradores.
          </CardContent>
        )}
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Administradores ({rows.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Utilizador</TableHead>
                  <TableHead>Tipo</TableHead>
                  {SCOPES.map((s) => <TableHead key={s.key} className="text-center">{s.label}</TableHead>)}
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.user_id}>
                    <TableCell>
                      <div className="font-medium">{r.profile?.nome_completo || "—"}</div>
                      <div className="text-xs text-muted-foreground">{r.profile?.email || r.user_id}</div>
                    </TableCell>
                    <TableCell>
                      {r.is_super
                        ? <Badge>Super</Badge>
                        : <Badge variant="secondary">Admin</Badge>}
                    </TableCell>
                    {SCOPES.map((s) => (
                      <TableCell key={s.key} className="text-center">
                        <Checkbox
                          checked={r.is_super || Boolean(r[s.key])}
                          disabled={!canManage || r.is_super}
                          onCheckedChange={(v) => toggleScope(r, s.key, Boolean(v))}
                        />
                      </TableCell>
                    ))}
                    <TableCell>
                      <Button
                        size="icon"
                        variant="ghost"
                        disabled={!canManage || r.is_super}
                        onClick={() => removeAdmin(r)}
                      >
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {!rows.length && (
                  <TableRow><TableCell colSpan={SCOPES.length + 3} className="text-center text-muted-foreground py-6">Sem administradores.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminAdmins;
