import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Send } from "lucide-react";
import { notificacoesApi, mensagemDeErroApi, PAPEIS_PARA_NOTIFICAR } from "@/lib/apiClient";
import { toast } from "sonner";
import { ROLE_LABEL, type UserRole } from "@/contexts/AuthContext";

const FORM_VAZIO = { titulo: "", mensagem: "", papel: "all" };

const AdminNotifications = () => {
  const [form, setForm] = useState(FORM_VAZIO);
  const [aEnviar, setAEnviar] = useState(false);
  const [ultimoEnvio, setUltimoEnvio] = useState<{ titulo: string; enviadas: number; papel: string } | null>(
    null,
  );

  const enviar = async () => {
    if (!form.titulo || !form.mensagem) {
      toast.error("Título e mensagem obrigatórios.");
      return;
    }
    setAEnviar(true);
    try {
      const { enviadas } = await notificacoesApi.enviar(
        form.titulo,
        form.mensagem,
        form.papel === "all" ? null : form.papel,
      );
      toast.success(
        enviadas > 0
          ? `Notificação enviada a ${enviadas} pessoa${enviadas === 1 ? "" : "s"}.`
          : "Enviada, mas não há ninguém com esse perfil ainda.",
      );
      setUltimoEnvio({ titulo: form.titulo, enviadas, papel: form.papel });
      setForm(FORM_VAZIO);
    } catch (err) {
      toast.error(mensagemDeErroApi(err, "Não foi possível enviar a notificação."));
    } finally {
      setAEnviar(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Notificações</h2>
        <p className="text-sm text-muted-foreground">
          Cria uma notificação real na conta de cada destinatário — aparece no sino do site,
          não só aqui.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Enviar notificação</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label htmlFor="notif-papel">Destinatários</Label>
            <Select value={form.papel} onValueChange={(v) => setForm({ ...form, papel: v })}>
              <SelectTrigger id="notif-papel">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {PAPEIS_PARA_NOTIFICAR.map((p) => (
                  <SelectItem key={p} value={p}>
                    {ROLE_LABEL[p as UserRole] ?? p}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="notif-titulo">Título</Label>
            <Input
              id="notif-titulo"
              value={form.titulo}
              onChange={(e) => setForm({ ...form, titulo: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="notif-mensagem">Mensagem</Label>
            <Textarea
              id="notif-mensagem"
              value={form.mensagem}
              onChange={(e) => setForm({ ...form, mensagem: e.target.value })}
            />
          </div>
          <Button onClick={enviar} disabled={aEnviar}>
            <Send className="w-4 h-4" /> {aEnviar ? "A enviar..." : "Enviar"}
          </Button>
        </CardContent>
      </Card>

      {ultimoEnvio && (
        <Card>
          <CardHeader>
            <CardTitle>Último envio</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="border rounded-lg p-3">
              <div className="font-semibold">{ultimoEnvio.titulo}</div>
              <div className="text-xs text-muted-foreground mt-1">
                {ultimoEnvio.papel === "all"
                  ? "Todos"
                  : `Perfil: ${ROLE_LABEL[ultimoEnvio.papel as UserRole] ?? ultimoEnvio.papel}`}{" "}
                · {ultimoEnvio.enviadas} destinatário{ultimoEnvio.enviadas === 1 ? "" : "s"}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default AdminNotifications;
