import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { CheckCircle2, XCircle, ArrowRight } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { authApi, mensagemDeErroApi } from "@/lib/apiClient";
import { useTranslation } from "react-i18next";
import { localizar } from "@/i18n/rotas";

type Estado = "a-confirmar" | "confirmado" | "erro";

/**
 * Ecrã aberto a partir do link de confirmação enviado por email logo após
 * o registo (AUTH-02, ver `POST /auth/registar` e `ConfirmacaoEmailService`).
 * Só confirma a conta -- nunca inicia sessão automaticamente, para manter o
 * mesmo modelo mental do resto do fluxo de auth (confirmar é um passo à
 * parte de entrar). Depois de confirmada, a pessoa faz login normalmente.
 */
const ConfirmarEmail = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const [estado, setEstado] = useState<Estado>("a-confirmar");
  const [mensagemErro, setMensagemErro] = useState("");
  // React 18 em StrictMode monta os efeitos duas vezes em dev -- sem isto,
  // a segunda chamada usaria o mesmo token (já consumido pela primeira) e
  // mostraria "inválido ou expirou" por engano.
  const jaTentou = useRef(false);

  useEffect(() => {
    if (!token) {
      setEstado("erro");
      setMensagemErro(t("ConfirmarEmail.esteLinkDeConfirmacao"));
      return;
    }
    if (jaTentou.current) return;
    jaTentou.current = true;

    authApi
      .confirmarEmail(token)
      .then(() => setEstado("confirmado"))
      .catch((err) => {
        setEstado("erro");
        setMensagemErro(mensagemDeErroApi(err, t("ConfirmarEmail.esteLinkDeConfirmacao2")));
      });
  }, [token, t]);

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-background to-muted/40">
      <Navbar />
      <main className="flex-1 container max-w-md pt-28 pb-16 flex items-center">
        <Card className="w-full shadow-lg border-border/60">
          <CardHeader className="text-center space-y-2">
            {estado === "confirmado" ? (
              <CheckCircle2 className="w-10 h-10 text-green-600 mx-auto" />
            ) : estado === "erro" ? (
              <XCircle className="w-10 h-10 text-destructive mx-auto" />
            ) : null}
            <CardTitle className="text-2xl md:text-3xl font-bold">
              {estado === "a-confirmar" && t("ConfirmarEmail.aConfirmarASua")}
              {estado === "confirmado" && t("ConfirmarEmail.contaConfirmada")}
              {estado === "erro" && t("ConfirmarEmail.naoFoiPossivelConfirmar")}
            </CardTitle>
            <CardDescription>
              {estado === "a-confirmar" && t("ConfirmarEmail.umMomento")}
              {estado === "confirmado" && t("ConfirmarEmail.jaPodeEntrarCom")}
              {estado === "erro" && mensagemErro}
            </CardDescription>
          </CardHeader>
          {estado !== "a-confirmar" && (
            <CardContent>
              <Button size="lg" className="w-full" onClick={() => navigate(localizar("/auth"), { replace: true })}>
                {t("ConfirmarEmail.irParaOLogin")}{" "}<ArrowRight className="w-4 h-4 ml-2" />
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
