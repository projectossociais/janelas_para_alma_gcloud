import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Send } from "lucide-react";
import { notificacoesApi, mensagemDeErroApi, PAPEIS_PARA_NOTIFICAR } from "@/lib/apiClient";
import { toast } from "sonner";
import { ROLE_LABEL, type UserRole } from "@/contexts/AuthContext";

const FORM_VAZIO = { titulo: "", mensagem: "", papel: "all", enviarEmail: false };

interface UltimoEnvio {
  titulo: string;
  enviadas: number;
  papel: string;
  enviarEmail: boolean;
  emailsEnviados: number;
  emailsFalharam: number;
}

const AdminNotifications = () => {
  const [form, setForm] = useState(FORM_VAZIO);
  const [aEnviar, setAEnviar] = useState(false);
  const [ultimoEnvio, setUltimoEnvio] = useState<UltimoEnvio | null>(null);

  const enviar = async () => {
    if (!form.titulo || !form.mensagem) {
      toast.error("Título e mensagem obrigatórios.");
      return;
    }
    setAEnviar(true);
    try {
      const { enviadas, emails_enviados, emails_falharam } = await notificacoesApi.enviar(
        form.titulo,
        form.mensagem,
        form.papel === "all" ? null : form.papel,
        form.enviarEmail,
      );
      if (enviadas === 0) {
        toast.success("Enviada, mas não há ninguém com esse perfil ainda.");
      } else if (form.enviarEmail && emails_falharam > 0) {
        // Nunca esconder uma falha parcial atrás de um "sucesso" genérico
        // (CLAUDE.md, "nunca mostrar sucesso antes de verificar erro") --
        // as notificações no sino já foram todas criadas, mas o admin
        // precisa de saber que nem todos os emails saíram.
        toast.error(
          `Notificação enviada a ${enviadas} pessoa${enviadas === 1 ? "" : "s"}, mas ${emails_falharam} email${emails_falharam === 1 ? "" : "s"} falharam.`,
        );
      } else {
        toast.success(
          form.enviarEmail
            ? `Notificação enviada a ${enviadas} pessoa${enviadas === 1 ? "" : "s"}, com email para todos.`
            : `Notificação enviada a ${enviadas} pessoa${enviadas === 1 ? "" : "s"}.`,
        );
      }
      setUltimoEnvio({
        titulo: form.titulo,
        enviadas,
        papel: form.papel,
        enviarEmail: form.enviarEmail,
        emailsEnviados: emails_enviados,
        emailsFalharam: emails_falharam,
      });
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
          Cria uma notificação real na conta de cada destinatário: aparece no sino do site,
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
          <div className="flex items-center gap-2">
            <Checkbox
              id="notif-enviar-email"
              checked={form.enviarEmail}
              onCheckedChange={(v) => setForm({ ...form, enviarEmail: v === true })}
            />
            <Label htmlFor="notif-enviar-email" className="font-normal cursor-pointer">
              Enviar também por email
            </Label>
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
              {ultimoEnvio.enviarEmail && (
                <div className="text-xs text-muted-foreground mt-1">
                  Email: {ultimoEnvio.emailsEnviados} enviado{ultimoEnvio.emailsEnviados === 1 ? "" : "s"}
                  {ultimoEnvio.emailsFalharam > 0 &&
                    `, ${ultimoEnvio.emailsFalharam} ${ultimoEnvio.emailsFalharam === 1 ? "falhou" : "falharam"}`}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default AdminNotifications;
