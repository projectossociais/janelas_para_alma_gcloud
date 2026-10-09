import { useState } from "react";
import { ShieldCheck } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { useConsentimentoSaude } from "@/contexts/ConsentimentoSaudeContext";
import { mensagemDeErroApi } from "@/lib/apiClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

/**
 * Direito de retirar o consentimento para dados de saúde (Lei 22/11). Retirar
 * não apaga o que já existe (isso é a eliminação da conta): deixa de se
 * gravar o que é novo. Só mostra sucesso depois de a API confirmar.
 */
const ConsentimentoSaudeDefinicoes = () => {
  const { t } = useTranslation();
  const { consentido, carregando, retirar } = useConsentimentoSaude();
  const [aRetirar, setARetirar] = useState(false);
  const [confirmar, setConfirmar] = useState(false);

  const confirmarRetirar = async (e: React.MouseEvent) => {
    e.preventDefault();
    setARetirar(true);
    try {
      await retirar();
      setConfirmar(false);
      toast.success(t("ConsentimentoSaude.retirado"));
    } catch (err) {
      toast.error(mensagemDeErroApi(err, t("ConsentimentoSaude.erroRetirar")));
    } finally {
      setARetirar(false);
    }
  };

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-primary">
          <ShieldCheck className="h-5 w-5 text-teal" /> {t("ConsentimentoSaude.seccaoTitulo")}
        </CardTitle>
        <CardDescription>
          {carregando
            ? null
            : consentido
              ? t("ConsentimentoSaude.estadoDado")
              : t("ConsentimentoSaude.estadoNaoDado")}
        </CardDescription>
      </CardHeader>
      {consentido && (
        <CardContent>
          <Button variant="outline" onClick={() => setConfirmar(true)}>
            {t("ConsentimentoSaude.retirar")}
          </Button>
          <AlertDialog open={confirmar} onOpenChange={setConfirmar}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{t("ConsentimentoSaude.retirar")}</AlertDialogTitle>
                <AlertDialogDescription>{t("ConsentimentoSaude.retirarConfirmar")}</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={aRetirar}>{t("ConsentimentoSaude.cancelar")}</AlertDialogCancel>
                <AlertDialogAction onClick={(e) => void confirmarRetirar(e)} disabled={aRetirar}>
                  {t("ConsentimentoSaude.retirar")}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardContent>
      )}
    </Card>
  );
};

export default ConsentimentoSaudeDefinicoes;
