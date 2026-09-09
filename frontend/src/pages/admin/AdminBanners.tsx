import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Trash2, Plus } from "lucide-react";
import { bannersApi, mensagemDeErroApi, type BannerAdmin } from "@/lib/apiClient";
import { toast } from "sonner";

const AdminBanners = () => {
  const [rows, setRows] = useState<BannerAdmin[]>([]);
  const [form, setForm] = useState({ titulo: "", mensagem: "", link: "", ativo: true });
  const [aGravar, setAGravar] = useState(false);

  const load = async () => {
    try {
      setRows(await bannersApi.listar());
    } catch (err) {
      toast.error(mensagemDeErroApi(err, "Não foi possível carregar os banners."));
    }
  };
  useEffect(() => {
    load();
  }, []);

  const create = async () => {
    if (!form.titulo || !form.mensagem) {
      toast.error("Título e mensagem obrigatórios.");
      return;
    }
    setAGravar(true);
    try {
      await bannersApi.criar({
        titulo: form.titulo,
        mensagem: form.mensagem,
        link: form.link || null,
        ativo: form.ativo,
      });
      toast.success("Banner criado.");
      setForm({ titulo: "", mensagem: "", link: "", ativo: true });
      await load();
    } catch (err) {
      toast.error(mensagemDeErroApi(err, "Não foi possível criar o banner."));
    } finally {
      setAGravar(false);
    }
  };

  const toggle = async (id: string, ativo: boolean) => {
    try {
      await bannersApi.atualizar(id, { ativo });
      await load();
    } catch (err) {
      toast.error(mensagemDeErroApi(err, "Não foi possível actualizar o banner."));
    }
  };

  const remove = async (id: string) => {
    try {
      await bannersApi.remover(id);
      toast.success("Removido.");
      await load();
    } catch (err) {
      toast.error(mensagemDeErroApi(err, "Não foi possível remover o banner."));
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Novo banner</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid md:grid-cols-2 gap-3">
            <div>
              <Label htmlFor="banner-titulo">Título</Label>
              <Input
                id="banner-titulo"
                value={form.titulo}
                onChange={(e) => setForm({ ...form, titulo: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="banner-link">Link (opcional)</Label>
              <Input
                id="banner-link"
                value={form.link}
                onChange={(e) => setForm({ ...form, link: e.target.value })}
                placeholder="/apoiar"
              />
            </div>
          </div>
          <div>
            <Label htmlFor="banner-mensagem">Mensagem</Label>
            <Textarea
              id="banner-mensagem"
              value={form.mensagem}
              onChange={(e) => setForm({ ...form, mensagem: e.target.value })}
            />
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={form.ativo} onCheckedChange={(v) => setForm({ ...form, ativo: v })} />
            <Label>Ativo</Label>
          </div>
          <Button onClick={create} disabled={aGravar}>
            <Plus className="w-4 h-4" /> {aGravar ? "A criar..." : "Criar banner"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Banners existentes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {rows.map((b) => (
            <div key={b.id} className="flex items-center justify-between border rounded-lg p-3 gap-3 flex-wrap">
              <div className="min-w-0 flex-1">
                <div className="font-semibold flex items-center gap-2">
                  {b.titulo}
                  <Badge variant={b.ativo ? "default" : "secondary"}>{b.ativo ? "Ativo" : "Inativo"}</Badge>
                </div>
                <div className="text-sm text-muted-foreground">{b.mensagem}</div>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={b.ativo} onCheckedChange={(v) => toggle(b.id, v)} />
                <Button size="icon" variant="ghost" onClick={() => remove(b.id)}>
                  <Trash2 className="w-4 h-4" />
                </Button>
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
