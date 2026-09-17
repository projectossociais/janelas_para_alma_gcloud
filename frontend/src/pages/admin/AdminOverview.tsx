import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  Users,
  Activity,
  Sparkles,
  MessageSquare,
  UserCheck,
  TrendingUp,
  ScanEye,
  Inbox,
  HeartHandshake,
  ArrowRight,
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { adminApi, mensagemDeErroApi, type EstatisticasAdmin, type PendenciasAdmin } from "@/lib/apiClient";
import { toast } from "sonner";

type Period = "week" | "month" | "year";

const periodDays: Record<Period, number> = { week: 7, month: 30, year: 365 };
const periodLabel: Record<Period, string> = { week: "esta semana", month: "este mês", year: "este ano" };

const AdminOverview = () => {
  const [period, setPeriod] = useState<Period>("month");
  const [stats, setStats] = useState<EstatisticasAdmin | null>(null);
  const [pendencias, setPendencias] = useState<PendenciasAdmin | null>(null);

  useEffect(() => {
    adminApi
      .obterEstatisticas(periodDays[period])
      .then(setStats)
      .catch((err) => toast.error(mensagemDeErroApi(err, "Não foi possível carregar as estatísticas.")));
  }, [period]);

  useEffect(() => {
    adminApi
      .obterPendencias()
      .then(setPendencias)
      .catch((err) => toast.error(mensagemDeErroApi(err, "Não foi possível carregar as pendências.")));
  }, []);

  const cards = [
    {
      label: "Utilizadores (total)",
      value: stats?.total_utilizadores ?? 0,
      icon: Users,
      color: "text-navy",
      href: "/admin/utilizadores",
    },
    {
      label: "Novos utilizadores",
      value: stats?.novos_utilizadores ?? 0,
      icon: TrendingUp,
      color: "text-teal",
      href: `/admin/utilizadores?dias=${periodDays[period]}`,
    },
    {
      label: `Ativos ${periodLabel[period]}`,
      value: stats?.utilizadores_ativos_periodo ?? 0,
      icon: UserCheck,
      color: "text-green-600",
      href: `/admin/atividade?tab=ativos&dias=${periodDays[period]}`,
    },
    {
      label: "Sessões de exercício",
      value: stats?.sessoes_exercicio ?? 0,
      icon: Activity,
      color: "text-gold",
      href: `/admin/atividade?tab=sessoes&dias=${periodDays[period]}`,
    },
    {
      label: "Pedidos premium",
      value: stats?.pedidos_premium ?? 0,
      icon: Sparkles,
      color: "text-purple-600",
      href: "/admin/mensagens?tab=premium",
    },
    {
      label: "Mensagens",
      value: stats?.mensagens_contacto ?? 0,
      icon: MessageSquare,
      color: "text-blue-600",
      href: "/admin/mensagens?tab=messages",
    },
  ];

  const pendenciasItems = [
    {
      label: "Pedidos Premium por decidir",
      valor: pendencias?.pedidos_premium_pendentes ?? 0,
      href: "/admin/mensagens?tab=premium",
      icon: Sparkles,
    },
    {
      label: "Mensagens por ler",
      valor: pendencias?.mensagens_por_ler ?? 0,
      href: "/admin/mensagens?tab=messages",
      icon: Inbox,
    },
    {
      label: "Candidaturas de voluntariado por decidir",
      valor: pendencias?.candidaturas_voluntariado_pendentes ?? 0,
      href: "/admin/voluntariado",
      icon: HeartHandshake,
    },
  ];
  const totalPendencias = pendenciasItems.reduce((soma, p) => soma + p.valor, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold">Visão Geral</h2>
          <p className="text-sm text-muted-foreground">Métricas do período selecionado</p>
        </div>
        <Tabs value={period} onValueChange={(v) => setPeriod(v as Period)}>
          <TabsList>
            <TabsTrigger value="week">Semanal</TabsTrigger>
            <TabsTrigger value="month">Mensal</TabsTrigger>
            <TabsTrigger value="year">Anual</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <Card className={totalPendencias > 0 ? "border-amber-300 bg-amber-50/50" : undefined}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Central de Pendências
            {totalPendencias > 0 && <Badge variant="destructive">{totalPendencias}</Badge>}
          </CardTitle>
        </CardHeader>
        <CardContent className="grid sm:grid-cols-3 gap-3">
          {pendenciasItems.map((p) => (
            <Link
              key={p.label}
              to={p.href}
              className="flex items-center justify-between gap-3 rounded-lg border bg-background p-4 hover:border-primary hover:shadow-sm transition-all"
            >
              <div className="flex items-center gap-3 min-w-0">
                <p.icon className="w-5 h-5 text-muted-foreground shrink-0" />
                <div className="min-w-0">
                  <div className="text-2xl font-bold leading-none">{p.valor}</div>
                  <div className="text-xs text-muted-foreground mt-1">{p.label}</div>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-muted-foreground shrink-0" />
            </Link>
          ))}
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-7 gap-4">
        {cards.map((c) =>
          c.href ? (
            <Link key={c.label} to={c.href}>
              <Card className="h-full transition-all hover:border-primary hover:shadow-sm">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <c.icon className={`w-5 h-5 ${c.color}`} />
                  </div>
                  <div className="text-2xl font-bold">{c.value}</div>
                  <div className="text-xs text-muted-foreground">{c.label}</div>
                </CardContent>
              </Card>
            </Link>
          ) : (
            <Card key={c.label} title="O scanner ainda regista resultados noutro serviço, não aqui.">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <c.icon className={`w-5 h-5 ${c.color}`} />
                </div>
                <div className="text-2xl font-bold">{c.value}</div>
                <div className="text-xs text-muted-foreground">{c.label}</div>
              </CardContent>
            </Card>
          )
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Atividade no período</CardTitle>
        </CardHeader>
        <CardContent className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={stats?.serie ?? []}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
              <XAxis dataKey="dia" fontSize={11} tickFormatter={(d: string) => d.slice(5)} />
              <YAxis fontSize={11} allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="registos" fill="hsl(var(--primary))" name="Registos" />
              <Bar dataKey="sessoes" fill="hsl(var(--secondary))" name="Sessões de exercício" />
              <Bar dataKey="pedidos_premium" fill="hsl(var(--accent))" name="Pedidos premium" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminOverview;
