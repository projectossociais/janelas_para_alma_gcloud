import { useEffect, useState } from "react";
import { Loader2, ShoppingBag } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { useProfile } from "@/contexts/ProfileContext";
import { comprarNaLoja, comprasConfiguradas, precoNaLoja } from "@/lib/comprasLoja";
import { cn } from "@/lib/utils";

interface BotaoCompraNaLojaProps {
  produtoId: string;
  /** Espera que a API mostre a compra (o webhook pode demorar uns
   *  segundos); `true` quando já a mostra. */
  confirmarNaApi: () => Promise<boolean>;
  mensagemSucesso: string;
  ariaLabel?: string;
  className?: string;
}

/**
 * Compra de um pacote do jogo pela App Store / Google Play, dentro da app
 * nativa (ver lib/comprasLoja.ts). Mostra o preço da loja; o saldo só muda
 * quando a API o confirma -- nunca sucesso antes disso (CLAUDE.md §6).
 */
const BotaoCompraNaLoja = ({
  produtoId,
  confirmarNaApi,
  mensagemSucesso,
  ariaLabel,
  className,
}: BotaoCompraNaLojaProps) => {
  const { t } = useTranslation();
  const { profile } = useProfile();
  const utilizadorId = profile?.id;
  const configuradas = comprasConfiguradas();
  const [preco, setPreco] = useState<string | null>(null);
  const [estado, setEstado] = useState<"livre" | "a_comprar" | "a_confirmar">("livre");

  useEffect(() => {
    if (!utilizadorId || !configuradas) return;
    let cancelado = false;
    precoNaLoja(utilizadorId, produtoId)
      .then((p) => !cancelado && setPreco(p))
      .catch((err) => console.error("Falha ao obter o preço da loja:", err));
    return () => {
      cancelado = true;
    };
  }, [utilizadorId, configuradas, produtoId]);

  const comprar = async () => {
    if (!utilizadorId) return;
    setEstado("a_comprar");
    try {
      if ((await comprarNaLoja(utilizadorId, produtoId)) === "cancelado") return;
      setEstado("a_confirmar");
      if (await confirmarNaApi()) toast.success(mensagemSucesso);
      else toast.info(t("ComprasLoja.pagamentoEmConfirmacao"));
    } catch (err) {
      console.error("Falha na compra pela loja:", err);
      toast.error(t("ComprasLoja.naoFoiPossivelComprar"));
    } finally {
      setEstado("livre");
    }
  };

  if (!configuradas) {
    return <p className={cn("text-xs text-muted-foreground", className)}>{t("ComprasLoja.indisponivel")}</p>;
  }

  return (
    <Button
      className={cn("w-full", className)}
      onClick={() => void comprar()}
      disabled={estado !== "livre" || !utilizadorId}
      aria-label={ariaLabel}
    >
      {estado === "livre" ? <ShoppingBag className="w-4 h-4" /> : <Loader2 className="w-4 h-4 animate-spin" />}
      {estado === "a_comprar"
        ? t("ComprasLoja.aComprar")
        : estado === "a_confirmar"
          ? t("ComprasLoja.aConfirmar")
          : preco ?? t("ComprasLoja.comprar")}
    </Button>
  );
};

export default BotaoCompraNaLoja;
