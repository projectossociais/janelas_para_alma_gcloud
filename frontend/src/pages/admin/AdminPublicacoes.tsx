import { useEffect, useRef, useState, type FormEvent } from "react";
import { ConfirmarAccao } from "@/components/admin/ConfirmarAccao";
import { EstadoDadosAdmin } from "@/components/admin/DadosAdmin";
import { useDadosAdmin } from "@/components/admin/useDadosAdmin";
import { Aviso } from "@/design/componentes/Aviso";
import { Botao } from "@/design/componentes/Botao";
import { Campo, CampoTexto } from "@/design/componentes/Campo";
import { Dialogo, DialogoConteudo } from "@/design/componentes/Dialogo";
import { Estado } from "@/design/componentes/Tabela";
import { CabecalhoConsola } from "@/design/layouts/LayoutConsola";
import {
  publicacoesApi,
  mensagemDeErroApi,
  TIPOS_DE_MIDIA_ACEITES,
  type PublicacaoAdmin,
  type MidiaPublicacao,
} from "@/lib/apiClient";
import { toast } from "sonner";
import { Calendar, Eye, EyeOff, ImagePlus, MapPin, Pencil, Plus, Trash2 } from "lucide-react";

const FORM_VAZIO = { titulo: "", resumo: "", corpo: "", local: "", data_evento: "" };

type TipoMidiaAceite = (typeof TIPOS_DE_MIDIA_ACEITES)[number];

/**
 * "2026-10-08" -> "08/10/2026", sem passar por `new Date()`: um dia sem hora lia-se
 * como meia-noite UTC e, num computador a oeste de UTC, mostrava o dia anterior.
 */
const formatarDiaEvento = (dia: string) => {
  const [a, m, d] = dia.slice(0, 10).split("-");
  return d && m && a ? `${d}/${m}/${a}` : dia;
};

const erroCampos = (f: typeof FORM_VAZIO) => ({
  titulo: !f.titulo.trim() ? "Escreva um título." : undefined,
  resumo: !f.resumo.trim() ? "Escreva o resumo." : undefined,
  corpo: !f.corpo.trim() ? "Escreva o texto completo." : undefined,
});

function tipoAceite(ficheiro: File): ficheiro is File & { type: TipoMidiaAceite } {
  return (TIPOS_DE_MIDIA_ACEITES as readonly string[]).includes(ficheiro.type);
}

const AdminPublicacoes = () => {
  const { dados, erro, aCarregar, recarregar: carregar } = useDadosAdmin(
    () => publicacoesApi.listarTodas(),
    "Não foi possível carregar as publicações.",
    [],
  );
  const publicacoes = dados ?? [];
  const [form, setForm] = useState(FORM_VAZIO);
  const [tentou, setTentou] = useState(false);
  const [erroCriar, setErroCriar] = useState<string | null>(null);
  const [aCriar, setACriar] = useState(false);
  const [emEdicao, setEmEdicao] = useState<PublicacaoAdmin | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const erros: Partial<ReturnType<typeof erroCampos>> = tentou ? erroCampos(form) : {};

  const criar = async (e: FormEvent) => {
    e.preventDefault();
    setTentou(true);
    setErroCriar(null);
    if (Object.values(erroCampos(form)).some(Boolean)) return;
    setACriar(true);
    try {
      const nova = await publicacoesApi.criar({
        titulo: form.titulo,
        resumo: form.resumo,
        corpo: form.corpo,
        local: form.local || null,
        data_evento: form.data_evento || null,
      });
      toast.success("Publicação criada em rascunho. Adicione fotos e publique quando estiver pronta.");
      setForm(FORM_VAZIO);
      setTentou(false);
      await carregar();
      setEmEdicao(nova);
    } catch (err) {
      setErroCriar(mensagemDeErroApi(err, "Não foi possível criar a publicação."));
    } finally {
      setACriar(false);
    }
  };

  const alternarPublicacao = async (p: PublicacaoAdmin) => {
    setOcupado(p.id);
    try {
      if (p.estado === "publicada") {
        await publicacoesApi.despublicar(p.id);
        toast.success("Publicação despublicada. Deixou de estar visível no site.");
      } else {
        await publicacoesApi.publicar(p.id);
        toast.success("Publicação publicada. Já está visível no site.");
      }
      await carregar();
    } catch (err) {
      toast.error(mensagemDeErroApi(err, "Não foi possível actualizar o estado."));
    } finally {
      setOcupado(null);
    }
  };

  const apagar = async (id: string) => {
    try {
      await publicacoesApi.apagar(id);
      toast.success("Publicação apagada.");
      await carregar();
    } catch (err) {
      toast.error(mensagemDeErroApi(err, "Não foi possível apagar a publicação."));
    }
  };

  return (
    <>
      <CabecalhoConsola
        titulo="Publicações"
        descricao={'O que aparece como "Acções Recentes" no site. Nasce sempre em rascunho: só fica visível depois de "Publicar".'}
      />

      <form onSubmit={(e) => void criar(e)} noValidate className="max-w-3xl space-y-4 rounded-cartao border border-linha bg-superficie p-5">
        <h2 className="text-titulo-p text-tinta">Nova publicação</h2>
        <Campo
          rotulo="Título"
          value={form.titulo}
          erro={erros.titulo}
          placeholder="Campanha de Consciencialização sobre o Estrabismo"
          onChange={(e) => setForm({ ...form, titulo: e.target.value })}
        />
        <CampoTexto
          rotulo="Resumo (aparece na listagem)"
          rows={2}
          value={form.resumo}
          erro={erros.resumo}
          onChange={(e) => setForm({ ...form, resumo: e.target.value })}
        />
        <CampoTexto
          rotulo="Texto completo"
          rows={5}
          value={form.corpo}
          erro={erros.corpo}
          onChange={(e) => setForm({ ...form, corpo: e.target.value })}
        />
        <div className="grid gap-4 md:grid-cols-2">
          <Campo
            rotulo="Local (opcional)"
            placeholder="Gamek, Luanda"
            value={form.local}
            onChange={(e) => setForm({ ...form, local: e.target.value })}
          />
          <Campo
            rotulo="Data do evento (opcional)"
            type="date"
            value={form.data_evento}
            onChange={(e) => setForm({ ...form, data_evento: e.target.value })}
          />
        </div>
        {erroCriar && (
          <Aviso variante="erro" anunciar titulo="A publicação não foi criada">
            {erroCriar}
          </Aviso>
        )}
        <Botao type="submit" aCarregar={aCriar}>
          <Plus aria-hidden /> Criar rascunho
        </Botao>
      </form>

      <section aria-labelledby="publicacoes-lista" className="mt-8">
        <h2 id="publicacoes-lista" className="mb-3 text-titulo-p text-tinta">
          Publicações{dados ? ` (${publicacoes.length})` : ""}
        </h2>
        <EstadoDadosAdmin aCarregar={aCarregar} erro={erro} aoTentarDeNovo={() => void carregar()} temDados={!!dados}>
          {publicacoes.length ? (
            <ul className="divide-y divide-linha rounded-cartao border border-linha bg-superficie">
              {publicacoes.map((p) => (
                <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    {p.capa_url ? (
                      <img src={p.capa_url} alt="" className="size-14 shrink-0 rounded-controlo object-cover" />
                    ) : (
                      <span aria-hidden className="flex size-14 shrink-0 items-center justify-center rounded-controlo bg-superficie-alt text-tinta-suave">
                        <ImagePlus className="size-5" />
                      </span>
                    )}
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">{p.titulo}</span>
                        <Estado tom={p.estado === "publicada" ? "sucesso" : "neutro"}>
                          {p.estado === "publicada" ? "Publicada" : "Rascunho"}
                        </Estado>
                      </div>
                      <p className="mt-0.5 flex flex-wrap gap-x-3 gap-y-1 text-legenda text-tinta-suave">
                        {p.local && (
                          <span className="inline-flex items-center gap-1">
                            <MapPin className="size-3.5" aria-hidden />
                            {p.local}
                          </span>
                        )}
                        {p.data_evento && (
                          <span className="inline-flex items-center gap-1">
                            <Calendar className="size-3.5" aria-hidden />
                            {formatarDiaEvento(p.data_evento)}
                          </span>
                        )}
                        <span>
                          {p.midias.length} foto{p.midias.length === 1 ? "" : "s"}
                        </span>
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <Botao variante="secundario" onClick={() => setEmEdicao(p)}>
                      <Pencil aria-hidden /> Editar
                    </Botao>
                    <Botao
                      variante={p.estado === "publicada" ? "secundario" : "primario"}
                      aCarregar={ocupado === p.id}
                      onClick={() => void alternarPublicacao(p)}
                    >
                      {p.estado === "publicada" ? <EyeOff aria-hidden /> : <Eye aria-hidden />}
                      {p.estado === "publicada" ? "Despublicar" : "Publicar"}
                    </Botao>
                    <ConfirmarAccao
                      soIcone
                      icone={<Trash2 aria-hidden />}
                      rotulo={`Apagar publicação «${p.titulo}»`}
                      titulo={`Apagar «${p.titulo}»?`}
                      descricao="A publicação e todas as suas fotos saem do site. Não se pode desfazer."
                      confirmar="Apagar"
                      aoConfirmar={() => void apagar(p.id)}
                    />
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-tinta-suave">Nenhuma publicação ainda.</p>
          )}
        </EstadoDadosAdmin>
      </section>

      <EditorDialog publicacao={emEdicao} onClose={() => setEmEdicao(null)} onChanged={carregar} />
    </>
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
  const [tentou, setTentou] = useState(false);
  const [erroGravar, setErroGravar] = useState<string | null>(null);
  // O erro de uma imagem fica junto dela, no diálogo -- não num aviso que desaparece.
  const [erroImagem, setErroImagem] = useState<string | null>(null);
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

  const gravar = async (e: FormEvent) => {
    e.preventDefault();
    if (!publicacao) return;
    setTentou(true);
    setErroGravar(null);
    if (Object.values(erroCampos(form)).some(Boolean)) return;
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
      setErroGravar(mensagemDeErroApi(err, "Não foi possível guardar as alterações."));
    } finally {
      setAGravar(false);
    }
  };

  const enviarCapa = async (ficheiro: File) => {
    setErroImagem(null);
    if (!publicacao || !tipoAceite(ficheiro)) {
      setErroImagem("Formato não suportado. Use PNG, JPEG ou WebP.");
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
      setErroImagem(mensagemDeErroApi(err, "Não foi possível enviar a capa."));
    } finally {
      setAEnviarCapa(false);
    }
  };

  const enviarFoto = async (ficheiro: File) => {
    setErroImagem(null);
    if (!publicacao || !tipoAceite(ficheiro)) {
      setErroImagem("Formato não suportado. Use PNG, JPEG ou WebP.");
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
      setErroImagem(mensagemDeErroApi(err, "Não foi possível enviar a foto."));
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
      setErroImagem(mensagemDeErroApi(err, "Não foi possível remover a foto."));
    }
  };

  const erros: Partial<Record<"titulo" | "resumo" | "corpo", string>> = tentou ? erroCampos(form) : {};

  return (
    <Dialogo open={!!publicacao} onOpenChange={(open) => !open && onClose()}>
      <DialogoConteudo
        className="max-w-2xl"
        titulo="Editar publicação"
        descricao={
          publicacao?.estado === "publicada"
            ? "Já está visível no site. As alterações ficam visíveis assim que guardar."
            : 'Ainda em rascunho. Só fica visível no site depois de "Publicar".'
        }
        rotuloFechar="Fechar"
      >
        <form onSubmit={(e) => void gravar(e)} noValidate className="space-y-4">
          <Campo rotulo="Título" value={form.titulo} erro={erros.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} />
          <CampoTexto rotulo="Resumo" rows={2} value={form.resumo} erro={erros.resumo} onChange={(e) => setForm({ ...form, resumo: e.target.value })} />
          <CampoTexto rotulo="Texto completo" rows={6} value={form.corpo} erro={erros.corpo} onChange={(e) => setForm({ ...form, corpo: e.target.value })} />
          <div className="grid gap-4 md:grid-cols-2">
            <Campo rotulo="Local" value={form.local} onChange={(e) => setForm({ ...form, local: e.target.value })} />
            <Campo rotulo="Data do evento" type="date" value={form.data_evento} onChange={(e) => setForm({ ...form, data_evento: e.target.value })} />
          </div>
          {erroGravar && (
            <Aviso variante="erro" anunciar titulo="As alterações não foram guardadas">
              {erroGravar}
            </Aviso>
          )}
          <Botao type="submit" aCarregar={aGravar}>
            Guardar alterações
          </Botao>
        </form>

        <section aria-labelledby="editor-capa" className="mt-6 border-t border-linha pt-5">
          <h3 id="editor-capa" className="text-corpo font-medium text-tinta">
            Foto de capa
          </h3>
          <div className="mt-2 flex items-center gap-3">
            {/* `object-contain`: as capas são tipicamente paisagem; um quadrado forçado recortava-as. */}
            <div className="flex h-24 w-32 shrink-0 items-center justify-center overflow-hidden rounded-controlo bg-superficie-alt">
              {capaUrl ? (
                <img src={capaUrl} alt="Capa actual" className="size-full object-contain" />
              ) : (
                <ImagePlus className="size-6 text-tinta-suave" aria-hidden />
              )}
            </div>
            <input
              ref={capaInputRef}
              type="file"
              accept={TIPOS_DE_MIDIA_ACEITES.join(",")}
              className="hidden"
              aria-label="Carregar foto de capa"
              onChange={(e) => e.target.files?.[0] && void enviarCapa(e.target.files[0])}
            />
            <Botao variante="secundario" aCarregar={aEnviarCapa} onClick={() => capaInputRef.current?.click()}>
              <ImagePlus aria-hidden /> {capaUrl ? "Alterar capa" : "Adicionar capa"}
            </Botao>
          </div>
        </section>

        <section aria-labelledby="editor-galeria" className="mt-6 border-t border-linha pt-5">
          <h3 id="editor-galeria" className="text-corpo font-medium text-tinta">
            Galeria de fotos
          </h3>
          <ul className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-4">
            {midias.map((m, i) => (
              <li key={m.id} className="relative">
                <img src={m.url} alt={`Foto ${i + 1} da galeria`} className="aspect-square w-full rounded-controlo object-cover" />
                {/* Sempre visível: só ao passar o rato, não existia no telemóvel nem com teclado. */}
                <div className="absolute right-1 top-1 rounded-pilula bg-superficie/90">
                  <ConfirmarAccao
                    soIcone
                    icone={<Trash2 aria-hidden />}
                    rotulo={`Remover a foto ${i + 1} da galeria`}
                    titulo="Remover esta foto?"
                    descricao="Sai da galeria da publicação. Não se pode desfazer."
                    confirmar="Remover"
                    aoConfirmar={() => void removerFoto(m.id)}
                  />
                </div>
              </li>
            ))}
            <li>
              <input
                ref={fotoInputRef}
                type="file"
                accept={TIPOS_DE_MIDIA_ACEITES.join(",")}
                className="hidden"
                aria-label="Carregar foto para a galeria"
                onChange={(e) => e.target.files?.[0] && void enviarFoto(e.target.files[0])}
              />
              <button
                type="button"
                disabled={aEnviarFoto}
                aria-busy={aEnviarFoto || undefined}
                onClick={() => fotoInputRef.current?.click()}
                className="flex aspect-square w-full items-center justify-center rounded-controlo border-2 border-dashed border-linha-forte text-tinta-suave transition-colors duration-feedback hover:border-accao hover:text-accao focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foco disabled:opacity-60"
                aria-label="Adicionar foto à galeria"
              >
                <Plus className="size-5" aria-hidden />
              </button>
            </li>
          </ul>
        </section>

        {erroImagem && (
          <Aviso variante="erro" anunciar className="mt-4">
            {erroImagem}
          </Aviso>
        )}
      </DialogoConteudo>
    </Dialogo>
  );
};

export default AdminPublicacoes;
