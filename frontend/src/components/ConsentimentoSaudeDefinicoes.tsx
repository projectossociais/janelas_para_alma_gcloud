import { useState } from "react";
import { ShieldCheck } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { useConsentimentoSaude } from "@/contexts/ConsentimentoSaudeContext";
import { Aviso } from "@/design/componentes/Aviso";
import { Botao } from "@/design/componentes/Botao";
import { Dialogo, DialogoConteudo, DialogoFechar } from "@/design/componentes/Dialogo";
import { mensagemDeErroApi } from "@/lib/apiClient";

/**
 * Direito de retirar o consentimento para dados de saúde (Lei 22/11). Retirar
 * não apaga o que já existe (isso é a eliminação da conta): deixa de se
 * gravar o que é novo. Só mostra sucesso depois de a API confirmar; um erro
 * fica no diálogo, que continua aberto.
 */
const ConsentimentoSaudeDefinicoes = () => {
  const { t } = useTranslation();
  const { consentido, carregando, retirar } = useConsentimentoSaude();
  const [aRetirar, setARetirar] = useState(false);
  const [aberto, setAberto] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const confirmarRetirar = async () => {
    setARetirar(true);
    setErro(null);
    try {
      await retirar();
      setAberto(false);
      toast.success(t("ConsentimentoSaude.retirado"));
    } catch (err) {
      setErro(mensagemDeErroApi(err, t("ConsentimentoSaude.erroRetirar")));
    } finally {
      setARetirar(false);
    }
  };

  return (
    <section aria-labelledby="definicoes-consentimento" className="rounded-cartao border border-linha bg-superficie p-5">
      <h2 id="definicoes-consentimento" className="flex items-center gap-2 text-titulo-p text-tinta">
        <ShieldCheck className="size-5 text-accao" aria-hidden /> {t("ConsentimentoSaude.seccaoTitulo")}
      </h2>
      {!carregando && (
        <p className="mt-1 text-corpo text-tinta-suave">
          {consentido ? t("ConsentimentoSaude.estadoDado") : t("ConsentimentoSaude.estadoNaoDado")}
        </p>
      )}
      {consentido && (
        <Dialogo
          open={aberto}
          onOpenChange={(v) => {
            if (aRetirar) return;
            setAberto(v);
            setErro(null);
          }}
        >
          <Botao variante="secundario" className="mt-4" onClick={() => setAberto(true)}>
            {t("ConsentimentoSaude.retirar")}
          </Botao>
          <DialogoConteudo
            titulo={t("ConsentimentoSaude.retirar")}
            descricao={t("ConsentimentoSaude.retirarConfirmar")}
            rotuloFechar={t("Configuracoes.fechar")}
            rodape={
              <>
                <DialogoFechar asChild>
                  <Botao variante="secundario" disabled={aRetirar}>
                    {t("ConsentimentoSaude.cancelar")}
                  </Botao>
                </DialogoFechar>
                <Botao variante="perigo" aCarregar={aRetirar} onClick={() => void confirmarRetirar()}>
                  {t("ConsentimentoSaude.retirar")}
                </Botao>
              </>
            }
          >
            {erro && (
              <Aviso variante="erro" anunciar>
                {erro}
              </Aviso>
            )}
          </DialogoConteudo>
        </Dialogo>
      )}
    </section>
  );
};

export default ConsentimentoSaudeDefinicoes;
