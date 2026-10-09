import { useEffect, useRef, useState, type ChangeEvent, type FormEvent, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Camera, Eye } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { MolduraApp } from "@/components/app/MolduraApp";
import { useAuth, PROVINCES } from "@/contexts/AuthContext";
import { useProfile } from "@/contexts/ProfileContext";
import { Aviso } from "@/design/componentes/Aviso";
import { Botao } from "@/design/componentes/Botao";
import { Campo, CampoTexto } from "@/design/componentes/Campo";
import { GrupoEscolha } from "@/design/componentes/Escolha";
import { Seleccao } from "@/design/componentes/Seleccao";
import { localizar } from "@/i18n/rotas";
import {
  perfilApi,
  uploadsApi,
  mensagemDeErroApi,
  TIPOS_DE_AVATAR_ACEITES,
  type FaixaEtaria,
  type OlhoMaisFraco,
} from "@/lib/apiClient";

const GENEROS = ["masculino", "feminino", "nao_dizer"] as const;
type Genero = (typeof GENEROS)[number];
const ROTULO_GENERO = { masculino: "EditarPerfil.masculino", feminino: "EditarPerfil.feminino", nao_dizer: "EditarPerfil.prefiroNaoDizer" } as const;

const Seccao = ({ id, titulo, descricao, children }: { id: string; titulo: ReactNode; descricao?: string; children: ReactNode }) => (
  <section aria-labelledby={id} className="rounded-cartao border border-linha bg-superficie p-5">
    <h2 id={id} className="flex items-center gap-2 text-titulo-p text-tinta">
      {titulo}
    </h2>
    {descricao && <p className="mt-1 text-corpo text-tinta-suave">{descricao}</p>}
    <div className="mt-5 flex flex-col gap-5">{children}</div>
  </section>
);

/**
 * O perfil da conta (arquétipo App). Hidrata o formulário **uma única vez**
 * a partir do perfil (CLAUDE.md §6): um `setProfile` noutro sítio (ex.: ao
 * trocar a foto) não apaga o que se está a escrever.
 *
 * Até 2026-10-09, apagar o nome e guardar mostrava "perfil actualizado" e
 * mantinha o nome antigo sem dizer nada; agora o campo diz que falta o nome.
 */
const EditarPerfil = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { isLoggedIn, loading: authLoading, user, updateUserProfile } = useAuth();
  const { profile, loading: profileLoading, setProfile } = useProfile();

  const [name, setName] = useState("");
  const [bio, setBio] = useState("");
  const [birthdate, setBirthdate] = useState("");
  const [gender, setGender] = useState<Genero | null>(null);
  const [phone, setPhone] = useState("");
  const [province, setProvince] = useState("");
  // Perfil visual dos exercícios (opcional): olho a treinar, óculos, faixa etária.
  const [olhoMaisFraco, setOlhoMaisFraco] = useState("");
  const [usaOculos, setUsaOculos] = useState("");
  const [faixaEtaria, setFaixaEtaria] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | undefined>(undefined);
  const [saving, setSaving] = useState(false);
  const [tentou, setTentou] = useState(false);
  const [erroGuardar, setErroGuardar] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [erroAvatar, setErroAvatar] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const hidratadoRef = useRef(false);

  useEffect(() => {
    // Esperar o AuthContext validar a sessão antes de decidir (num refresh,
    // `isLoggedIn` começa `false` até /auth/eu responder).
    if (!authLoading && !isLoggedIn) navigate(localizar(`/auth?next=${encodeURIComponent("/editar-perfil")}`));
  }, [authLoading, isLoggedIn, navigate]);

  useEffect(() => {
    if (profile && !hidratadoRef.current) {
      hidratadoRef.current = true;
      setName(profile.nome_completo ?? "");
      setBio(profile.biografia ?? "");
      setBirthdate(profile.data_nascimento ?? "");
      setGender((GENEROS as readonly string[]).includes(profile.genero ?? "") ? (profile.genero as Genero) : null);
      setPhone(profile.telefone ?? "");
      setProvince(profile.provincia ?? "");
      setOlhoMaisFraco(profile.olho_mais_fraco ?? "");
      setUsaOculos(profile.usa_oculos == null ? "" : profile.usa_oculos ? "sim" : "nao");
      setFaixaEtaria(profile.faixa_etaria ?? "");
      setAvatarUrl(profile.avatar_url ?? user?.avatarUrl);
    }
  }, [profile, user?.avatarUrl]);

  const handleAvatarChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const ficheiro = e.target.files?.[0];
    e.target.value = ""; // permite escolher o mesmo ficheiro outra vez
    if (!ficheiro || !profile) return;
    setErroAvatar(null);

    if (!(TIPOS_DE_AVATAR_ACEITES as readonly string[]).includes(ficheiro.type)) {
      setErroAvatar(t("EditarPerfil.useUmaImagemPng"));
      return;
    }
    if (ficheiro.size > 5 * 1024 * 1024) {
      setErroAvatar(t("EditarPerfil.aImagemNaoPode"));
      return;
    }

    // Três passos: a API assina o URL, o browser envia ao R2 directamente, a
    // API confirma e grava. Nunca mostrar sucesso sem cada passo ter corrido
    // bem (CLAUDE.md §6).
    setUploadingAvatar(true);
    try {
      const preparado = await uploadsApi.prepararAvatar(ficheiro.type);
      await uploadsApi.enviarParaStorage(preparado.url_de_upload, ficheiro);
      const { avatar_url } = await uploadsApi.confirmarAvatar(preparado.chave);
      setAvatarUrl(avatar_url);
      setProfile({ ...profile, avatar_url });
      updateUserProfile({ avatarUrl: avatar_url });
      toast.success(t("EditarPerfil.fotoDePerfilActualizada"));
    } catch (err) {
      console.error("Falha ao enviar a foto de perfil:", err);
      setErroAvatar(mensagemDeErroApi(err, t("EditarPerfil.naoFoiPossivelEnviar")));
    } finally {
      setUploadingAvatar(false);
    }
  };

  const iniciais = (name || "U")
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const erroNome = tentou && !name.trim() ? t("EditarPerfil.escrevaONome") : undefined;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    setTentou(true);
    setErroGuardar(null);
    if (!name.trim()) return;

    setSaving(true);
    try {
      const data = await perfilApi.atualizar({
        nome_completo: name.trim(),
        biografia: bio || null,
        data_nascimento: birthdate || null,
        genero: gender,
        telefone: phone || null,
        provincia: province || null,
        // Vazio = "não mudar" (a API não limpa estes campos por PATCH).
        ...(olhoMaisFraco ? { olho_mais_fraco: olhoMaisFraco as OlhoMaisFraco } : {}),
        ...(usaOculos ? { usa_oculos: usaOculos === "sim" } : {}),
        ...(faixaEtaria ? { faixa_etaria: faixaEtaria as FaixaEtaria } : {}),
      });

      setProfile({
        ...profile,
        ...data,
        nome_completo: data.nome_completo ?? "",
        px_por_mm: data.px_por_mm ?? null,
        olho_mais_fraco: data.olho_mais_fraco ?? null,
        usa_oculos: data.usa_oculos ?? null,
        faixa_etaria: data.faixa_etaria ?? null,
      });
      // Ponte para quem ainda lê o AuthContext directamente.
      updateUserProfile({
        name: data.nome_completo ?? "",
        province: data.provincia ?? "",
        biografia: data.biografia ?? "",
        telefone: data.telefone ?? "",
        dataNascimento: data.data_nascimento ?? "",
        gender: data.genero ?? "",
      });
      toast.success(t("EditarPerfil.oSeuPerfilFoi"));
    } catch (err) {
      console.error("Falha ao guardar o perfil:", err);
      setErroGuardar(mensagemDeErroApi(err, t("EditarPerfil.naoFoiPossivelGuardar")));
    } finally {
      setSaving(false);
    }
  };

  if (!user) return null;

  return (
    <MolduraApp titulo={t("EditarPerfil.editarPerfil")} subtitulo={t("EditarPerfil.actualizeAsSuasInformacoes")}>
      {profileLoading || !profile ? (
        <p role="status" className="text-corpo text-tinta-suave">
          {t("EditarPerfil.aCarregar")}
        </p>
      ) : (
        <form onSubmit={(e) => void handleSubmit(e)} noValidate className="flex max-w-3xl flex-col gap-6">
          <Seccao id="perfil-foto" titulo={t("EditarPerfil.fotoEBiografia")} descricao={t("EditarPerfil.personalizeASuaIdentidade")}>
            <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
              {avatarUrl ? (
                <img src={avatarUrl} alt="" className="size-24 shrink-0 rounded-pilula object-cover" />
              ) : (
                <span aria-hidden className="flex size-24 shrink-0 items-center justify-center rounded-pilula bg-accao-suave text-titulo-p font-medium text-accao">
                  {iniciais}
                </span>
              )}
              <div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  aria-label={t("EditarPerfil.carregarFotoDePerfil")}
                  onChange={(e) => void handleAvatarChange(e)}
                  disabled={uploadingAvatar}
                />
                <Botao variante="secundario" aCarregar={uploadingAvatar} onClick={() => fileInputRef.current?.click()}>
                  <Camera aria-hidden /> {t("EditarPerfil.alterarFoto")}
                </Botao>
                <p className="mt-2 text-legenda text-tinta-suave">{t("EditarPerfil.jpgOuPngMaximo")}</p>
              </div>
            </div>
            {erroAvatar && (
              <Aviso variante="erro" anunciar>
                {erroAvatar}
              </Aviso>
            )}
            <CampoTexto
              rotulo={t("EditarPerfil.biografia")}
              placeholder={t("EditarPerfil.conteUmPoucoSobre")}
              rows={4}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
            />
          </Seccao>

          <Seccao id="perfil-dados" titulo={t("EditarPerfil.dadosPessoais")} descricao={t("EditarPerfil.asSuasInformacoesBasicas")}>
            <Campo
              rotulo={t("EditarPerfil.nomeCompleto")}
              autoComplete="name"
              value={name}
              erro={erroNome}
              onChange={(e) => setName(e.target.value)}
            />
            <Campo
              rotulo={t("EditarPerfil.dataDeNascimento")}
              type="date"
              value={birthdate}
              onChange={(e) => setBirthdate(e.target.value)}
              className="sm:max-w-xs"
            />
            <GrupoEscolha<Genero>
              legenda={t("EditarPerfil.genero")}
              aparencia="radio"
              opcoes={GENEROS.map((g) => ({ valor: g, rotulo: t(ROTULO_GENERO[g]) }))}
              valor={gender}
              aoMudar={setGender}
            />
          </Seccao>

          <Seccao id="perfil-contacto" titulo={t("EditarPerfil.informacoesDeContacto")} descricao={t("EditarPerfil.comoPodemosComunicarConsigo")}>
            <Campo rotulo={t("EditarPerfil.email")} type="email" value={user.email} disabled ajuda={t("EditarPerfil.oEmailEO")} />
            <Campo
              rotulo={t("EditarPerfil.telefone")}
              type="tel"
              autoComplete="tel"
              placeholder="+244 923 000 000"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
            <Seleccao
              rotulo={t("EditarPerfil.provincia")}
              marcador={t("EditarPerfil.seleccioneASuaProvincia")}
              value={province}
              onChange={(e) => setProvince(e.target.value)}
              opcoes={PROVINCES.map((p) => ({ valor: p, rotulo: p }))}
            />
          </Seccao>

          <Seccao
            id="perfil-visual"
            titulo={
              <>
                <Eye className="size-5 text-accao" aria-hidden /> {t("Visao.perfilVisualTitulo")}
              </>
            }
            descricao={t("Visao.perfilVisualTexto")}
          >
            <div className="grid gap-5 sm:grid-cols-3">
              <Seleccao
                rotulo={t("Visao.olhoMaisFraco")}
                marcador={t("EditarPerfil.seleccione")}
                value={olhoMaisFraco}
                onChange={(e) => setOlhoMaisFraco(e.target.value)}
                opcoes={[
                  { valor: "direito", rotulo: t("Visao.olhoDireito") },
                  { valor: "esquerdo", rotulo: t("Visao.olhoEsquerdo") },
                  { valor: "nao_sei", rotulo: t("Visao.naoSei") },
                ]}
              />
              <Seleccao
                rotulo={t("Visao.usaOculosPergunta")}
                marcador={t("EditarPerfil.seleccione")}
                value={usaOculos}
                onChange={(e) => setUsaOculos(e.target.value)}
                opcoes={[
                  { valor: "sim", rotulo: t("Visao.sim") },
                  { valor: "nao", rotulo: t("Visao.nao") },
                ]}
              />
              <Seleccao
                rotulo={t("Visao.faixaEtaria")}
                marcador={t("EditarPerfil.seleccione")}
                value={faixaEtaria}
                onChange={(e) => setFaixaEtaria(e.target.value)}
                opcoes={[
                  { valor: "ate_5", rotulo: t("Visao.faixaAte5") },
                  { valor: "6_12", rotulo: t("Visao.faixa6a12") },
                  { valor: "13_17", rotulo: t("Visao.faixa13a17") },
                  { valor: "18_39", rotulo: t("Visao.faixa18a39") },
                  { valor: "40_59", rotulo: t("Visao.faixa40a59") },
                  { valor: "60_mais", rotulo: t("Visao.faixa60Mais") },
                ]}
              />
            </div>
            {olhoMaisFraco === "nao_sei" && (
              <Aviso>
                {t("Visao.naoSeiOlhoTexto")}{" "}
                <Link to={localizar("/exercicios/acuidade")} className="font-medium text-accao underline underline-offset-2">
                  {t("Visao.fazerTesteAcuidade")}
                </Link>
              </Aviso>
            )}
          </Seccao>

          {erroGuardar && (
            <Aviso variante="erro" anunciar titulo={t("EditarPerfil.naoFoiPossivelGuardar")}>
              {erroGuardar !== t("EditarPerfil.naoFoiPossivelGuardar") ? erroGuardar : null}
            </Aviso>
          )}
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Botao variante="secundario" onClick={() => navigate(-1)} disabled={saving}>
              {t("EditarPerfil.cancelar")}
            </Botao>
            <Botao type="submit" aCarregar={saving}>
              {t("EditarPerfil.salvarAlteracoes")}
            </Botao>
          </div>
        </form>
      )}
    </MolduraApp>
  );
};

export default EditarPerfil;
