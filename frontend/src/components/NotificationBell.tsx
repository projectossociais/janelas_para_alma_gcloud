import { useEffect, useState } from "react";
import { Bell, Loader2 } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { notificacoesApi, mensagemDeErroApi, type NotificacaoPublica } from "@/lib/apiClient";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { formatarDataHora } from "@/i18n/formatar";

// ADMIN-04: substitui o antigo AdminNotifications.tsx, que "enviava" para
// uma tabela do Supabase sem nenhum consumidor real -- este sino é esse
// consumidor. Só aparece com sessão (Navbar controla isso).

interface NotificationBellProps {
  claro: boolean;
}

const NotificationBell = ({ claro }: NotificationBellProps) => {
  const { t } = useTranslation();
  const [aberto, setAberto] = useState(false);
  const [contagem, setContagem] = useState(0);
  const [notificacoes, setNotificacoes] = useState<NotificacaoPublica[] | null>(null);

  const carregarContagem = async () => {
    try {
      setContagem((await notificacoesApi.contarNaoLidas()).contagem);
    } catch {
      // Sino é informativo -- uma falha aqui nunca deve incomodar quem só
      // está a navegar o site.
    }
  };

  useEffect(() => {
    carregarContagem();
    const intervalo = setInterval(carregarContagem, 60_000);
    return () => clearInterval(intervalo);
  }, []);

  const abrir = async (aberto: boolean) => {
    setAberto(aberto);
    if (!aberto) return;
    try {
      setNotificacoes(await notificacoesApi.listarMinhas());
    } catch (err) {
      toast.error(mensagemDeErroApi(err, t("NotificationBell.naoFoiPossivelCarregar")));
    }
  };

  const marcarLida = async (id: string) => {
    try {
      await notificacoesApi.marcarLida(id);
      setNotificacoes((atual) => atual?.map((n) => (n.id === id ? { ...n, lida: true } : n)) ?? null);
      setContagem((atual) => Math.max(0, atual - 1));
    } catch (err) {
      toast.error(mensagemDeErroApi(err, t("NotificationBell.naoFoiPossivelMarcar")));
    }
  };

  const marcarTodasLidas = async () => {
    try {
      await notificacoesApi.marcarTodasLidas();
      setNotificacoes((atual) => atual?.map((n) => ({ ...n, lida: true })) ?? null);
      setContagem(0);
    } catch (err) {
      toast.error(mensagemDeErroApi(err, t("NotificationBell.naoFoiPossivelMarcar2")));
    }
  };

  return (
    <Popover open={aberto} onOpenChange={abrir}>
      <PopoverTrigger asChild>
        <button
          className={`relative p-2 rounded-lg transition-colors ${
            claro ? "text-primary-foreground hover:bg-primary-foreground/10" : "text-foreground hover:bg-muted"
          }`}
          aria-label={contagem > 0 ? t("NotificationBell.notificacoesPorLer", { contagem }) : t("NotificationBell.notificacoes")}
        >
          <Bell className="w-5 h-5" />
          {contagem > 0 && (
            <span className="absolute top-0.5 right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center">
              {contagem > 9 ? "9+" : contagem}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between p-3 border-b">
          <span className="font-semibold text-sm">{t("NotificationBell.notificacoes")}</span>
          {contagem > 0 && (
            <button onClick={marcarTodasLidas} className="text-xs text-primary hover:underline">
              {t("NotificationBell.marcarTudoComoLido")}
            </button>
          )}
        </div>
        <ScrollArea className="max-h-80">
          {notificacoes === null && (
            <div className="flex justify-center py-8">
              <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
            </div>
          )}
          {notificacoes?.map((n) => (
            <button
              key={n.id}
              onClick={() => !n.lida && marcarLida(n.id)}
              className={`w-full text-left p-3 border-b last:border-b-0 transition-colors hover:bg-muted/50 ${
                n.lida ? "" : "bg-primary/5"
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="font-medium text-sm">{n.titulo}</span>
                {!n.lida && <Badge className="h-1.5 w-1.5 p-0 rounded-full" />}
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">{n.mensagem}</p>
              <p className="text-[11px] text-muted-foreground mt-1">
                {formatarDataHora(n.created_at)}
              </p>
            </button>
          ))}
          {notificacoes?.length === 0 && (
            <p className="text-center text-sm text-muted-foreground py-8">{t("NotificationBell.semNotificacoes")}</p>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
};

export default NotificationBell;
