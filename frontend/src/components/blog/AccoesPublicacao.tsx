import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Eye, Heart, Share2 } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/contexts/AuthContext";
import { mensagemDeErroApi, publicacoesApi } from "@/lib/apiClient";
import { localizar } from "@/i18n/rotas";

interface AccoesPublicacaoProps {
  slug: string;
  titulo: string;
  visualizacoes: number;
  gostos: number;
  gostei: boolean;
}

/**
 * Visualizações, "Gosto" e partilha de uma publicação. O gosto exige sessão
 * (uma conta, um gosto -- a API decide e devolve a contagem); a partilha usa a
 * folha nativa do telemóvel e, sem ela, copia o link.
 */
const AccoesPublicacao = ({ slug, titulo, visualizacoes, gostos: gostosIniciais, gostei: gosteiInicial }: AccoesPublicacaoProps) => {
  const { t } = useTranslation();
  const { isLoggedIn } = useAuth();
  const navigate = useNavigate();
  const [gostos, setGostos] = useState(gostosIniciais);
  const [gostei, setGostei] = useState(gosteiInicial);
  const [aGuardar, setAGuardar] = useState(false);

  const alternarGosto = async () => {
    if (!isLoggedIn) {
      toast(t("AccoesPublicacao.entreParaGostar"), {
        action: {
          label: t("AccoesPublicacao.entrar"),
          onClick: () => navigate(`${localizar("/auth")}?next=${encodeURIComponent(localizar(`/publicacoes/${slug}`))}`),
        },
      });
      return;
    }
    setAGuardar(true);
    try {
      const r = gostei ? await publicacoesApi.retirarGosto(slug) : await publicacoesApi.gostar(slug);
      setGostos(r.gostos);
      setGostei(r.gostei);
    } catch (err) {
      toast.error(mensagemDeErroApi(err, t("AccoesPublicacao.naoFoiPossivelGuardar")));
    } finally {
      setAGuardar(false);
    }
  };

  const partilhar = async () => {
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({ title: titulo, url });
      } catch {
        // A pessoa fechou a folha de partilha: nada a fazer.
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      toast.success(t("AccoesPublicacao.linkCopiado"));
    } catch {
      toast.error(t("AccoesPublicacao.naoFoiPossivelCopiar"));
    }
  };

  return (
    <div className="flex flex-wrap items-center justify-center gap-3 text-sm text-marca-marinho/75">
      <span className="inline-flex items-center gap-1.5" title={t("AccoesPublicacao.visualizacoes")}>
        <Eye className="h-4 w-4" aria-hidden="true" />
        {t("AccoesPublicacao.nVisualizacoes", { count: visualizacoes })}
      </span>
      <button
        type="button"
        onClick={alternarGosto}
        disabled={aGuardar}
        aria-pressed={gostei}
        className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 transition-colors ${
          gostei ? "border-marca-azul/30 bg-marca-celeste/25 text-marca-azul" : "border-marca-marinho/10 hover:bg-marca-celeste/25"
        }`}
      >
        <Heart className={`h-4 w-4 ${gostei ? "fill-marca-azul text-marca-azul" : ""}`} aria-hidden="true" />
        {t("AccoesPublicacao.gosto")} · {gostos}
      </button>
      <button
        type="button"
        onClick={partilhar}
        className="inline-flex items-center gap-1.5 rounded-full border border-marca-marinho/10 px-3 py-1.5 transition-colors hover:bg-marca-celeste/25"
      >
        <Share2 className="h-4 w-4" aria-hidden="true" />
        {t("AccoesPublicacao.partilhar")}
      </button>
    </div>
  );
};

export default AccoesPublicacao;
