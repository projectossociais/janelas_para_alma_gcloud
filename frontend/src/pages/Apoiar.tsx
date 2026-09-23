import { useState } from "react";
import {
  Heart,
  CreditCard,
  Check,
  Package,
  Wallet,
  Sparkles,
  Crown,
  Glasses,
  Eye,
  Boxes,
  ArrowRight,
  UploadCloud,
} from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import BackButton from "@/components/BackButton";
import FileDropzone from "@/components/FileDropzone";
import PontosRecolha from "@/components/PontosRecolha";
import CopyRow from "@/components/CopyRow";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  comprovativosApi,
  doacoesApi,
  mensagemDeErroApi,
  TIPOS_DE_COMPROVATIVO_ACEITES,
} from "@/lib/apiClient";
import { DEFAULT_BANK_DATA, ofuscarValor } from "@/lib/pagamento";
import { Trans, useTranslation } from "react-i18next";
import i18n from "@/i18n";

type Mode = "materiais" | "financeiro";

interface MaterialItem {
  id: string;
  label: string;
  description: string;
  icon: typeof Glasses;
}

const materialItems: MaterialItem[] = [
  {
    id: "armacoes",
    get label() {
      return i18n.t("Apoiar.armacoes");
    },
    get description() {
      return i18n.t("Apoiar.armacoesNovasOuUsadas");
    },
    icon: Glasses,
  },
  {
    id: "tampoes",
    get label() {
      return i18n.t("Apoiar.tampoesOclusores");
    },
    get description() {
      return i18n.t("Apoiar.oclusoresOftalmologicosParaTratamento");
    },
    icon: Eye,
  },
  {
    id: "outros",
    get label() {
      return i18n.t("Apoiar.outros");
    },
    get description() {
      return i18n.t("Apoiar.lentesEstojosProdutosDe");
    },
    icon: Boxes,
  },
];

interface Tier {
  id: "tier1" | "tier2" | "tier3";
  name: string;
  range: string;
  short: string;
  impact: string;
  icon: typeof Sparkles;
  accent: string;
  ring: string;
  chip: string;
}

const tiers: Tier[] = [
  {
    id: "tier1",
    get name() {
      return i18n.t("Apoiar.aliado");
    },
    get range() {
      return i18n.t("Apoiar.n10000A250");
    },
    get short() {
      return i18n.t("Apoiar.umGestoSignificativo");
    },
    get impact() {
      return i18n.t("Apoiar.financiaConsultasDeRastreio");
    },
    icon: Sparkles,
    accent: "text-teal",
    ring: "ring-teal border-teal",
    chip: "bg-teal/10 text-teal",
  },
  {
    id: "tier2",
    get name() {
      return i18n.t("Apoiar.padrinho");
    },
    get range() {
      return i18n.t("Apoiar.n250000A500");
    },
    get short() {
      return i18n.t("Apoiar.impactoSustentado");
    },
    get impact() {
      return i18n.t("Apoiar.cobreUmCicloCompleto");
    },
    icon: Heart,
    accent: "text-navy",
    ring: "ring-navy border-navy",
    chip: "bg-navy/10 text-navy",
  },
  {
    id: "tier3",
    get name() {
      return i18n.t("Apoiar.benfeitor");
    },
    get range() {
      return i18n.t("Apoiar.acimaDe500000");
    },
    get short() {
      return i18n.t("Apoiar.transformacaoEmEscala");
    },
    get impact() {
      return i18n.t("Apoiar.viabilizaUmaCampanhaComunitaria");
    },
    icon: Crown,
    accent: "text-gold",
    ring: "ring-gold border-gold",
    chip: "bg-gold/10 text-gold",
  },
];

const LIMITE_NOTAS_MATERIAIS = 500;

interface MaterialDonationReceipt {
  id: string;
  email: string;
  materials: string[];
  notes?: string;
}

type DialogStep = "form" | "recolha" | "upload";

const StepIndicator = ({
  current,
  total,
  tone,
}: {
  current: number;
  total: number;
  tone: "teal" | "navy";
}) => (
  <div className="flex items-center gap-3 pb-1">
    <Progress
      value={(current / total) * 100}
      className="h-1.5 flex-1"
      indicatorClassName={tone === "teal" ? "bg-teal" : "bg-navy"}
    />
    <span className="shrink-0 text-xs font-medium text-muted-foreground">
      <Trans i18nKey="Apoiar.etapaDe" values={{ current, total }} />
    </span>
  </div>
);

const Apoiar = () => {
  const { t: tr } = useTranslation();
  const [mode, setMode] = useState<Mode>("materiais");
  const [selectedMaterials, setSelectedMaterials] = useState<string[]>([]);
  const [materialNotes, setMaterialNotes] = useState("");
  const [selectedTier, setSelectedTier] = useState<Tier["id"] | null>(null);

  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<DialogStep>("form");
  const [email, setEmail] = useState("");
  const [receipt, setReceipt] = useState<MaterialDonationReceipt | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [comprovativo, setComprovativo] = useState<File | null>(null);

  const bankData = DEFAULT_BANK_DATA;

  const toggleMaterial = (id: string) => {
    setSelectedMaterials((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleMaterialSubmit = () => {
    if (selectedMaterials.length === 0) {
      toast.error(tr("Apoiar.seleccionePeloMenosUm"));
      return;
    }
    setReceipt(null);
    setStep("form");
    setOpen(true);
  };

  const handleFinanceSubmit = () => {
    if (!selectedTier) {
      toast.error(tr("Apoiar.seleccioneUmTierDe"));
      return;
    }
    setStep("form");
    setOpen(true);
  };

  const activeTier = tiers.find((t) => t.id === selectedTier) ?? null;

  const handleConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    if (mode === "materiais") {
      setSubmitting(true);
      try {
        const detalhesDoacao = materialNotes.trim() || null;

        // A API própria já grava a doação e manda a confirmação por email
        // (DoacaoService, via Resend) -- o mesmo recibo/email que antes
        // vinha da Edge Function do Supabase, agora só num pedido. Uma
        // falha em qualquer um dos dois passos (gravar ou enviar o email)
        // devolve erro, nunca um 201 fabricado (ver CLAUDE.md, "nunca
        // mostrar sucesso antes de verificar erro").
        const doacao = await doacoesApi.registarMateriais(email, selectedMaterials, detalhesDoacao);

        setReceipt({
          id: doacao.recibo_id,
          email,
          materials: [...selectedMaterials],
          notes: materialNotes,
        });
        setStep("recolha");
        toast.success(tr("Apoiar.doacaoRegistadaEnviamosUm"));
        setSelectedMaterials([]);
        setMaterialNotes("");
      } catch (err) {
        console.error("Falha ao registar doação de materiais:", err);
        toast.error(mensagemDeErroApi(err, tr("Apoiar.naoFoiPossivelRegistar")));
      } finally {
        setSubmitting(false);
      }
      return;
    }

    setStep("upload");
  };

  const handleConcluirDoacao = async () => {
    if (!comprovativo) {
      toast.error(tr("Apoiar.anexeOComprovativoDa2"));
      return;
    }
    if (!TIPOS_DE_COMPROVATIVO_ACEITES.includes(comprovativo.type as never)) {
      toast.error(tr("Apoiar.formatoNaoSuportadoUse"));
      return;
    }

    setSubmitting(true);
    try {
      const detalhesDonativo = activeTier
        ? `${activeTier.name} (${activeTier.range})`
        : tr("Apoiar.donativoFinanceiro");

      // Três passos (CROSS-02, mesmo padrão do avatar): a API assina o
      // URL, o browser envia os bytes directamente ao R2, e só depois a
      // doação é criada com a chave -- nunca os bytes passam pela nossa
      // API. Nunca mostrar sucesso antes de todos os passos confirmarem.
      const preparado = await comprovativosApi.preparar(comprovativo.type);
      await comprovativosApi.enviarParaStorage(preparado.url_de_upload, comprovativo);
      await doacoesApi.registarFinanceira(email, detalhesDonativo, preparado.chave);

      toast.success(tr("Apoiar.comprovativoRecebidoComSucesso"));
      setSelectedTier(null);
      closeDialog();
    } catch (err) {
      console.error("Falha ao processar comprovativo:", err);
      toast.error(mensagemDeErroApi(err, tr("Apoiar.naoFoiPossivelEnviar")));
    } finally {
      setSubmitting(false);
    }
  };

  const closeDialog = () => {
    setOpen(false);
    setEmail("");
    setReceipt(null);
    setStep("form");
    setComprovativo(null);
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1">
        {/* Hero */}
        <section className="relative pt-28 pb-16 bg-gradient-to-br from-navy via-navy to-teal/80 text-primary-foreground overflow-hidden">
          <div
            className="absolute inset-0 opacity-10 pointer-events-none"
            style={{
              backgroundImage: "radial-gradient(circle at 20% 20%, white 1px, transparent 1px)",
              backgroundSize: "24px 24px",
            }}
          />
          <div className="container relative">
            <BackButton />
            <div className="max-w-3xl mx-auto text-center mt-6">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary-foreground/10 backdrop-blur mb-6">
                <Heart className="w-8 h-8 text-gold" />
              </div>
              <h1 className="text-4xl md:text-5xl font-bold leading-tight mb-4">{tr("Apoiar.facaADiferenca")}</h1>
              <p className="text-lg md:text-xl text-primary-foreground/85 leading-relaxed">
                {tr("Apoiar.escolhaComoQuerContribuir")}
              </p>
            </div>
          </div>
        </section>

        {/* Tabs */}
        <section className="py-16 md:py-20 bg-background">
          <div className="container max-w-5xl">
            <Tabs value={mode} onValueChange={(v) => setMode(v as Mode)} className="w-full">
              <div className="flex justify-center mb-10">
                <TabsList className="grid grid-cols-2 w-full max-w-xl h-auto p-1.5">
                  <TabsTrigger
                    value="materiais"
                    className="flex items-center gap-2 py-3 text-sm md:text-base data-[state=active]:bg-teal data-[state=active]:text-teal-foreground"
                  >
                    <Package className="w-4 h-4" />
                    {tr("Apoiar.apoioComMateriais")}
                  </TabsTrigger>
                  <TabsTrigger
                    value="financeiro"
                    className="flex items-center gap-2 py-3 text-sm md:text-base data-[state=active]:bg-navy data-[state=active]:text-navy-foreground"
                  >
                    <Wallet className="w-4 h-4" />
                    {tr("Apoiar.apoioFinanceiro")}
                  </TabsTrigger>
                </TabsList>
              </div>

              {/* Materiais */}
              <TabsContent value="materiais" className="mt-0">
                <div className="text-center max-w-2xl mx-auto mb-10 space-y-2">
                  <span className="inline-block text-xs font-bold uppercase tracking-widest text-teal">
                    {tr("Apoiar.doeOQueJa")}
                  </span>
                  <h2 className="text-2xl md:text-3xl font-bold text-foreground">
                    {tr("Apoiar.queMateriaisGostariaDe")}
                  </h2>
                  <p className="text-muted-foreground">
                    {tr("Apoiar.seleccioneUmOuMais")}
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                  {materialItems.map((item) => {
                    const selected = selectedMaterials.includes(item.id);
                    return (
                      <button
                        key={item.id}
                        type="button"
                        aria-pressed={selected}
                        onClick={() => toggleMaterial(item.id)}
                        className={`relative text-left p-6 rounded-2xl border-2 bg-card transition-all duration-200 hover:-translate-y-1 hover:shadow-elevated focus:outline-none focus:ring-2 focus:ring-teal focus:ring-offset-2 ${
                          selected
                            ? "border-teal shadow-elevated bg-teal/5"
                            : "border-border/60 shadow-card"
                        }`}
                      >
                        <div className="flex items-start justify-between mb-4">
                          <div
                            className={`inline-flex items-center justify-center w-12 h-12 rounded-xl transition-colors ${
                              selected ? "bg-teal text-teal-foreground" : "bg-teal/10 text-teal"
                            }`}
                          >
                            <item.icon className="w-6 h-6" />
                          </div>
                          <Checkbox checked={selected} className="pointer-events-none mt-1" />
                        </div>
                        <h3 className="text-lg font-bold text-foreground mb-1">{item.label}</h3>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                          {item.description}
                        </p>
                      </button>
                    );
                  })}
                </div>

                <div className="max-w-2xl mx-auto space-y-4">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="material-notes" className="text-sm">
                        {tr("Apoiar.detalhesAdicionaisOpcional")}
                      </Label>
                      <span
                        className={`text-xs tabular-nums ${
                          materialNotes.length >= LIMITE_NOTAS_MATERIAIS
                            ? "text-destructive"
                            : "text-muted-foreground"
                        }`}
                        aria-live="polite"
                      >
                        {materialNotes.length}/{LIMITE_NOTAS_MATERIAIS}
                      </span>
                    </div>
                    <Textarea
                      id="material-notes"
                      placeholder={tr("Apoiar.quantidadeAproximadaEstadoDos")}
                      value={materialNotes}
                      onChange={(e) => setMaterialNotes(e.target.value.slice(0, LIMITE_NOTAS_MATERIAIS))}
                      maxLength={LIMITE_NOTAS_MATERIAIS}
                      rows={4}
                    />
                  </div>
                  <Button
                    onClick={handleMaterialSubmit}
                    className="w-full bg-teal text-teal-foreground hover:bg-teal/90"
                    size="lg"
                  >
                    {tr("Apoiar.confirmarDoacaoDeMateriais")}
                  </Button>
                </div>
              </TabsContent>

              {/* Financeiro */}
              <TabsContent value="financeiro" className="mt-0">
                <div className="text-center max-w-2xl mx-auto mb-10 space-y-2">
                  <span className="inline-block text-xs font-bold uppercase tracking-widest text-navy">
                    {tr("Apoiar.escolhaOSeuImpacto")}
                  </span>
                  <h2 className="text-2xl md:text-3xl font-bold text-foreground">
                    {tr("Apoiar.tresTiersTresFormas")}
                  </h2>
                  <p className="text-muted-foreground">
                    {tr("Apoiar.cadaNivelCorrespondeA")}
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                  {tiers.map((tier) => {
                    const selected = selectedTier === tier.id;
                    return (
                      <button
                        key={tier.id}
                        type="button"
                        aria-pressed={selected}
                        onClick={() => setSelectedTier(tier.id)}
                        className={`relative text-left p-8 rounded-2xl border-2 bg-card transition-all duration-300 hover:-translate-y-1 hover:shadow-elevated focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                          selected
                            ? `${tier.ring} shadow-elevated ring-2`
                            : "border-border/60 shadow-card"
                        }`}
                      >
                        {selected && (
                          <span className="absolute top-4 right-4 inline-flex items-center justify-center w-6 h-6 rounded-full bg-teal text-teal-foreground">
                            <Check className="w-4 h-4" />
                          </span>
                        )}
                        <div
                          className={`inline-flex items-center justify-center w-14 h-14 rounded-2xl ${tier.chip} mb-5`}
                        >
                          <tier.icon className="w-7 h-7" />
                        </div>
                        <span
                          className={`inline-block text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full ${tier.chip} mb-3`}
                        >
                          {tier.name}
                        </span>
                        <p className={`text-2xl font-bold ${tier.accent} leading-tight mb-1`}>
                          {tier.range}
                        </p>
                        <p className="text-sm font-medium text-foreground/70 mb-4">{tier.short}</p>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                          {tier.impact}
                        </p>
                      </button>
                    );
                  })}
                </div>

                <div className="max-w-2xl mx-auto">
                  <Button
                    onClick={handleFinanceSubmit}
                    className="w-full bg-navy text-navy-foreground hover:bg-navy/90"
                    size="lg"
                    disabled={!selectedTier}
                  >
                    {selectedTier
                      ? tr("Apoiar.apoiarComo", { name: activeTier?.name })
                      : tr("Apoiar.seleccioneUmTierPara")}
                  </Button>
                </div>
              </TabsContent>
            </Tabs>

            <p className="text-center text-sm text-muted-foreground mt-12 max-w-xl mx-auto">
              {tr("Apoiar.todosOsDonativosSao")}
            </p>
          </div>
        </section>
      </main>
      <Footer />

      <Dialog open={open} onOpenChange={(v) => (v ? setOpen(true) : closeDialog())}>
        <DialogContent className={step === "recolha" ? "max-w-lg" : "max-w-md"}>
          {step === "recolha" ? (
            <div
              key="recolha"
              className="animate-in fade-in-0 slide-in-from-right-4 duration-300 space-y-4"
            >
              <DialogHeader className="space-y-3">
                <StepIndicator current={2} total={2} tone="teal" />
                <DialogTitle className="flex items-center gap-2">
                  <Check className="w-5 h-5 text-teal" />
                  {tr("Apoiar.doacaoRegistada")}
                </DialogTitle>
                <DialogDescription>
                  {tr("Apoiar.escolhaOPontoDe")}
                </DialogDescription>
              </DialogHeader>

              <PontosRecolha />

              {receipt?.id && (
                <p className="text-center text-xs text-muted-foreground">
                  <Trans i18nKey="Apoiar.referenciaDoPedido" components={{ span: <span className="font-mono" /> }} values={{ id: receipt.id }} />
                </p>
              )}

              <DialogFooter>
                <Button
                  onClick={closeDialog}
                  className="w-full bg-teal text-teal-foreground hover:bg-teal/90"
                >
                  {tr("Apoiar.concluir")}
                </Button>
              </DialogFooter>
            </div>
          ) : step === "upload" ? (
            <div
              key="upload"
              className="animate-in fade-in-0 slide-in-from-right-4 duration-300 space-y-4"
            >
              <DialogHeader className="space-y-3">
                <StepIndicator current={2} total={2} tone="navy" />
                <DialogTitle className="flex items-center gap-2">
                  <UploadCloud className="w-5 h-5 text-navy" />
                  {tr("Apoiar.enviarComprovativo")}
                </DialogTitle>
                <DialogDescription>
                  {activeTier?.name ?? tr("Apoiar.donativo")}: {activeTier?.range ?? ""}{tr("Apoiar.anexeOComprovativoDa")}
                </DialogDescription>
              </DialogHeader>

              <FileDropzone file={comprovativo} onFileChange={setComprovativo} />

              <DialogFooter className="flex-col gap-2 sm:flex-col">
                <Button
                  onClick={handleConcluirDoacao}
                  disabled={submitting || !comprovativo}
                  className="w-full bg-navy text-navy-foreground hover:bg-navy/90"
                >
                  {submitting
                    ? tr("Apoiar.aEnviar")
                    : comprovativo
                      ? tr("Apoiar.concluirDoacao")
                      : tr("Apoiar.anexeOComprovativoPara")}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setStep("form")}
                  disabled={submitting}
                  className="w-full text-muted-foreground"
                >
                  {tr("Apoiar.voltar")}
                </Button>
              </DialogFooter>
            </div>
          ) : (
            <div key="form" className="animate-in fade-in-0 slide-in-from-left-4 duration-300">
              <DialogHeader className="space-y-3">
                <StepIndicator current={1} total={2} tone={mode === "materiais" ? "teal" : "navy"} />
                <DialogTitle className="flex items-center gap-2">
                  {mode === "materiais" ? (
                    <Package className="w-5 h-5 text-teal" />
                  ) : (
                    <CreditCard className="w-5 h-5 text-navy" />
                  )}
                  {mode === "materiais" ? tr("Apoiar.combinarRecolha") : tr("Apoiar.detalhesParaPagamento")}
                </DialogTitle>
                <DialogDescription>
                  {mode === "materiais"
                    ? tr("Apoiar.deixeOSeuEmail")
                    : tr("Apoiar.nivelObrigado", { nome: activeTier?.name ?? tr("Apoiar.donativo"), intervalo: activeTier?.range ?? "" })}
                </DialogDescription>
              </DialogHeader>

              <form onSubmit={handleConfirm} className="space-y-4 mt-4">
                {mode === "financeiro" && (
                  <div className="rounded-lg border border-navy/20 bg-navy/5 p-4 space-y-1 divide-y divide-navy/10">
                    <CopyRow label={tr("Apoiar.beneficiario")} value={bankData.beneficiario} />
                    <CopyRow
                      label={bankData.pagamento_rapido.metodo}
                      value={bankData.pagamento_rapido.telefone}
                      displayValue={ofuscarValor(bankData.pagamento_rapido.telefone)}
                    />
                    <CopyRow
                      label={`IBAN ${bankData.transferencia_nacional.banco}`}
                      value={bankData.transferencia_nacional.iban}
                      displayValue={ofuscarValor(bankData.transferencia_nacional.iban)}
                    />
                  </div>
                )}

                {mode === "materiais" && selectedMaterials.length > 0 && (
                  <div className="rounded-lg border border-teal/20 bg-teal/5 p-4">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground font-medium mb-2">
                      {tr("Apoiar.materiaisSeleccionados")}
                    </p>
                    <ul className="space-y-1">
                      {selectedMaterials.map((id) => {
                        const item = materialItems.find((m) => m.id === id);
                        return (
                          <li key={id} className="flex items-center gap-2 text-sm text-foreground">
                            <Check className="w-4 h-4 text-teal" />
                            {item?.label}
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="donor-email">
                    {mode === "materiais"
                      ? tr("Apoiar.oSeuEmailPara")
                      : tr("Apoiar.insiraOSeuEmail")}
                  </Label>
                  <Input
                    id="donor-email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="seu@email.com"
                  />
                </div>

                <DialogFooter>
                  <Button
                    type="submit"
                    disabled={submitting}
                    className={`w-full ${
                      mode === "materiais"
                        ? "bg-teal text-teal-foreground hover:bg-teal/90"
                        : "bg-navy text-navy-foreground hover:bg-navy/90"
                    }`}
                  >
                    {mode === "materiais" ? (
                      submitting ? tr("Apoiar.aEnviar") : tr("Apoiar.confirmarDoacao")
                    ) : (
                      <span className="inline-flex items-center gap-2">
                        {tr("Apoiar.continuar")}
                        <ArrowRight className="h-4 w-4" />
                      </span>
                    )}
                  </Button>
                </DialogFooter>
              </form>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Apoiar;