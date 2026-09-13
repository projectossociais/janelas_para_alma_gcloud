import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { toast } from "sonner";
import { authApi, mensagemDeErroApi } from "@/lib/apiClient";

const PASSWORD_MIN_LEN = 8;

/**
 * Ecrã de "Definir nova palavra-passe", aberto a partir do link de
 * recuperação enviado por email (`?token=...` — ver
 * `Auth.tsx::handleForgotPasswordSubmit` e `POST /auth/recuperar-password`).
 * O token é de uso único e tem validade curta (ver
 * `docs/BACKLOG.md`, "Identidade externa e email"); a API é que valida isso,
 * esta página só o envia junto com a nova palavra-passe.
 */
const AtualizarPassword = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password || !confirm) {
      toast.error("Preencha os dois campos.");
      return;
    }
    if (password.length < PASSWORD_MIN_LEN) {
      toast.error(`A palavra-passe deve ter pelo menos ${PASSWORD_MIN_LEN} caracteres.`);
      return;
    }
    if (password !== confirm) {
      toast.error("As palavras-passe não coincidem.");
      return;
    }

    setLoading(true);
    try {
      await authApi.redefinirPassword(token, password);
      toast.success("Palavra-passe atualizada. Inicie sessão com a nova palavra-passe.");
      navigate("/auth", { replace: true });
    } catch (err) {
      toast.error(
        mensagemDeErroApi(err, "Não foi possível atualizar a palavra-passe. O link pode ter expirado.")
      );
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="min-h-screen flex flex-col bg-gradient-to-b from-background to-muted/40">
        <Navbar />
        <main className="flex-1 container max-w-md pt-28 pb-16 flex items-center">
          <Card className="w-full shadow-lg border-border/60">
            <CardHeader className="text-center space-y-2">
              <CardTitle className="text-2xl font-bold">Link inválido</CardTitle>
              <CardDescription>
                Este link de recuperação de palavra-passe está incompleto. Peça um novo em
                "Esqueceu a palavra-passe?", na página de entrada.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button className="w-full" onClick={() => navigate("/auth")}>
                Voltar ao login
              </Button>
            </CardContent>
          </Card>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-background to-muted/40">
      <Navbar />
      <main className="flex-1 container max-w-md pt-28 pb-16 flex items-center">
        <Card className="w-full shadow-lg border-border/60">
          <CardHeader className="text-center space-y-2">
            <CardTitle className="text-2xl md:text-3xl font-bold">Definir Nova Palavra-passe</CardTitle>
            <CardDescription>Escolha uma nova palavra-passe para a sua conta.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="new-password">Nova Palavra-passe</Label>
                <Input
                  id="new-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="new-password"
                  disabled={loading}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-password">Confirmar Palavra-passe</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="new-password"
                  disabled={loading}
                />
              </div>
              <Button type="submit" size="lg" className="w-full" disabled={loading}>
                {loading ? (
                  "A guardar..."
                ) : (
                  <>
                    Guardar Nova Palavra-passe <ArrowRight className="w-4 h-4 ml-2" />
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </main>
      <Footer />
    </div>
  );
};

export default AtualizarPassword;
