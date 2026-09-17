import { useEffect, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Trash2, Plus, ImagePlus } from "lucide-react";
import {
  bannersApi,
  bannerHomepageApi,
  mensagemDeErroApi,
  TIPOS_DE_MIDIA_ACEITES,
  type BannerAdmin,
  type BannerHomepageAdmin,
} from "@/lib/apiClient";
import { toast } from "sonner";

const tipoAceite = (ficheiro: File) => (TIPOS_DE_MIDIA_ACEITES as readonly string[]).includes(ficheiro.type);

const AdminBanners = () => (
  <Tabs defaultValue="faixa" className="space-y-6">
    <TabsList>
      <TabsTrigger value="faixa">Faixa de aviso</TabsTrigger>
      <TabsTrigger value="homepage">Banner da homepage</TabsTrigger>
    </TabsList>
    <TabsContent value="faixa">
      <FaixaDeAviso />
    </TabsContent>
    <TabsContent value="homepage">
      <BannerHomepage />
    </TabsContent>
  </Tabs>
);

// --- Faixa de aviso (texto, topo de todas as páginas) -----------------------
// Comportamento inalterado — só mudou de sítio para dentro de uma aba.

const FaixaDeAviso = () => {
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
          <CardTitle>Nova faixa de aviso</CardTitle>
          <CardDescription>Barra fina, no topo de todas as páginas do site — só texto.</CardDescription>
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
          <CardTitle>Faixas existentes</CardTitle>
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
          {!rows.length && <p className="text-center text-muted-foreground py-6">Nenhuma faixa ainda.</p>}
        </CardContent>
      </Card>
    </div>
  );
};

// --- Banner-imagem da homepage -----------------------------------------------
// Entidade distinta da faixa de aviso -- secção visual só na homepage, com
// foto. Nasce sem imagem; a foto é sempre um upload em dois passos à parte
// (mesmo fluxo da capa de Publicações), nunca um campo de URL manual.

const BannerHomepage = () => {
  const [rows, setRows] = useState<BannerHomepageAdmin[]>([]);
  const [form, setForm] = useState({ titulo: "", descricao: "", link: "" });
  const [aGravar, setAGravar] = useState(false);
  const [aEnviarImagem, setAEnviarImagem] = useState<string | null>(null);
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const load = async () => {
    try {
      setRows(await bannerHomepageApi.listar());
    } catch (err) {
      toast.error(mensagemDeErroApi(err, "Não foi possível carregar os banners da homepage."));
    }
  };
  useEffect(() => {
    load();
  }, []);

  const create = async () => {
    if (!form.titulo) {
      toast.error("Título obrigatório.");
      return;
    }
    setAGravar(true);
    try {
      await bannerHomepageApi.criar({
        titulo: form.titulo,
        descricao: form.descricao || null,
        link: form.link || null,
      });
      toast.success("Banner criado — agora adicione uma foto para poder ativá-lo.");
      setForm({ titulo: "", descricao: "", link: "" });
      await load();
    } catch (err) {
      toast.error(mensagemDeErroApi(err, "Não foi possível criar o banner."));
    } finally {
      setAGravar(false);
    }
  };

  const toggle = async (b: BannerHomepageAdmin, ativo: boolean) => {
    if (ativo && !b.imagem_url) {
      toast.error("Adicione uma foto antes de ativar este banner.");
      return;
    }
    try {
      await bannerHomepageApi.atualizar(b.id, { ativo });
      await load();
    } catch (err) {
      toast.error(mensagemDeErroApi(err, "Não foi possível actualizar o banner."));
    }
  };

  const remove = async (id: string) => {
    try {
      await bannerHomepageApi.remover(id);
      toast.success("Removido.");
      await load();
    } catch (err) {
      toast.error(mensagemDeErroApi(err, "Não foi possível remover o banner."));
    }
  };

  const enviarImagem = async (bannerId: string, ficheiro: File) => {
    if (!tipoAceite(ficheiro)) {
      toast.error("Formato não suportado — use PNG, JPEG ou WebP.");
      return;
    }
    setAEnviarImagem(bannerId);
    try {
      const preparado = await bannerHomepageApi.prepararImagem(bannerId, ficheiro.type);
      await bannerHomepageApi.enviarParaStorage(preparado.url_de_upload, ficheiro);
      await bannerHomepageApi.confirmarImagem(bannerId, preparado.chave);
      toast.success("Foto atualizada.");
      await load();
    } catch (err) {
      toast.error(mensagemDeErroApi(err, "Não foi possível enviar a foto."));
    } finally {
      setAEnviarImagem(null);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Novo banner da homepage</CardTitle>
          <CardDescription>
            Secção visual, só na página inicial — para campanhas e promoções. Nasce inativo; a foto
            adiciona-se a seguir, e só pode ativar-se depois de ter uma.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid md:grid-cols-2 gap-3">
            <div>
              <Label htmlFor="bh-titulo">Título</Label>
              <Input
                id="bh-titulo"
                value={form.titulo}
                onChange={(e) => setForm({ ...form, titulo: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="bh-link">Link (opcional)</Label>
              <Input
                id="bh-link"
                value={form.link}
                onChange={(e) => setForm({ ...form, link: e.target.value })}
                placeholder="/apoiar"
              />
            </div>
          </div>
          <div>
            <Label htmlFor="bh-descricao">Descrição (opcional)</Label>
            <Textarea
              id="bh-descricao"
              value={form.descricao}
              onChange={(e) => setForm({ ...form, descricao: e.target.value })}
            />
          </div>
          <Button onClick={create} disabled={aGravar}>
            <Plus className="w-4 h-4" /> {aGravar ? "A criar..." : "Criar banner"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Banners da homepage existentes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {rows.map((b) => (
            <div key={b.id} className="flex items-center justify-between border rounded-lg p-3 gap-3 flex-wrap">
              <div className="flex items-center gap-3 min-w-0 flex-1">
                {b.imagem_url ? (
                  <img src={b.imagem_url} alt="" className="w-16 h-16 rounded-lg object-cover shrink-0" />
                ) : (
                  <div className="w-16 h-16 rounded-lg bg-muted flex items-center justify-center shrink-0">
                    <ImagePlus className="w-5 h-5 text-muted-foreground" />
                  </div>
                )}
                <div className="min-w-0">
                  <div className="font-semibold flex items-center gap-2">
                    {b.titulo}
                    <Badge variant={b.ativo ? "default" : "secondary"}>{b.ativo ? "Ativo" : "Inativo"}</Badge>
                  </div>
                  {b.descricao && <div className="text-sm text-muted-foreground truncate">{b.descricao}</div>}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <input
                  ref={(el) => (inputRefs.current[b.id] = el)}
                  type="file"
                  accept={TIPOS_DE_MIDIA_ACEITES.join(",")}
                  className="hidden"
                  aria-label={`Carregar foto para ${b.titulo}`}
                  onChange={(e) => e.target.files?.[0] && enviarImagem(b.id, e.target.files[0])}
                />
                <Button
                  size="sm"
                  variant="outline"
                  disabled={aEnviarImagem === b.id}
                  onClick={() => inputRefs.current[b.id]?.click()}
                >
                  <ImagePlus className="w-4 h-4" />
                  {aEnviarImagem === b.id ? "A enviar..." : b.imagem_url ? "Trocar foto" : "Adicionar foto"}
                </Button>
                <Switch checked={b.ativo} onCheckedChange={(v) => toggle(b, v)} />
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
