import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { Aviso } from "@/design/componentes/Aviso";
import { Botao } from "@/design/componentes/Botao";
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
      <Aviso variante="aviso" titulo={t("DashboardUser.premiumPendenteTitulo")}>
        {t("DashboardUser.premiumPendenteDescricao")}
      </Aviso>
    );
  }

  return (
    <Aviso
      variante="erro"
      titulo={t("DashboardUser.premiumRevogadoTitulo")}
      accao={
        <Botao variante="secundario" onClick={() => navigate(localizar("/registo-premium"))}>
          {t("DashboardUser.premiumSubmeterNovoPedido")}
        </Botao>
      }
    >
      {t("DashboardUser.premiumRevogadoDescricao")}
    </Aviso>
  );
};

export default PremiumRequestBanner;
