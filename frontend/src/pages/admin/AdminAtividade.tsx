import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  adminApi,
  mensagemDeErroApi,
  type SessaoExercicioAdmin,
  type UtilizadorAtivoAdmin,
} from "@/lib/apiClient";
import { toast } from "sonner";

const AdminAtividade = () => {
  // A Visão Geral (AdminOverview) linka directamente ao separador certo —
  // ex.: /admin/atividade?tab=sessoes a partir do card "Sessões de exercício".
  const [searchParams] = useSearchParams();
  const tabInicial = searchParams.get("tab") === "ativos" ? "ativos" : "sessoes";
  const [sessoes, setSessoes] = useState<SessaoExercicioAdmin[]>([]);
  const [ativos, setAtivos] = useState<UtilizadorAtivoAdmin[]>([]);

  useEffect(() => {
    // Mesmos 30 dias por omissão do resto do dashboard (obterEstatisticas).
    adminApi
      .listarSessoesExercicio(30)
      .then(setSessoes)
      .catch((err) => toast.error(mensagemDeErroApi(err, "Não foi possível carregar as sessões de exercício.")));
    adminApi
      .listarAtivosSemana()
      .then(setAtivos)
      .catch((err) => toast.error(mensagemDeErroApi(err, "Não foi possível carregar os utilizadores ativos.")));
  }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Atividade</CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue={tabInicial}>
          <TabsList>
            <TabsTrigger value="sessoes">Sessões de exercício ({sessoes.length})</TabsTrigger>
            <TabsTrigger value="ativos">Ativos esta semana ({ativos.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="sessoes">
            <p className="text-xs text-muted-foreground mb-3">Últimos 30 dias.</p>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Utilizador</TableHead>
                    <TableHead>Exercício</TableHead>
                    <TableHead>Duração</TableHead>
                    <TableHead>Pontuação</TableHead>
                    <TableHead>Precisão</TableHead>
                    <TableHead>Quando</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sessoes.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell className="font-medium">{s.utilizador_nome || s.utilizador_email}</TableCell>
                      <TableCell>{s.exercicio_id}</TableCell>
                      <TableCell>{s.duracao_segundos}s</TableCell>
                      <TableCell>{s.pontuacao}</TableCell>
                      <TableCell>{s.precisao_percentual.toFixed(0)}%</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {new Date(s.created_at).toLocaleString("pt-PT")}
                      </TableCell>
                    </TableRow>
                  ))}
                  {!sessoes.length && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground py-6">
                        Sem sessões de exercício nos últimos 30 dias.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          <TabsContent value="ativos">
            <p className="text-xs text-muted-foreground mb-3">
              Fizeram pelo menos um exercício nos últimos 7 dias.
            </p>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Utilizador</TableHead>
                    <TableHead>Sessões na semana</TableHead>
                    <TableHead>Última sessão</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ativos.map((a) => (
                    <TableRow key={a.user_id}>
                      <TableCell className="font-medium">{a.utilizador_nome || a.utilizador_email}</TableCell>
                      <TableCell>{a.sessoes_na_semana}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {new Date(a.ultima_sessao_em).toLocaleString("pt-PT")}
                      </TableCell>
                    </TableRow>
                  ))}
                  {!ativos.length && (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center text-muted-foreground py-6">
                        Ninguém fez exercícios nos últimos 7 dias.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};

export default AdminAtividade;
