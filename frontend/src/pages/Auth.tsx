import { useRef, useState, type FormEvent } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import GoogleSignInButton from "@/components/GoogleSignInButton";
import { PROVINCES, ROLE_LABEL, useAuth, type UserRole } from "@/contexts/AuthContext";
import { Aviso } from "@/design/componentes/Aviso";
import { Botao } from "@/design/componentes/Botao";
import { Campo } from "@/design/componentes/Campo";
import { CampoPassword } from "@/design/componentes/CampoPassword";
import { GrupoEscolha } from "@/design/componentes/Escolha";
import { TransicaoPasso } from "@/design/componentes/Passos";
import { Seleccao } from "@/design/componentes/Seleccao";
import { LayoutEntrada } from "@/design/layouts/LayoutEntrada";
import { Ligacao } from "@/design/Ligacao";
import logotipo from "@/design/marca/logotipo-horizontal-negativo-sem-assinatura.svg";
import { localizar } from "@/i18n/rotas";
import { authApi, mensagemDeErroApi } from "@/lib/apiClient";
import { erroDePasswordFraca } from "@/lib/validarPassword";

/**
 * Entrar e criar conta, no arquétipo Entrada (docs/LAYOUTS.md §2.2): ecrã
 * dividido, sem cabeçalho nem rodapé do site.
 *
 * Dois modos claros, com a troca por baixo do formulário. O protótipo da
 * montra adivinhava se a conta existia ("email primeiro"), mas isso obrigaria a
 * API a dizer se um email está registado, e a API nunca o revela (ver
 * `recuperar-password`); por isso aqui a pessoa diz o que quer fazer.
 *
 * Validação (docs/PESQUISA_UX.md §3): não se mostra erro enquanto a pessoa
 * escreve pela primeira vez; ao submeter, cada campo diz o seu erro e o foco vai
 * para o primeiro por corrigir (o leitor de ecrã lê-lhe o nome e o erro); depois
 * disso, o erro desaparece assim que o campo fica corrigido. Sem caixa de
 * resumo por cima: o erro fica onde se corrige. A confirmação da password foi substituída pelo "Mostrar" no
 * campo (a pessoa vê o que escreveu e os gestores de passwords funcionam).
 * Quem decide se a password serve é sempre a API (`validarPassword.ts` é só
 * uma cópia para dar resposta imediata).
 */

type Modo = "entrar" | "criar";

const GENEROS = ["masculino", "feminino", "nao_dizer"] as const;
type Genero = (typeof GENEROS)[number];
const ROTULO_GENERO = {
  masculino: "Auth.masculino",
  feminino: "Auth.feminino",
  nao_dizer: "Auth.prefiroNaoDizer",
} as const;
const PERFIS: readonly UserRole[] = ["comum", "estrabico", "profissional"];
const EMAIL_COMPLETO = /^\S+@\S+\.\S+$/;

interface ErrosFormulario {
  nome?: string;
  email?: string;
  password?: string;
  provincia?: string;
  genero?: string;
  perfil?: string;
}

const Auth = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { signIn, registerUser, signInWithGoogle } = useAuth();

  // Para onde voltar depois de autenticar (ex.: uma página que exigiu login
  // primeiro). Só caminhos relativos, nunca um URL externo.
  const rawNext = searchParams.get("next") ?? "";
  const nextPath = /^\/(?!\/)/.test(rawNext) ? rawNext : "/";

  // `?modo=registo` abre directamente em "Criar conta" (ex.: o CTA do teste de
  // 7 dias, para quem ainda não tem conta).
  const [modo, setModo] = useState<Modo>(searchParams.get("modo") === "registo" ? "criar" : "entrar");
  const [direccao, setDireccao] = useState<1 | -1>(1);

  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [provincia, setProvincia] = useState("");
  const [genero, setGenero] = useState<Genero | null>(null);
  const [perfil, setPerfil] = useState<UserRole | null>(null);

  const [aSubmeter, setASubmeter] = useState(false);
  const [aPedirRecuperacao, setAPedirRecuperacao] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  // Só depois da primeira tentativa de submeter é que os erros aparecem.
  const [tentou, setTentou] = useState(false);
  const formulario = useRef<HTMLFormElement>(null);

  const irParaProximo = () => navigate(localizar(nextPath));

  const trocarModo = (novo: Modo) => {
    setDireccao(novo === "criar" ? 1 : -1);
    setTentou(false);
    setPassword("");
    setModo(novo);
  };

  const calcularErros = (): ErrosFormulario => {
    const erros: ErrosFormulario = {};
    const emailErro = EMAIL_COMPLETO.test(email.trim()) ? undefined : t("Auth.erroEmail");
    const passwordErro = !password
      ? t("Auth.erroPasswordVazia")
      : modo === "criar"
        ? erroDePasswordFraca(password)
        : undefined;
    // Pela ordem do formulário: o resumo lê-se de cima para baixo, como os campos.
    if (modo === "criar" && !nome.trim()) erros.nome = t("Auth.erroNome");
    if (emailErro) erros.email = emailErro;
    if (passwordErro) erros.password = passwordErro;
    if (modo === "criar") {
      if (!provincia) erros.provincia = t("Auth.erroProvincia");
      if (!genero) erros.genero = t("Auth.erroGenero");
      if (!perfil) erros.perfil = t("Auth.erroPerfil");
    }
    return erros;
  };

  const erros = tentou ? calcularErros() : {};

  /** Valida ao submeter; se houver erros, leva o foco ao primeiro campo por corrigir. */
  const podeSeguir = () => {
    setTentou(true);
    if (Object.keys(calcularErros()).length === 0) return true;
    // Depois de os erros estarem no ecrã: campos com erro, ou o primeiro botão de um grupo com erro.
    window.setTimeout(() => {
      formulario.current
        ?.querySelector<HTMLElement>('[aria-invalid="true"], fieldset[aria-describedby] input')
        ?.focus();
    }, 0);
    return false;
  };

  const handleGoogleCredential = async (idToken: string) => {
    setGoogleLoading(true);
    try {
      const resultado = await signInWithGoogle(idToken);
      if (!resultado.ok) {
        toast.error(resultado.error || t("Auth.naoFoiPossivelEntrar"));
        return;
      }
      toast.success(t("Auth.sessaoIniciada"));
      irParaProximo();
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleReenviarConfirmacao = async (emailConta: string) => {
    try {
      // Resposta sempre igual, exista ou não a conta, esteja ou não já confirmada.
      await authApi.reenviarConfirmacao(emailConta);
      toast.success(t("Auth.seExistirUmaConta"));
    } catch (err) {
      toast.error(mensagemDeErroApi(err, t("Auth.naoFoiPossivelReenviar")));
    }
  };

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    if (!podeSeguir()) return;
    setASubmeter(true);
    try {
      const resultado = await signIn(email.trim(), password);
      if (!resultado.ok) {
        // A API devolve esta mensagem em 403 quando a password está certa mas o
        // email não foi confirmado: dá logo a acção óbvia (reenviar o link).
        if (resultado.error?.includes(t("Auth.confirmeOSeuEmail"))) {
          toast.error(resultado.error, {
            action: { label: t("Auth.reenviarLink"), onClick: () => void handleReenviarConfirmacao(email.trim()) },
          });
          return;
        }
        toast.error(resultado.error || t("Auth.emailOuPalavraPasse"));
        return;
      }
      toast.success(t("Auth.sessaoIniciada"));
      irParaProximo();
    } finally {
      setASubmeter(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email.trim()) {
      toast.error(t("Auth.escrevaOSeuEmail"));
      return;
    }
    setAPedirRecuperacao(true);
    try {
      // A resposta é sempre a mesma exista ou não conta com este email: um
      // "sucesso" aqui só significa "o pedido foi aceite", nunca "o email existe".
      await authApi.recuperarPassword(email.trim());
      toast.success(t("Auth.seExistirUmaConta2"));
    } catch (err) {
      // Aqui sim pode ser um erro real (API em baixo): nunca mostrar sucesso a partir de um catch.
      toast.error(mensagemDeErroApi(err, t("Auth.naoFoiPossivelPedir")));
    } finally {
      setAPedirRecuperacao(false);
    }
  };

  const handleRegister = async (e: FormEvent) => {
    e.preventDefault();
    if (!podeSeguir()) return;
    setASubmeter(true);
    try {
      const resultado = await registerUser({
        name: nome.trim(),
        email: email.trim(),
        password,
        province: provincia,
        gender: genero as string,
        role: perfil as UserRole,
      });
      if (!resultado.ok) {
        toast.error(resultado.error || t("Auth.naoFoiPossivelCriar"));
        return;
      }
      // A conta existe mas fica por confirmar: nunca navegar como se já
      // estivesse autenticado. Leva para "Entrar", já com o email preenchido.
      toast.success(t("Auth.contaCriadaEnviamosUm", { valor: email.trim() }), { duration: 8000 });
      setNome("");
      setProvincia("");
      setGenero(null);
      setPerfil(null);
      trocarModo("entrar");
    } finally {
      setASubmeter(false);
    }
  };

  const textosPassword = { mostrar: t("Auth.mostrar"), esconder: t("Auth.esconder") };
  const inicio = localizar("/");

  return (
    <LayoutEntrada
      logotipo={<img src={logotipo} alt="" />}
      inicio={{ href: inicio, rotulo: t("Auth.inicio") }}
      voltar={{ href: inicio, rotulo: t("Auth.voltarAoSite") }}
      frase={t("Auth.frase")}
      factos={[t("Auth.facto1"), t("Auth.facto2"), t("Auth.facto3")]}
      textoSaltar={t("Auth.saltar")}
    >
      <TransicaoPasso chave={modo} direccao={direccao}>
        <h1 className="text-titulo-m text-tinta">{t(modo === "entrar" ? "Auth.tituloEntrar" : "Auth.tituloCriar")}</h1>
        <p className="mt-2 text-corpo text-tinta-suave">
          {t(modo === "entrar" ? "Auth.subtituloEntrar" : "Auth.subtituloCriar")}
        </p>

        {import.meta.env.VITE_GOOGLE_CLIENT_ID && (
          <div className="mt-8">
            <GoogleSignInButton onCredential={handleGoogleCredential} />
            {googleLoading && (
              <p role="status" className="mt-3 text-center text-legenda text-tinta-suave">
                {t("Auth.aEntrar")}
              </p>
            )}
            <div className="my-6 flex items-center gap-4 text-legenda text-tinta-suave" aria-hidden>
              <span className="h-px flex-1 bg-linha" />
              {t("Auth.ou")}
              <span className="h-px flex-1 bg-linha" />
            </div>
          </div>
        )}

        <form
          ref={formulario}
          onSubmit={modo === "entrar" ? handleLogin : handleRegister}
          noValidate
          className={import.meta.env.VITE_GOOGLE_CLIENT_ID ? undefined : "mt-8"}
        >
          <div className="flex flex-col gap-6">
            {modo === "criar" && (
              <Campo
                rotulo={t("Auth.nomeCompleto")}
                autoComplete="name"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                erro={erros.nome}
              />
            )}
            <Campo
              rotulo={t("Auth.email")}
              type="email"
              inputMode="email"
              autoComplete={modo === "entrar" ? "username" : "email"}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              erro={erros.email}
            />
            <CampoPassword
              rotulo={t("Auth.palavraPasse")}
              ajuda={modo === "criar" ? t("Auth.peloMenos8Caracteres") : undefined}
              autoComplete={modo === "entrar" ? "current-password" : "new-password"}
              textos={textosPassword}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              erro={erros.password}
            />

            {modo === "criar" && (
              <>
                <Seleccao
                  rotulo={t("Auth.provincia")}
                  marcador={t("Auth.escolhaProvincia")}
                  opcoes={PROVINCES.map((p) => ({ valor: p, rotulo: p }))}
                  value={provincia}
                  onChange={(e) => setProvincia(e.target.value)}
                  erro={erros.provincia}
                />
                <GrupoEscolha<Genero>
                  legenda={t("Auth.genero")}
                  aparencia="radio"
                  opcoes={GENEROS.map((g) => ({ valor: g, rotulo: t(ROTULO_GENERO[g]) }))}
                  valor={genero}
                  aoMudar={setGenero}
                  erro={erros.genero}
                />
                <GrupoEscolha<UserRole>
                  legenda={t("Auth.perfilDeUtente")}
                  opcoes={PERFIS.map((p) => ({ valor: p, rotulo: ROLE_LABEL[p] }))}
                  valor={perfil}
                  aoMudar={setPerfil}
                  erro={erros.perfil}
                />
                <Aviso>{t("Auth.maioresDe18")}</Aviso>
              </>
            )}
          </div>

          <Botao type="submit" larguraTotal className="mt-8" aCarregar={aSubmeter}>
            {t(modo === "entrar" ? (aSubmeter ? "Auth.aEntrar" : "Auth.entrar") : aSubmeter ? "Auth.aCriarConta" : "Auth.criarConta")}
          </Botao>

          {modo === "entrar" && (
            <button
              type="button"
              onClick={() => void handleForgotPassword()}
              disabled={aPedirRecuperacao}
              className="mt-4 inline-flex min-h-alvo-app items-center rounded-controlo text-corpo font-medium text-accao underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foco disabled:opacity-60"
            >
              {aPedirRecuperacao ? t("Auth.aEnviar") : t("Auth.esqueceuAPalavraPasse")}
            </button>
          )}
        </form>

        <p className="mt-8 border-t border-linha pt-6 text-corpo text-tinta-suave">
          {t(modo === "entrar" ? "Auth.semConta" : "Auth.comConta")}{" "}
          <button
            type="button"
            onClick={() => trocarModo(modo === "entrar" ? "criar" : "entrar")}
            className="inline-flex min-h-alvo-app items-center rounded-controlo font-medium text-accao underline underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foco"
          >
            {t(modo === "entrar" ? "Auth.criarConta" : "Auth.entrar")}
          </button>
        </p>

        <p className="mt-2 text-legenda text-tinta-suave">
          {t("Auth.aoContinuar")}{" "}
          <Ligacao
            href={localizar("/termos-de-utilizacao")}
            className="font-medium text-accao underline underline-offset-2"
          >
            {t("Auth.termos")}
          </Ligacao>{" "}
          {t("Auth.e")}{" "}
          <Ligacao
            href={localizar("/politica-de-privacidade")}
            className="font-medium text-accao underline underline-offset-2"
          >
            {t("Auth.politica")}
          </Ligacao>
          .
        </p>
      </TransicaoPasso>
    </LayoutEntrada>
  );
};

export default Auth;
