import { useEffect, useState } from "react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Stethoscope, Users, Calendar, FileText, Mail, Phone } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import RequireClinica from "@/components/admin/RequireClinica";
import { clinicasApi, mensagemDeErroApi, type AgendamentoClinicoAdmin, type ClinicaParceiraAdmin } from "@/lib/apiClient";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

const estadoBadge = (estado: string) => {
  const variantes: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
    confirmada: "default",
    pendente: "secondary",
    recusada: "destructive",
  };
  return <Badge variant={variantes[estado] ?? "outline"}>{estado}</Badge>;
};

const ConteudoDashboardPro = ({ clinica }: { clinica: ClinicaParceiraAdmin }) => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [agendamentos, setAgendamentos] = useState<AgendamentoClinicoAdmin[]>([]);

  useEffect(() => {
    clinicasApi
      .meusAgendamentos()
      .then(setAgendamentos)
      .catch((err) => toast.error(mensagemDeErroApi(err, t("DashboardPro.naoFoiPossivelCarregar"))));
  }, []);

  const pendentes = agendamentos.filter((a) => a.estado === "pendente");
  const confirmados = agendamentos.filter((a) => a.estado === "confirmada");

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-background to-muted/40">
      <Navbar />
      <main className="flex-1 container pt-28 pb-16 space-y-8">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Stethoscope className="w-8 h-8 text-navy" />{" "}{t("DashboardPro.areaClinica")}
          </h1>
          <p className="text-muted-foreground">
            {t("DashboardPro.bemVindoADr")} {user?.name || ""} — {clinica.nome}.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-4">
          <Card><CardContent className="p-6">
            <Users className="w-6 h-6 text-teal mb-2" /><div className="text-2xl font-bold">{pendentes.length}</div>
            <div className="text-sm text-muted-foreground">{t("DashboardPro.pedidosPorDecidir")}</div>
          </CardContent></Card>
          <Card><CardContent className="p-6">
            <Calendar className="w-6 h-6 text-navy mb-2" /><div className="text-2xl font-bold">{confirmados.length}</div>
            <div className="text-sm text-muted-foreground">{t("DashboardPro.teleconsultasAgendadas")}</div>
          </CardContent></Card>
          <Card><CardContent className="p-6">
            <FileText className="w-6 h-6 text-gold mb-2" />
            <div className="text-2xl font-bold text-muted-foreground">{t("DashboardPro.emBreve")}</div>
            <div className="text-sm text-muted-foreground">{t("DashboardPro.relatoriosPendentes")}</div>
          </CardContent></Card>
        </div>

        <Card>
          <CardHeader><CardTitle>{t("DashboardPro.pedidosDeConsulta")}</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {agendamentos.map((a) => (
              <div key={a.id} className="flex items-center justify-between border rounded-lg p-3 gap-3 flex-wrap">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold">{a.nome}</span>
                    {estadoBadge(a.estado)}
                  </div>
                  <div className="text-xs text-muted-foreground flex gap-3 mt-1 flex-wrap">
                    <span className="inline-flex items-center gap-1"><Mail className="w-3 h-3" />{a.email}</span>
                    <span className="inline-flex items-center gap-1"><Phone className="w-3 h-3" />{a.telefone}</span>
                  </div>
                </div>
              </div>
            ))}
            {!agendamentos.length && (
              <p className="text-center text-muted-foreground py-6">{t("DashboardPro.aindaSemPedidos")}</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>{t("DashboardPro.emBreve")}</CardTitle></CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2">
            <p>{t("DashboardPro.listaDePacientesQue")}</p>
            <p>{t("DashboardPro.visualizacaoDeRelatoriosDo")}</p>
            <p>{t("DashboardPro.agendaIntegradaDeTeleconsultas")}</p>
            <p>{t("DashboardPro.emissaoDeRecomendacoesClinicas")}</p>
          </CardContent>
        </Card>
      </main>
      <Footer />
    </div>
  );
};

const DashboardPro = () => (
  <RequireClinica>{(clinica) => <ConteudoDashboardPro clinica={clinica} />}</RequireClinica>
);

export default DashboardPro;
