import { useRef, useState, type FormEvent, type ReactNode } from "react";
import { ImagePlus, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { ConfirmarAccao } from "@/components/admin/ConfirmarAccao";
import { EstadoDadosAdmin, useDadosAdmin } from "@/components/admin/DadosAdmin";
import { Aviso } from "@/design/componentes/Aviso";
import { Botao } from "@/design/componentes/Botao";
import { Campo, CampoTexto } from "@/design/componentes/Campo";
import { Dialogo, DialogoConteudo, DialogoFechar } from "@/design/componentes/Dialogo";
import { GrupoEscolha } from "@/design/componentes/Escolha";
import { OpcaoConfirmar } from "@/design/componentes/OpcaoConfirmar";
import { Estado } from "@/design/componentes/Tabela";
import { CabecalhoConsola } from "@/design/layouts/LayoutConsola";
import {
  bannersApi,
  bannerHomepageApi,
  mensagemDeErroApi,
  TIPOS_DE_MIDIA_ACEITES,
  type BannerAdmin,
  type BannerHomepageAdmin,
} from "@/lib/apiClient";

const tipoAceite = (ficheiro: File) => (TIPOS_DE_MIDIA_ACEITES as readonly string[]).includes(ficheiro.type);

type Vista = "faixa" | "homepage";

/**
 * Banners: a faixa de aviso (texto, no topo de todas as páginas) e o banner da
 * página inicial (com foto). São entidades distintas na API; aqui partilham as
 * peças (formulário, linha, edição).
 */
const AdminBanners = () => {
  const [vista, setVista] = useState<Vista>("faixa");
  return (
    <>
      <CabecalhoConsola titulo="Banners" descricao="Avisos e campanhas que aparecem no site." />
      <GrupoEscolha<Vista>
        legenda="Mostrar"
        legendaOculta
        aparencia="pastilha"
        valor={vista}
        aoMudar={setVista}
        className="mb-6"
        opcoes={[
          { valor: "faixa", rotulo: "Faixa de aviso" },
          { valor: "homepage", rotulo: "Banner da homepage" },
        ]}
      />
      {vista === "faixa" ? <FaixaDeAviso /> : <BannerHomepage />}
    </>
  );
};

// --- Peças comuns ------------------------------------------------------------

const Seccao = ({ titulo, descricao, children }: { titulo: string; descricao?: string; children: ReactNode }) => (
  <section className="rounded-cartao border border-linha bg-superficie p-5">
    <h2 className="text-titulo-p text-tinta">{titulo}</h2>
    {descricao && <p className="mt-1 text-corpo text-tinta-suave">{descricao}</p>}
    <div className="mt-4">{children}</div>
  </section>
);

interface CamposBanner {
  titulo: string;
  texto: string;
  link: string;
}

/** Título, texto (mensagem ou descrição) e link -- igual a criar e a editar. */
const Campos = ({
  valores,
  aoMudar,
  rotuloTexto,
  textoObrigatorio,
  tentou,
}: {
  valores: CamposBanner;
  aoMudar: (v: CamposBanner) => void;
  rotuloTexto: string;
  textoObrigatorio: boolean;
  tentou: boolean;
}) => (
  <div className="space-y-4">
    <div className="grid gap-4 md:grid-cols-2">
      <Campo
        rotulo="Título"
        value={valores.titulo}
        erro={tentou && !valores.titulo.trim() ? "Escreva um título." : undefined}
        onChange={(e) => aoMudar({ ...valores, titulo: e.target.value })}
      />
      <Campo
        rotulo="Link (opcional)"
        placeholder="/apoiar"
        value={valores.link}
        onChange={(e) => aoMudar({ ...valores, link: e.target.value })}
      />
    </div>
    <CampoTexto
      rotulo={rotuloTexto}
      value={valores.texto}
      erro={tentou && textoObrigatorio && !valores.texto.trim() ? "Escreva a mensagem." : undefined}
      onChange={(e) => aoMudar({ ...valores, texto: e.target.value })}
    />
  </div>
);

const valido = (v: CamposBanner, textoObrigatorio: boolean) => !!v.titulo.trim() && (!textoObrigatorio || !!v.texto.trim());

/** Editar um banner num diálogo; o erro fica no diálogo, com o que se escreveu. */
const DialogoEdicao = ({
  aberto,
  aoFechar,
  titulo,
  descricao,
  valoresIniciais,
  rotuloTexto,
  textoObrigatorio,
  aoGuardar,
}: {
  aberto: boolean;
  aoFechar: () => void;
  titulo: string;
  descricao: string;
  valoresIniciais: CamposBanner;
  rotuloTexto: string;
  textoObrigatorio: boolean;
  aoGuardar: (v: CamposBanner) => Promise<void>;
}) => {
  const [valores, setValores] = useState(valoresIniciais);
  const [tentou, setTentou] = useState(false);
  const [aGuardar, setAGuardar] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const guardar = async (e: FormEvent) => {
    e.preventDefault();
    setTentou(true);
    setErro(null);
    if (!valido(valores, textoObrigatorio)) return;
    setAGuardar(true);
    try {
      await aoGuardar(valores);
    } catch (err) {
      setErro(mensagemDeErroApi(err, "Não foi possível guardar as alterações."));
    } finally {
      setAGuardar(false);
    }
  };

  return (
    <Dialogo open={aberto} onOpenChange={(open) => !open && aoFechar()}>
      <DialogoConteudo titulo={titulo} descricao={descricao} rotuloFechar="Fechar">
        <form onSubmit={(e) => void guardar(e)} noValidate className="space-y-4">
          <Campos valores={valores} aoMudar={setValores} rotuloTexto={rotuloTexto} textoObrigatorio={textoObrigatorio} tentou={tentou} />
          {erro && (
            <Aviso variante="erro" anunciar titulo="As alterações não foram guardadas">
              {erro}
            </Aviso>
          )}
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <DialogoFechar asChild>
              <Botao variante="secundario">Cancelar</Botao>
            </DialogoFechar>
            <Botao type="submit" aCarregar={aGuardar}>
              Guardar alterações
            </Botao>
          </div>
        </form>
      </DialogoConteudo>
    </Dialogo>
  );
};

/** Uma linha da lista: o banner, o estado, e as acções com nome (nada de interruptores sem rótulo). */
const LinhaBanner = ({
  titulo,
  texto,
  ativo,
  imagem,
  accoesExtra,
  aoAlternar,
  aoEditar,
  aoRemover,
  ocupado,
}: {
  titulo: string;
  texto: string | null;
  ativo: boolean;
  imagem?: ReactNode;
  accoesExtra?: ReactNode;
  aoAlternar: () => void;
  aoEditar: () => void;
  aoRemover: () => void;
  ocupado: boolean;
}) => (
  <li className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
    <div className="flex min-w-0 flex-1 items-center gap-3">
      {imagem}
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium">{titulo}</span>
          <Estado tom={ativo ? "sucesso" : "neutro"}>{ativo ? "Activo" : "Inactivo"}</Estado>
        </div>
        {texto && <p className="truncate text-legenda text-tinta-suave">{texto}</p>}
      </div>
    </div>
    <div className="flex shrink-0 flex-wrap items-center gap-1">
      {accoesExtra}
      <Botao variante="secundario" aCarregar={ocupado} onClick={aoAlternar} aria-label={`${ativo ? "Desactivar" : "Activar"} ${titulo}`}>
        {ativo ? "Desactivar" : "Activar"}
      </Botao>
      <Botao variante="fantasma" className="min-w-alvo-app px-2" onClick={aoEditar} aria-label={`Editar ${titulo}`}>
        <Pencil aria-hidden />
      </Botao>
      <ConfirmarAccao
        soIcone
        icone={<Trash2 aria-hidden />}
        rotulo={`Remover ${titulo}`}
        titulo={`Remover «${titulo}»?`}
        descricao="Sai do site e da lista. Não se pode desfazer."
        confirmar="Remover"
        aoConfirmar={aoRemover}
      />
    </div>
  </li>
);

// --- Faixa de aviso (texto, topo de todas as páginas) -----------------------

const FAIXA_VAZIA = { titulo: "", texto: "", link: "" };

const FaixaDeAviso = () => {
  const { dados, erro, aCarregar, recarregar } = useDadosAdmin(() => bannersApi.listar(), "Não foi possível carregar os banners.", []);
  const [form, setForm] = useState(FAIXA_VAZIA);
  const [ativo, setAtivo] = useState(true);
  const [tentou, setTentou] = useState(false);
  const [aGravar, setAGravar] = useState(false);
  const [erroCriar, setErroCriar] = useState<string | null>(null);
  const [aEditar, setAEditar] = useState<BannerAdmin | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);

  const criar = async (e: FormEvent) => {
    e.preventDefault();
    setTentou(true);
    setErroCriar(null);
    if (!valido(form, true)) return;
    setAGravar(true);
    try {
      await bannersApi.criar({ titulo: form.titulo, mensagem: form.texto, link: form.link || null, ativo });
      toast.success("Banner criado.");
      setForm(FAIXA_VAZIA);
      setAtivo(true);
      setTentou(false);
      await recarregar();
    } catch (err) {
      setErroCriar(mensagemDeErroApi(err, "Não foi possível criar o banner."));
    } finally {
      setAGravar(false);
    }
  };

  const alternar = async (b: BannerAdmin) => {
    setOcupado(b.id);
    try {
      await bannersApi.atualizar(b.id, { ativo: !b.ativo });
      await recarregar();
    } catch (err) {
      toast.error(mensagemDeErroApi(err, "Não foi possível actualizar o banner."));
    } finally {
      setOcupado(null);
    }
  };

  const remover = async (id: string) => {
    try {
      await bannersApi.remover(id);
      toast.success("Removido.");
      await recarregar();
    } catch (err) {
      toast.error(mensagemDeErroApi(err, "Não foi possível remover o banner."));
    }
  };

  return (
    <div className="space-y-6">
      <Seccao titulo="Nova faixa de aviso" descricao="Barra fina, no topo de todas as páginas do site, só com texto.">
        <form onSubmit={(e) => void criar(e)} noValidate className="max-w-3xl space-y-4">
          <Campos valores={form} aoMudar={setForm} rotuloTexto="Mensagem" textoObrigatorio tentou={tentou} />
          <OpcaoConfirmar rotulo="Activa logo" descricao="Aparece no site assim que for criada." marcada={ativo} aoMudar={setAtivo} />
          {erroCriar && (
            <Aviso variante="erro" anunciar titulo="O banner não foi criado">
              {erroCriar}
            </Aviso>
          )}
          <Botao type="submit" aCarregar={aGravar}>
            <Plus aria-hidden /> Criar banner
          </Botao>
        </form>
      </Seccao>

      <Seccao titulo="Faixas existentes">
        <EstadoDadosAdmin aCarregar={aCarregar} erro={erro} aoTentarDeNovo={() => void recarregar()} temDados={!!dados}>
          {dados?.length ? (
            <ul className="divide-y divide-linha rounded-controlo border border-linha">
              {dados.map((b) => (
                <LinhaBanner
                  key={b.id}
                  titulo={b.titulo}
                  texto={b.mensagem}
                  ativo={b.ativo}
                  ocupado={ocupado === b.id}
                  aoAlternar={() => void alternar(b)}
                  aoEditar={() => setAEditar(b)}
                  aoRemover={() => void remover(b.id)}
                />
              ))}
            </ul>
          ) : (
            <p className="text-tinta-suave">Nenhuma faixa ainda.</p>
          )}
        </EstadoDadosAdmin>
      </Seccao>

      {aEditar && (
        <DialogoEdicao
          key={aEditar.id}
          aberto
          aoFechar={() => setAEditar(null)}
          titulo="Editar faixa de aviso"
          descricao="As alterações ficam visíveis no site assim que guardar."
          valoresIniciais={{ titulo: aEditar.titulo, texto: aEditar.mensagem, link: aEditar.link ?? "" }}
          rotuloTexto="Mensagem"
          textoObrigatorio
          aoGuardar={async (v) => {
            await bannersApi.atualizar(aEditar.id, { titulo: v.titulo, mensagem: v.texto, link: v.link || null });
            toast.success("Banner actualizado.");
            setAEditar(null);
            await recarregar();
          }}
        />
      )}
    </div>
  );
};

// --- Banner-imagem da homepage -----------------------------------------------
// Entidade distinta da faixa de aviso -- secção visual só na homepage, com
// foto. Nasce sem imagem; a foto é sempre um upload em dois passos à parte
// (mesmo fluxo da capa de Publicações), nunca um campo de URL manual.

const BannerHomepage = () => {
  const { dados, erro, aCarregar, recarregar } = useDadosAdmin(
    () => bannerHomepageApi.listar(),
    "Não foi possível carregar os banners da homepage.",
    [],
  );
  const [form, setForm] = useState(FAIXA_VAZIA);
  const [tentou, setTentou] = useState(false);
  const [aGravar, setAGravar] = useState(false);
  const [erroCriar, setErroCriar] = useState<string | null>(null);
  const [aEnviarImagem, setAEnviarImagem] = useState<string | null>(null);
  const entradas = useRef<Record<string, HTMLInputElement | null>>({});
  const [aEditar, setAEditar] = useState<BannerHomepageAdmin | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);

  const criar = async (e: FormEvent) => {
    e.preventDefault();
    setTentou(true);
    setErroCriar(null);
    if (!valido(form, false)) return;
    setAGravar(true);
    try {
      await bannerHomepageApi.criar({ titulo: form.titulo, descricao: form.texto || null, link: form.link || null });
      toast.success("Banner criado. Agora adicione uma foto para poder activá-lo.");
      setForm(FAIXA_VAZIA);
      setTentou(false);
      await recarregar();
    } catch (err) {
      setErroCriar(mensagemDeErroApi(err, "Não foi possível criar o banner."));
    } finally {
      setAGravar(false);
    }
  };

  const alternar = async (b: BannerHomepageAdmin) => {
    if (!b.ativo && !b.imagem_url) {
      toast.error("Adicione uma foto antes de activar este banner.");
      return;
    }
    setOcupado(b.id);
    try {
      await bannerHomepageApi.atualizar(b.id, { ativo: !b.ativo });
      await recarregar();
    } catch (err) {
      toast.error(mensagemDeErroApi(err, "Não foi possível actualizar o banner."));
    } finally {
      setOcupado(null);
    }
  };

  const remover = async (id: string) => {
    try {
      await bannerHomepageApi.remover(id);
      toast.success("Removido.");
      await recarregar();
    } catch (err) {
      toast.error(mensagemDeErroApi(err, "Não foi possível remover o banner."));
    }
  };

  const enviarImagem = async (bannerId: string, ficheiro: File) => {
    if (!tipoAceite(ficheiro)) {
      toast.error("Formato não suportado. Use PNG, JPEG ou WebP.");
      return;
    }
    setAEnviarImagem(bannerId);
    try {
      const preparado = await bannerHomepageApi.prepararImagem(bannerId, ficheiro.type);
      await bannerHomepageApi.enviarParaStorage(preparado.url_de_upload, ficheiro);
      await bannerHomepageApi.confirmarImagem(bannerId, preparado.chave);
      toast.success("Foto actualizada.");
      await recarregar();
    } catch (err) {
      toast.error(mensagemDeErroApi(err, "Não foi possível enviar a foto."));
    } finally {
      setAEnviarImagem(null);
    }
  };

  return (
    <div className="space-y-6">
      <Seccao
        titulo="Novo banner da homepage"
        descricao="Secção visual, só na página inicial, para campanhas e promoções. Nasce inactivo; a foto adiciona-se a seguir, e só pode activar-se depois de ter uma."
      >
        <form onSubmit={(e) => void criar(e)} noValidate className="max-w-3xl space-y-4">
          <Campos valores={form} aoMudar={setForm} rotuloTexto="Descrição (opcional)" textoObrigatorio={false} tentou={tentou} />
          {erroCriar && (
            <Aviso variante="erro" anunciar titulo="O banner não foi criado">
              {erroCriar}
            </Aviso>
          )}
          <Botao type="submit" aCarregar={aGravar}>
            <Plus aria-hidden /> Criar banner
          </Botao>
        </form>
      </Seccao>

      <Seccao titulo="Banners da homepage existentes">
        <EstadoDadosAdmin aCarregar={aCarregar} erro={erro} aoTentarDeNovo={() => void recarregar()} temDados={!!dados}>
          {dados?.length ? (
            <ul className="divide-y divide-linha rounded-controlo border border-linha">
              {dados.map((b) => (
                <LinhaBanner
                  key={b.id}
                  titulo={b.titulo}
                  texto={b.descricao}
                  ativo={b.ativo}
                  ocupado={ocupado === b.id}
                  imagem={
                    b.imagem_url ? (
                      <img src={b.imagem_url} alt="" className="size-16 shrink-0 rounded-controlo object-cover" />
                    ) : (
                      <span aria-hidden className="flex size-16 shrink-0 items-center justify-center rounded-controlo bg-superficie-alt text-tinta-suave">
                        <ImagePlus className="size-5" />
                      </span>
                    )
                  }
                  accoesExtra={
                    <>
                      <input
                        ref={(el) => (entradas.current[b.id] = el)}
                        type="file"
                        accept={TIPOS_DE_MIDIA_ACEITES.join(",")}
                        className="hidden"
                        aria-label={`Carregar foto para ${b.titulo}`}
                        onChange={(e) => e.target.files?.[0] && void enviarImagem(b.id, e.target.files[0])}
                      />
                      <Botao
                        variante="secundario"
                        aCarregar={aEnviarImagem === b.id}
                        onClick={() => entradas.current[b.id]?.click()}
                      >
                        <ImagePlus aria-hidden />
                        {b.imagem_url ? "Trocar foto" : "Adicionar foto"}
                      </Botao>
                    </>
                  }
                  aoAlternar={() => void alternar(b)}
                  aoEditar={() => setAEditar(b)}
                  aoRemover={() => void remover(b.id)}
                />
              ))}
            </ul>
          ) : (
            <p className="text-tinta-suave">Nenhum banner ainda.</p>
          )}
        </EstadoDadosAdmin>
      </Seccao>

      {aEditar && (
        <DialogoEdicao
          key={aEditar.id}
          aberto
          aoFechar={() => setAEditar(null)}
          titulo="Editar banner da homepage"
          descricao="As alterações ficam visíveis assim que guardar (a foto edita-se à parte)."
          valoresIniciais={{ titulo: aEditar.titulo, texto: aEditar.descricao ?? "", link: aEditar.link ?? "" }}
          rotuloTexto="Descrição (opcional)"
          textoObrigatorio={false}
          aoGuardar={async (v) => {
            await bannerHomepageApi.atualizar(aEditar.id, { titulo: v.titulo, descricao: v.texto || null, link: v.link || null });
            toast.success("Banner actualizado.");
            setAEditar(null);
            await recarregar();
          }}
        />
      )}
    </div>
  );
};

export default AdminBanners;
