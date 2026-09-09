import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { Database } from "@/integrations/supabase/types";

type Profile = {
  id: string;
  nome_completo: string;
  email: string;
  provincia: string | null;
  papel: string;
  created_at: string;
};

type AppRole = Database["public"]["Enums"]["app_role"];

const ROLES: AppRole[] = ["admin", "profissional", "oftalmologista", "estrabico", "voluntario", "comum"];

const AdminUsers = () => {
  const [rows, setRows] = useState<Profile[]>([]);
  const [q, setQ] = useState("");
  const [roleMap, setRoleMap] = useState<Record<string, string[]>>({});

  const load = async () => {
    const { data, error } = await supabase
      .from("profiles")
      .select("id,nome_completo,email,provincia,papel,created_at")
      .order("created_at", { ascending: false });
    if (error) { toast.error(error.message); return; }
    setRows((data ?? []) as Profile[]);

    const { data: r } = await supabase.from("user_roles").select("user_id,role");
    const map: Record<string, string[]> = {};
    (r ?? []).forEach((x) => {
      map[x.user_id] = [...(map[x.user_id] ?? []), x.role];
    });
    setRoleMap(map);
  };

  useEffect(() => { load(); }, []);

  const changeRole = async (userId: string, newRole: AppRole) => {
    // Replace all roles with the new one (single active role for MVP)
    const { error: delErr } = await supabase.from("user_roles").delete().eq("user_id", userId);
    if (delErr) { toast.error(delErr.message); return; }
    const { error: insErr } = await supabase.from("user_roles").insert({ user_id: userId, role: newRole });
    if (insErr) { toast.error(insErr.message); return; }
    await supabase.from("profiles").update({ papel: newRole }).eq("id", userId);
    toast.success("Perfil atualizado.");
    load();
  };

  const filtered = rows.filter((r) => {
    const s = q.toLowerCase();
    return !s || r.nome_completo?.toLowerCase().includes(s) || r.email?.toLowerCase().includes(s);
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Utilizadores ({filtered.length})</CardTitle>
        <Input placeholder="Pesquisar por nome ou email…" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-sm" />
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Província</TableHead>
                <TableHead>Perfil atual</TableHead>
                <TableHead>Mudar para</TableHead>
                <TableHead>Registado em</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((u) => {
                const currentRoles = roleMap[u.id] ?? [u.papel];
                const primary = currentRoles.includes("admin") ? "admin" : currentRoles[0] ?? u.papel;
                return (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium">{u.nome_completo || "—"}</TableCell>
                    <TableCell>{u.email}</TableCell>
                    <TableCell>{u.provincia || "—"}</TableCell>
                    <TableCell>
                      <Badge variant={primary === "admin" ? "default" : "secondary"}>{primary}</Badge>
                    </TableCell>
                    <TableCell>
                      <Select value={primary} onValueChange={(v) => changeRole(u.id, v as AppRole)}>
                        <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {ROLES.map((r) => (<SelectItem key={r} value={r}>{r}</SelectItem>))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(u.created_at).toLocaleDateString("pt-PT")}
                    </TableCell>
                  </TableRow>
                );
              })}
              {!filtered.length && (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-6">Sem utilizadores.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
};

export default AdminUsers;
