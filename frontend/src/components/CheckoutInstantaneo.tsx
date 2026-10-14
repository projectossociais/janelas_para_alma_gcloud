import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AlertCircle, ArrowLeft, CheckCircle2, Clock, Loader2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import FileDropzone from "@/components/FileDropzone";
import CopyRow from "@/components/CopyRow";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/contexts/ProfileContext";
import { useAcessoExercicios } from "@/contexts/AcessoExerciciosContext";
import {
  mensagemDeErroApi,
  pagamentosApi,
  type ResultadoValidacaoComprovativo,
} from "@/lib/apiClient";
import { DEFAULT_BANK_DATA } from "@/lib/pagamento";
import { formatarData } from "@/i18n/formatar";
import { localizar } from "@/i18n/rotas";
import { useTranslation } from "react-i18next";

/** Depois de aprovado, quanto tempo o ecrã de sucesso fica antes de abrir
 *  os exercícios. */
export const ATRASO_REDIRECCIONAR_MS = 2000;

type Fase = "escolher" | "a_validar" | "aprovado" | "revisao";

interface CheckoutInstantaneoProps {
  onVoltar: () => void;
}

/**
 * Checkout do plano mensal com validação instantânea do comprovativo: o
 * utilizador paga no BAI Directo / Multicaixa Express, envia o PDF original
 * e a API decide na hora (ver `validacao_comprovativo_service.py`).
 *
 * Três passos, como o avatar: a API assina o URL, o PDF vai directo ao R2,
 * e só depois se pede a validação. Nunca mostra sucesso a partir de um
 * `catch` -- só quando a API responde `aprovado` (CLAUDE.md §6). O acesso é
 * sempre decidido pela API; aqui só se recarrega o que ela já gravou.
 */
const CheckoutInstantaneo = ({ onVoltar }: CheckoutInstantaneoProps) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { isLoggedIn } = useAuth();
  const { refetch: recarregarPerfil } = useProfile();
  const { refetch: recarregarAcesso } = useAcessoExercicios();
  const [ficheiro, setFicheiro] = useState<File | null>(null);
  const [fase, setFase] = useState<Fase>("escolher");
  const [erro, setErro] = useState<string | null>(null);
  const [resultado, setResultado] = useState<ResultadoValidacaoComprovativo | null>(null);

  useEffect(() => {
    if (fase !== "aprovado") return;
    const temporizador = setTimeout(() => navigate(localizar("/exercicios")), ATRASO_REDIRECCIONAR_MS);
    return () => clearTimeout(temporizador);
  }, [fase, navigate]);

  const validar = async () => {
    if (!ficheiro) return;
    setErro(null);
    setFase("a_validar");
    try {
      const { url_de_upload, chave } = await pagamentosApi.prepararComprovativo();
      await pagamentosApi.enviarParaStorage(url_de_upload, ficheiro);
      const r = await pagamentosApi.validarComprovativo(chave);
      setResultado(r);
      if (r.estado === "aprovado") {
        setFase("aprovado");
        // O Premium já está gravado; isto só actualiza a interface.
        void recarregarAcesso();
        void recarregarPerfil();
      } else {
        setFase("revisao");
      }
    } catch (err) {
      console.error("Falha ao validar o comprovativo:", err);
      setErro(mensagemDeErroApi(err, t("CheckoutInstantaneo.naoFoiPossivelValidar")));
      setFase("escolher");
    }
  };

  if (fase === "aprovado" && resultado) {
    return (
      <div className="text-center animate-fade-in" role="status">
        <div className="relative mx-auto w-20 h-20 mt-8 mb-6">
          <span className="absolute inset-0 rounded-full bg-green/30 animate-ping" aria-hidden="true" />
          <div className="relative w-20 h-20 rounded-full bg-green/15 flex items-center justify-center">
            <CheckCircle2 className="w-12 h-12 text-green" strokeWidth={2.5} />
          </div>
        </div>
        <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-3">
          {t("CheckoutInstantaneo.pagamentoConfirmado")}
        </h1>
        <p className="text-muted-foreground leading-relaxed mb-6">{t("CheckoutInstantaneo.acessoLiberado")}</p>
        <dl className="rounded-xl border border-border bg-card p-4 text-left space-y-2 mb-6">
          {resultado.referencia_transacao && (
            <div className="flex justify-between gap-3 text-sm">
              <dt className="text-muted-foreground">{t("CheckoutInstantaneo.numeroDaOperacao")}</dt>
              <dd className="font-semibold text-foreground break-all">{resultado.referencia_transacao}</dd>
            </div>
          )}
          {resultado.premium_expira_em && (
            <div className="flex justify-between gap-3 text-sm">
              <dt className="text-muted-foreground">{t("CheckoutInstantaneo.validoAte")}</dt>
              <dd className="font-semibold text-foreground">{formatarData(resultado.premium_expira_em)}</dd>
            </div>
          )}
        </dl>
        <p className="text-xs text-muted-foreground mb-4">{t("CheckoutInstantaneo.aAbrirOsExercicios")}</p>
        <Button
          size="lg"
          onClick={() => navigate(localizar("/exercicios"))}
          className="bg-gradient-to-r from-teal to-navy text-primary-foreground hover:opacity-90"
        >
          {t("CheckoutInstantaneo.irParaOsExercicios")}
        </Button>
      </div>
    );
  }

  if (fase === "revisao") {
    return (
      <div className="text-center animate-fade-in" role="status">
        <div className="mx-auto w-20 h-20 rounded-full bg-gold/15 flex items-center justify-center mb-6">
          <Clock className="w-11 h-11 text-gold" strokeWidth={2.2} />
        </div>
        <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-3">
          {t("CheckoutInstantaneo.comprovativoRecebido")}
        </h1>
        <p className="text-muted-foreground leading-relaxed mb-8">
          {t("CheckoutInstantaneo.aEquipaVaiConfirmar")}
        </p>
        <Button
          size="lg"
          onClick={() => navigate(localizar("/"))}
          className="bg-gradient-to-r from-teal to-navy text-primary-foreground hover:opacity-90"
        >
          {t("CheckoutInstantaneo.voltarAPaginaInicial")}
        </Button>
      </div>
    );
  }

  const aValidar = fase === "a_validar";

  return (
    <div className="flex flex-col space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-foreground">{t("CheckoutInstantaneo.pagamento")}</h1>
        <p className="text-sm text-muted-foreground mt-1">{t("CheckoutInstantaneo.libertaNaHora")}</p>
      </div>

      {/* Passo 1 -- dados para pagamento */}
      <section className="space-y-3" aria-labelledby="checkout-passo-1">
        <h2 id="checkout-passo-1" className="font-semibold text-foreground">
          {t("CheckoutInstantaneo.passo1DadosParaPagamento")}
        </h2>
        <div className="rounded-xl border border-border bg-card p-4 flex items-baseline justify-between gap-2">
          <span className="text-sm font-semibold text-foreground">{t("CheckoutInstantaneo.valorAPagar")}</span>
          <span className="text-xl font-bold text-navy">{t("CheckoutInstantaneo.valorPorMes")}</span>
        </div>
        <div className="rounded-lg border border-navy/20 bg-navy/5 p-4 space-y-1 divide-y divide-navy/10">
          <CopyRow label={t("CheckoutInstantaneo.titular")} value={DEFAULT_BANK_DATA.beneficiario} />
          <CopyRow
            label={`IBAN ${DEFAULT_BANK_DATA.transferencia_nacional.banco}`}
            value={DEFAULT_BANK_DATA.transferencia_nacional.iban}
          />
          <CopyRow
            label={DEFAULT_BANK_DATA.pagamento_rapido.metodo}
            value={DEFAULT_BANK_DATA.pagamento_rapido.telefone}
          />
        </div>
        <ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground">
          <li>{t("CheckoutInstantaneo.instrucao1")}</li>
          <li>{t("CheckoutInstantaneo.instrucao2")}</li>
          <li>{t("CheckoutInstantaneo.instrucao3")}</li>
        </ol>
      </section>

      <hr className="border-border" />

      {/* Passo 2 -- upload e validação */}
      <section className="space-y-3" aria-labelledby="checkout-passo-2">
        <h2 id="checkout-passo-2" className="font-semibold text-foreground">
          {t("CheckoutInstantaneo.passo2JaPaguei")}
        </h2>

        {!isLoggedIn ? (
          <div className="rounded-lg border border-border bg-muted/40 p-4 text-sm text-foreground space-y-3">
            <p>{t("CheckoutInstantaneo.entraParaValidar")}</p>
            <Button asChild variant="outline" size="sm">
              <Link to={localizar("/auth?next=/registo-premium")}>{t("CheckoutInstantaneo.entrarNaConta")}</Link>
            </Button>
          </div>
        ) : (
          <>
            <p className="flex items-start gap-2 text-xs text-muted-foreground">
              <ShieldCheck className="w-4 h-4 shrink-0 text-teal mt-0.5" />
              {t("CheckoutInstantaneo.usaOPdfOriginal")}
            </p>
            <FileDropzone file={ficheiro} onFileChange={setFicheiro} apenasPdf />
            {erro && (
              <div
                role="alert"
                className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"
              >
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{erro}</span>
              </div>
            )}
          </>
        )}
      </section>

      <div className="flex gap-3">
        <Button type="button" variant="outline" size="lg" onClick={onVoltar} disabled={aValidar} className="flex-1">
          <ArrowLeft className="w-4 h-4" /> {t("CheckoutInstantaneo.voltar")}
        </Button>
        <Button
          type="button"
          size="lg"
          onClick={() => void validar()}
          disabled={!isLoggedIn || !ficheiro || aValidar}
          className="flex-[2] bg-gradient-to-r from-teal to-navy text-primary-foreground hover:opacity-90"
        >
          {aValidar ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" /> {t("CheckoutInstantaneo.aVerificar")}
            </>
          ) : (
            t("CheckoutInstantaneo.validarEPagar")
          )}
        </Button>
      </div>
      {aValidar && (
        <p className="text-center text-xs text-muted-foreground" role="status">
          {t("CheckoutInstantaneo.aVerificarAutenticidade")}
        </p>
      )}
    </div>
  );
};

export default CheckoutInstantaneo;
