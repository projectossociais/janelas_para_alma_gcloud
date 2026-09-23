import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Stethoscope, Users, Calendar, FileText } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useTranslation } from "react-i18next";

const DashboardPro = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-background to-muted/40">
      <Navbar />
      <main className="flex-1 container pt-28 pb-16 space-y-8">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Stethoscope className="w-8 h-8 text-navy" />{" "}{t("DashboardPro.areaClinica")}
          </h1>
          <p className="text-muted-foreground">{t("DashboardPro.bemVindoADr")}{" "}{user?.name || ""}.</p>
        </div>

        <div className="grid md:grid-cols-3 gap-4">
          <Card><CardContent className="p-6">
            <Users className="w-6 h-6 text-teal mb-2" /><div className="text-2xl font-bold">—</div>
            <div className="text-sm text-muted-foreground">{t("DashboardPro.pacientesAtribuidos")}</div>
          </CardContent></Card>
          <Card><CardContent className="p-6">
            <Calendar className="w-6 h-6 text-navy mb-2" /><div className="text-2xl font-bold">—</div>
            <div className="text-sm text-muted-foreground">{t("DashboardPro.teleconsultasAgendadas")}</div>
          </CardContent></Card>
          <Card><CardContent className="p-6">
            <FileText className="w-6 h-6 text-gold mb-2" /><div className="text-2xl font-bold">—</div>
            <div className="text-sm text-muted-foreground">{t("DashboardPro.relatoriosPendentes")}</div>
          </CardContent></Card>
        </div>

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

export default DashboardPro;
