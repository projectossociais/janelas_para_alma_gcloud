import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { authApi, mensagemDeErroApi } from "@/lib/apiClient";

type Estado = "a-confirmar" | "confirmado" | "erro";

/**
 * Aberto a partir do link de confirmação enviado no registo (`?token=...`
 * — ver `POST /auth/confirmar-email`). Confirma automaticamente ao carregar
 * a página, sem exigir nenhuma acção — o clique já aconteceu no email.
 */
const ConfirmarEmail = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const [estado, setEstado] = useState<Estado>("a-confirmar");
  const [mensagemErro, setMensagemErro] = useState("");

  useEffect(() => {
    if (!token) {
      setEstado("erro");
      setMensagemErro("Este link de confirmação está incompleto.");
      return;
    }
    let cancelado = false;
    authApi
      .confirmarEmail(token)
      .then(() => {
        if (!cancelado) setEstado("confirmado");
      })
      .catch((err) => {
        if (!cancelado) {
          setEstado("erro");
          setMensagemErro(
            mensagemDeErroApi(err, "Não foi possível confirmar o email. O link pode ter expirado.")
          );
        }
      });
    return () => {
      cancelado = true;
    };
  }, [token]);

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-background to-muted/40">
      <Navbar />
      <main className="flex-1 container max-w-md pt-28 pb-16 flex items-center">
        <Card className="w-full shadow-lg border-border/60">
          <CardHeader className="text-center space-y-3">
            {estado === "a-confirmar" && (
              <Loader2 className="w-10 h-10 mx-auto animate-spin text-muted-foreground" />
            )}
            {estado === "confirmado" && <CheckCircle2 className="w-10 h-10 mx-auto text-green" />}
            {estado === "erro" && <XCircle className="w-10 h-10 mx-auto text-destructive" />}
            <CardTitle className="text-2xl font-bold">
              {estado === "a-confirmar" && "A confirmar a sua conta…"}
              {estado === "confirmado" && "Conta confirmada"}
              {estado === "erro" && "Não foi possível confirmar"}
            </CardTitle>
            <CardDescription>
              {estado === "confirmado" && "O seu email foi confirmado com sucesso."}
              {estado === "erro" && mensagemErro}
            </CardDescription>
          </CardHeader>
          {estado !== "a-confirmar" && (
            <CardContent>
              <Button asChild className="w-full">
                <Link to="/">Ir para a página inicial</Link>
              </Button>
            </CardContent>
          )}
        </Card>
      </main>
      <Footer />
    </div>
  );
};

export default ConfirmarEmail;
