import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { adminApi, mensagemDeErroApi, type AdminUtilizador } from "@/lib/apiClient";
import { toast } from "sonner";
import { Trash2, ShieldPlus } from "lucide-react";

// W-11: no modelo novo "admin" é binário (uma coluna `papel`), não uma
// matriz de permissões. Saíram o `is_super`, os `can_*` e o `useAdminScope`
// (que liam a tabela `admin_permissions` do Supabase). O primeiro admin
// cria-se por linha de comando: `python -m app.criar_admin <email>`.

const AdminAdmins = () => {
  const [rows, setRows] = useState<AdminUtilizador[]>([]);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    try {
      setRows(await adminApi.listarUtilizadores("admin"));
    } catch (err) {
      toast.error(mensagemDeErroApi(err, "Não foi possível carregar os administradores."));
    }
  };

  useEffect(() => {
    load();
  }, []);

  const addAdmin = async () => {
    const clean = email.trim();
    if (!clean) return;
    setBusy(true);
    try {
      await adminApi.promover(clean);
      toast.success("Admin adicionado.");
      setEmail("");
      await load();
    } catch (err) {
      toast.error(mensagemDeErroApi(err, "Não foi possível adicionar o administrador."));
    } finally {
      setBusy(false);
    }
  };

  const removeAdmin = async (row: AdminUtilizador) => {
    if (!confirm(`Remover o acesso de admin de ${row.email}?`)) return;
    try {
      await adminApi.removerAdmin(row.id);
      toast.success("Admin removido.");
      await load();
    } catch (err) {
      toast.error(mensagemDeErroApi(err, "Não foi possível remover o administrador."));
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldPlus className="w-5 h-5" /> Adicionar administrador
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col sm:flex-row gap-3">
          <Input
            placeholder="email@exemplo.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={busy}
          />
          <Button onClick={addAdmin} disabled={busy || !email.trim()}>
            Adicionar
          </Button>
        </CardContent>
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
                  <TableHead>Desde</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>
                      <div className="font-medium">{r.nome_completo || "—"}</div>
                      <div className="text-xs text-muted-foreground">{r.email}</div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(r.criado_em).toLocaleDateString("pt-PT")}
                    </TableCell>
                    <TableCell>
                      <Button size="icon" variant="ghost" onClick={() => removeAdmin(r)}>
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {!rows.length && (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-muted-foreground py-6">
                      <Badge variant="outline">Sem administradores</Badge>
                    </TableCell>
                  </TableRow>
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
