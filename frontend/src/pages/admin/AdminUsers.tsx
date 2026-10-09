import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { adminApi, mensagemDeErroApi, type AdminUtilizador } from "@/lib/apiClient";
import { toast } from "sonner";
import { ROLE_LABEL, type UserRole } from "@/contexts/AuthContext";

// "admin" fica de fora do selector genérico de propósito -- essa transição
// tem o seu próprio fluxo em Administradores (com protecção contra ficar
// sem nenhum admin), que este endpoint recusa (422) para nunca duplicar.
const PAPEIS_ATRIBUIVEIS: Exclude<UserRole, "admin">[] = [
  "comum",
  "estrabico",
  "profissional",
  "oftalmologista",
  "voluntario",
];

const AdminUsers = () => {
  const [searchParams] = useSearchParams();
  // Vem do card "Novos utilizadores" do dashboard: mesma janela de dias.
  const dias = searchParams.get("dias") ? Number(searchParams.get("dias")) : undefined;
  const [rows, setRows] = useState<AdminUtilizador[]>([]);
  const [q, setQ] = useState("");
  const [aGuardar, setAGuardar] = useState<string | null>(null);

  const load = async () => {
    try {
      setRows(await adminApi.listarUtilizadores(undefined, dias));
    } catch (err) {
      toast.error(mensagemDeErroApi(err, "Não foi possível carregar os utilizadores."));
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dias]);

  const changeRole = async (userId: string, novoPapel: string) => {
    setAGuardar(userId);
    try {
      await adminApi.definirPapel(userId, novoPapel);
      toast.success("Perfil actualizado.");
      await load();
    } catch (err) {
      toast.error(mensagemDeErroApi(err, "Não foi possível actualizar o perfil."));
    } finally {
      setAGuardar(null);
    }
  };

  const filtered = rows.filter((r) => {
    const s = q.toLowerCase();
    return !s || r.nome_completo?.toLowerCase().includes(s) || r.email?.toLowerCase().includes(s);
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-2">
        <div>
          <CardTitle>Utilizadores ({filtered.length})</CardTitle>
          {dias && (
            <p className="text-xs text-muted-foreground mt-1">
              Registados nos últimos {dias} dias · <Link to="/admin/utilizadores" className="underline">ver todos</Link>
            </p>
          )}
        </div>
        <Input placeholder="Pesquisar por nome ou email…" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-sm" />
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Perfil actual</TableHead>
                <TableHead>Mudar para</TableHead>
                <TableHead>Premium</TableHead>
                <TableHead>Registado em</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((u) => (
                <TableRow key={u.id}>
                  <TableCell className="font-medium">{u.nome_completo || "—"}</TableCell>
                  <TableCell>{u.email}</TableCell>
                  <TableCell>
                    <Badge variant={u.papel === "admin" ? "default" : "secondary"}>
                      {ROLE_LABEL[u.papel as UserRole] ?? u.papel}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {u.papel === "admin" ? (
                      <span className="text-xs text-muted-foreground">
                        Gerido em <Link to="/admin/administradores" className="underline">Administradores</Link>
                      </span>
                    ) : (
                      <Select
                        value={u.papel}
                        onValueChange={(v) => changeRole(u.id, v)}
                        disabled={aGuardar === u.id}
                      >
                        <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {PAPEIS_ATRIBUIVEIS.map((r) => (
                            <SelectItem key={r} value={r}>{ROLE_LABEL[r]}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </TableCell>
                  <TableCell>
                    {u.premium_ativo ? <Badge>Activo</Badge> : <span className="text-xs text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {new Date(u.criado_em).toLocaleDateString("pt-PT")}
                  </TableCell>
                </TableRow>
              ))}
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
