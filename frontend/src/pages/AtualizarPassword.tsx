import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

/** Quanto tempo esperar por uma sessão de recuperação antes de desistir e mandar para /auth. */
const JANELA_VALIDACAO_MS = 2500;

/**
 * Ecrã de "Definir nova palavra-passe", aberto a partir do link de
 * recuperação enviado por email (ver `handleForgotPassword` em Auth.tsx).
 *
 * O Supabase JS deteta o token de recuperação na URL e cria uma sessão
 * automaticamente -- por isso esta página não pede a palavra-passe antiga,
 * só a nova. A intercepção que força a navegação até aqui (evento
 * `PASSWORD_RECOVERY`) vive em `AuthContext.tsx`; esta página só cuida do
 * formulário e faz a sua própria verificação de sessão como segunda linha
 * de defesa (rota seguida directamente, sem token válido, etc.).
 */
const AtualizarPassword = () => {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let resolvido = false;

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (resolvido) return;
      if (event === "PASSWORD_RECOVERY" || (session && event === "SIGNED_IN")) {
        resolvido = true;
        setReady(true);
      }
    });

    supabase.auth.getSession().then(({ data }) => {
      if (resolvido) return;
      if (data.session) {
        resolvido = true;
        setReady(true);
        return;
      }
      // Dá uma janela curta ao evento PASSWORD_RECOVERY para chegar (o
      // Supabase JS ainda pode estar a processar o token da URL) antes de
      // concluir que não há sessão válida.
      setTimeout(() => {
        if (resolvido) return;
        resolvido = true;
        toast.error("Este link de recuperação é inválido ou expirou. Peça um novo.");
        navigate("/auth", { replace: true });
      }, JANELA_VALIDACAO_MS);
    });

    return () => sub.subscription.unsubscribe();
  }, [navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password || !confirm) {
      toast.error("Preencha os dois campos.");
      return;
    }
    if (password.length < 6) {
      toast.error("A palavra-passe deve ter pelo menos 6 caracteres.");
      return;
    }
    if (password !== confirm) {
      toast.error("As palavras-passe não coincidem.");
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;

      toast.success("Palavra-passe atualizada com sucesso!");
      // Termina a sessão de recuperação -- o utilizador faz login limpo com
      // a palavra-passe nova a seguir, em vez de ficar "meio autenticado".
      await supabase.auth.signOut();
      navigate("/auth", { replace: true });
    } catch (err) {
      console.error("Falha ao atualizar a palavra-passe:", err);
      toast.error(
        err instanceof Error ? err.message : "Não foi possível atualizar a palavra-passe. Tente novamente.",
      );
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
              {ready
                ? "Escolha uma nova palavra-passe para a sua conta."
                : "A validar o link de recuperação..."}
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
                  disabled={!ready || loading}
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
                  disabled={!ready || loading}
                />
              </div>
              <Button type="submit" size="lg" className="w-full" disabled={loading || !ready}>
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
