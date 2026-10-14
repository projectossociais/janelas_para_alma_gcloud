import { FileText } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { adminApi, mensagemDeErroApi } from "@/lib/apiClient";

/**
 * Abre o comprovativo de um pedido (Premium anual, doação, loja) pedindo o
 * URL à API: uma chave do bucket privado vem como URL assinado, de curta
 * duração; um URL público antigo vem tal como está. Nunca um link directo
 * guardado na página -- o bucket privado não tem URL público.
 */
const BotaoVerComprovativo = ({ referencia }: { referencia: string }) => {
  const abrir = async () => {
    // A janela abre já (antes do await) para não ser bloqueada como pop-up.
    const janela = window.open("", "_blank");
    try {
      const { url } = await adminApi.urlDoComprovativoManual(referencia);
      if (janela) janela.location.href = url;
      else window.location.href = url;
    } catch (err) {
      janela?.close();
      toast.error(mensagemDeErroApi(err, "Não foi possível abrir o comprovativo."));
    }
  };
  return (
    <Button size="sm" variant="outline" onClick={() => void abrir()}>
      <FileText className="w-3 h-3" /> Ver comprovativo
    </Button>
  );
};

export default BotaoVerComprovativo;
