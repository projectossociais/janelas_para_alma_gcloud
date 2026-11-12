import { useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { Building2, CheckCircle2, FileText, Loader2, Paperclip, X } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import BackButton from "@/components/BackButton";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  MAX_BYTES_DOCUMENTO_DE_PARCERIA,
  MAX_DOCUMENTOS_DE_PARCERIA,
  TIPOS_DE_DOCUMENTO_DE_PARCERIA,
  TIPOS_DE_PARCEIRO,
  mensagemDeErroApi,
  parceriasApi,
  type DocumentoDeParceria,
  type TipoDeParceiro,
} from "@/lib/apiClient";
import { localizar } from "@/i18n/rotas";

const DADOS_LEGAIS = ["firma", "nifRotulo", "matricula", "capitalSocial", "sede", "objecto"] as const;
const VALOR_LEGAL: Record<(typeof DADOS_LEGAIS)[number], string> = {
  firma: "firmaValor",
  nifRotulo: "nifValor",
  matricula: "matriculaValor",
  capitalSocial: "capitalSocialValor",
  sede: "sedeValor",
  objecto: "objectoValor",
};
const PASSOS = ["passo1", "passo2", "passo3", "passo4"] as const;

const camposIniciais = {
  denominacao: "",
  nif: "",
  provincia: "",
  morada: "",
  website: "",
  representante_nome: "",
  representante_cargo: "",
  email: "",
  telefone: "",
  mensagem: "",
};
type Campos = typeof camposIniciais;

/**
 * Registo de empresas parceiras (clínicas, ópticas, organizações). Público:
 * quem ainda não é parceiro não tem conta. Os documentos sobem directos ao
 * storage privado; a API grava o registo, envia tudo à equipa por email e
 * manda à empresa um comprovativo em PDF.
 */
const RegistoParceiro = () => {
  const { t } = useTranslation();
  const [campos, setCampos] = useState<Campos>(camposIniciais);
  const [tipo, setTipo] = useState<TipoDeParceiro | "">("");
  const [documentos, setDocumentos] = useState<DocumentoDeParceria[]>([]);
  const [aEnviarDocumento, setAEnviarDocumento] = useState<string | null>(null);
  const [declaracao, setDeclaracao] = useState(false);
  const [aSubmeter, setASubmeter] = useState(false);
  const [recebido, setRecebido] = useState<{ referencia: string; empresa: string; email: string } | null>(null);
  const inputFicheiro = useRef<HTMLInputElement>(null);

  const mudar = (campo: keyof Campos) => (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setCampos((anterior) => ({ ...anterior, [campo]: e.target.value }));

  const adicionarDocumento = async (e: ChangeEvent<HTMLInputElement>) => {
    const ficheiro = e.target.files?.[0];
    e.target.value = "";
    if (!ficheiro) return;
    if (documentos.length >= MAX_DOCUMENTOS_DE_PARCERIA) {
      toast.error(t("RegistoParceiro.demasiadosDocumentos", { max: MAX_DOCUMENTOS_DE_PARCERIA }));
      return;
    }
    if (!(TIPOS_DE_DOCUMENTO_DE_PARCERIA as readonly string[]).includes(ficheiro.type)) {
      toast.error(t("RegistoParceiro.tipoNaoPermitido"));
      return;
    }
    if (ficheiro.size > MAX_BYTES_DOCUMENTO_DE_PARCERIA) {
      toast.error(t("RegistoParceiro.ficheiroGrande"));
      return;
    }
    setAEnviarDocumento(ficheiro.name);
    try {
      const preparado = await parceriasApi.prepararDocumento(ficheiro.type);
      await parceriasApi.enviarParaStorage(preparado.url_de_upload, ficheiro);
      // Só entra na lista depois de o envio ter mesmo corrido.
      setDocumentos((anteriores) => [
        ...anteriores,
        { chave: preparado.chave, nome: ficheiro.name, content_type: ficheiro.type },
      ]);
    } catch {
      toast.error(t("RegistoParceiro.erroNoDocumento"));
    } finally {
      setAEnviarDocumento(null);
    }
  };

  const submeter = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!tipo) {
      toast.error(t("RegistoParceiro.tipoEmFalta"));
      return;
    }
    if (!declaracao) {
      toast.error(t("RegistoParceiro.declaracaoEmFalta"));
      return;
    }
    setASubmeter(true);
    try {
      const { referencia } = await parceriasApi.submeter({
        denominacao: campos.denominacao.trim(),
        nif: campos.nif.trim(),
        tipo,
        provincia: campos.provincia.trim(),
        morada: campos.morada.trim() || null,
        website: campos.website.trim() || null,
        representante_nome: campos.representante_nome.trim(),
        representante_cargo: campos.representante_cargo.trim(),
        email: campos.email.trim(),
        telefone: campos.telefone.trim(),
        mensagem: campos.mensagem.trim() || null,
        documentos,
        declaracao: true,
      });
      // Sucesso só com a resposta da API na mão (nunca a partir de um catch).
      setRecebido({ referencia, empresa: campos.denominacao.trim(), email: campos.email.trim() });
      window.scrollTo({ top: 0 });
    } catch (err) {
      toast.error(mensagemDeErroApi(err, t("RegistoParceiro.erroAoSubmeter")));
    } finally {
      setASubmeter(false);
    }
  };

  const classeSeccao = "rounded-2xl border border-border/60 bg-card p-6 md:p-8 shadow-card space-y-5";
  const classeTituloSeccao = "text-lg font-bold text-foreground";

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <section className="bg-hero-gradient pt-32 pb-14 md:pt-40 md:pb-20">
        <div className="container px-6 text-center">
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-xl bg-primary-foreground/10 text-primary-foreground">
            <Building2 className="h-7 w-7" />
          </div>
          <h1 className="text-3xl md:text-5xl font-bold tracking-tight text-primary-foreground mb-4">
            {t("RegistoParceiro.titulo")}
          </h1>
          <p className="mx-auto max-w-2xl text-lg text-primary-foreground/85 leading-relaxed">
            {t("RegistoParceiro.subtitulo")}
          </p>
        </div>
      </section>

      <BackButton className="pb-2 md:pb-4" />

      <section className="pb-20 md:pb-28">
        <div className="container px-6">
          {recebido ? (
            <div
              role="status"
              className="mx-auto max-w-2xl rounded-2xl border border-border/60 bg-card p-8 md:p-10 text-center shadow-card"
            >
              <CheckCircle2 className="mx-auto mb-4 h-12 w-12 text-teal" />
              <h2 className="text-2xl font-bold text-foreground mb-3">{t("RegistoParceiro.recebido")}</h2>
              <p className="text-muted-foreground leading-relaxed mb-6">
                {t("RegistoParceiro.recebidoTexto", { empresa: recebido.empresa, email: recebido.email })}
              </p>
              <div className="mx-auto mb-8 inline-block rounded-xl bg-muted px-6 py-4">
                <div className="text-xs uppercase tracking-widest text-muted-foreground">
                  {t("RegistoParceiro.referencia")}
                </div>
                <div className="text-xl font-bold text-foreground">{recebido.referencia}</div>
              </div>
              <div>
                <Button asChild variant="outline">
                  <Link to={localizar("/parceiros")}>{t("RegistoParceiro.voltarAosParceiros")}</Link>
                </Button>
              </div>
            </div>
          ) : (
            <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)] lg:items-start">
              <aside className="space-y-6 lg:sticky lg:top-28">
                <div className={classeSeccao}>
                  <h2 className={classeTituloSeccao}>{t("RegistoParceiro.quemSomos")}</h2>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {t("RegistoParceiro.quemSomosTexto")}
                  </p>
                  <dl className="divide-y divide-border/60 text-sm">
                    {DADOS_LEGAIS.map((chave) => (
                      <div key={chave} className="grid grid-cols-[7.5rem_minmax(0,1fr)] gap-3 py-2.5">
                        <dt className="text-muted-foreground">{t(`RegistoParceiro.${chave}`)}</dt>
                        <dd className="font-medium text-foreground">{t(`RegistoParceiro.${VALOR_LEGAL[chave]}`)}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
                <div className={classeSeccao}>
                  <h2 className={classeTituloSeccao}>{t("RegistoParceiro.comoFunciona")}</h2>
                  <ol className="space-y-3 text-sm text-muted-foreground">
                    {PASSOS.map((passo, i) => (
                      <li key={passo} className="flex gap-3">
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-teal/15 text-xs font-bold text-teal">
                          {i + 1}
                        </span>
                        <span className="leading-relaxed">{t(`RegistoParceiro.${passo}`)}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              </aside>

              <form onSubmit={submeter} className="space-y-6">
                <fieldset className={classeSeccao}>
                  <legend className="sr-only">{t("RegistoParceiro.dadosDaEmpresa")}</legend>
                  <h2 className={classeTituloSeccao} aria-hidden="true">
                    {t("RegistoParceiro.dadosDaEmpresa")}
                  </h2>
                  <div className="grid gap-2">
                    <Label htmlFor="rp-denominacao">{t("RegistoParceiro.denominacao")}</Label>
                    <Input
                      id="rp-denominacao"
                      required
                      minLength={2}
                      maxLength={200}
                      value={campos.denominacao}
                      onChange={mudar("denominacao")}
                      placeholder={t("RegistoParceiro.denominacaoExemplo")}
                    />
                  </div>
                  <div className="grid gap-5 sm:grid-cols-2">
                    <div className="grid gap-2">
                      <Label htmlFor="rp-nif">{t("RegistoParceiro.nif")}</Label>
                      <Input
                        id="rp-nif"
                        required
                        minLength={5}
                        maxLength={20}
                        pattern="[0-9A-Za-z]+"
                        value={campos.nif}
                        onChange={mudar("nif")}
                        placeholder={t("RegistoParceiro.nifExemplo")}
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="rp-tipo">{t("RegistoParceiro.tipo")}</Label>
                      <Select value={tipo} onValueChange={(valor) => setTipo(valor as TipoDeParceiro)}>
                        <SelectTrigger id="rp-tipo">
                          <SelectValue placeholder={t("RegistoParceiro.seleccione")} />
                        </SelectTrigger>
                        <SelectContent>
                          {TIPOS_DE_PARCEIRO.map((valor) => (
                            <SelectItem key={valor} value={valor}>
                              {t(`RegistoParceiro.tipo_${valor}`)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid gap-5 sm:grid-cols-2">
                    <div className="grid gap-2">
                      <Label htmlFor="rp-provincia">{t("RegistoParceiro.provincia")}</Label>
                      <Input
                        id="rp-provincia"
                        required
                        minLength={2}
                        maxLength={60}
                        value={campos.provincia}
                        onChange={mudar("provincia")}
                        placeholder={t("RegistoParceiro.provinciaExemplo")}
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="rp-website">{t("RegistoParceiro.website")}</Label>
                      <Input
                        id="rp-website"
                        maxLength={200}
                        value={campos.website}
                        onChange={mudar("website")}
                        placeholder="www.exemplo.ao"
                      />
                    </div>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="rp-morada">{t("RegistoParceiro.morada")}</Label>
                    <Input
                      id="rp-morada"
                      maxLength={300}
                      value={campos.morada}
                      onChange={mudar("morada")}
                      placeholder={t("RegistoParceiro.moradaExemplo")}
                    />
                  </div>
                </fieldset>

                <fieldset className={classeSeccao}>
                  <legend className="sr-only">{t("RegistoParceiro.representante")}</legend>
                  <h2 className={classeTituloSeccao} aria-hidden="true">
                    {t("RegistoParceiro.representante")}
                  </h2>
                  <div className="grid gap-5 sm:grid-cols-2">
                    <div className="grid gap-2">
                      <Label htmlFor="rp-rep-nome">{t("RegistoParceiro.representanteNome")}</Label>
                      <Input
                        id="rp-rep-nome"
                        required
                        minLength={2}
                        maxLength={150}
                        value={campos.representante_nome}
                        onChange={mudar("representante_nome")}
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="rp-rep-cargo">{t("RegistoParceiro.representanteCargo")}</Label>
                      <Input
                        id="rp-rep-cargo"
                        required
                        minLength={2}
                        maxLength={100}
                        value={campos.representante_cargo}
                        onChange={mudar("representante_cargo")}
                        placeholder={t("RegistoParceiro.cargoExemplo")}
                      />
                    </div>
                  </div>
                  <div className="grid gap-5 sm:grid-cols-2">
                    <div className="grid gap-2">
                      <Label htmlFor="rp-email">{t("RegistoParceiro.email")}</Label>
                      <Input
                        id="rp-email"
                        type="email"
                        required
                        maxLength={255}
                        value={campos.email}
                        onChange={mudar("email")}
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="rp-telefone">{t("RegistoParceiro.telefone")}</Label>
                      <Input
                        id="rp-telefone"
                        type="tel"
                        required
                        minLength={6}
                        maxLength={30}
                        pattern="[0-9+() \-]+"
                        value={campos.telefone}
                        onChange={mudar("telefone")}
                        placeholder="+244 9xx xxx xxx"
                      />
                    </div>
                  </div>
                </fieldset>

                <fieldset className={classeSeccao}>
                  <legend className="sr-only">{t("RegistoParceiro.parceria")}</legend>
                  <h2 className={classeTituloSeccao} aria-hidden="true">
                    {t("RegistoParceiro.parceria")}
                  </h2>
                  <div className="grid gap-2">
                    <Label htmlFor="rp-mensagem">{t("RegistoParceiro.mensagem")}</Label>
                    <Textarea
                      id="rp-mensagem"
                      rows={4}
                      maxLength={2000}
                      value={campos.mensagem}
                      onChange={mudar("mensagem")}
                      placeholder={t("RegistoParceiro.mensagemExemplo")}
                    />
                  </div>
                </fieldset>

                <fieldset className={classeSeccao}>
                  <legend className="sr-only">{t("RegistoParceiro.documentos")}</legend>
                  <h2 className={classeTituloSeccao} aria-hidden="true">
                    {t("RegistoParceiro.documentos")}
                  </h2>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {t("RegistoParceiro.documentosAjuda", { max: MAX_DOCUMENTOS_DE_PARCERIA })}{" "}
                    {t("RegistoParceiro.documentosPrivados")}
                  </p>
                  {documentos.length > 0 && (
                    <ul className="space-y-2">
                      {documentos.map((documento) => (
                        <li
                          key={documento.chave}
                          className="flex items-center gap-3 rounded-lg border border-border/60 bg-muted/40 px-3 py-2 text-sm"
                        >
                          <FileText className="h-4 w-4 shrink-0 text-teal" />
                          <span className="min-w-0 flex-1 truncate">{documento.nome}</span>
                          <button
                            type="button"
                            className="rounded p-1 text-muted-foreground hover:text-foreground"
                            aria-label={t("RegistoParceiro.remover", { nome: documento.nome })}
                            onClick={() =>
                              setDocumentos((anteriores) => anteriores.filter((d) => d.chave !== documento.chave))
                            }
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                  <input
                    ref={inputFicheiro}
                    type="file"
                    className="sr-only"
                    data-testid="rp-ficheiro"
                    accept={TIPOS_DE_DOCUMENTO_DE_PARCERIA.join(",")}
                    onChange={adicionarDocumento}
                    tabIndex={-1}
                    aria-hidden="true"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    disabled={aEnviarDocumento !== null || documentos.length >= MAX_DOCUMENTOS_DE_PARCERIA}
                    onClick={() => inputFicheiro.current?.click()}
                  >
                    {aEnviarDocumento !== null ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        {t("RegistoParceiro.aEnviarDocumento", { nome: aEnviarDocumento })}
                      </>
                    ) : (
                      <>
                        <Paperclip className="h-4 w-4" />
                        {t("RegistoParceiro.adicionarDocumento")}
                      </>
                    )}
                  </Button>
                </fieldset>

                <div className={classeSeccao}>
                  <div className="flex items-start gap-3">
                    <Checkbox
                      id="rp-declaracao"
                      checked={declaracao}
                      onCheckedChange={(valor) => setDeclaracao(valor === true)}
                      className="mt-1"
                    />
                    <Label htmlFor="rp-declaracao" className="text-sm font-normal leading-relaxed">
                      {t("RegistoParceiro.declaracao")}
                    </Label>
                  </div>
                  <Button
                    type="submit"
                    size="lg"
                    disabled={aSubmeter || aEnviarDocumento !== null}
                    className="w-full bg-teal text-teal-foreground hover:bg-teal/90"
                  >
                    {aSubmeter ? t("RegistoParceiro.aSubmeter") : t("RegistoParceiro.submeter")}
                  </Button>
                </div>
              </form>
            </div>
          )}
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default RegistoParceiro;
