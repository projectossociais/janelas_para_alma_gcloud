import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { z } from "zod";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Sparkles,
  Stethoscope,
  Activity,
  Eye,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import FileDropzone from "@/components/FileDropzone";
import CopyRow from "@/components/CopyRow";
import { toast } from "@/hooks/use-toast";
import {
  comprovativosApi,
  mensagemDeErroApi,
  premiumApi,
  TIPOS_DE_COMPROVATIVO_ACEITES,
} from "@/lib/apiClient";
import { DEFAULT_BANK_DATA, ofuscarValor } from "@/lib/pagamento";

const doctorImage = "/registo-premium-doctor.webp";

const step1Schema = z.object({
  nome: z.string().trim().min(2, "Nome muito curto").max(100),
  email: z.string().trim().email("Email inválido").max(255),
  telefone: z
    .string()
    .trim()
    .min(6, "Telefone inválido")
    .max(20, "Telefone inválido")
    .regex(/^[+()\d\s-]+$/, "Use apenas dígitos, espaços e os símbolos + ( ) -"),
});

const step2Schema = z.object({
  para: z
    .string()
    .refine((v) => ["mim", "filho", "familiar"].includes(v), "Seleccione uma opção"),
  diagnostico: z
    .string()
    .refine((v) => ["sim", "nao", "duvida"].includes(v), "Seleccione uma opção"),
});

type Step = 1 | 2 | 3 | 4 | 5;

const steps = [
  { n: 1, label: "Dados Pessoais" },
  { n: 2, label: "Perfil Clínico" },
  { n: 3, label: "Escolha do Plano" },
  { n: 4, label: "Pagamento" },
  { n: 5, label: "Conclusão" },
];

interface PlanoOpcao {
  id: "mensal" | "anual";
  label: string;
  preco: string;
  detalhe: string;
  beneficios: string[];
}

const PLANOS: PlanoOpcao[] = [
  {
    id: "mensal",
    label: "Plano Mensal",
    preco: "15.000 Kz",
    detalhe: "Cobrança todos os meses",
    beneficios: [
      "Acesso ilimitado a 8 exercícios avançados",
      "Acompanhamento de métricas de evolução",
      "Suporte prioritário",
    ],
  },
  {
    id: "anual",
    label: "Plano Anual",
    preco: "150.000 Kz",
    detalhe: "Poupe 2 meses",
    beneficios: [
      "Todos os benefícios do plano mensal",
      "2 meses de oferta",
      "Sessão de triagem online com oftalmologista",
    ],
  },
];

const benefits = [
  { icon: Eye, title: "Triagem visual assistida", desc: "Detecção precoce de sinais de estrabismo." },
  { icon: Activity, title: "Acompanhamento contínuo", desc: "Métricas e evolução personalizadas." },
  { icon: Stethoscope, title: "Exercícios guiados", desc: "Programa clínico validado por oftalmologistas." },
];

const RegistoPremium = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>(1);

  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [telefone, setTelefone] = useState("");
  const [para, setPara] = useState<string>("");
  const [diagnostico, setDiagnostico] = useState<string>("");
  const [detalhesDiagnostico, setDetalhesDiagnostico] = useState("");
  const [plano, setPlano] = useState<PlanoOpcao["id"] | null>(null);
  const [comprovativo, setComprovativo] = useState<File | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const handleStep1 = (e: React.FormEvent) => {
    e.preventDefault();
    const result = step1Schema.safeParse({ nome, email, telefone });
    if (!result.success) {
      const fe: Record<string, string> = {};
      result.error.issues.forEach((err) => {
        if (err.path[0]) fe[String(err.path[0])] = err.message;
      });
      setErrors(fe);
      return;
    }
    setErrors({});
    setStep(2);
  };

  const handleStep2 = (e: React.FormEvent) => {
    e.preventDefault();
    const result = step2Schema.safeParse({ para, diagnostico });
    if (!result.success) {
      const fe: Record<string, string> = {};
      result.error.issues.forEach((err) => {
        if (err.path[0]) fe[String(err.path[0])] = err.message;
      });
      setErrors(fe);
      return;
    }
    setErrors({});
    setStep(3);
  };

  const handlePagamento = async () => {
    if (!plano) {
      toast({
        title: "Escolha um plano",
        description: "Seleccione o plano mensal ou anual para continuar.",
        variant: "destructive",
      });
      return;
    }
    if (!comprovativo) {
      toast({
        title: "Anexe o comprovativo",
        description: "É necessário anexar o comprovativo do pagamento.",
        variant: "destructive",
      });
      return;
    }
    if (!TIPOS_DE_COMPROVATIVO_ACEITES.includes(comprovativo.type as never)) {
      toast({
        title: "Formato não suportado",
        description: "Use PNG, JPEG, WebP ou PDF.",
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);
    try {
      // Três passos (CROSS-02, mesmo padrão do avatar): a API assina o
      // URL, o browser envia os bytes directamente ao R2, e só depois o
      // pedido é criado com a chave -- nunca os bytes passam pela nossa
      // API. Nunca mostrar sucesso antes de todos os passos confirmarem.
      const preparado = await comprovativosApi.preparar(comprovativo.type);
      await comprovativosApi.enviarParaStorage(preparado.url_de_upload, comprovativo);
      await premiumApi.pedir({ nome, email, telefone, plano, comprovativo_chave: preparado.chave });

      setStep(5);
      toast({
        title: "Pagamento recebido",
        description: "A nossa equipa vai confirmar o seu pagamento e activar a subscrição em breve.",
      });
    } catch (err) {
      console.error("Falha ao processar o pagamento Premium:", err);
      toast({
        title: "Não foi possível concluir",
        description: mensagemDeErroApi(err, "Tente novamente dentro de momentos."),
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const progressPct =
    step === 1 ? 20 : step === 2 ? 40 : step === 3 ? 60 : step === 4 ? 80 : 100;
  const planoEscolhido = PLANOS.find((p) => p.id === plano) ?? null;
  const wizardMaxWidth = step === 3 ? "max-w-xl" : step === 4 ? "max-w-lg" : "max-w-md";

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-background">
      {/* Left column — Value anchor */}
      <aside className="relative hidden lg:flex bg-navy text-primary-foreground overflow-hidden">
        <img
          src={doctorImage}
          alt="Especialista sorridente do programa Janelas Para a Alma"
          width={1024}
          height={1280}
          className="absolute inset-0 w-full h-full object-cover object-center opacity-55"
        />
        <div className="absolute inset-0 bg-gradient-to-br from-navy via-navy/85 to-teal/40" />
        <div className="relative z-10 flex flex-col justify-between p-12 xl:p-16 w-full">
          <div>
            <Link
              to="/"
              className="inline-flex items-center gap-2 text-sm text-primary-foreground/80 hover:text-primary-foreground transition-colors"
            >
              <ArrowLeft className="w-4 h-4" /> Voltar
            </Link>
          </div>

          <div className="max-w-md space-y-8">
            <div>
              <span className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-gold">
                <Sparkles className="w-3.5 h-3.5" /> Acesso Premium
              </span>
              <h2 className="mt-3 text-3xl xl:text-4xl font-bold leading-tight">
                Um olhar alinhado, uma vida transformada.
              </h2>
            </div>

            <blockquote className="border-l-2 border-gold pl-4 text-primary-foreground/90 text-base leading-relaxed">
              &ldquo;O programa devolveu-me a confiança de olhar as pessoas nos olhos.
              Ter acompanhamento perto de casa mudou tudo.&rdquo;
              <footer className="mt-2 text-sm text-primary-foreground/70">
                — Kamba do programa, Luanda
              </footer>
            </blockquote>

            <ul className="space-y-4">
              {benefits.map((b) => (
                <li key={b.title} className="flex items-start gap-3">
                  <span className="mt-0.5 w-9 h-9 rounded-lg bg-primary-foreground/10 border border-primary-foreground/20 flex items-center justify-center shrink-0">
                    <b.icon className="w-4 h-4 text-gold" />
                  </span>
                  <div>
                    <p className="font-semibold">{b.title}</p>
                    <p className="text-sm text-primary-foreground/70">{b.desc}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <p className="text-xs text-primary-foreground/60">
            © 2026 Janelas Para a Alma
          </p>
        </div>
      </aside>

      {/* Right column — Wizard */}
      <section className="flex flex-col bg-background">
        <div className="lg:hidden border-b border-border">
          <div className="container py-4">
            <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground">
              <ArrowLeft className="w-4 h-4" /> Voltar
            </Link>
          </div>
        </div>

        <div className="flex-1 flex items-center justify-center p-6 md:p-12">
          <div className={`w-full ${wizardMaxWidth} transition-[max-width] duration-300`}>
            {/* Progress */}
            <div className="mb-8">
              <div className="flex items-center justify-between mb-3">
                {steps.map((s) => (
                  <div key={s.n} className="flex-1 text-center">
                    <div
                      className={`mx-auto w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold transition-colors ${
                        step >= (s.n as Step)
                          ? "bg-teal text-teal-foreground"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {step > s.n ? <CheckCircle2 className="w-4 h-4" /> : s.n}
                    </div>
                    <p
                      className={`mt-2 text-[11px] font-medium ${
                        step >= (s.n as Step) ? "text-foreground" : "text-muted-foreground"
                      }`}
                    >
                      {s.label}
                    </p>
                  </div>
                ))}
              </div>
              <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-teal to-navy transition-all duration-500"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
            </div>

            {step === 1 && (
              <form onSubmit={handleStep1} className="space-y-5 animate-fade-in">
                <div>
                  <h1 className="text-2xl md:text-3xl font-bold text-foreground">
                    Dados Pessoais
                  </h1>
                  <p className="text-sm text-muted-foreground mt-1">
                    Conte-nos um pouco sobre si para começarmos.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="nome">Nome Completo</Label>
                  <Input
                    id="nome"
                    value={nome}
                    onChange={(e) => setNome(e.target.value)}
                    placeholder="O seu nome"
                    maxLength={100}
                  />
                  {errors.nome && <p className="text-xs text-destructive">{errors.nome}</p>}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="voce@exemplo.com"
                    maxLength={255}
                  />
                  {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="telefone">Telefone (WhatsApp)</Label>
                  <Input
                    id="telefone"
                    type="tel"
                    value={telefone}
                    onChange={(e) => setTelefone(e.target.value)}
                    placeholder="+244 000 000 000"
                    maxLength={20}
                  />
                  {errors.telefone && (
                    <p className="text-xs text-destructive">{errors.telefone}</p>
                  )}
                </div>

                <Button
                  type="submit"
                  size="lg"
                  className="w-full bg-gradient-to-r from-teal to-navy text-primary-foreground hover:opacity-90"
                >
                  Continuar <ArrowRight className="w-4 h-4" />
                </Button>
              </form>
            )}

            {step === 2 && (
              <form onSubmit={handleStep2} className="space-y-6 animate-fade-in">
                <div>
                  <h1 className="text-2xl md:text-3xl font-bold text-foreground">
                    Perfil Clínico
                  </h1>
                  <p className="text-sm text-muted-foreground mt-1">
                    Ajuda-nos a personalizar o seu acompanhamento.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="para">A subscrição é para quem?</Label>
                  <Select value={para} onValueChange={setPara}>
                    <SelectTrigger id="para">
                      <SelectValue placeholder="Seleccione uma opção" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="mim">Para mim</SelectItem>
                      <SelectItem value="filho">Para o meu filho/a</SelectItem>
                      <SelectItem value="familiar">Outro familiar</SelectItem>
                    </SelectContent>
                  </Select>
                  {errors.para && <p className="text-xs text-destructive">{errors.para}</p>}
                </div>

                <div className="space-y-3">
                  <Label>Já tem um diagnóstico médico de estrabismo?</Label>
                  <RadioGroup
                    value={diagnostico}
                    onValueChange={setDiagnostico}
                    className="space-y-2"
                  >
                    {[
                      { v: "sim", l: "Sim" },
                      { v: "nao", l: "Não" },
                      { v: "duvida", l: "Não tenho a certeza" },
                    ].map((opt) => (
                      <div key={opt.v}>
                        <label
                          htmlFor={`diag-${opt.v}`}
                          className="flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-3 cursor-pointer hover:border-teal transition-colors has-[[data-state=checked]]:border-teal has-[[data-state=checked]]:bg-teal/5"
                        >
                          <RadioGroupItem value={opt.v} id={`diag-${opt.v}`} />
                          <span className="text-sm text-foreground">{opt.l}</span>
                        </label>
                        {opt.v === "nao" && diagnostico === "nao" && (
                          <p className="mt-3 text-sm text-muted-foreground ml-7">
                            Recomendamos uma avaliação prévia.{" "}
                            <Link to="/parceiros?agendar=optiotica" className="text-teal underline font-medium">
                              Marque uma teleconsulta com a nossa equipa.
                            </Link>
                          </p>
                        )}
                        {opt.v === "duvida" && diagnostico === "duvida" && (
                          <Textarea
                            className="mt-3 ml-7"
                            onChange={(e) => setDetalhesDiagnostico(e.target.value)}
                            placeholder="Descreva brevemente os seus sintomas ou dúvidas..."
                            value={detalhesDiagnostico}
                          />
                        )}
                      </div>
                    ))}
                  </RadioGroup>
                  {errors.diagnostico && (
                    <p className="text-xs text-destructive">{errors.diagnostico}</p>
                  )}
                </div>

                <div className="flex gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    size="lg"
                    onClick={() => setStep(1)}
                    className="flex-1"
                  >
                    <ArrowLeft className="w-4 h-4" /> Voltar
                  </Button>
                  <Button
                    type="submit"
                    size="lg"
                    className="flex-[2] bg-gradient-to-r from-teal to-navy text-primary-foreground hover:opacity-90"
                  >
                    Continuar <ArrowRight className="w-4 h-4" />
                  </Button>
                </div>
              </form>
            )}

            {step === 3 && (
              <div className="space-y-6 animate-fade-in">
                <div>
                  <h1 className="text-2xl md:text-3xl font-bold text-foreground">
                    Escolha o Plano
                  </h1>
                  <p className="text-sm text-muted-foreground mt-1">
                    Escolha o plano que melhor se adapta a si.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {PLANOS.map((p) => {
                    const selected = plano === p.id;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        aria-pressed={selected}
                        onClick={() => setPlano(p.id)}
                        className={`relative flex flex-col text-left rounded-2xl border-2 p-5 transition-all focus:outline-none focus:ring-2 focus:ring-teal focus:ring-offset-2 ${
                          selected
                            ? "border-teal bg-teal/5 shadow-elevated"
                            : "border-border bg-card hover:border-teal/50"
                        }`}
                      >
                        {p.id === "anual" && (
                          <span className="absolute -top-3 left-4 rounded-full bg-gold px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-gold-foreground">
                            Melhor Valor
                          </span>
                        )}
                        <span
                          className={`absolute top-4 right-4 inline-flex h-6 w-6 items-center justify-center rounded-full ${
                            selected ? "bg-teal text-teal-foreground" : "bg-muted text-transparent"
                          }`}
                        >
                          <Check className="h-4 w-4" strokeWidth={3} />
                        </span>

                        <p className="text-sm font-semibold text-muted-foreground pr-8">{p.label}</p>
                        <p className="mt-1 text-2xl font-bold text-navy">{p.preco}</p>
                        <p className="text-xs text-muted-foreground mb-4">{p.detalhe}</p>

                        <ul className="space-y-2 mt-auto pt-2">
                          {p.beneficios.map((b) => (
                            <li key={b} className="flex items-start gap-2 text-sm text-foreground">
                              <Check className="h-4 w-4 shrink-0 text-teal mt-0.5" strokeWidth={3} />
                              <span>{b}</span>
                            </li>
                          ))}
                        </ul>
                      </button>
                    );
                  })}
                </div>

                <div className="flex gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    size="lg"
                    onClick={() => setStep(2)}
                    className="flex-1"
                  >
                    <ArrowLeft className="w-4 h-4" /> Voltar
                  </Button>
                  <Button
                    type="button"
                    size="lg"
                    onClick={() => setStep(4)}
                    disabled={!plano}
                    className="flex-[2] bg-gradient-to-r from-teal to-navy text-primary-foreground hover:opacity-90"
                  >
                    Continuar para Pagamento <ArrowRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}

            {step === 4 && (
              <div className="flex flex-col space-y-6 animate-fade-in">
                <div>
                  <h1 className="text-2xl md:text-3xl font-bold text-foreground">
                    Pagamento
                  </h1>
                  <p className="text-sm text-muted-foreground mt-1">
                    Confirme o resumo e envie o comprovativo do pagamento.
                  </p>
                </div>

                {/* Resumo do Pedido */}
                <div className="space-y-2">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground font-medium">
                    Resumo do Pedido
                  </p>
                  <div className="rounded-xl border border-border bg-card p-4">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold text-foreground">
                        {planoEscolhido?.label ?? "Plano"}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {planoEscolhido?.detalhe}
                      </span>
                    </div>
                    <div className="mt-3 pt-3 border-t border-border flex items-center justify-between">
                      <span className="text-sm font-semibold text-foreground">
                        Total a Pagar Hoje
                      </span>
                      <span className="text-xl font-bold text-navy">
                        {planoEscolhido?.preco}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Dados Bancários */}
                <div className="space-y-2">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground font-medium">
                    Dados Bancários
                  </p>
                  <div className="rounded-lg border border-navy/20 bg-navy/5 p-4 space-y-1 divide-y divide-navy/10">
                    <CopyRow label="Beneficiário" value={DEFAULT_BANK_DATA.beneficiario} />
                    <CopyRow
                      label={DEFAULT_BANK_DATA.pagamento_rapido.metodo}
                      value={DEFAULT_BANK_DATA.pagamento_rapido.telefone}
                      displayValue={ofuscarValor(DEFAULT_BANK_DATA.pagamento_rapido.telefone)}
                    />
                    <CopyRow
                      label={`IBAN ${DEFAULT_BANK_DATA.transferencia_nacional.banco}`}
                      value={DEFAULT_BANK_DATA.transferencia_nacional.iban}
                      displayValue={ofuscarValor(DEFAULT_BANK_DATA.transferencia_nacional.iban)}
                    />
                  </div>
                </div>

                <hr className="my-2 border-border" />

                {/* Envio do Comprovativo */}
                <div className="space-y-2">
                  <h3 className="font-semibold text-foreground mb-1">2. Anexe o Comprovativo</h3>
                  <FileDropzone file={comprovativo} onFileChange={setComprovativo} />
                </div>

                <div className="flex gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    size="lg"
                    onClick={() => setStep(3)}
                    disabled={submitting}
                    className="flex-1"
                  >
                    <ArrowLeft className="w-4 h-4" /> Voltar
                  </Button>
                  <Button
                    type="button"
                    size="lg"
                    onClick={() => void handlePagamento()}
                    disabled={submitting || !plano || !comprovativo}
                    className="flex-[2] bg-gradient-to-r from-teal to-navy text-primary-foreground hover:opacity-90"
                  >
                    {submitting ? "A enviar..." : (
                      <>
                        Concluir Assinatura <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </Button>
                </div>
              </div>
            )}

            {step === 5 && (
              <div className="text-center animate-fade-in">
                <div className="mx-auto w-20 h-20 rounded-full bg-green/15 flex items-center justify-center mb-6">
                  <CheckCircle2 className="w-12 h-12 text-green" strokeWidth={2.5} />
                </div>
                <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-3">
                  Pedido Recebido com Sucesso!
                </h1>
                <p className="text-muted-foreground leading-relaxed mb-8">
                  Recebemos o seu pedido e o comprovativo de pagamento. Para garantir
                  que recebe o acompanhamento correcto, um dos nossos especialistas em
                  triagem vai confirmar o pagamento e entrar em contacto consigo via
                  WhatsApp nas próximas 24 horas para activar a sua subscrição e agendar
                  a sua primeira teleconsulta.
                </p>
                <Button
                  size="lg"
                  onClick={() => navigate("/")}
                  className="bg-gradient-to-r from-teal to-navy text-primary-foreground hover:opacity-90"
                >
                  Voltar à Página Inicial
                </Button>
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
};

export default RegistoPremium;
