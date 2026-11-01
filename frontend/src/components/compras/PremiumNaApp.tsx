import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Check, Loader2, ShoppingBag } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { useAcessoExercicios } from "@/contexts/AcessoExerciciosContext";
import { useProfile } from "@/contexts/ProfileContext";
import { exerciciosApi } from "@/lib/apiClient";
import {
  PRODUTO_PREMIUM_MENSAL,
  comprarNaLoja,
  comprasConfiguradas,
  esperarPelaApi,
  precoNaLoja,
  restaurarCompras,
} from "@/lib/comprasLoja";
import { localizar } from "@/i18n/rotas";

interface PremiumNaAppProps {
  onVoltar: () => void;
}

/**
 * O Premium dentro da app nativa: subscrição mensal pela App Store / Google
 * Play, em vez da transferência + comprovativo do site (que as lojas não
 * aceitam numa app). O Premium só aparece activo quando a API o diz
 * (webhook do RevenueCat) -- nunca a partir da resposta da loja.
 */
const PremiumNaApp = ({ onVoltar }: PremiumNaAppProps) => {
  const { t } = useTranslation();
  const { profile } = useProfile();
  const { acesso, refetch } = useAcessoExercicios();
  const utilizadorId = profile?.id;
  const configuradas = comprasConfiguradas();
  const [preco, setPreco] = useState<string | null>(null);
  const [estado, setEstado] = useState<"livre" | "a_comprar" | "a_confirmar" | "a_restaurar">("livre");

  useEffect(() => {
    if (!utilizadorId || !configuradas) return;
    let cancelado = false;
    precoNaLoja(utilizadorId, PRODUTO_PREMIUM_MENSAL, true)
      .then((p) => !cancelado && setPreco(p))
      .catch((err) => console.error("Falha ao obter o preço do Premium na loja:", err));
    return () => {
      cancelado = true;
    };
  }, [utilizadorId, configuradas]);

  const premiumActivo = acesso.estado === "premium";

  const subscrever = async () => {
    if (!utilizadorId) return;
    setEstado("a_comprar");
    try {
      if ((await comprarNaLoja(utilizadorId, PRODUTO_PREMIUM_MENSAL, true)) === "cancelado") return;
      setEstado("a_confirmar");
      const confirmado = await esperarPelaApi(exerciciosApi.acesso, (a) => a.estado === "premium");
      await refetch();
      if (confirmado) toast({ title: t("ComprasLoja.premiumActivado") });
      else toast({ title: t("ComprasLoja.pagamentoEmConfirmacao") });
    } catch (err) {
      console.error("Falha ao subscrever o Premium pela loja:", err);
      toast({ title: t("ComprasLoja.naoFoiPossivelComprar"), variant: "destructive" });
    } finally {
      setEstado("livre");
    }
  };

  const restaurar = async () => {
    if (!utilizadorId) return;
    setEstado("a_restaurar");
    try {
      await restaurarCompras(utilizadorId);
      await refetch();
      toast({ title: t("ComprasLoja.restauradas") });
    } catch (err) {
      console.error("Falha ao restaurar as compras:", err);
      toast({ title: t("ComprasLoja.naoFoiPossivelComprar"), variant: "destructive" });
    } finally {
      setEstado("livre");
    }
  };

  const beneficios = [
    t("RegistoPremium.acessoIlimitadoA8"),
    t("RegistoPremium.acompanhamentoDeMetricasDe"),
    t("RegistoPremium.suportePrioritario"),
  ];

  return (
    <div className="min-h-screen bg-background">
      <main className="container max-w-md pt-10 pb-16 space-y-6">
        <button
          type="button"
          onClick={onVoltar}
          className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-primary"
        >
          <ArrowLeft className="w-4 h-4" /> {t("ComprasLoja.voltar")}
        </button>

        <div>
          <h1 className="text-3xl font-bold text-foreground">{t("ComprasLoja.titulo")}</h1>
          <p className="text-muted-foreground mt-2">{t("ComprasLoja.descricao")}</p>
        </div>

        <ul className="space-y-2">
          {beneficios.map((b) => (
            <li key={b} className="flex items-start gap-2 text-sm text-foreground">
              <Check className="h-4 w-4 shrink-0 text-teal mt-0.5" strokeWidth={3} />
              <span>{b}</span>
            </li>
          ))}
        </ul>

        {!profile ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">{t("ComprasLoja.entrarParaComprar")}</p>
            <Button asChild className="w-full">
              <Link to={localizar("/auth")}>{t("ComprasLoja.entrar")}</Link>
            </Button>
          </div>
        ) : premiumActivo ? (
          <div className="rounded-xl border border-teal/40 bg-teal/5 p-4 space-y-3">
            <p className="font-semibold text-foreground">{t("ComprasLoja.jaTemPremium")}</p>
            <Button asChild className="w-full">
              <Link to={localizar("/exercicios")}>{t("ComprasLoja.irParaExercicios")}</Link>
            </Button>
          </div>
        ) : !configuradas ? (
          <p className="text-sm text-muted-foreground">{t("ComprasLoja.indisponivel")}</p>
        ) : (
          <div className="space-y-3">
            <p className="text-2xl font-bold text-navy">
              {preco ? t("ComprasLoja.porMes", { preco }) : t("ComprasLoja.precoACarregar")}
            </p>
            <Button
              size="lg"
              className="w-full bg-gradient-to-r from-teal to-navy text-primary-foreground hover:opacity-90"
              onClick={() => void subscrever()}
              disabled={estado !== "livre" || !preco}
            >
              {estado === "livre" ? <ShoppingBag className="w-4 h-4" /> : <Loader2 className="w-4 h-4 animate-spin" />}
              {estado === "a_comprar"
                ? t("ComprasLoja.aComprar")
                : estado === "a_confirmar"
                  ? t("ComprasLoja.aConfirmar")
                  : t("ComprasLoja.subscrever")}
            </Button>
          </div>
        )}

        {profile && configuradas && (
          <Button variant="outline" className="w-full" onClick={() => void restaurar()} disabled={estado !== "livre"}>
            {t("ComprasLoja.restaurar")}
          </Button>
        )}

        {/* Informação que a App Store e o Google Play exigem junto da compra de uma subscrição. */}
        <p className="text-xs text-muted-foreground leading-relaxed">{t("ComprasLoja.termosSubscricao")}</p>
        <p className="text-xs flex gap-4">
          <Link to={localizar("/termos-de-utilizacao")} className="underline text-muted-foreground">
            {t("ComprasLoja.termosUtilizacao")}
          </Link>
          <Link to={localizar("/politica-de-privacidade")} className="underline text-muted-foreground">
            {t("ComprasLoja.politicaPrivacidade")}
          </Link>
        </p>
      </main>
    </div>
  );
};

export default PremiumNaApp;
