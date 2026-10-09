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
import { limiarFormatado, nomeDoExercicio, nomeDoOlho } from "@/components/visao/rotulos";

/**
 * O resultado de uma sessão como o exercício o mede. Versão 2 (sem webcam):
 * o limiar, como no progresso e no relatório. Versão 1: pontuação e precisão
 * dos exercícios antigos -- até 2026-10-09 eram as únicas colunas, e as
 * sessões novas apareciam todas com "0" e "0%".
 */
const resultadoDaSessao = (s: SessaoExercicioAdmin): string => {
  if (s.versao < 2) return `${s.pontuacao} pts · ${s.precisao_percentual.toFixed(0)}%`;
  const sinais = s.astigmatismo === null ? null : { astigmatismo: s.astigmatismo };
  return limiarFormatado(s.limiar, s.unidade, sinais);
};

const AdminAtividade = () => {
  // A Visão Geral (AdminOverview) linka directamente ao separador e ao
  // período certos — ex.: /admin/atividade?tab=sessoes&dias=7 a partir do
  // card "Sessões de exercício" com o filtro "Semanal" seleccionado. Sem o
  // `dias` na URL, os números aqui nunca coincidiam com os do card que
  // trouxe até aqui (ficava sempre preso a 30 dias fixos).
  const [searchParams] = useSearchParams();
  const tabInicial = searchParams.get("tab") === "ativos" ? "ativos" : "sessoes";
  const dias = Number(searchParams.get("dias")) || 30;
  const [sessoes, setSessoes] = useState<SessaoExercicioAdmin[]>([]);
  const [ativos, setAtivos] = useState<UtilizadorAtivoAdmin[]>([]);

  useEffect(() => {
    adminApi
      .listarSessoesExercicio(dias)
      .then(setSessoes)
      .catch((err) => toast.error(mensagemDeErroApi(err, "Não foi possível carregar as sessões de exercício.")));
    adminApi
      .listarAtivos(dias)
      .then(setAtivos)
      .catch((err) => toast.error(mensagemDeErroApi(err, "Não foi possível carregar os utilizadores activos.")));
  }, [dias]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Actividade</CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue={tabInicial}>
          <TabsList>
            <TabsTrigger value="sessoes">Sessões de exercício ({sessoes.length})</TabsTrigger>
            <TabsTrigger value="ativos">Activos no período ({ativos.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="sessoes">
            <p className="text-xs text-muted-foreground mb-3">Últimos {dias} dias.</p>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Utilizador</TableHead>
                    <TableHead>Exercício</TableHead>
                    <TableHead>Duração</TableHead>
                    <TableHead>Olho</TableHead>
                    <TableHead>Resultado</TableHead>
                    <TableHead>Quando</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sessoes.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell className="font-medium">{s.utilizador_nome || s.utilizador_email}</TableCell>
                      <TableCell>{nomeDoExercicio(s.exercicio_id)}</TableCell>
                      <TableCell>{s.duracao_segundos}s</TableCell>
                      <TableCell>{s.versao < 2 ? "—" : nomeDoOlho(s.olho)}</TableCell>
                      <TableCell>
                        {resultadoDaSessao(s)}
                        {s.baixa_atencao && <span className="ml-2 text-xs text-gold">(baixa atenção)</span>}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {new Date(s.created_at).toLocaleString("pt-PT")}
                      </TableCell>
                    </TableRow>
                  ))}
                  {!sessoes.length && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground py-6">
                        Sem sessões de exercício nos últimos {dias} dias.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          <TabsContent value="ativos">
            <p className="text-xs text-muted-foreground mb-3">
              Fizeram pelo menos um exercício nos últimos {dias} dias.
            </p>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Utilizador</TableHead>
                    <TableHead>Sessões no período</TableHead>
                    <TableHead>Última sessão</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ativos.map((a) => (
                    <TableRow key={a.user_id}>
                      <TableCell className="font-medium">{a.utilizador_nome || a.utilizador_email}</TableCell>
                      <TableCell>{a.sessoes_no_periodo}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {new Date(a.ultima_sessao_em).toLocaleString("pt-PT")}
                      </TableCell>
                    </TableRow>
                  ))}
                  {!ativos.length && (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center text-muted-foreground py-6">
                        Ninguém fez exercícios nos últimos {dias} dias.
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
