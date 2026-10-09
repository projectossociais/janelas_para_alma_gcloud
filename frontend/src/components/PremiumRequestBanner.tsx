import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { Clock, ShieldAlert } from "lucide-react";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useProfile } from "@/contexts/ProfileContext";
import { premiumApi, type PedidoPremiumPublico } from "@/lib/apiClient";
import { localizar } from "@/i18n/rotas";

/**
 * L-12 — depois de submeter um comprovativo em `RegistoPremium.tsx`, o
 * utilizador não tinha nenhuma forma de saber, ao voltar, se o pedido ainda
 * está a aguardar aprovação. Só aparece a quem não tem Premium activo: quem
 * já o tem não precisa desta informação, mesmo que o último pedido guardado
 * ainda diga "aprovado" (a validade real é sempre `profile.premium_ativo`,
 * nunca o `status` do pedido -- ver `PremiumService`/CLAUDE.md §1).
 */
const PremiumRequestBanner = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { profile, loading: perfilCarregando } = useProfile();
  const [pedido, setPedido] = useState<PedidoPremiumPublico | null>(null);

  useEffect(() => {
    if (perfilCarregando || !profile || profile.premium_ativo) {
      setPedido(null);
      return;
    }
    let activo = true;
    premiumApi
      .meuPedido()
      .then((p) => {
        if (activo) setPedido(p);
      })
      .catch(() => {
        if (activo) setPedido(null);
      });
    return () => {
      activo = false;
    };
  }, [perfilCarregando, profile]);

  if (!pedido || pedido.status === "aprovado") return null;

  if (pedido.status === "pendente") {
    return (
      <Alert className="border-gold/50 bg-gold/10">
        <Clock className="w-4 h-4 text-gold" />
        <AlertTitle>{t("DashboardUser.premiumPendenteTitulo")}</AlertTitle>
        <AlertDescription>{t("DashboardUser.premiumPendenteDescricao")}</AlertDescription>
      </Alert>
    );
  }

  return (
    <Alert variant="destructive">
      <ShieldAlert className="w-4 h-4" />
      <AlertTitle>{t("DashboardUser.premiumRevogadoTitulo")}</AlertTitle>
      <AlertDescription className="space-y-3">
        <p>{t("DashboardUser.premiumRevogadoDescricao")}</p>
        <Button size="sm" variant="outline" onClick={() => navigate(localizar("/registo-premium"))}>
          {t("DashboardUser.premiumSubmeterNovoPedido")}
        </Button>
      </AlertDescription>
    </Alert>
  );
};

export default PremiumRequestBanner;
