import { useEffect, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  publicacoesApi,
  mensagemDeErroApi,
  TIPOS_DE_MIDIA_ACEITES,
  type PublicacaoAdmin,
  type MidiaPublicacao,
} from "@/lib/apiClient";
import { toast } from "sonner";
import { Plus, Trash2, ImagePlus, Eye, EyeOff, Loader2, Calendar, MapPin } from "lucide-react";

const FORM_VAZIO = { titulo: "", resumo: "", corpo: "", local: "", data_evento: "" };

type TipoMidiaAceite = (typeof TIPOS_DE_MIDIA_ACEITES)[number];

function tipoAceite(ficheiro: File): ficheiro is File & { type: TipoMidiaAceite } {
  return (TIPOS_DE_MIDIA_ACEITES as readonly string[]).includes(ficheiro.type);
}

const AdminPublicacoes = () => {
  const [publicacoes, setPublicacoes] = useState<PublicacaoAdmin[]>([]);
  const [form, setForm] = useState(FORM_VAZIO);
  const [aCriar, setACriar] = useState(false);
  const [emEdicao, setEmEdicao] = useState<PublicacaoAdmin | null>(null);

  const carregar = async () => {
    try {
      setPublicacoes(await publicacoesApi.listarTodas());
    } catch (err) {
      toast.error(mensagemDeErroApi(err, "Não foi possível carregar as publicações."));
    }
  };
  useEffect(() => {
    carregar();
  }, []);

  const criar = async () => {
    if (!form.titulo || !form.resumo || !form.corpo) {
      toast.error("Título, resumo e texto completo são obrigatórios.");
      return;
    }
    setACriar(true);
    try {
      const nova = await publicacoesApi.criar({
        titulo: form.titulo,
        resumo: form.resumo,
        corpo: form.corpo,
        local: form.local || null,
        data_evento: form.data_evento || null,
      });
      toast.success("Publicação criada em rascunho — adicione fotos e publique quando estiver pronta.");
      setForm(FORM_VAZIO);
      await carregar();
      setEmEdicao(nova);
    } catch (err) {
      toast.error(mensagemDeErroApi(err, "Não foi possível criar a publicação."));
    } finally {
      setACriar(false);
    }
  };

  const alternarPublicacao = async (p: PublicacaoAdmin) => {
    try {
      if (p.estado === "publicada") {
        await publicacoesApi.despublicar(p.id);
        toast.success("Publicação despublicada — deixou de estar visível no site.");
      } else {
        await publicacoesApi.publicar(p.id);
        toast.success("Publicação publicada — já está visível no site.");
      }
      await carregar();
    } catch (err) {
      toast.error(mensagemDeErroApi(err, "Não foi possível actualizar o estado."));
    }
  };

  const apagar = async (id: string) => {
    if (!confirm("Apagar esta publicação e todas as suas fotos? Esta acção não pode ser desfeita.")) return;
    try {
      await publicacoesApi.apagar(id);
      toast.success("Publicação apagada.");
      await carregar();
    } catch (err) {
      toast.error(mensagemDeErroApi(err, "Não foi possível apagar a publicação."));
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Publicações & Mural de Actividades</h2>
        <p className="text-sm text-muted-foreground">
          O que aparece como "Ações Recentes" no site já não é escrito directamente em código —
          crie, adicione fotos e publique aqui. Nasce sempre em rascunho: só fica visível ao
          público depois de premir "Publicar".
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Nova publicação</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label htmlFor="pub-titulo">Título</Label>
            <Input
              id="pub-titulo"
              value={form.titulo}
              onChange={(e) => setForm({ ...form, titulo: e.target.value })}
              placeholder="Campanha de Conscientização sobre o Estrabismo"
            />
          </div>
          <div>
            <Label htmlFor="pub-resumo">Resumo (aparece na listagem)</Label>
            <Textarea
              id="pub-resumo"
              value={form.resumo}
              onChange={(e) => setForm({ ...form, resumo: e.target.value })}
              rows={2}
            />
          </div>
          <div>
            <Label htmlFor="pub-corpo">Texto completo</Label>
            <Textarea
              id="pub-corpo"
              value={form.corpo}
              onChange={(e) => setForm({ ...form, corpo: e.target.value })}
              rows={5}
            />
          </div>
          <div className="grid md:grid-cols-2 gap-3">
            <div>
              <Label htmlFor="pub-local">Local (opcional)</Label>
              <Input
                id="pub-local"
                value={form.local}
                onChange={(e) => setForm({ ...form, local: e.target.value })}
                placeholder="Gamek, Luanda"
              />
            </div>
            <div>
              <Label htmlFor="pub-data">Data do evento (opcional)</Label>
              <Input
                id="pub-data"
                type="date"
                value={form.data_evento}
                onChange={(e) => setForm({ ...form, data_evento: e.target.value })}
              />
            </div>
          </div>
          <Button onClick={criar} disabled={aCriar}>
            <Plus className="w-4 h-4" /> {aCriar ? "A criar..." : "Criar rascunho"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Publicações ({publicacoes.length})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {publicacoes.map((p) => (
            <div key={p.id} className="flex items-center justify-between border rounded-lg p-3 gap-3 flex-wrap">
              <div className="flex items-center gap-3 min-w-0 flex-1">
                {p.capa_url ? (
                  <img src={p.capa_url} alt="" className="w-14 h-14 rounded-lg object-cover shrink-0" />
                ) : (
                  <div className="w-14 h-14 rounded-lg bg-muted shrink-0 flex items-center justify-center">
                    <ImagePlus className="w-5 h-5 text-muted-foreground" />
                  </div>
                )}
                <div className="min-w-0">
                  <div className="font-semibold flex items-center gap-2 flex-wrap">
                    {p.titulo}
                    <Badge variant={p.estado === "publicada" ? "default" : "secondary"}>
                      {p.estado === "publicada" ? "Publicada" : "Rascunho"}
                    </Badge>
                  </div>
                  <div className="text-xs text-muted-foreground flex gap-3 flex-wrap mt-0.5">
                    {p.local && (
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        {p.local}
                      </span>
                    )}
                    {p.data_evento && (
                      <span className="inline-flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {new Date(p.data_evento).toLocaleDateString("pt-PT")}
                      </span>
                    )}
                    <span>
                      {p.midias.length} foto{p.midias.length === 1 ? "" : "s"}
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex gap-2 shrink-0">
                <Button size="sm" variant="outline" onClick={() => setEmEdicao(p)}>
                  Editar
                </Button>
                <Button
                  size="sm"
                  variant={p.estado === "publicada" ? "outline" : "default"}
                  onClick={() => alternarPublicacao(p)}
                >
                  {p.estado === "publicada" ? (
                    <>
                      <EyeOff className="w-3 h-3" /> Despublicar
                    </>
                  ) : (
                    <>
                      <Eye className="w-3 h-3" /> Publicar
                    </>
                  )}
                </Button>
                <Button size="icon" variant="ghost" aria-label="Apagar publicação" onClick={() => apagar(p.id)}>
                  <Trash2 className="w-4 h-4 text-destructive" />
                </Button>
              </div>
            </div>
          ))}
          {!publicacoes.length && (
            <p className="text-center text-muted-foreground py-6">Nenhuma publicação ainda.</p>
          )}
        </CardContent>
      </Card>

      <EditorDialog publicacao={emEdicao} onClose={() => setEmEdicao(null)} onChanged={carregar} />
    </div>
  );
};

interface EditorDialogProps {
  publicacao: PublicacaoAdmin | null;
  onClose: () => void;
  onChanged: () => Promise<void> | void;
}

const EditorDialog = ({ publicacao, onClose, onChanged }: EditorDialogProps) => {
  const [form, setForm] = useState(FORM_VAZIO);
  const [aGravar, setAGravar] = useState(false);
  const [aEnviarCapa, setAEnviarCapa] = useState(false);
  const [aEnviarFoto, setAEnviarFoto] = useState(false);
  const [capaUrl, setCapaUrl] = useState<string | null>(null);
  const [midias, setMidias] = useState<MidiaPublicacao[]>([]);
  const capaInputRef = useRef<HTMLInputElement>(null);
  const fotoInputRef = useRef<HTMLInputElement>(null);

  // Hidratar uma única vez por publicação aberta -- nunca a cada re-render,
  // senão apagava o que o admin estivesse a escrever (mesmo padrão de
  // EditarPerfil.tsx / Configuracoes.tsx, ver CLAUDE.md).
  const idHidratado = useRef<string | null>(null);
  useEffect(() => {
    if (!publicacao) {
      idHidratado.current = null;
      return;
    }
    if (idHidratado.current === publicacao.id) return;
    idHidratado.current = publicacao.id;
    setForm({
      titulo: publicacao.titulo,
      resumo: publicacao.resumo,
      corpo: publicacao.corpo,
      local: publicacao.local || "",
      data_evento: publicacao.data_evento || "",
    });
    setCapaUrl(publicacao.capa_url);
    setMidias(publicacao.midias);
  }, [publicacao]);

  const gravar = async () => {
    if (!publicacao) return;
    setAGravar(true);
    try {
      await publicacoesApi.atualizar(publicacao.id, {
        titulo: form.titulo,
        resumo: form.resumo,
        corpo: form.corpo,
        local: form.local || null,
        data_evento: form.data_evento || null,
      });
      toast.success("Alterações guardadas.");
      await onChanged();
    } catch (err) {
      toast.error(mensagemDeErroApi(err, "Não foi possível guardar as alterações."));
    } finally {
      setAGravar(false);
    }
  };

  const enviarCapa = async (ficheiro: File) => {
    if (!publicacao || !tipoAceite(ficheiro)) {
      toast.error("Formato não suportado — use PNG, JPEG ou WebP.");
      return;
    }
    setAEnviarCapa(true);
    try {
      const preparado = await publicacoesApi.prepararCapa(publicacao.id, ficheiro.type);
      await publicacoesApi.enviarParaStorage(preparado.url_de_upload, ficheiro);
      const { capa_url } = await publicacoesApi.confirmarCapa(publicacao.id, preparado.chave);
      setCapaUrl(capa_url);
      toast.success("Capa actualizada.");
      await onChanged();
    } catch (err) {
      toast.error(mensagemDeErroApi(err, "Não foi possível enviar a capa."));
    } finally {
      setAEnviarCapa(false);
    }
  };

  const enviarFoto = async (ficheiro: File) => {
    if (!publicacao || !tipoAceite(ficheiro)) {
      toast.error("Formato não suportado — use PNG, JPEG ou WebP.");
      return;
    }
    setAEnviarFoto(true);
    try {
      const preparado = await publicacoesApi.prepararMidia(publicacao.id, ficheiro.type);
      await publicacoesApi.enviarParaStorage(preparado.url_de_upload, ficheiro);
      const midia = await publicacoesApi.confirmarMidia(publicacao.id, preparado.chave);
      setMidias((atual) => [...atual, midia]);
      toast.success("Foto adicionada à galeria.");
      await onChanged();
    } catch (err) {
      toast.error(mensagemDeErroApi(err, "Não foi possível enviar a foto."));
    } finally {
      setAEnviarFoto(false);
    }
  };

  const removerFoto = async (midiaId: string) => {
    if (!publicacao) return;
    try {
      await publicacoesApi.removerMidia(publicacao.id, midiaId);
      setMidias((atual) => atual.filter((m) => m.id !== midiaId));
      toast.success("Foto removida.");
      await onChanged();
    } catch (err) {
      toast.error(mensagemDeErroApi(err, "Não foi possível remover a foto."));
    }
  };

  return (
    <Dialog open={!!publicacao} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar publicação</DialogTitle>
          <DialogDescription>
            {publicacao?.estado === "publicada"
              ? "Já está visível no site — as alterações ficam visíveis assim que guardar."
              : 'Ainda em rascunho — só fica visível no site depois de "Publicar".'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label htmlFor="edit-titulo">Título</Label>
            <Input id="edit-titulo" value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} />
          </div>
          <div>
            <Label htmlFor="edit-resumo">Resumo</Label>
            <Textarea
              id="edit-resumo"
              value={form.resumo}
              onChange={(e) => setForm({ ...form, resumo: e.target.value })}
              rows={2}
            />
          </div>
          <div>
            <Label htmlFor="edit-corpo">Texto completo</Label>
            <Textarea
              id="edit-corpo"
              value={form.corpo}
              onChange={(e) => setForm({ ...form, corpo: e.target.value })}
              rows={6}
            />
          </div>
          <div className="grid md:grid-cols-2 gap-3">
            <div>
              <Label htmlFor="edit-local">Local</Label>
              <Input id="edit-local" value={form.local} onChange={(e) => setForm({ ...form, local: e.target.value })} />
            </div>
            <div>
              <Label htmlFor="edit-data">Data do evento</Label>
              <Input
                id="edit-data"
                type="date"
                value={form.data_evento}
                onChange={(e) => setForm({ ...form, data_evento: e.target.value })}
              />
            </div>
          </div>
          <Button onClick={gravar} disabled={aGravar}>
            {aGravar ? "A guardar..." : "Guardar alterações"}
          </Button>

          <div className="border-t pt-4">
            <Label>Foto de capa</Label>
            <div className="flex items-center gap-3 mt-2">
              {capaUrl ? (
                <img src={capaUrl} alt="Capa" className="w-24 h-24 rounded-lg object-cover" />
              ) : (
                <div className="w-24 h-24 rounded-lg bg-muted flex items-center justify-center">
                  <ImagePlus className="w-6 h-6 text-muted-foreground" />
                </div>
              )}
              <input
                ref={capaInputRef}
                type="file"
                accept={TIPOS_DE_MIDIA_ACEITES.join(",")}
                className="hidden"
                aria-label="Carregar foto de capa"
                onChange={(e) => e.target.files?.[0] && enviarCapa(e.target.files[0])}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={aEnviarCapa}
                onClick={() => capaInputRef.current?.click()}
              >
                {aEnviarCapa ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImagePlus className="w-4 h-4" />}
                {aEnviarCapa ? "A enviar..." : "Alterar capa"}
              </Button>
            </div>
          </div>

          <div className="border-t pt-4">
            <Label>Galeria de fotos</Label>
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 mt-2">
              {midias.map((m) => (
                <div key={m.id} className="relative group">
                  <img src={m.url} alt="" className="w-full aspect-square rounded-lg object-cover" />
                  <button
                    type="button"
                    onClick={() => removerFoto(m.id)}
                    className="absolute top-1 right-1 bg-black/60 rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                    aria-label="Remover foto"
                  >
                    <Trash2 className="w-3 h-3 text-white" />
                  </button>
                </div>
              ))}
              <input
                ref={fotoInputRef}
                type="file"
                accept={TIPOS_DE_MIDIA_ACEITES.join(",")}
                className="hidden"
                aria-label="Carregar foto para a galeria"
                onChange={(e) => e.target.files?.[0] && enviarFoto(e.target.files[0])}
              />
              <button
                type="button"
                disabled={aEnviarFoto}
                onClick={() => fotoInputRef.current?.click()}
                className="w-full aspect-square rounded-lg border-2 border-dashed flex items-center justify-center text-muted-foreground hover:border-primary hover:text-primary transition-colors"
                aria-label="Adicionar foto à galeria"
              >
                {aEnviarFoto ? <Loader2 className="w-5 h-5 animate-spin" /> : <Plus className="w-5 h-5" />}
              </button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AdminPublicacoes;
