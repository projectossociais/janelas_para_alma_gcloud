import { useState } from "react";
import { Film } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTranslation } from "react-i18next";
import { exerciciosApi } from "@/lib/apiClient";

interface ExercicioVideoProps {
  exercicioId: string;
}

/**
 * L-02 -- o backend já assina um URL temporário para o vídeo explicativo de
 * cada exercício (`GET /exercicios/{id}/video`), mas nenhum ecrã o mostrava.
 * Carregado só a pedido (nunca ao abrir o exercício): assinar um URL para um
 * vídeo que ainda não foi carregado no bucket é sempre um pedido bem-sucedido
 * da API (W-18 continua a decidir quais ficheiros já lá estão) -- só o
 * próprio `<video>` sabe se o ficheiro existe de facto. Qualquer falha (da
 * API ou do vídeo) esconde o botão em vez de mostrar um leitor partido.
 */
const ExercicioVideo = ({ exercicioId }: ExercicioVideoProps) => {
  const { t } = useTranslation();
  const [estado, setEstado] = useState<"fechado" | "a_carregar" | "aberto" | "indisponivel">(
    "fechado",
  );
  const [url, setUrl] = useState<string | null>(null);

  const abrir = async () => {
    setEstado("a_carregar");
    try {
      const resposta = await exerciciosApi.video(exercicioId);
      setUrl(resposta.url);
      setEstado("aberto");
    } catch {
      setEstado("indisponivel");
    }
  };

  if (estado === "indisponivel") return null;

  if (estado === "aberto" && url) {
    return (
      <div className="mt-4">
        <video
          src={url}
          controls
          className="w-full rounded-xl border border-border/60"
          onError={() => setEstado("indisponivel")}
        />
      </div>
    );
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={() => void abrir()}
      disabled={estado === "a_carregar"}
      className="mt-4 gap-2"
    >
      <Film className="h-4 w-4" />
      {estado === "a_carregar"
        ? t("ExercicioVideo.aCarregar")
        : t("ExercicioVideo.verVideoExplicativo")}
    </Button>
  );
};

export default ExercicioVideo;
