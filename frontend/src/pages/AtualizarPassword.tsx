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
import { erroDePasswordFraca } from "@/lib/validarPassword";

/**
 * Ecrã de "Definir nova palavra-passe", aberto a partir do link de
 * recuperação enviado por email (ver `handleForgotPassword` em Auth.tsx e
 * `POST /auth/recuperar-password`). O token vem na própria URL
 * (?token=...), gerado pela API -- não há sessão nenhuma envolvida aqui,
 * ao contrário do fluxo antigo do Supabase: o token é de uso único e
 * validado directamente por `POST /auth/redefinir-password`.
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
    if (!token) {
      toast.error("Este link de recuperação é inválido. Peça um novo.");
      return;
    }
    if (!password || !confirm) {
      toast.error("Preencha os dois campos.");
      return;
    }
    const erroPassword = erroDePasswordFraca(password);
    if (erroPassword) {
      toast.error(erroPassword);
      return;
    }
    if (password !== confirm) {
      toast.error("As palavras-passe não coincidem.");
      return;
    }

    setLoading(true);
    try {
      await authApi.redefinirPassword(token, password);
      toast.success("Palavra-passe actualizada com sucesso!");
      // Sem sessão nenhuma para terminar aqui (o token de recuperação nunca
      // autentica, só troca a password) — segue directo para o login limpo.
      navigate("/auth", { replace: true });
    } catch (err) {
      // Nunca mostrar sucesso a partir daqui — um token inválido, expirado
      // ou já usado devolve erro, e é isto que aparece ao utilizador.
      toast.error(mensagemDeErroApi(err, "Este link de recuperação é inválido ou expirou. Peça um novo."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-background to-muted/40">
      <Navbar />
      <main className="flex-1 container max-w-md pt-28 pb-16 flex items-center">
        <Card className="w-full shadow-lg border-border/60">
          <CardHeader className="text-center space-y-2">
            <CardTitle className="text-2xl md:text-3xl font-bold">Definir Nova Palavra-passe</CardTitle>
            <CardDescription>
              {token ? "Escolha uma nova palavra-passe para a sua conta." : "Este link de recuperação é inválido."}
            </CardDescription>
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
                  disabled={!token || loading}
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
                  disabled={!token || loading}
                />
              </div>
              <Button type="submit" size="lg" className="w-full" disabled={loading || !token}>
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
