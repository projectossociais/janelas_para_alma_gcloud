import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type NotificationRow = {
  id: string;
  title: string;
  body?: string | null;
  target_role?: string | null;
  created_at: string;
};

const AdminNotifications = () => {
  const [form, setForm] = useState({ title: "", body: "", link: "", target: "all" });
  const [recent, setRecent] = useState<NotificationRow[]>([]);

  const load = async () => {
    const { data } = await supabase.from("notifications").select("*").order("created_at", { ascending: false }).limit(20);
    setRecent((data ?? []) as unknown as NotificationRow[]);
  };
  useEffect(() => { load(); }, []);

  const send = async () => {
    if (!form.title) { toast.error("Título obrigatório."); return; }
    const payload: { title: string; body: string; link: string | null; target_role?: string } = {
      title: form.title,
      body: form.body,
      link: form.link || null,
    };
    if (form.target !== "all") payload.target_role = form.target;
    const { error } = await supabase.from("notifications").insert(payload);
    if (error) toast.error(error.message);
    else { toast.success("Notificação enviada."); setForm({ title: "", body: "", link: "", target: "all" }); load(); }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><CardTitle>Enviar notificação</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label>Destinatários</Label>
            <Select value={form.target} onValueChange={(v) => setForm({ ...form, target: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="comum">Pessoas comuns</SelectItem>
                <SelectItem value="estrabico">Pessoas com estrabismo</SelectItem>
                <SelectItem value="profissional">Profissionais de saúde</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Título</Label>
            <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </div>
          <div>
            <Label>Mensagem</Label>
            <Textarea value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} />
          </div>
          <div>
            <Label>Link (opcional)</Label>
            <Input value={form.link} onChange={(e) => setForm({ ...form, link: e.target.value })} placeholder="/exercicios" />
          </div>
          <Button onClick={send}><Send className="w-4 h-4" /> Enviar</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Últimas notificações</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {recent.map((n) => (
            <div key={n.id} className="border rounded-lg p-3">
              <div className="font-semibold">{n.title}</div>
              {n.body && <div className="text-sm text-muted-foreground">{n.body}</div>}
              <div className="text-xs text-muted-foreground mt-1">
                {n.target_role ? `Perfil: ${n.target_role}` : "Todos"} · {new Date(n.created_at).toLocaleString("pt-PT")}
              </div>
            </div>
          ))}
          {!recent.length && <p className="text-center text-muted-foreground py-6">Sem notificações.</p>}
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminNotifications;
