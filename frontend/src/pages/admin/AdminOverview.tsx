import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Users, Activity, Sparkles, MessageSquare, Eye, TrendingUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

type Period = "week" | "month" | "year";

const periodDays: Record<Period, number> = { week: 7, month: 30, year: 365 };

interface Kpis {
  totalUsers: number;
  newUsers: number;
  scans: number;
  premium: number;
  messages: number;
  online: number;
}

const AdminOverview = () => {
  const [period, setPeriod] = useState<Period>("month");
  const [kpis, setKpis] = useState<Kpis>({
    totalUsers: 0, newUsers: 0, scans: 0, premium: 0, messages: 0, online: 0,
  });
  const [series, setSeries] = useState<{ day: string; registos: number; analises: number; pedidos: number }[]>([]);

  useEffect(() => {
    const load = async () => {
      const since = new Date();
      since.setDate(since.getDate() - periodDays[period]);
      const sinceIso = since.toISOString();

      const [users, newUsers, scans, premium, msgs] = await Promise.all([
        supabase.from("profiles").select("id", { count: "exact", head: true }),
        supabase.from("profiles").select("id", { count: "exact", head: true }).gte("created_at", sinceIso),
        supabase.from("scanner_analyses").select("id", { count: "exact", head: true }).gte("created_at", sinceIso),
        supabase.from("premium_requests").select("id", { count: "exact", head: true }).gte("created_at", sinceIso),
        supabase.from("contact_messages").select("id", { count: "exact", head: true }).gte("created_at", sinceIso),
      ]);

      setKpis((k) => ({
        ...k,
        totalUsers: users.count ?? 0,
        newUsers: newUsers.count ?? 0,
        scans: scans.count ?? 0,
        premium: premium.count ?? 0,
        messages: msgs.count ?? 0,
      }));

      // Series
      const [rProfiles, rScans, rPremium] = await Promise.all([
        supabase.from("profiles").select("created_at").gte("created_at", sinceIso),
        supabase.from("scanner_analyses").select("created_at").gte("created_at", sinceIso),
        supabase.from("premium_requests").select("created_at").gte("created_at", sinceIso),
      ]);
      const days = periodDays[period];
      const buckets: Record<string, { registos: number; analises: number; pedidos: number }> = {};
      for (let i = days - 1; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const key = d.toISOString().slice(0, 10);
        buckets[key] = { registos: 0, analises: 0, pedidos: 0 };
      }
      const bump = (rows: any[], field: keyof (typeof buckets)[string]) => {
        rows?.forEach((r) => {
          const k = r.created_at.slice(0, 10);
          if (buckets[k]) buckets[k][field]++;
        });
      };
      bump(rProfiles.data || [], "registos");
      bump(rScans.data || [], "analises");
      bump(rPremium.data || [], "pedidos");
      setSeries(Object.entries(buckets).map(([day, v]) => ({ day: day.slice(5), ...v })));
    };
    load();
  }, [period]);

  // Presence: online users
  useEffect(() => {
    const channel = supabase.channel("online-users", {
      config: { presence: { key: crypto.randomUUID() } },
    });
    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState();
        setKpis((k) => ({ ...k, online: Object.keys(state).length }));
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({ at: Date.now() });
        }
      });
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const cards = [
    { label: "Utilizadores (total)", value: kpis.totalUsers, icon: Users, color: "text-navy" },
    { label: "Novos utilizadores", value: kpis.newUsers, icon: TrendingUp, color: "text-teal" },
    { label: "Online agora", value: kpis.online, icon: Eye, color: "text-green-600" },
    { label: "Análises scanner", value: kpis.scans, icon: Activity, color: "text-gold" },
    { label: "Pedidos premium", value: kpis.premium, icon: Sparkles, color: "text-purple-600" },
    { label: "Mensagens", value: kpis.messages, icon: MessageSquare, color: "text-blue-600" },
  ];

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

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {cards.map((c) => (
          <Card key={c.label}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <c.icon className={`w-5 h-5 ${c.color}`} />
              </div>
              <div className="text-2xl font-bold">{c.value}</div>
              <div className="text-xs text-muted-foreground">{c.label}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Atividade no período</CardTitle>
        </CardHeader>
        <CardContent className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={series}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
              <XAxis dataKey="day" fontSize={11} />
              <YAxis fontSize={11} allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="registos" fill="hsl(var(--primary))" name="Registos" />
              <Bar dataKey="analises" fill="hsl(var(--secondary))" name="Análises" />
              <Bar dataKey="pedidos" fill="hsl(var(--accent))" name="Pedidos" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminOverview;
