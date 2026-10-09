import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowRight, CheckCircle2, XCircle } from "lucide-react";
import { useTranslation } from "react-i18next";
import { MolduraEntrada } from "@/components/auth/MolduraEntrada";
import { PedirNovoLink } from "@/components/auth/PedirNovoLink";
import { Botao } from "@/design/componentes/Botao";
import { localizar } from "@/i18n/rotas";
import { authApi, mensagemDeErroApi } from "@/lib/apiClient";

type Estado = "a-confirmar" | "confirmado" | "erro";

/**
 * Ecrã aberto a partir do link de confirmação enviado por email logo após
 * o registo (AUTH-02, ver `POST /auth/registar` e `ConfirmacaoEmailService`).
 * Só confirma a conta -- nunca inicia sessão automaticamente, para manter o
 * mesmo modelo mental do resto do fluxo de auth (confirmar é um passo à
 * parte de entrar). Depois de confirmada, a pessoa faz login normalmente.
 * Com o link inválido ou expirado, pede-se outro aqui mesmo.
 */
const ConfirmarEmail = () => {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const [estado, setEstado] = useState<Estado>("a-confirmar");
  const [mensagemErro, setMensagemErro] = useState("");
  // React 18 em StrictMode monta os efeitos duas vezes em dev -- sem isto,
  // a segunda chamada usaria o mesmo token (já consumido pela primeira) e
  // mostraria "inválido ou expirou" por engano.
  const jaTentou = useRef(false);

  useEffect(() => {
    if (!token) {
      setEstado("erro");
      setMensagemErro(t("ConfirmarEmail.esteLinkDeConfirmacao"));
      return;
    }
    if (jaTentou.current) return;
    jaTentou.current = true;

    authApi
      .confirmarEmail(token)
      .then(() => setEstado("confirmado"))
      .catch((err) => {
        setEstado("erro");
        setMensagemErro(mensagemDeErroApi(err, t("ConfirmarEmail.esteLinkDeConfirmacao2")));
      });
  }, [token, t]);

  return (
    <MolduraEntrada>
      {estado === "a-confirmar" && (
        <>
          <h1 className="text-titulo-m text-tinta">{t("ConfirmarEmail.aConfirmarASua")}</h1>
          <p role="status" className="mt-2 text-corpo text-tinta-suave">
            {t("ConfirmarEmail.umMomento")}
          </p>
        </>
      )}

      {estado === "confirmado" && (
        <>
          <span aria-hidden className="flex size-12 items-center justify-center rounded-pilula bg-sucesso-suave text-sucesso [&_svg]:size-6">
            <CheckCircle2 />
          </span>
          <h1 className="mt-5 text-titulo-m text-tinta">{t("ConfirmarEmail.contaConfirmada")}</h1>
          <p className="mt-2 text-corpo text-tinta-suave">{t("ConfirmarEmail.jaPodeEntrarCom")}</p>
          <Botao asChild tamanho="g" larguraTotal className="mt-8">
            <Link to={localizar("/auth")} replace>
              {t("ConfirmarEmail.irParaOLogin")} <ArrowRight aria-hidden />
            </Link>
          </Botao>
        </>
      )}

      {estado === "erro" && (
        <>
          <span aria-hidden className="flex size-12 items-center justify-center rounded-pilula bg-erro-suave text-erro [&_svg]:size-6">
            <XCircle />
          </span>
          <h1 className="mt-5 text-titulo-m text-tinta">{t("ConfirmarEmail.naoFoiPossivelConfirmar")}</h1>
          <p role="alert" className="mt-2 text-corpo text-tinta-suave">
            {mensagemErro}
          </p>
          <PedirNovoLink
            aoPedir={(email) => authApi.reenviarConfirmacao(email)}
            textos={{
              titulo: t("ConfirmarEmail.pedirNovoTitulo"),
              explicacao: t("ConfirmarEmail.pedirNovoTexto"),
              enviado: t("ConfirmarEmail.pedirNovoEnviado"),
              botao: t("ConfirmarEmail.pedirNovoBotao"),
            }}
          />
          <p className="mt-6 text-corpo">
            <Link to={localizar("/auth")} className="font-medium text-accao underline underline-offset-2">
              {t("ConfirmarEmail.irParaOLogin")}
            </Link>
          </p>
        </>
      )}
    </MolduraEntrada>
  );
};

export default ConfirmarEmail;
