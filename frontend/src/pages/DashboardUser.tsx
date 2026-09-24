import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Eye, Activity, Sparkles, Calendar, Play } from "lucide-react";
import { screeningsApi } from "@/lib/apiClient";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/contexts/ProfileContext";
import { useTranslation } from "react-i18next";
import { localizar } from "@/i18n/rotas";

// 4 gratuitos + 8 premium (ver Exercicios.tsx) -- todos com rota real em
// App.tsx, nenhum placeholder. Os premium só contam para quem tem acesso.
const TOTAL_EXERCICIOS_GRATUITOS = 4;
const TOTAL_EXERCICIOS_PREMIUM = 8;

const DashboardUser = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { profile } = useProfile();
  const [scanCount, setScanCount] = useState(0);
  const primeiroNome = user?.name?.split(" ")[0];

  const temAcessoPremium = !!profile && (profile.premium_ativo || profile.papel === "admin");
  const exerciciosDisponiveis =
    TOTAL_EXERCICIOS_GRATUITOS + (temAcessoPremium ? TOTAL_EXERCICIOS_PREMIUM : 0);

  useEffect(() => {
    if (!user) return;
    screeningsApi
      .listarMinhas()
      .then((screenings) => setScanCount(screenings.length))
      .catch(() => setScanCount(0));
  }, [user]);

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-background to-muted/40">
      <Navbar />
      <main className="flex-1 container pt-28 pb-16 space-y-8">
        <div>
          <h1 className="text-3xl font-bold">{primeiroNome ? t("DashboardUser.saudacao", { nome: primeiroNome }) : t("DashboardUser.saudacaoSemNome")} 👋</h1>
          <p className="text-muted-foreground">{t("DashboardUser.oSeuEspacoDe")}</p>
        </div>

        <div className="grid md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-6">
              <Activity className="w-6 h-6 text-teal mb-2" />
              <div className="text-2xl font-bold">{scanCount}</div>
              <div className="text-sm text-muted-foreground">{t("DashboardUser.analisesRealizadas")}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <Eye className="w-6 h-6 text-navy mb-2" />
              <div className="text-2xl font-bold">{exerciciosDisponiveis}</div>
              <div className="text-sm text-muted-foreground">{t("DashboardUser.exerciciosDisponiveis")}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <Calendar className="w-6 h-6 text-gold mb-2" />
              {/* A teleconsulta ainda não é uma funcionalidade real da
                  plataforma -- um "—" ao lado de números verdadeiros
                  parecia uma métrica vazia, não uma que ainda não existe. */}
              <div className="text-2xl font-bold text-muted-foreground">{t("DashboardUser.emBreve")}</div>
              <div className="text-sm text-muted-foreground">{t("DashboardUser.proximaTeleconsulta")}</div>
            </CardContent>
          </Card>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <Card>
            <CardHeader><CardTitle>{t("DashboardUser.fazerNovaAnalise")}</CardTitle></CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">{t("DashboardUser.useOScannerPara")}</p>
              <Button onClick={() => navigate(localizar("/scanner"))}><Eye className="w-4 h-4" />{" "}{t("DashboardUser.abrirScanner")}</Button>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>{t("DashboardUser.continuarExercicios")}</CardTitle></CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">{t("DashboardUser.treineACoordenacaoOcular")}</p>
              <Button variant="secondary" onClick={() => navigate(localizar("/exercicios"))}><Play className="w-4 h-4" />{" "}{t("DashboardUser.verExercicios")}</Button>
            </CardContent>
          </Card>
        </div>

      </main>
      <Footer />
    </div>
  );
};

export default DashboardUser;
