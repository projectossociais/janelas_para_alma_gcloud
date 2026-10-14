import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  mensagemDeErroApi,
  pagamentosApi,
  type ComprovativoPagamentoAdmin,
  type ComprovativoPagamentoDetalhe,
  type EstadoComprovativo,
} from "@/lib/apiClient";
import { toast } from "sonner";
import { Check, Eye, FileText, Undo2, X } from "lucide-react";

const FILTROS: { valor: EstadoComprovativo | "todos"; rotulo: string }[] = [
  { valor: "revisao_manual", rotulo: "Por confirmar" },
  { valor: "aprovado", rotulo: "Aprovados" },
  { valor: "rejeitado", rotulo: "Rejeitados" },
  { valor: "revogado", rotulo: "Revogados" },
  { valor: "todos", rotulo: "Todos" },
];

const ESTADO: Record<EstadoComprovativo, { rotulo: string; variante: "default" | "secondary" | "destructive" | "outline" }> = {
  aprovado: { rotulo: "Aprovado", variante: "default" },
  revisao_manual: { rotulo: "Por confirmar", variante: "secondary" },
  rejeitado: { rotulo: "Rejeitado", variante: "destructive" },
  revogado: { rotulo: "Revogado", variante: "outline" },
};

const ORIGEM: Record<string, string> = {
  bai_directo: "BAI Directo",
  multicaixa_express: "Multicaixa Express",
  bfa: "BFA",
  bic: "Banco BIC",
  atlantico: "Millennium Atlântico",
  banco_sol: "Banco Sol",
  standard_bank: "Standard Bank",
  keve: "Banco Keve",
  access_bank: "Access Bank",
  bni: "BNI",
  caixa_angola: "Caixa Geral Angola",
  outro: "Origem desconhecida",
};

const kz = (v: string | null) =>
  v === null ? "—" : `${Number(v).toLocaleString("pt-PT", { minimumFractionDigits: 2 })} Kz`;
const dataHora = (v: string | null) => (v ? new Date(v).toLocaleString("pt-PT") : "—");

type Accao = { tipo: "rejeitar" | "revogar"; comprovativo: ComprovativoPagamentoAdmin };

/**
 * Auditoria dos comprovativos de pagamento do Premium validados
 * automaticamente. Três trabalhos:
 * - confirmar à mão os que ficaram "por confirmar" (layout novo, PDF
 *   regravado...) e os rejeitados por engano;
 * - reconciliar os aprovados automaticamente com o extracto bancário -- a
 *   validação lê o PDF, não vê a conta; um PDF forjado com cuidado passa;
 * - revogar um aprovado que não esteja no extracto.
 * Cada decisão é da API (ValidacaoComprovativoService); aqui só se pede.
 */
const AdminComprovativos = () => {
  const [filtro, setFiltro] = useState<EstadoComprovativo | "todos">("revisao_manual");
  const [lista, setLista] = useState<ComprovativoPagamentoAdmin[]>([]);
  const [aCarregar, setACarregar] = useState(true);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [detalhe, setDetalhe] = useState<ComprovativoPagamentoDetalhe | null>(null);
  const [accao, setAccao] = useState<Accao | null>(null);
  const [motivo, setMotivo] = useState("");

  const carregar = useCallback(async () => {
    setACarregar(true);
    try {
      setLista(await pagamentosApi.listar(filtro === "todos" ? undefined : filtro));
    } catch (err) {
      toast.error(mensagemDeErroApi(err, "Não foi possível carregar os comprovativos."));
    } finally {
      setACarregar(false);
    }
  }, [filtro]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const abrirPdf = async (id: string) => {
    // A janela abre já (antes do await) para não ser bloqueada como pop-up.
    const janela = window.open("", "_blank");
    try {
      const { url } = await pagamentosApi.urlDoFicheiro(id);
      if (janela) janela.location.href = url;
      else window.location.href = url;
    } catch (err) {
      janela?.close();
      toast.error(mensagemDeErroApi(err, "Não foi possível abrir o PDF."));
    }
  };

  const verDetalhe = async (id: string) => {
    try {
      setDetalhe(await pagamentosApi.obter(id));
    } catch (err) {
      toast.error(mensagemDeErroApi(err, "Não foi possível carregar o comprovativo."));
    }
  };

  const aprovar = async (c: ComprovativoPagamentoAdmin) => {
    setOcupado(c.id);
    try {
      await pagamentosApi.aprovar(c.id);
      toast.success("Pagamento confirmado — Premium activado (+30 dias).");
      await carregar();
    } catch (err) {
      toast.error(mensagemDeErroApi(err, "Não foi possível aprovar."));
    } finally {
      setOcupado(null);
    }
  };

  const confirmarAccao = async () => {
    if (!accao) return;
    const { tipo, comprovativo } = accao;
    setOcupado(comprovativo.id);
    try {
      if (tipo === "rejeitar") await pagamentosApi.rejeitar(comprovativo.id, motivo.trim());
      else await pagamentosApi.revogar(comprovativo.id, motivo.trim());
      toast.success(tipo === "rejeitar" ? "Comprovativo rejeitado." : "Aprovação revogada — os 30 dias foram retirados.");
      setAccao(null);
      setMotivo("");
      await carregar();
    } catch (err) {
      toast.error(mensagemDeErroApi(err, "Não foi possível guardar a decisão."));
    } finally {
      setOcupado(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Comprovativos de pagamento</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Validação automática do Premium (PDF ou captura de ecrã, de qualquer banco ou do Multicaixa Express). Os aprovados
          automaticamente devem ser conferidos no extracto bancário: a validação lê o ficheiro, não vê a conta.
        </p>
      </div>

      <Tabs value={filtro} onValueChange={(v) => setFiltro(v as EstadoComprovativo | "todos")}>
        <TabsList className="flex-wrap h-auto">
          {FILTROS.map((f) => (
            <TabsTrigger key={f.valor} value={f.valor}>
              {f.rotulo}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {aCarregar ? (
        <p className="text-sm text-muted-foreground">A carregar...</p>
      ) : lista.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum comprovativo neste estado.</p>
      ) : (
        <div className="grid gap-4">
          {lista.map((c) => (
            <Card key={c.id} data-testid="comprovativo">
              <CardHeader className="pb-2">
                <CardTitle className="flex flex-wrap items-center gap-2 text-base">
                  <Badge variant={ESTADO[c.estado].variante}>{ESTADO[c.estado].rotulo}</Badge>
                  {c.estado === "aprovado" && !c.decidido_por && (
                    <Badge variant="outline">Automático — conferir no extracto</Badge>
                  )}
                  <span className="font-semibold">{kz(c.montante_kz)}</span>
                  <span className="text-muted-foreground font-normal text-sm">
                    {c.utilizador_nome ?? c.utilizador_email ?? "Conta eliminada"}
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <dl className="grid gap-x-6 gap-y-1 sm:grid-cols-2">
                  <div><dt className="inline text-muted-foreground">Operação: </dt><dd className="inline font-medium break-all">{c.referencia_transacao ?? "—"}</dd></div>
                  <div><dt className="inline text-muted-foreground">Origem: </dt><dd className="inline">{c.origem ? ORIGEM[c.origem] ?? c.origem : "—"}</dd></div>
                  <div><dt className="inline text-muted-foreground">Data da operação: </dt><dd className="inline">{dataHora(c.data_transacao)}</dd></div>
                  <div><dt className="inline text-muted-foreground">Enviado em: </dt><dd className="inline">{dataHora(c.criado_em)}</dd></div>
                  {c.utilizador_email && (
                    <div><dt className="inline text-muted-foreground">Email: </dt><dd className="inline">{c.utilizador_email}</dd></div>
                  )}
                  {c.premium_expira_em && (
                    <div><dt className="inline text-muted-foreground">Premium até: </dt><dd className="inline">{dataHora(c.premium_expira_em)}</dd></div>
                  )}
                </dl>
                {c.motivo && <p className="rounded-md bg-muted/50 p-2 text-muted-foreground">{c.motivo}</p>}
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={() => void abrirPdf(c.id)}>
                    <FileText className="w-4 h-4" /> Ver ficheiro
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => void verDetalhe(c.id)}>
                    <Eye className="w-4 h-4" /> Texto e metadados
                  </Button>
                  {(c.estado === "revisao_manual" || c.estado === "rejeitado") && (
                    <Button size="sm" disabled={ocupado === c.id} onClick={() => void aprovar(c)}>
                      <Check className="w-4 h-4" /> Confirmar pagamento
                    </Button>
                  )}
                  {c.estado === "revisao_manual" && (
                    <Button size="sm" variant="destructive" disabled={ocupado === c.id} onClick={() => setAccao({ tipo: "rejeitar", comprovativo: c })}>
                      <X className="w-4 h-4" /> Rejeitar
                    </Button>
                  )}
                  {c.estado === "aprovado" && (
                    <Button size="sm" variant="destructive" disabled={ocupado === c.id} onClick={() => setAccao({ tipo: "revogar", comprovativo: c })}>
                      <Undo2 className="w-4 h-4" /> Revogar
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={!!detalhe} onOpenChange={(aberto) => !aberto && setDetalhe(null)}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Texto e metadados do ficheiro</DialogTitle>
            <DialogDescription className="break-all">SHA-256: {detalhe?.hash_sha256}</DialogDescription>
          </DialogHeader>
          <pre className="whitespace-pre-wrap rounded-md bg-muted p-3 text-xs">
            {JSON.stringify(detalhe?.metadados_ficheiro ?? {}, null, 2)}
          </pre>
          <pre className="whitespace-pre-wrap rounded-md bg-muted p-3 text-xs">
            {detalhe?.texto_extraido ?? "(sem texto extraído)"}
          </pre>
        </DialogContent>
      </Dialog>

      <Dialog open={!!accao} onOpenChange={(aberto) => !aberto && setAccao(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{accao?.tipo === "rejeitar" ? "Rejeitar comprovativo" : "Revogar aprovação"}</DialogTitle>
            <DialogDescription>
              {accao?.tipo === "revogar"
                ? "Retira os 30 dias que este comprovativo deu. O ficheiro e a operação continuam bloqueados."
                : "O utilizador não recebe Premium por este comprovativo."}
            </DialogDescription>
          </DialogHeader>
          <Textarea
            aria-label="Motivo"
            placeholder="Motivo (ex.: não entrou no extracto)"
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            maxLength={500}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setAccao(null)}>Cancelar</Button>
            <Button
              variant="destructive"
              disabled={motivo.trim().length < 3 || ocupado === accao?.comprovativo.id}
              onClick={() => void confirmarAccao()}
            >
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminComprovativos;
