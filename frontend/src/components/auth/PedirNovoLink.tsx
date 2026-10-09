import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { Aviso } from "@/design/componentes/Aviso";
import { Botao } from "@/design/componentes/Botao";
import { Campo } from "@/design/componentes/Campo";
import { mensagemDeErroApi } from "@/lib/apiClient";

/**
 * Quando um link de email (confirmar a conta, recuperar a password) é inválido
 * ou expirou, a pessoa pede outro aqui mesmo, em vez de ficar num beco sem
 * saída (até 2026-10-09, a página só dizia que o link não servia).
 *
 * A API responde sempre igual, haja ou não conta com esse email (não revela
 * quem está registado); por isso a confirmação também é neutra.
 */
export const PedirNovoLink = ({
  aoPedir,
  textos,
}: {
  aoPedir: (email: string) => Promise<unknown>;
  textos: { titulo: string; explicacao: string; enviado: string; botao: string };
}) => {
  const { t } = useTranslation();
  const [email, setEmail] = useState("");
  const [tentou, setTentou] = useState(false);
  const [aEnviar, setAEnviar] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const valido = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

  const pedir = async (e: FormEvent) => {
    e.preventDefault();
    setTentou(true);
    setErro(null);
    if (!valido) return;
    setAEnviar(true);
    try {
      await aoPedir(email.trim());
      setEnviado(true);
    } catch (err) {
      setErro(mensagemDeErroApi(err, t("PedirNovoLink.erro")));
    } finally {
      setAEnviar(false);
    }
  };

  if (enviado)
    return (
      <Aviso variante="sucesso" anunciar className="mt-8">
        {textos.enviado}
      </Aviso>
    );

  return (
    <form onSubmit={(e) => void pedir(e)} noValidate className="mt-8 border-t border-linha pt-6">
      <h2 className="text-corpo font-medium text-tinta">{textos.titulo}</h2>
      <p className="mt-1 text-corpo text-tinta-suave">{textos.explicacao}</p>
      <Campo
        className="mt-4"
        rotulo={t("PedirNovoLink.email")}
        type="email"
        inputMode="email"
        autoComplete="email"
        value={email}
        erro={tentou && !valido ? t("PedirNovoLink.emailInvalido") : undefined}
        onChange={(e) => setEmail(e.target.value)}
      />
      {erro && (
        <Aviso variante="erro" anunciar className="mt-4">
          {erro}
        </Aviso>
      )}
      <Botao type="submit" variante="secundario" larguraTotal className="mt-4" aCarregar={aEnviar}>
        {textos.botao}
      </Botao>
    </form>
  );
};
