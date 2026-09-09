import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Trash2, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const COLORS = ["teal", "navy", "gold", "green", "red"];

const AdminBanners = () => {
  const [rows, setRows] = useState<any[]>([]);
  const [form, setForm] = useState({ title: "", message: "", link: "", color: "teal", active: true });

  const load = async () => {
    const { data } = await supabase.from("banners").select("*").order("created_at", { ascending: false });
    setRows(data ?? []);
  };
  useEffect(() => { load(); }, []);

  const create = async () => {
    if (!form.title || !form.message) { toast.error("Título e mensagem obrigatórios."); return; }
    const { error } = await supabase.from("banners").insert(form);
    if (error) toast.error(error.message);
    else { toast.success("Banner criado."); setForm({ title: "", message: "", link: "", color: "teal", active: true }); load(); }
  };

  const toggle = async (id: string, active: boolean) => {
    await supabase.from("banners").update({ active }).eq("id", id);
    load();
  };

  const remove = async (id: string) => {
    await supabase.from("banners").delete().eq("id", id);
    toast.success("Removido.");
    load();
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><CardTitle>Novo banner</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="grid md:grid-cols-2 gap-3">
            <div>
              <Label>Título</Label>
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </div>
            <div>
              <Label>Link (opcional)</Label>
              <Input value={form.link} onChange={(e) => setForm({ ...form, link: e.target.value })} placeholder="/apoiar" />
            </div>
          </div>
          <div>
            <Label>Mensagem</Label>
            <Textarea value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} />
          </div>
          <div className="flex items-center gap-4 flex-wrap">
            <div>
              <Label>Cor</Label>
              <div className="flex gap-2 mt-2">
                {COLORS.map((c) => (
                  <button key={c} type="button" onClick={() => setForm({ ...form, color: c })}
                    className={`w-8 h-8 rounded-full border-2 ${form.color === c ? "border-foreground" : "border-transparent"}`}
                    style={{ backgroundColor: `var(--${c}, ${c})` }} title={c} />
                ))}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={form.active} onCheckedChange={(v) => setForm({ ...form, active: v })} />
              <Label>Ativo</Label>
            </div>
          </div>
          <Button onClick={create}><Plus className="w-4 h-4" /> Criar banner</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Banners existentes</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {rows.map((b) => (
            <div key={b.id} className="flex items-center justify-between border rounded-lg p-3 gap-3 flex-wrap">
              <div className="min-w-0 flex-1">
                <div className="font-semibold flex items-center gap-2">
                  {b.title}
                  <Badge variant={b.active ? "default" : "secondary"}>{b.active ? "Ativo" : "Inativo"}</Badge>
                  <Badge variant="outline">{b.color}</Badge>
                </div>
                <div className="text-sm text-muted-foreground">{b.message}</div>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={b.active} onCheckedChange={(v) => toggle(b.id, v)} />
                <Button size="icon" variant="ghost" onClick={() => remove(b.id)}><Trash2 className="w-4 h-4" /></Button>
              </div>
            </div>
          ))}
          {!rows.length && <p className="text-center text-muted-foreground py-6">Nenhum banner ainda.</p>}
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminBanners;
