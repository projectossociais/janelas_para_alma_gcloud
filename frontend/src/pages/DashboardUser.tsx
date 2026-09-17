import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Eye, Activity, Sparkles, Calendar, Play } from "lucide-react";
import { screeningsApi } from "@/lib/apiClient";
import { useAuth } from "@/contexts/AuthContext";

const DashboardUser = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [scanCount, setScanCount] = useState(0);

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
          <h1 className="text-3xl font-bold">Olá, {user?.name?.split(" ")[0] || "utilizador"} 👋</h1>
          <p className="text-muted-foreground">O seu espaço de acompanhamento visual.</p>
        </div>

        <div className="grid md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-6">
              <Activity className="w-6 h-6 text-teal mb-2" />
              <div className="text-2xl font-bold">{scanCount}</div>
              <div className="text-sm text-muted-foreground">Análises realizadas</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <Eye className="w-6 h-6 text-navy mb-2" />
              <div className="text-2xl font-bold">4</div>
              <div className="text-sm text-muted-foreground">Exercícios disponíveis</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <Calendar className="w-6 h-6 text-gold mb-2" />
              <div className="text-2xl font-bold">—</div>
              <div className="text-sm text-muted-foreground">Próxima teleconsulta</div>
            </CardContent>
          </Card>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <Card>
            <CardHeader><CardTitle>Fazer nova análise</CardTitle></CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">Use o scanner para avaliar o seu alinhamento ocular.</p>
              <Button onClick={() => navigate("/scanner")}><Eye className="w-4 h-4" /> Abrir scanner</Button>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Continuar exercícios</CardTitle></CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">Treine a coordenação ocular diariamente.</p>
              <Button variant="secondary" onClick={() => navigate("/exercicios")}><Play className="w-4 h-4" /> Ver exercícios</Button>
            </CardContent>
          </Card>
        </div>

      </main>
      <Footer />
    </div>
  );
};

export default DashboardUser;
