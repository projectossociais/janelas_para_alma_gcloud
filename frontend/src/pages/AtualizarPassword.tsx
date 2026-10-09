import { useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { MolduraEntrada } from "@/components/auth/MolduraEntrada";
import { PedirNovoLink } from "@/components/auth/PedirNovoLink";
import { Aviso } from "@/design/componentes/Aviso";
import { Botao } from "@/design/componentes/Botao";
import { CampoPassword } from "@/design/componentes/CampoPassword";
import { localizar } from "@/i18n/rotas";
import { authApi, mensagemDeErroApi } from "@/lib/apiClient";
import { erroDePasswordFraca } from "@/lib/validarPassword";

/**
 * Ecrã de "Definir nova palavra-passe", aberto a partir do link de
 * recuperação enviado por email (ver `POST /auth/recuperar-password`). O
 * token vem na própria URL (?token=...), gerado pela API -- não há sessão
 * nenhuma envolvida aqui: o token é de uso único e validado directamente por
 * `POST /auth/redefinir-password`.
 *
 * Os erros ficam escritos no próprio campo; com o link inválido ou expirado,
 * pede-se outro aqui mesmo (antes: um aviso que desaparecia e nenhuma saída).
 */
const AtualizarPassword = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [tentou, setTentou] = useState(false);
  const [loading, setLoading] = useState(false);
  const [erroLink, setErroLink] = useState<string | null>(token ? null : t("AtualizarPassword.esteLinkDeRecuperacao3"));

  const erroPassword = !password
    ? t("AtualizarPassword.preenchaOsDoisCampos")
    : (erroDePasswordFraca(password) ?? undefined);
  const erroConfirmar = !confirm
    ? t("AtualizarPassword.preenchaOsDoisCampos")
    : password !== confirm
      ? t("AtualizarPassword.asPalavrasPasseNao")
      : undefined;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setTentou(true);
    if (!token || erroPassword || erroConfirmar) return;

    setLoading(true);
    try {
      await authApi.redefinirPassword(token, password);
      toast.success(t("AtualizarPassword.palavraPasseActualizadaCom"));
      // Sem sessão nenhuma para terminar aqui (o token de recuperação nunca
      // autentica, só troca a password) — segue directo para o login limpo.
      navigate(localizar("/auth"), { replace: true });
    } catch (err) {
      // Nunca mostrar sucesso a partir daqui — um token inválido, expirado
      // ou já usado devolve erro, e é isto que aparece ao utilizador.
      setErroLink(mensagemDeErroApi(err, t("AtualizarPassword.esteLinkDeRecuperacao2")));
    } finally {
      setLoading(false);
    }
  };

  const textosPassword = { mostrar: t("Auth.mostrar"), esconder: t("Auth.esconder") };

  return (
    <MolduraEntrada>
      <h1 className="text-titulo-m text-tinta">{t("AtualizarPassword.definirNovaPalavraPasse")}</h1>

      {erroLink ? (
        <>
          <Aviso variante="erro" anunciar className="mt-4">
            {erroLink}
          </Aviso>
          <PedirNovoLink
            aoPedir={(email) => authApi.recuperarPassword(email)}
            textos={{
              titulo: t("AtualizarPassword.pedirNovoTitulo"),
              explicacao: t("AtualizarPassword.pedirNovoTexto"),
              enviado: t("AtualizarPassword.pedirNovoEnviado"),
              botao: t("AtualizarPassword.pedirNovoBotao"),
            }}
          />
          <p className="mt-6 text-corpo">
            <Link to={localizar("/auth")} className="font-medium text-accao underline underline-offset-2">
              {t("AtualizarPassword.voltarAoLogin")}
            </Link>
          </p>
        </>
      ) : (
        <>
          <p className="mt-2 text-corpo text-tinta-suave">{t("AtualizarPassword.escolhaUmaNovaPalavra")}</p>
          <form onSubmit={(e) => void handleSubmit(e)} noValidate className="mt-8 flex flex-col gap-6">
            <CampoPassword
              rotulo={t("AtualizarPassword.novaPalavraPasse")}
              ajuda={t("Auth.peloMenos8Caracteres")}
              autoComplete="new-password"
              textos={textosPassword}
              value={password}
              erro={tentou ? erroPassword : undefined}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
            />
            <CampoPassword
              rotulo={t("AtualizarPassword.confirmarPalavraPasse")}
              autoComplete="new-password"
              textos={textosPassword}
              value={confirm}
              erro={tentou ? erroConfirmar : undefined}
              onChange={(e) => setConfirm(e.target.value)}
              disabled={loading}
            />
            <Botao type="submit" tamanho="g" larguraTotal aCarregar={loading}>
              {t("AtualizarPassword.guardarNovaPalavraPasse")} <ArrowRight aria-hidden />
            </Botao>
          </form>
        </>
      )}
    </MolduraEntrada>
  );
};

export default AtualizarPassword;
