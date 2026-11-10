import { useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  CalendarClock,
  Check,
  Landmark,
  ShieldCheck,
  Smartphone,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import CopyRow from "@/components/CopyRow";
import FileDropzone from "@/components/FileDropzone";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  comprovativosApi,
  doacoesApi,
  mensagemDeErroApi,
  TIPOS_DE_COMPROVATIVO_ACEITES,
} from "@/lib/apiClient";
import {
  agruparMilhares,
  detalhesDoDonativo,
  lerValorKz,
  VALOR_MINIMO_KZ,
  VALORES_DOACAO_KZ,
  type FrequenciaDoacao,
} from "@/lib/doacao";
import { DEFAULT_BANK_DATA, ofuscarValor } from "@/lib/pagamento";
import { tPt } from "@/i18n";

type Passo = "valor" | "pagamento" | "comprovativo" | "concluido";
type Metodo = "express" | "transferencia";

// Cada frequência tem a sua cor da paleta, do separador ao botão final, para
// que o doador saiba sempre se está a doar uma vez (marinho) ou todos os meses
// (verde). Classes escritas por extenso: o Tailwind não vê classes montadas.
const COR_FREQUENCIA: Record<
  FrequenciaDoacao,
  { separador: string; separadorHover: string; valor: string; valorHover: string; borda: string; foco: string; botao: string; ponto: string; caixa: string }
> = {
  unica: {
    separador: "bg-navy text-navy-foreground shadow-sm",
    separadorHover: "hover:text-navy",
    valor: "border-navy bg-navy text-navy-foreground",
    valorHover: "hover:border-navy/30",
    borda: "border-navy",
    foco: "focus-within:border-navy",
    botao: "bg-navy text-navy-foreground hover:bg-navy/90",
    ponto: "bg-navy",
    caixa: "divide-navy/10 bg-navy/5",
  },
  mensal: {
    separador: "bg-green text-green-foreground shadow-sm",
    separadorHover: "hover:text-green",
    valor: "border-green bg-green text-green-foreground",
    valorHover: "hover:border-green/30",
    borda: "border-green",
    foco: "focus-within:border-green",
    botao: "bg-green text-green-foreground hover:bg-green/90",
    ponto: "bg-green",
    caixa: "divide-green/10 bg-green/5",
  },
};

const LIMITE_NOTA = 300;
const EMAIL_VALIDO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const METODOS: { id: Metodo; chave: string; icon: LucideIcon }[] = [
  { id: "express", chave: "DoacaoFinanceira.multicaixaExpress", icon: Smartphone },
  { id: "transferencia", chave: "DoacaoFinanceira.transferenciaBancaria", icon: Landmark },
];

const CHAVE_FREQUENCIA: Record<FrequenciaDoacao, string> = {
  unica: "DoacaoFinanceira.umaUnicaVez",
  mensal: "DoacaoFinanceira.mensalmente",
};

/** Como a frequência aparece no texto para a equipa ("Mensal · 25.000 Kz · ..."). */
const CHAVE_FREQUENCIA_DETALHES: Record<FrequenciaDoacao, string> = {
  unica: "DoacaoFinanceira.umaUnicaVez",
  mensal: "DoacaoFinanceira.mensal",
};

/**
 * Apoio Financeiro em três passos, no formato dos formulários de doação
 * habituais: valor e frequência -> resumo e forma de pagar -> comprovativo.
 * O sucesso só aparece depois de a API confirmar o registo (CLAUDE.md §6).
 */
const DoacaoFinanceira = ({ frequenciaInicial = "unica" }: { frequenciaInicial?: FrequenciaDoacao }) => {
  const { t } = useTranslation();
  const [passo, setPasso] = useState<Passo>("valor");
  const [frequencia, setFrequencia] = useState<FrequenciaDoacao>(frequenciaInicial);
  const [valorSugerido, setValorSugerido] = useState<number | null>(null);
  const [outroValor, setOutroValor] = useState("");
  const [comNota, setComNota] = useState(false);
  const [nota, setNota] = useState("");
  const [metodo, setMetodo] = useState<Metodo | null>(null);
  const [email, setEmail] = useState("");
  const [comprovativo, setComprovativo] = useState<File | null>(null);
  const [aEnviar, setAEnviar] = useState(false);
  const [reciboId, setReciboId] = useState<string | null>(null);

  const valorOutro = outroValor.trim() ? lerValorKz(outroValor) : null;
  const valor = valorSugerido ?? valorOutro;
  const valorValido = valor !== null && valor >= VALOR_MINIMO_KZ;
  const outroInvalido = outroValor.trim() !== "" && !valorValido;
  const mensal = frequencia === "mensal";
  const cor = COR_FREQUENCIA[frequencia];
  const valorTexto = valor !== null ? t("DoacaoFinanceira.valorKz", { valor: agruparMilhares(valor) }) : "";

  const recomecar = () => {
    setPasso("valor");
    setValorSugerido(null);
    setOutroValor("");
    setComNota(false);
    setNota("");
    setMetodo(null);
    setComprovativo(null);
    setReciboId(null);
  };

  const concluir = async () => {
    if (!comprovativo) {
      toast.error(t("Apoiar.anexeOComprovativoDa2"));
      return;
    }
    if (!TIPOS_DE_COMPROVATIVO_ACEITES.includes(comprovativo.type as never)) {
      toast.error(t("Apoiar.formatoNaoSuportadoUse"));
      return;
    }
    if (valor === null || valor < VALOR_MINIMO_KZ || !metodo) return;

    setAEnviar(true);
    try {
      const detalhes = detalhesDoDonativo({
        frequencia: tPt(CHAVE_FREQUENCIA_DETALHES[frequencia]),
        valorKz: valor,
        metodo: tPt(METODOS.find((m) => m.id === metodo)!.chave),
        nota: comNota ? nota : undefined,
      });
      // Três passos (CROSS-02): a API assina o URL, o browser envia os bytes
      // directamente ao R2, e só depois a doação é criada com a chave.
      const preparado = await comprovativosApi.preparar(comprovativo.type);
      await comprovativosApi.enviarParaStorage(preparado.url_de_upload, comprovativo);
      const doacao = await doacoesApi.registarFinanceira(email, detalhes, preparado.chave, frequencia);

      toast.success(t("Apoiar.comprovativoRecebidoComSucesso"));
      setReciboId(doacao.recibo_id);
      setPasso("concluido");
    } catch (err) {
      console.error("Falha ao processar comprovativo:", err);
      toast.error(mensagemDeErroApi(err, t("Apoiar.naoFoiPossivelEnviar")));
    } finally {
      setAEnviar(false);
    }
  };

  const Cabecalho = ({ titulo, voltarPara }: { titulo: string; voltarPara?: Passo }) => (
    <div className="relative flex items-center justify-center gap-2 min-h-9">
      {voltarPara && (
        <button
          type="button"
          onClick={() => setPasso(voltarPara)}
          disabled={aEnviar}
          aria-label={t("Apoiar.voltar")}
          className="absolute left-0 inline-flex h-9 w-9 items-center justify-center rounded-full text-foreground hover:bg-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-navy"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
      )}
      <ShieldCheck className="h-5 w-5 text-teal" aria-hidden="true" />
      <h3 className="text-lg font-semibold text-foreground">{titulo}</h3>
    </div>
  );

  return (
    <div className="mx-auto max-w-lg overflow-hidden rounded-2xl border border-border/60 bg-card shadow-card">
      <div className="space-y-6 p-5 md:p-8">
        {passo === "valor" && (
          <div key="valor" className="space-y-5 animate-in fade-in-0 duration-300">
            <Cabecalho titulo={t("DoacaoFinanceira.escolhaOValor")} />

            <div className="grid grid-cols-2 gap-1 rounded-xl bg-muted p-1" role="group" aria-label={t("DoacaoFinanceira.frequencia")}>
              {(["unica", "mensal"] as const).map((f) => (
                <button
                  key={f}
                  type="button"
                  aria-pressed={frequencia === f}
                  onClick={() => {
                    // Cada frequência tem os seus valores: o escolhido deixa de fazer sentido.
                    if (f !== frequencia) setValorSugerido(null);
                    setFrequencia(f);
                  }}
                  className={`rounded-lg py-2.5 text-sm font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-navy ${
                    frequencia === f
                      ? COR_FREQUENCIA[f].separador
                      : `text-muted-foreground ${COR_FREQUENCIA[f].separadorHover}`
                  }`}
                >
                  {t(CHAVE_FREQUENCIA[f])}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {VALORES_DOACAO_KZ[frequencia].map((v) => {
                const escolhido = valorSugerido === v;
                return (
                  <button
                    key={v}
                    type="button"
                    aria-pressed={escolhido}
                    onClick={() => {
                      setValorSugerido(v);
                      setOutroValor("");
                    }}
                    className={`rounded-xl border-2 py-3.5 text-base font-bold tabular-nums transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-navy ${
                      escolhido
                        ? cor.valor
                        : `border-transparent bg-muted text-foreground ${cor.valorHover}`
                    }`}
                  >
                    {t("DoacaoFinanceira.valorKz", { valor: agruparMilhares(v) })}
                  </button>
                );
              })}
            </div>

            <div className="space-y-1.5">
              <div
                className={`flex items-center rounded-xl border-2 bg-muted px-4 ${cor.foco} ${
                  valorSugerido === null && valorValido ? cor.borda : "border-transparent"
                }`}
              >
                <Input
                  id="doacao-outro-valor"
                  inputMode="numeric"
                  autoComplete="off"
                  maxLength={11}
                  value={outroValor}
                  onChange={(e) => {
                    setOutroValor(e.target.value);
                    setValorSugerido(null);
                  }}
                  placeholder={t("DoacaoFinanceira.outroValor")}
                  aria-label={t("DoacaoFinanceira.outroValor")}
                  aria-invalid={outroInvalido}
                  aria-describedby="doacao-minimo"
                  className="h-12 border-0 bg-transparent px-0 text-base shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
                />
                <span className="text-sm font-semibold text-muted-foreground">Kz</span>
              </div>
              <p
                id="doacao-minimo"
                className={`text-xs ${outroInvalido ? "text-destructive" : "text-muted-foreground"}`}
              >
                {t("DoacaoFinanceira.valorMinimo", { valor: agruparMilhares(VALOR_MINIMO_KZ) })}
              </p>
            </div>

            <div className="space-y-2">
              <label className="flex cursor-pointer items-center gap-2.5 text-sm text-foreground">
                <Checkbox checked={comNota} onCheckedChange={(v) => setComNota(v === true)} />
                {t("DoacaoFinanceira.adicionarNota")}
              </label>
              {comNota && (
                <Textarea
                  value={nota}
                  onChange={(e) => setNota(e.target.value.slice(0, LIMITE_NOTA))}
                  maxLength={LIMITE_NOTA}
                  rows={3}
                  aria-label={t("DoacaoFinanceira.adicionarNota")}
                  placeholder={t("DoacaoFinanceira.notaPlaceholder")}
                />
              )}
            </div>

            <Button
              size="lg"
              className={`w-full ${cor.botao}`}
              disabled={!valorValido}
              onClick={() => setPasso("pagamento")}
            >
              {t("Apoiar.continuar")}
            </Button>
          </div>
        )}

        {passo === "pagamento" && valor !== null && (
          <div key="pagamento" className="space-y-5 animate-in fade-in-0 slide-in-from-right-4 duration-300">
            <Cabecalho titulo={t("DoacaoFinanceira.resumo")} voltarPara="valor" />

            <div>
              <p className="text-3xl font-bold tabular-nums text-foreground">
                {valorTexto}
                {mensal && <span className="text-xl font-semibold text-muted-foreground"> {t("DoacaoFinanceira.porMes")}</span>}
              </p>
              <p className="text-sm text-muted-foreground">
                {mensal ? t("DoacaoFinanceira.todosOsMeses") : t("DoacaoFinanceira.umaUnicaVez")}
              </p>
            </div>

            <div className="space-y-2">
              <h4 className="font-semibold text-foreground">{t("DoacaoFinanceira.escolhaComoPagar")}</h4>
              <div className="divide-y divide-border/60 overflow-hidden rounded-xl border border-border/60" role="radiogroup">
                {METODOS.map((m) => {
                  const escolhido = metodo === m.id;
                  return (
                    <div key={m.id}>
                      <button
                        type="button"
                        role="radio"
                        aria-checked={escolhido}
                        onClick={() => setMetodo(m.id)}
                        className="flex w-full items-center gap-3 px-4 py-3.5 text-left hover:bg-muted/50 focus:outline-none focus-visible:bg-muted"
                      >
                        <span
                          className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${
                            escolhido ? cor.borda : "border-muted-foreground/40"
                          }`}
                          aria-hidden="true"
                        >
                          {escolhido && <span className={`h-2.5 w-2.5 rounded-full ${cor.ponto}`} />}
                        </span>
                        <span className="flex-1 font-medium text-foreground">{t(m.chave)}</span>
                        <m.icon className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
                      </button>
                      {escolhido && (
                        <div className={`space-y-1 divide-y px-4 py-3 ${cor.caixa}`}>
                          <CopyRow label={t("Apoiar.beneficiario")} value={DEFAULT_BANK_DATA.beneficiario} />
                          {m.id === "express" ? (
                            <CopyRow
                              label={DEFAULT_BANK_DATA.pagamento_rapido.metodo}
                              value={DEFAULT_BANK_DATA.pagamento_rapido.telefone}
                              displayValue={ofuscarValor(DEFAULT_BANK_DATA.pagamento_rapido.telefone)}
                            />
                          ) : (
                            <CopyRow
                              label={`IBAN ${DEFAULT_BANK_DATA.transferencia_nacional.banco}`}
                              value={DEFAULT_BANK_DATA.transferencia_nacional.iban}
                              displayValue={ofuscarValor(DEFAULT_BANK_DATA.transferencia_nacional.iban)}
                            />
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {mensal && (
              <div className="flex gap-3 rounded-xl border border-green/30 bg-green/10 p-4 text-sm text-foreground">
                <CalendarClock className="mt-0.5 h-5 w-5 shrink-0 text-green" aria-hidden="true" />
                <p>{t("DoacaoFinanceira.comoDoarTodosOsMeses", { valor: valorTexto })}</p>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="doacao-email">{t("Apoiar.insiraOSeuEmail")}</Label>
              <Input
                id="doacao-email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu@email.com"
              />
            </div>

            <Button
              size="lg"
              className={`w-full ${cor.botao}`}
              disabled={!metodo || !EMAIL_VALIDO.test(email.trim())}
              onClick={() => setPasso("comprovativo")}
            >
              <span className="inline-flex items-center gap-2">
                {t("DoacaoFinanceira.jaTransferi")}
                <ArrowRight className="h-4 w-4" />
              </span>
            </Button>
          </div>
        )}

        {passo === "comprovativo" && (
          <div key="comprovativo" className="space-y-5 animate-in fade-in-0 slide-in-from-right-4 duration-300">
            <Cabecalho titulo={t("Apoiar.enviarComprovativo")} voltarPara="pagamento" />
            <p className="text-center text-sm text-muted-foreground">
              {t("DoacaoFinanceira.anexeOComprovativo", { valor: valorTexto })}
            </p>
            <FileDropzone file={comprovativo} onFileChange={setComprovativo} />
            <Button
              size="lg"
              className={`w-full ${cor.botao}`}
              disabled={aEnviar || !comprovativo}
              onClick={concluir}
            >
              {aEnviar ? t("Apoiar.aEnviar") : t("Apoiar.concluirDoacao")}
            </Button>
          </div>
        )}

        {passo === "concluido" && (
          <div key="concluido" className="space-y-4 text-center animate-in fade-in-0 zoom-in-95 duration-300">
            <div className="mx-auto inline-flex h-14 w-14 items-center justify-center rounded-full bg-teal/15 text-teal">
              <Check className="h-7 w-7" />
            </div>
            <h3 className="text-xl font-bold text-foreground">{t("DoacaoFinanceira.obrigado")}</h3>
            <p className="text-sm text-muted-foreground">{t("DoacaoFinanceira.recebemosOComprovativo", { email })}</p>
            {mensal && (
              <p className="rounded-xl bg-gold/10 p-3 text-sm text-foreground">
                {t("DoacaoFinanceira.lembreteMensal", { valor: valorTexto })}
              </p>
            )}
            {reciboId && (
              <p className="text-xs text-muted-foreground">
                {t("DoacaoFinanceira.recibo")} <span className="font-mono">{reciboId}</span>
              </p>
            )}
            <Button variant="outline" onClick={recomecar} className="w-full">
              {t("DoacaoFinanceira.fazerOutraDoacao")}
            </Button>
          </div>
        )}
      </div>

      <div className="flex items-start gap-2 border-t border-border/60 bg-muted/40 px-5 py-3 text-xs text-muted-foreground md:px-8">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-teal" aria-hidden="true" />
        <span>{t("DoacaoFinanceira.semCartao")}</span>
      </div>
    </div>
  );
};

export default DoacaoFinanceira;
