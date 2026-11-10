import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { BadgeCheck, CalendarClock, Check, HeartHandshake, Loader2, LogIn, UploadCloud } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import CopyRow from "@/components/CopyRow";
import FileDropzone from "@/components/FileDropzone";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useAuth } from "@/contexts/AuthContext";
import {
  apoiosMensaisApi,
  comprovativosApi,
  mensagemDeErroApi,
  TIPOS_DE_COMPROVATIVO_ACEITES,
  type ApoioMensalPublico,
} from "@/lib/apiClient";
import { formatarKz, lerValorMensal, NIVEIS_APOIO_MENSAL, VALOR_MENSAL_MINIMO_KZ } from "@/lib/apoioMensal";
import { DEFAULT_BANK_DATA, ofuscarValor } from "@/lib/pagamento";
import { formatarData } from "@/i18n/formatar";
import { localizar } from "@/i18n/rotas";

type Escolha = number | "outro" | null;

/** Dados para a transferência mensal: os mesmos de qualquer pagamento manual do site. */
const DadosBancarios = () => {
  const { t } = useTranslation();
  const banco = DEFAULT_BANK_DATA;
  return (
    <div className="space-y-1 divide-y divide-marca-marinho/10 rounded-lg border border-marca-marinho/20 bg-marca-marinho/5 p-4">
      <CopyRow label={t("Apoiar.beneficiario")} value={banco.beneficiario} />
      <CopyRow
        label={banco.pagamento_rapido.metodo}
        value={banco.pagamento_rapido.telefone}
        displayValue={ofuscarValor(banco.pagamento_rapido.telefone)}
      />
      <CopyRow
        label={`IBAN ${banco.transferencia_nacional.banco}`}
        value={banco.transferencia_nacional.iban}
        displayValue={ofuscarValor(banco.transferencia_nacional.iban)}
      />
    </div>
  );
};

/**
 * Envio do comprovativo do mês: os mesmos três passos de qualquer
 * comprovativo (a API assina o URL, o browser envia ao R2, a API grava) e
 * nunca "recebido" antes de os três confirmarem.
 */
const EnviarComprovativoMensal = ({ onEnviado }: { onEnviado: (apoio: ApoioMensalPublico) => void }) => {
  const { t } = useTranslation();
  const [ficheiro, setFicheiro] = useState<File | null>(null);
  const [aEnviar, setAEnviar] = useState(false);

  const enviar = async () => {
    if (!ficheiro) return;
    if (!TIPOS_DE_COMPROVATIVO_ACEITES.includes(ficheiro.type as never)) {
      toast.error(t("Apoiar.formatoNaoSuportadoUse"));
      return;
    }
    setAEnviar(true);
    try {
      const preparado = await comprovativosApi.preparar(ficheiro.type);
      await comprovativosApi.enviarParaStorage(preparado.url_de_upload, ficheiro);
      const apoio = await apoiosMensaisApi.enviarComprovativo(preparado.chave);
      toast.success(t("ApoioMensal.comprovativoRecebido"));
      setFicheiro(null);
      onEnviado(apoio);
    } catch (err) {
      console.error("Falha ao enviar comprovativo do apoio mensal:", err);
      toast.error(mensagemDeErroApi(err, t("Apoiar.naoFoiPossivelEnviar")));
    } finally {
      setAEnviar(false);
    }
  };

  return (
    <div className="space-y-3">
      <FileDropzone file={ficheiro} onFileChange={setFicheiro} />
      <Button
        onClick={enviar}
        disabled={!ficheiro || aEnviar}
        className="w-full bg-marca-marinho text-marca-marfim hover:bg-marca-marinho/90"
      >
        {aEnviar ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            {t("Apoiar.aEnviar")}
          </>
        ) : (
          <>
            <UploadCloud className="mr-2 h-4 w-4" />
            {t("ApoioMensal.enviarComprovativoDoMes")}
          </>
        )}
      </Button>
    </div>
  );
};

/** Estado de quem já é Kamba Mensal: o estatuto, o mês em curso e o envio do comprovativo. */
const ApoioActivo = ({
  apoio,
  onActualizar,
  onCancelado,
}: {
  apoio: ApoioMensalPublico;
  onActualizar: (a: ApoioMensalPublico) => void;
  onCancelado: () => void;
}) => {
  const { t } = useTranslation();
  const [aCancelar, setACancelar] = useState(false);

  const cancelar = async () => {
    setACancelar(true);
    try {
      await apoiosMensaisApi.cancelar();
      toast.success(t("ApoioMensal.cancelado"));
      onCancelado();
    } catch (err) {
      toast.error(mensagemDeErroApi(err, t("ApoioMensal.naoFoiPossivelCancelar")));
    } finally {
      setACancelar(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="rounded-2xl border-2 border-marca-ouro/60 bg-marca-ouro/10 p-6 text-center">
        <BadgeCheck className="mx-auto h-10 w-10 text-marca-marinho" aria-hidden="true" />
        <p className="mt-3 text-xs font-bold uppercase tracking-widest text-marca-marinho/70">{t("ApoioMensal.oSeuEstatuto")}</p>
        <h3 className="mt-1 text-2xl font-bold text-marca-marinho">{t("ApoioMensal.kambaMensal")}</h3>
        <p className="mt-2 text-marca-marinho/70">
          {t("ApoioMensal.resumoEstatuto", {
            valor: formatarKz(apoio.valor_mensal_kz),
            data: formatarData(apoio.criado_em),
            meses: apoio.meses_com_comprovativo,
          })}
        </p>
      </div>

      <div
        className={`flex items-start gap-3 rounded-xl border p-4 text-sm ${
          apoio.renovacao_em_falta ? "border-marca-ouro bg-marca-ouro/10" : "border-marca-turquesa/30 bg-marca-turquesa/5"
        }`}
        role="status"
      >
        {apoio.renovacao_em_falta ? (
          <CalendarClock className="mt-0.5 h-5 w-5 shrink-0 text-marca-marinho" aria-hidden="true" />
        ) : (
          <Check className="mt-0.5 h-5 w-5 shrink-0 text-marca-turquesa" aria-hidden="true" />
        )}
        <p>
          {apoio.renovacao_em_falta
            ? t("ApoioMensal.renovacaoEmFalta")
            : apoio.ultimo_comprovativo_em
              ? t("ApoioMensal.mesEmDia", { data: formatarData(apoio.ultimo_comprovativo_em) })
              : t("ApoioMensal.primeiroComprovativo")}
        </p>
      </div>

      <div className="space-y-4 rounded-2xl border border-marca-marinho/15 bg-marca-marfim p-6 shadow-card">
        <h4 className="font-bold text-marca-marinho">{t("ApoioMensal.transferenciaDoMes", { valor: formatarKz(apoio.valor_mensal_kz) })}</h4>
        <DadosBancarios />
        <EnviarComprovativoMensal onEnviado={onActualizar} />
      </div>

      <div className="text-center">
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <button type="button" className="text-sm text-marca-marinho/70 underline-offset-4 hover:underline">
              {t("ApoioMensal.deixarDeApoiar")}
            </button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t("ApoioMensal.confirmarCancelamentoTitulo")}</AlertDialogTitle>
              <AlertDialogDescription>{t("ApoioMensal.confirmarCancelamentoTexto")}</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t("ApoioMensal.continuarAApoiar")}</AlertDialogCancel>
              <AlertDialogAction onClick={cancelar} disabled={aCancelar}>
                {t("ApoioMensal.deixarDeApoiar")}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
};

/**
 * Doação mensal (Kamba Mensal). Não há débito automático em Angola sem um
 * gateway: a pessoa promete um valor por mês, transfere-o ela própria e envia
 * o comprovativo, como numa doação única. A API guarda a promessa na conta
 * (o estatuto aparece aqui e no painel) e lembra-a por email quando passa um
 * mês sem comprovativo. Por isso exige sessão.
 */
const DoacaoMensal = () => {
  const { t } = useTranslation();
  const { isLoggedIn, loading: aCarregarSessao } = useAuth();
  const [apoio, setApoio] = useState<ApoioMensalPublico | null>(null);
  const [aCarregar, setACarregar] = useState(false);
  const [erroAoCarregar, setErroAoCarregar] = useState(false);
  const [escolha, setEscolha] = useState<Escolha>(15000);
  const [valorOutro, setValorOutro] = useState("");
  const [aAderir, setAAderir] = useState(false);

  useEffect(() => {
    if (!isLoggedIn) return;
    let activo = true;
    setACarregar(true);
    setErroAoCarregar(false);
    apoiosMensaisApi
      .meu()
      .then((a) => activo && setApoio(a))
      .catch(() => activo && setErroAoCarregar(true))
      .finally(() => activo && setACarregar(false));
    return () => {
      activo = false;
    };
  }, [isLoggedIn]);

  const valorEscolhido = escolha === "outro" ? lerValorMensal(valorOutro) : escolha;

  const aderir = async () => {
    if (!valorEscolhido) return;
    setAAderir(true);
    try {
      const novo = await apoiosMensaisApi.aderir(valorEscolhido);
      setApoio(novo);
      toast.success(t("ApoioMensal.bemVindo"));
    } catch (err) {
      toast.error(mensagemDeErroApi(err, t("ApoioMensal.naoFoiPossivelAderir")));
    } finally {
      setAAderir(false);
    }
  };

  if (isLoggedIn && (aCarregar || aCarregarSessao)) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-marca-marinho/70" aria-label={t("ApoioMensal.aCarregar")} />
      </div>
    );
  }

  if (isLoggedIn && erroAoCarregar) {
    return <p className="py-12 text-center text-marca-marinho/70">{t("ApoioMensal.naoFoiPossivelCarregar")}</p>;
  }

  if (apoio) {
    return <ApoioActivo apoio={apoio} onActualizar={setApoio} onCancelado={() => setApoio(null)} />;
  }

  const proximo = encodeURIComponent("/apoiar?modo=mensal");

  return (
    <div>
      <div className="mx-auto mb-10 max-w-2xl space-y-2 text-center">
        <span className="inline-block text-xs font-bold uppercase tracking-widest text-marca-marinho">
          {t("ApoioMensal.tornarSeKamba")}
        </span>
        <h2 className="text-2xl font-bold text-marca-marinho md:text-3xl">{t("ApoioMensal.titulo")}</h2>
        <p className="text-marca-marinho/70">{t("ApoioMensal.explicacao")}</p>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3" role="radiogroup" aria-label={t("ApoioMensal.valorMensal")}>
        {NIVEIS_APOIO_MENSAL.map((nivel) => {
          const seleccionado = escolha === nivel.valor;
          return (
            <button
              key={nivel.valor}
              type="button"
              role="radio"
              aria-checked={seleccionado}
              onClick={() => setEscolha(nivel.valor)}
              className={`relative rounded-2xl border-2 bg-marca-marfim p-6 text-left transition-all hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-marca-marinho focus:ring-offset-2 ${
                seleccionado ? "border-marca-marinho shadow-elevated" : "border-marca-marinho/15 shadow-card"
              }`}
            >
              {seleccionado && (
                <span className="absolute right-4 top-4 inline-flex h-6 w-6 items-center justify-center rounded-full bg-marca-marinho text-marca-marfim">
                  <Check className="h-4 w-4" />
                </span>
              )}
              <p className="text-2xl font-bold text-marca-marinho">
                {formatarKz(nivel.valor)}
                <span className="text-sm font-medium text-marca-marinho/70">{t("ApoioMensal.porMes")}</span>
              </p>
              <p className="mt-3 text-sm leading-relaxed text-marca-marinho/70">{t(nivel.impacto)}</p>
            </button>
          );
        })}
      </div>

      <div
        className={`mb-8 rounded-2xl border-2 bg-marca-marfim p-5 transition-colors ${
          escolha === "outro" ? "border-marca-marinho" : "border-marca-marinho/15"
        }`}
      >
        <button
          type="button"
          role="radio"
          aria-checked={escolha === "outro"}
          onClick={() => setEscolha("outro")}
          className="text-left font-semibold text-marca-marinho"
        >
          {t("ApoioMensal.outroValor")}
        </button>
        {escolha === "outro" && (
          <div className="mt-3 max-w-xs space-y-1.5">
            <Label htmlFor="valor-mensal-outro">{t("ApoioMensal.valorEmKz")}</Label>
            <Input
              id="valor-mensal-outro"
              inputMode="numeric"
              value={valorOutro}
              onChange={(e) => setValorOutro(e.target.value)}
              placeholder="10.000"
              aria-invalid={valorOutro !== "" && valorEscolhido === null}
            />
            <p className="text-xs text-marca-marinho/70">
              {t("ApoioMensal.valorMinimo", { valor: formatarKz(VALOR_MENSAL_MINIMO_KZ) })}
            </p>
          </div>
        )}
      </div>

      <div className="mx-auto max-w-2xl space-y-3">
        {isLoggedIn ? (
          <Button
            onClick={aderir}
            disabled={!valorEscolhido || aAderir}
            size="lg"
            className="w-full bg-marca-marinho text-marca-marfim hover:bg-marca-marinho/90"
          >
            {aAderir ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <HeartHandshake className="mr-2 h-5 w-5" />
            )}
            {valorEscolhido
              ? t("ApoioMensal.tornarMeKambaCom", { valor: formatarKz(valorEscolhido) })
              : t("ApoioMensal.escolhaUmValor")}
          </Button>
        ) : (
          <>
            <Button asChild size="lg" className="w-full bg-marca-marinho text-marca-marfim hover:bg-marca-marinho/90">
              <Link to={`${localizar("/auth")}?next=${proximo}`}>
                <LogIn className="mr-2 h-5 w-5" />
                {t("ApoioMensal.entrarParaContinuar")}
              </Link>
            </Button>
            <p className="text-center text-sm text-marca-marinho/70">{t("ApoioMensal.porqueConta")}</p>
          </>
        )}
        <p className="text-center text-xs text-marca-marinho/70">{t("ApoioMensal.semDebitoAutomatico")}</p>
      </div>
    </div>
  );
};

export default DoacaoMensal;
