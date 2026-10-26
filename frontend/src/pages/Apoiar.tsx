import { useState } from "react";
import {
  Heart,
  Check,
  Package,
  Wallet,
  Glasses,
  Eye,
  EyeOff,
  Boxes,
  ChevronRight,
  Wrench,
  Disc,
  Layers,
  Paperclip,
  Ellipsis,
  Recycle,
  type LucideIcon,
} from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import BackButton from "@/components/BackButton";
import PontosRecolha from "@/components/PontosRecolha";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import DoacaoFinanceira from "@/components/DoacaoFinanceira";
import { toast } from "sonner";
import { doacoesApi, mensagemDeErroApi } from "@/lib/apiClient";
import { Trans, useTranslation } from "react-i18next";
import i18n, { tPt } from "@/i18n";
import { PROVINCES } from "@/contexts/AuthContext";

type Mode = "materiais" | "financeiro";

/** Um material concreto aceite numa categoria, seleccionável no painel de detalhe. */
interface ItemAceite {
  /** A chave i18n: identifica o item e dá o texto em português que vai para a API. */
  id: string;
  readonly nome: string;
  icon: LucideIcon;
  /** Fotografia de referência. Enquanto não houver uma real, mostra-se o ícone. */
  imagem?: string;
}

const itemAceite = (chave: string, icon: LucideIcon, imagem?: string): ItemAceite => ({
  id: chave,
  get nome() {
    return i18n.t(chave);
  },
  icon,
  imagem,
});

/** Quem escolhe este item tem de o descrever no campo de detalhes. */
const ITEM_OUTRO_MATERIAL = "Apoiar.outrosItemOutroMaterial";

interface MaterialItem {
  id: string;
  /** Chave i18n do nome: o registo e o aviso à equipa usam sempre o português. */
  chaveLabel: string;
  label: string;
  description: string;
  /** Texto de apoio do painel. */
  reaproveitamento: string;
  /** `false`: texto neutro, sem o título "Como é reaproveitado". */
  comTituloReaproveitamento: boolean;
  itens: ItemAceite[];
  icon: LucideIcon;
}

const materialItems: MaterialItem[] = [
  {
    id: "armacoes",
    chaveLabel: "Apoiar.armacoes",
    get label() {
      return i18n.t("Apoiar.armacoes");
    },
    get description() {
      return i18n.t("Apoiar.armacoesNovasOuUsadas");
    },
    get reaproveitamento() {
      return i18n.t("Apoiar.armacoesReaproveitamento");
    },
    comTituloReaproveitamento: true,
    itens: [
      itemAceite("Apoiar.armacoesItemGraduados", Glasses),
      itemAceite("Apoiar.armacoesItemPartidas", Wrench),
      itemAceite("Apoiar.armacoesItemLentes", Disc),
    ],
    icon: Glasses,
  },
  {
    id: "tampoes",
    chaveLabel: "Apoiar.tampoesOclusores",
    get label() {
      return i18n.t("Apoiar.tampoesOclusores");
    },
    get description() {
      return i18n.t("Apoiar.oclusoresOftalmologicosParaTratamento");
    },
    get reaproveitamento() {
      return i18n.t("Apoiar.tampoesReaproveitamento");
    },
    comTituloReaproveitamento: true,
    itens: [
      itemAceite("Apoiar.tampoesItemAdesivos", EyeOff),
      itemAceite("Apoiar.tampoesItemTecido", Eye),
    ],
    icon: Eye,
  },
  {
    id: "outros",
    chaveLabel: "Apoiar.outros",
    get label() {
      return i18n.t("Apoiar.outros");
    },
    get description() {
      return i18n.t("Apoiar.outrosDescricao");
    },
    get reaproveitamento() {
      return i18n.t("Apoiar.outrosReaproveitamento");
    },
    comTituloReaproveitamento: false,
    itens: [
      itemAceite("Apoiar.outrosItemPapelao", Package),
      itemAceite("Apoiar.outrosItemPelicula", Layers),
      itemAceite("Apoiar.outrosItemFita", Paperclip),
      itemAceite(ITEM_OUTRO_MATERIAL, Ellipsis),
    ],
    icon: Boxes,
  },
];

/** Itens escolhidos por categoria (id da categoria -> ids dos itens). */
type ItensPorMaterial = Record<string, string[]>;

/** "Armações: Lentes soltas", um por item, sempre em português (como os detalhes do donativo). */
function materiaisParaEnvio(itensPorMaterial: ItensPorMaterial): string[] {
  return materialItems.flatMap((m) =>
    m.itens
      .filter((item) => itensPorMaterial[m.id]?.includes(item.id))
      .map((item) => `${tPt(m.chaveLabel)}: ${tPt(item.id)}`),
  );
}

const LIMITE_NOTAS_MATERIAIS = 500;

interface MaterialDonationReceipt {
  id: string;
  email: string;
  materials: string[];
  notes?: string;
}

type DialogStep = "form" | "recolha";

const StepIndicator = ({ current, total }: { current: number; total: number }) => (
  <div className="flex items-center gap-3 pb-1">
    <Progress
      value={(current / total) * 100}
      className="h-1.5 flex-1"
      indicatorClassName="bg-teal"
    />
    <span className="shrink-0 text-xs font-medium text-muted-foreground">
      <Trans i18nKey="Apoiar.etapaDe" values={{ current, total }} />
    </span>
  </div>
);

const Apoiar = () => {
  const { t: tr } = useTranslation();
  const [mode, setMode] = useState<Mode>("materiais");
  const [itensPorMaterial, setItensPorMaterial] = useState<ItensPorMaterial>({});
  const [materialNotes, setMaterialNotes] = useState("");
  // Painéis de detalhe: o cartão mostra só ícone e título, o resto abre aqui.
  const [detalheMaterial, setDetalheMaterial] = useState<string | null>(null);
  const [materialAberto, setMaterialAberto] = useState(false);
  // Itens marcados no painel aberto; só passam para `itensPorMaterial` com "Quero Doar Isto".
  const [rascunhoItens, setRascunhoItens] = useState<string[]>([]);
  // O id fica depois de fechar, para o painel não ficar vazio durante a animação de saída.
  const abrirMaterial = (id: string) => {
    setDetalheMaterial(id);
    setRascunhoItens(itensPorMaterial[id] ?? []);
    setMaterialAberto(true);
  };

  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<DialogStep>("form");
  const [email, setEmail] = useState("");
  // UX-03 -- onde a equipa vai recolher o que foi doado. Só a doação de
  // materiais precisa disto (uma financeira não tem nada a ir buscar).
  const [provincia, setProvincia] = useState("");
  const [receipt, setReceipt] = useState<MaterialDonationReceipt | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const materiaisEscolhidos = materialItems.filter((m) => (itensPorMaterial[m.id]?.length ?? 0) > 0);

  const alternarItem = (itemId: string) => {
    setRascunhoItens((prev) =>
      prev.includes(itemId) ? prev.filter((x) => x !== itemId) : [...prev, itemId]
    );
  };

  // "Quero Doar Isto": guarda o que ficou marcado (nada marcado desfaz a escolha
  // da categoria) e fecha. Fechar de outra forma descarta as alterações.
  const confirmarItens = () => {
    if (detalheMaterial) {
      setItensPorMaterial((prev) => ({ ...prev, [detalheMaterial]: rascunhoItens }));
    }
    setMaterialAberto(false);
  };

  const handleMaterialSubmit = () => {
    if (materiaisEscolhidos.length === 0) {
      toast.error(tr("Apoiar.seleccionePeloMenosUm"));
      return;
    }
    const escolheuOutroMaterial = Object.values(itensPorMaterial).some((itens) =>
      itens.includes(ITEM_OUTRO_MATERIAL)
    );
    if (escolheuOutroMaterial && !materialNotes.trim()) {
      toast.error(tr("Apoiar.descrevaOOutroMaterial"));
      document.getElementById("material-notes")?.focus();
      return;
    }
    setReceipt(null);
    setStep("form");
    setOpen(true);
  };

  const materialEmDetalhe = materialItems.find((m) => m.id === detalheMaterial) ?? null;

  const handleConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    {
      if (!provincia) {
        toast.error(tr("Apoiar.seleccioneASuaProvincia"));
        return;
      }
      setSubmitting(true);
      try {
        const detalhesDoacao = materialNotes.trim() || null;

        // A API própria já grava a doação e manda a confirmação por email
        // (DoacaoService, via Resend) -- o mesmo recibo/email que antes
        // vinha da Edge Function do Supabase, agora só num pedido. Uma
        // falha em qualquer um dos dois passos (gravar ou enviar o email)
        // devolve erro, nunca um 201 fabricado (ver CLAUDE.md, "nunca
        // mostrar sucesso antes de verificar erro").
        const materiais = materiaisParaEnvio(itensPorMaterial);
        const doacao = await doacoesApi.registarMateriais(email, materiais, provincia, detalhesDoacao);

        setReceipt({
          id: doacao.recibo_id,
          email,
          materials: materiais,
          notes: materialNotes,
        });
        setStep("recolha");
        toast.success(tr("Apoiar.doacaoRegistadaEnviamosUm"));
        setItensPorMaterial({});
        setMaterialNotes("");
        setProvincia("");
      } catch (err) {
        console.error("Falha ao registar doação de materiais:", err);
        toast.error(mensagemDeErroApi(err, tr("Apoiar.naoFoiPossivelRegistar")));
      } finally {
        setSubmitting(false);
      }
    }
  };

  const closeDialog = () => {
    setOpen(false);
    setEmail("");
    setReceipt(null);
    setStep("form");
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

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4 mb-8">
                  {materialItems.map((item) => {
                    const quantos = itensPorMaterial[item.id]?.length ?? 0;
                    const selected = quantos > 0;
                    return (
                      <div
                        key={item.id}
                        className={`relative rounded-2xl border-2 bg-card transition-all duration-200 hover:-translate-y-1 hover:shadow-elevated ${
                          selected
                            ? "border-teal shadow-elevated bg-teal/5"
                            : "border-border/60 shadow-card"
                        }`}
                      >
                        <button
                          type="button"
                          aria-haspopup="dialog"
                          onClick={() => abrirMaterial(item.id)}
                          className="flex h-full w-full flex-col items-start gap-3 rounded-2xl p-4 md:p-6 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-teal focus-visible:ring-offset-2"
                        >
                          <div
                            className={`inline-flex items-center justify-center w-12 h-12 rounded-xl transition-colors ${
                              selected ? "bg-teal text-teal-foreground" : "bg-teal/10 text-teal"
                            }`}
                          >
                            <item.icon className="w-6 h-6" />
                          </div>
                          <h3 className="text-base md:text-lg font-bold text-foreground leading-snug">
                            {item.label}
                          </h3>
                          <span className="mt-auto inline-flex items-center gap-1 text-xs font-medium text-teal">
                            {tr("Apoiar.verDetalhes")}
                            <ChevronRight className="w-3.5 h-3.5" />
                          </span>
                          {selected && (
                            <span className="absolute top-4 right-4 inline-flex items-center gap-1 rounded-full bg-teal px-2.5 py-1 text-xs font-semibold text-teal-foreground">
                              <Check className="w-3.5 h-3.5" aria-hidden="true" />
                              {quantos === 1
                                ? tr("Apoiar.umItem")
                                : tr("Apoiar.nItens", { count: quantos })}
                            </span>
                          )}
                        </button>
                      </div>
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
                <div className="text-center max-w-2xl mx-auto mb-8 space-y-2">
                  <span className="inline-block text-xs font-bold uppercase tracking-widest text-navy">
                    {tr("Apoiar.escolhaOSeuImpacto")}
                  </span>
                  <h2 className="text-2xl md:text-3xl font-bold text-foreground">
                    {tr("Apoiar.doeUmaVezOuTodosOsMeses")}
                  </h2>
                  <p className="text-muted-foreground">{tr("Apoiar.cadaDonativoAjuda")}</p>
                </div>

                <DoacaoFinanceira />
              </TabsContent>
            </Tabs>

            <p className="text-center text-sm text-muted-foreground mt-12 max-w-xl mx-auto">
              {tr("Apoiar.todosOsDonativosSao")}
            </p>
          </div>
        </section>
      </main>
      <Footer />

      {/* Detalhe de uma categoria de materiais */}
      <Sheet open={materialAberto && materialEmDetalhe !== null} onOpenChange={setMaterialAberto}>
        <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto flex flex-col gap-6">
          {materialEmDetalhe && (
            <>
              <SheetHeader className="space-y-3 text-left pr-6">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-teal/10 text-teal">
                  <materialEmDetalhe.icon className="w-6 h-6" />
                </div>
                <SheetTitle className="text-xl">{materialEmDetalhe.label}</SheetTitle>
                <SheetDescription>{materialEmDetalhe.description}</SheetDescription>
              </SheetHeader>

              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-widest text-teal">
                  {tr("Apoiar.materiaisAceites")}
                </h4>
                <ul className="space-y-2">
                  {materialEmDetalhe.itens.map((itemAceite) => {
                    const marcado = rascunhoItens.includes(itemAceite.id);
                    return (
                      <li key={itemAceite.id}>
                        <label
                          className={`flex cursor-pointer items-center gap-3 rounded-xl border-2 p-2.5 transition-colors ${
                            marcado ? "border-teal bg-teal/5" : "border-border/60 bg-card hover:border-teal/40"
                          }`}
                        >
                          <Checkbox
                            checked={marcado}
                            onCheckedChange={() => alternarItem(itemAceite.id)}
                            className="h-5 w-5 shrink-0 data-[state=checked]:bg-teal data-[state=checked]:border-teal"
                          />
                          {itemAceite.imagem ? (
                            <img
                              src={itemAceite.imagem}
                              alt=""
                              className="w-14 h-14 shrink-0 rounded-lg object-cover"
                            />
                          ) : (
                            <div
                              className="w-14 h-14 shrink-0 rounded-lg bg-teal/10 text-teal flex items-center justify-center"
                              aria-hidden="true"
                            >
                              <itemAceite.icon className="w-6 h-6" />
                            </div>
                          )}
                          <span className="text-sm font-medium text-foreground">{itemAceite.nome}</span>
                        </label>
                      </li>
                    );
                  })}
                </ul>
              </div>

              <div className="space-y-2 rounded-xl bg-teal/5 border border-teal/20 p-4">
                {materialEmDetalhe.comTituloReaproveitamento && (
                  <h4 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                    <Recycle className="w-4 h-4 text-teal" />
                    {tr("Apoiar.comoEReaproveitado")}
                  </h4>
                )}
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {materialEmDetalhe.reaproveitamento}
                </p>
              </div>

              <div className="mt-auto flex flex-col gap-2">
                <Button
                  onClick={confirmarItens}
                  className="w-full bg-teal text-teal-foreground hover:bg-teal/90"
                  size="lg"
                >
                  {tr("Apoiar.queroDoarIsto")}
                </Button>
                <Button variant="outline" onClick={() => setMaterialAberto(false)} className="w-full">
                  {tr("Apoiar.fechar")}
                </Button>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      <Dialog open={open} onOpenChange={(v) => (v ? setOpen(true) : closeDialog())}>
        <DialogContent className={step === "recolha" ? "max-w-lg" : "max-w-md"}>
          {step === "recolha" ? (
            <div
              key="recolha"
              className="animate-in fade-in-0 slide-in-from-right-4 duration-300 space-y-4"
            >
              <DialogHeader className="space-y-3">
                <StepIndicator current={2} total={2} />
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
          ) : (
            <div key="form" className="animate-in fade-in-0 slide-in-from-left-4 duration-300">
              <DialogHeader className="space-y-3">
                <StepIndicator current={1} total={2} />
                <DialogTitle className="flex items-center gap-2">
                  <Package className="w-5 h-5 text-teal" />
                  {tr("Apoiar.combinarRecolha")}
                </DialogTitle>
                <DialogDescription>{tr("Apoiar.deixeOSeuEmail")}</DialogDescription>
              </DialogHeader>

              <form onSubmit={handleConfirm} className="space-y-4 mt-4">
                {materiaisEscolhidos.length > 0 && (
                  <div className="rounded-lg border border-teal/20 bg-teal/5 p-4">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground font-medium mb-2">
                      {tr("Apoiar.materiaisSeleccionados")}
                    </p>
                    <ul className="space-y-1">
                      {materiaisEscolhidos.map((m) => (
                        <li key={m.id} className="flex items-start gap-2 text-sm text-foreground">
                          <Check className="w-4 h-4 mt-0.5 shrink-0 text-teal" />
                          <span>
                            <span className="font-medium">{m.label}:</span>{" "}
                            {m.itens
                              .filter((i) => itensPorMaterial[m.id]?.includes(i.id))
                              .map((i) => i.nome)
                              .join(", ")}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="space-y-2">
                    <Label htmlFor="donor-provincia">{tr("Apoiar.provinciaParaRecolha")}</Label>
                    <Select value={provincia} onValueChange={setProvincia}>
                      <SelectTrigger id="donor-provincia">
                        <SelectValue placeholder={tr("Apoiar.seleccioneASuaProvincia")} />
                      </SelectTrigger>
                      <SelectContent className="max-h-72">
                        {PROVINCES.map((p) => (
                          <SelectItem key={p} value={p}>
                            {p}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                <div className="space-y-2">
                  <Label htmlFor="donor-email">{tr("Apoiar.oSeuEmailPara")}</Label>
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
                    className="w-full bg-teal text-teal-foreground hover:bg-teal/90"
                  >
                    {submitting ? tr("Apoiar.aEnviar") : tr("Apoiar.confirmarDoacao")}
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