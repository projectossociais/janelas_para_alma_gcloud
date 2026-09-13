import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import jsPDF from "jspdf";
import {
  CheckCircle2,
  Info,
  MapPin,
  Activity,
  Users,
  Phone,
  ArrowRight,
  ShieldCheck,
  AlertCircle,
  Download,
  Stethoscope,
  Eye,
} from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import BackButton from "@/components/BackButton";
import { screeningsApi, mensagemDeErroApi, type ScreeningPublica } from "@/lib/apiClient";

type TabKey = "sinais" | "clinicas" | "exercicios" | "comunidade";

/** Resultado honesto de uma sessão: nenhum campo aqui é um diagnóstico nem uma
 * métrica de confiança calculada — apenas o que foi de facto capturado
 * (CLAUDE.md secção 11, W-04). Mantido em sincronia com `Scanner.tsx`. */
interface ScanResult {
  capturedAt: string;
  method: "camera" | "upload";
  posesCapturadas: string[];
  analysisId: string | null;
}

/**
 * Conteúdo educativo genérico — não é atribuído a nenhum diagnóstico
 * específico, porque nenhuma medição real ainda é calculada a partir da
 * sessão (ver W-13 a W-17 no BACKLOG: o método clínico e a calibração ainda
 * não existem). Listar sinais comuns de estrabismo/ambliopia, em geral, é
 * informação correta e útil sem fingir saber qual se aplica a esta pessoa.
 */
const SINAIS_A_OBSERVAR: string[] = [
  "Um ou ambos os olhos parecem desviar-se para dentro, para fora, para cima ou para baixo",
  "Visão dupla (diplopia), sobretudo ao fim do dia ou com cansaço visual",
  "Fecha um olho ou pisca com frequência sob luz intensa",
  "Inclina ou roda a cabeça na tentativa de alinhar a visão",
  "Fadiga ocular e dores de cabeça frequentes",
  "Dificuldade em perceber profundidade — por exemplo, ao descer escadas ou apanhar objectos",
];

const TRATAMENTOS_POSSIVEIS: string[] = [
  "Óculos com a correção adequada (hipermetropia, miopia ou astigmatismo)",
  "Terapia visual ortóptica",
  "Oclusão com tampão, em casos de ambliopia",
  "Prismas corretivos, para alguns desvios verticais",
  "Toxina botulínica ou cirurgia dos músculos oculares, em casos selecionados",
];

const tabs: { key: TabKey; label: string; icon: typeof Info }[] = [
  { key: "sinais", label: "Sinais a Observar", icon: Info },
  { key: "clinicas", label: "Clínicas Recomendadas", icon: MapPin },
  { key: "exercicios", label: "Exercícios", icon: Activity },
  { key: "comunidade", label: "Comunidade", icon: Users },
];

const CLINICAS = [
  {
    name: "Clínica Sagrada Esperança",
    city: "Luanda · Ilha de Luanda",
    specialty: "Oftalmologia geral & estrabismo",
    price: "25.000 – 40.000 AOA",
    phone: "+244923167950",
    phoneDisplay: "+244 923 167 950",
    website: "https://www.cse.co.ao",
  },
  {
    name: "Centro Óptico Angolano",
    city: "Luanda · Call Center",
    specialty: "Avaliação visual & óculos",
    price: "15.000 – 22.000 AOA",
    phone: "+244923400300",
    phoneDisplay: "+244 923 400 300",
    website: "https://centrooptico.co.ao",
  },
  {
    name: "Clínica Multiperfil",
    city: "Luanda · Morro Bento",
    specialty: "Pediatria & cirurgia oftalmológica",
    price: "30.000 – 45.000 AOA",
    phone: "+244923501168",
    phoneDisplay: "+244 923 501 168",
    website: "https://www.multiperfil.co.ao",
  },
  {
    name: "Hospital Girassol",
    city: "Luanda · Maianga",
    specialty: "Neuroftalmologia & exames avançados",
    price: "35.000 – 55.000 AOA",
    phone: "+244222641000",
    phoneDisplay: "+244 222 641 000",
    website: "https://www.hospitalgirassol.co.ao",
  },
] as const;

const exercises = [
  { title: "Convergência", to: "/exercicios/convergencia", desc: "Treina a coordenação binocular." },
  { title: "Cérebro & Visão", to: "/exercicios/cerebro", desc: "Estímulos cognitivos visuais." },
  { title: "Tracking Ocular", to: "/exercicios/tracking", desc: "Movimentos suaves de seguimento." },
  { title: "Relaxamento", to: "/exercicios/relaxamento", desc: "Alivia fadiga ocular." },
];

const metodoLabel = (result: ScanResult): string =>
  result.method === "camera" ? "Câmara ao vivo (3 poses)" : "Fotografia carregada";

const posesLabel = (result: ScanResult): string =>
  result.method === "camera" ? `${result.posesCapturadas.length} de 3` : "Fotografia única";

const Resultados = () => {
  const navigate = useNavigate();
  const [tab, setTab] = useState<TabKey>("sinais");
  const [result, setResult] = useState<ScanResult | null>(null);
  const [screening, setScreening] = useState<ScreeningPublica | null>(null);
  const [screeningLoading, setScreeningLoading] = useState(false);
  const [screeningError, setScreeningError] = useState<string | null>(null);

  useEffect(() => {
    const raw = sessionStorage.getItem("scanResult");
    if (!raw) {
      navigate("/scanner", { replace: true });
      return;
    }
    try {
      setResult(JSON.parse(raw));
    } catch {
      navigate("/scanner", { replace: true });
    }
  }, [navigate]);

  // Sinal técnico experimental (W-13/W-15) — só existe para a captura por
  // câmara, que é a única que envia landmarks à API. Ver
  // `docs/SCANNER-METODO.md`: nunca um diagnóstico, sempre `requer_avaliacao_humana`.
  useEffect(() => {
    if (!result?.analysisId) return;
    let cancelado = false;
    setScreeningLoading(true);
    setScreeningError(null);
    screeningsApi
      .obter(result.analysisId)
      .then((s) => {
        if (!cancelado) setScreening(s);
      })
      .catch((err) => {
        if (!cancelado) {
          setScreeningError(
            mensagemDeErroApi(err, "Não foi possível carregar o sinal técnico desta sessão.")
          );
        }
      })
      .finally(() => {
        if (!cancelado) setScreeningLoading(false);
      });
    return () => {
      cancelado = true;
    };
  }, [result?.analysisId]);

  const dataFormatada = useMemo(
    () => (result ? new Date(result.capturedAt).toLocaleDateString("pt-PT") : ""),
    [result]
  );

  const handleDownload = () => {
    if (!result) return;
    const date = new Date(result.capturedAt);
    const formatted = date.toLocaleString("pt-PT");

    const doc = new jsPDF({ unit: "pt", format: "a4" });
    const W = doc.internal.pageSize.getWidth();
    const H = doc.internal.pageSize.getHeight();
    const M = 48;

    const navy: [number, number, number] = [11, 27, 59];
    const teal: [number, number, number] = [31, 178, 158];
    const gold: [number, number, number] = [217, 175, 84];
    const ink: [number, number, number] = [30, 41, 59];
    const muted: [number, number, number] = [100, 116, 139];
    const soft: [number, number, number] = [241, 245, 249];

    // Header
    doc.setFillColor(...navy);
    doc.rect(0, 0, W, 110, "F");
    doc.setFillColor(...teal);
    doc.rect(0, 110, W, 4, "F");

    doc.setFillColor(...teal);
    doc.ellipse(M + 14, 55, 18, 11, "F");
    doc.setFillColor(255, 255, 255);
    doc.circle(M + 14, 55, 5, "F");
    doc.setFillColor(...navy);
    doc.circle(M + 14, 55, 2.5, "F");

    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.text("JANELAS PARA A ALMA", M + 44, 50);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(180, 220, 215);
    doc.text("Resumo de Sessão de Rastreio Visual", M + 44, 66);
    doc.setFontSize(8);
    doc.text(`Emitido em ${formatted}`, M + 44, 80);

    // Session summary card (no diagnosis, no confidence score)
    let y = 150;
    doc.setFillColor(...soft);
    doc.roundedRect(M, y, W - M * 2, 90, 12, 12, "F");

    doc.setTextColor(...muted);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.text("SESSÃO DE RASTREIO CONCLUÍDA", M + 20, y + 26);

    doc.setTextColor(...navy);
    doc.setFontSize(16);
    doc.text("Sinais registados — sujeitos a confirmação clínica", M + 20, y + 48);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...ink);
    doc.text(`Método: ${metodoLabel(result)}`, M + 20, y + 68);
    doc.text(`Poses capturadas: ${posesLabel(result)}`, M + 220, y + 68);

    y += 114;

    const section = (title: string, color: [number, number, number]) => {
      if (y > H - 120) { doc.addPage(); y = M; }
      doc.setFillColor(...color);
      doc.rect(M, y, 4, 16, "F");
      doc.setTextColor(...navy);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.text(title, M + 12, y + 12);
      y += 24;
    };

    const bullets = (items: readonly string[]) => {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(...ink);
      items.forEach((t) => {
        if (y > H - 80) { doc.addPage(); y = M; }
        const wrapped = doc.splitTextToSize(t, W - M * 2 - 18);
        doc.setFillColor(...teal);
        doc.circle(M + 6, y + 4, 1.8, "F");
        doc.text(wrapped, M + 16, y + 6);
        y += wrapped.length * 13 + 4;
      });
      y += 6;
    };

    if (screening && screening.estado === "concluido") {
      section("Sinal Técnico (experimental)", teal);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(...ink);
      const explicacao = doc.splitTextToSize(
        "Não é um diagnóstico nem uma percentagem de confiança clínica — é uma medida geométrica " +
          "calculada a partir da posição da íris nos dois olhos durante a captura, ainda sem valor " +
          "de referência validado clinicamente.",
        W - M * 2
      );
      doc.text(explicacao, M, y + 6);
      y += explicacao.length * 13 + 12;

      doc.setFont("helvetica", "bold");
      doc.text(
        `Assimetria horizontal (técnica): ${screening.assimetria_horizontal?.toFixed(3) ?? "—"}`,
        M,
        y + 6
      );
      doc.text(
        `Assimetria vertical (técnica): ${screening.assimetria_vertical?.toFixed(3) ?? "—"}`,
        M,
        y + 22
      );
      doc.setFont("helvetica", "normal");
      doc.text(
        `Qualidade técnica da captura: ${screening.qualidade_fiavel ? "boa" : "baixa"}`,
        M,
        y + 38
      );
      y += 54;
      if (screening.qualidade_motivos.length > 0) {
        bullets(screening.qualidade_motivos);
      }
    }

    section("Sinais a Observar", teal);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(...ink);
    const intro = doc.splitTextToSize(
      "Esta lista é informativa e geral — não indica que algum destes sinais foi detetado nesta sessão.",
      W - M * 2
    );
    doc.text(intro, M, y + 6);
    y += intro.length * 13 + 10;
    bullets(SINAIS_A_OBSERVAR);

    section("Abordagens Terapêuticas Mais Comuns", gold);
    bullets(TRATAMENTOS_POSSIVEIS);

    section("Clínicas Recomendadas em Angola", navy);
    CLINICAS.forEach((c) => {
      if (y > H - 110) { doc.addPage(); y = M; }
      doc.setFillColor(...soft);
      doc.roundedRect(M, y, W - M * 2, 66, 10, 10, "F");
      doc.setFillColor(...teal);
      doc.rect(M, y, 4, 66, "F");
      doc.setTextColor(...navy);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.text(c.name, M + 14, y + 20);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(...ink);
      doc.text(`${c.city}  ·  ${c.specialty}`, M + 14, y + 36);
      doc.setTextColor(...muted);
      doc.text(`Contacto: ${c.phoneDisplay}`, M + 14, y + 50);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...gold);
      doc.text(c.price, W - M - 14, y + 20, { align: "right" });
      y += 76;
    });

    section("Recomendações Gerais", gold);
    bullets([
      "Procure avaliação presencial com oftalmologista qualificado.",
      "Realize exames de refração e teste de cobertura ocular.",
      "Mantenha pausas visuais regulares (regra 20-20-20).",
      "Inicie exercícios visuais terapêuticos sob orientação profissional.",
      "Junte-se à comunidade Janelas Para a Alma para apoio emocional.",
    ]);

    if (y > H - 120) { doc.addPage(); y = M; }
    doc.setFillColor(255, 247, 224);
    doc.roundedRect(M, y, W - M * 2, 50, 8, 8, "F");
    doc.setTextColor(...navy);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text("AVISO IMPORTANTE", M + 12, y + 18);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...ink);
    const disc = doc.splitTextToSize(
      "Este documento resume os dados de uma sessão de rastreio visual e NÃO contém um diagnóstico médico nem uma pontuação de confiança calculada. Consulte sempre um profissional de saúde visual qualificado para avaliação e diagnóstico.",
      W - M * 2 - 24
    );
    doc.text(disc, M + 12, y + 32);

    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFillColor(...navy);
      doc.rect(0, H - 36, W, 36, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.text("Janelas Para a Alma", M, H - 20);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(180, 220, 215);
      doc.text("Um Olhar Alinhado, Uma Vida Transformada", M, H - 10);
      doc.setTextColor(255, 255, 255);
      doc.text("janelasparaalma18@gmail.com", W / 2, H - 14, { align: "center" });
      doc.setTextColor(180, 220, 215);
      doc.text(`Página ${i} de ${pageCount}`, W - M, H - 14, { align: "right" });
    }

    doc.save(`relatorio-janelas-rastreio-${date.toISOString().slice(0, 10)}.pdf`);
  };

  if (!result) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-muted-foreground">
        A carregar resultados…
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />
      <BackButton to="/scanner" label="Nova análise" />
      <main className="flex-1">
        <section className="container py-8 md:py-12">
          <div className="max-w-5xl mx-auto rounded-3xl bg-gradient-to-br from-navy to-navy/80 text-navy-foreground p-6 md:p-10 shadow-elevated animate-fade-in">
            <div className="flex items-center gap-2 text-teal text-xs font-bold uppercase tracking-widest">
              <CheckCircle2 className="w-4 h-4" /> Sessão de rastreio concluída
            </div>
            <h1 className="mt-3 text-3xl md:text-4xl font-bold leading-tight">
              Sinais registados — <span className="text-gold">sujeitos a confirmação clínica</span>
            </h1>
            <p className="mt-3 text-sm md:text-base text-white/80 max-w-2xl">
              Esta sessão não produz um diagnóstico. Os dados captados ficam disponíveis para
              partilhar com um oftalmologista, que é quem pode confirmar se existe algum desvio
              e qual o tratamento adequado.
            </p>

            <div className="mt-6 grid sm:grid-cols-3 gap-3">
              {[
                { l: "Método", v: metodoLabel(result) },
                { l: "Poses capturadas", v: posesLabel(result) },
                { l: "Data", v: dataFormatada },
              ].map((m) => (
                <div key={m.l} className="rounded-2xl bg-white/10 backdrop-blur px-4 py-3">
                  <div className="text-xs text-white/70">{m.l}</div>
                  <div className="text-lg font-bold">{m.v}</div>
                </div>
              ))}
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-3 text-xs text-white/70">
              <span className="inline-flex items-center gap-1.5"><ShieldCheck className="w-4 h-4 text-teal" /> Dados confidenciais</span>
              <button
                onClick={handleDownload}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
              >
                <Download className="w-3.5 h-3.5" /> Descarregar resumo
              </button>
            </div>
          </div>

          <div className="max-w-5xl mx-auto mt-5 flex items-start gap-3 p-4 rounded-2xl bg-gold/10 border border-gold/30 text-sm text-foreground">
            <AlertCircle className="w-5 h-5 text-gold shrink-0 mt-0.5" />
            <p>
              Este rastreio é orientador e <strong>não é um diagnóstico</strong>. Procure sempre um
              profissional de saúde visual qualificado para avaliação e confirmação.
            </p>
          </div>

          {result.method === "camera" && (
            <div className="max-w-5xl mx-auto mt-5">
              {screeningLoading && (
                <Card>
                  <p className="text-sm text-muted-foreground">A carregar o sinal técnico desta sessão…</p>
                </Card>
              )}
              {screeningError && (
                <Card>
                  <p className="text-sm text-destructive">{screeningError}</p>
                </Card>
              )}
              {screening && <SinalTecnicoCard screening={screening} />}
            </div>
          )}

          <div className="max-w-5xl mx-auto mt-8">
            <div className="flex flex-wrap gap-2 p-1.5 rounded-2xl bg-muted">
              {tabs.map((t) => {
                const Icon = t.icon;
                const active = tab === t.key;
                return (
                  <button
                    key={t.key}
                    onClick={() => setTab(t.key)}
                    className={`flex-1 min-w-[140px] inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                      active ? "bg-card text-foreground shadow-card" : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {t.label}
                  </button>
                );
              })}
            </div>

            <div className="mt-6 animate-fade-in" key={tab}>
              {tab === "sinais" && <SinaisPanel />}
              {tab === "clinicas" && <ClinicasPanel />}
              {tab === "exercicios" && <ExerciciosPanel />}
              {tab === "comunidade" && <ComunidadePanel />}
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
};

const Card = ({ children }: { children: React.ReactNode }) => (
  <div className="rounded-2xl bg-card border border-border shadow-card p-6">{children}</div>
);

/**
 * Sinal geométrico experimental (W-13/W-15) — nunca um diagnóstico nem uma
 * percentagem de confiança clínica. Ver `docs/SCANNER-METODO.md`: não existe
 * hoje nenhum limiar validado, por isso `requer_avaliacao_humana` é sempre
 * `true` e este cartão nunca classifica o resultado como "normal"/"desvio".
 */
const SinalTecnicoCard = ({ screening }: { screening: ScreeningPublica }) => {
  if (screening.estado !== "concluido") {
    return (
      <Card>
        <div className="flex items-center gap-2 text-muted-foreground text-xs font-bold uppercase tracking-widest">
          <Info className="w-4 h-4" /> Sinal técnico
        </div>
        <p className="mt-2 text-sm text-foreground">
          Não foi possível calcular um sinal técnico nesta sessão (rosto não detetado com
          clareza suficiente na pose central). Os sinais gerais abaixo continuam válidos.
        </p>
      </Card>
    );
  }

  return (
    <Card>
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 text-teal text-xs font-bold uppercase tracking-widest">
          <Eye className="w-4 h-4" /> Sinal técnico (experimental)
        </div>
        <span
          className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
            screening.qualidade_fiavel
              ? "bg-green/10 text-green"
              : "bg-yellow-400/15 text-yellow-700 dark:text-yellow-300"
          }`}
        >
          Qualidade técnica da captura: {screening.qualidade_fiavel ? "boa" : "baixa"}
        </span>
      </div>

      <p className="mt-3 text-sm text-muted-foreground">
        Este número <strong>não é um diagnóstico nem uma percentagem de confiança clínica</strong>.
        É uma medida geométrica calculada a partir da posição da íris nos seus dois olhos durante a
        captura — ainda sem um valor de referência validado clinicamente.
      </p>

      <div className="mt-4 grid sm:grid-cols-2 gap-3">
        <div className="rounded-xl bg-muted px-4 py-3">
          <div className="text-xs text-muted-foreground">Assimetria horizontal (técnica)</div>
          <div className="text-lg font-bold text-foreground">
            {screening.assimetria_horizontal?.toFixed(3) ?? "—"}
          </div>
        </div>
        <div className="rounded-xl bg-muted px-4 py-3">
          <div className="text-xs text-muted-foreground">Assimetria vertical (técnica)</div>
          <div className="text-lg font-bold text-foreground">
            {screening.assimetria_vertical?.toFixed(3) ?? "—"}
          </div>
        </div>
      </div>

      {screening.qualidade_motivos.length > 0 && (
        <div className="mt-4">
          <div className="text-xs font-semibold uppercase tracking-wider text-foreground/70 mb-2">
            O que pode ter afetado a qualidade desta captura
          </div>
          <ul className="space-y-1">
            {screening.qualidade_motivos.map((m) => (
              <li key={m} className="flex items-start gap-2 text-sm text-muted-foreground">
                <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-yellow-400 shrink-0" />
                {m}
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="mt-4 text-xs text-muted-foreground">
        Um profissional de saúde visual é sempre necessário para interpretar este sinal — ele
        nunca substitui um exame presencial.
      </p>
    </Card>
  );
};

const SinaisPanel = () => (
  <div className="grid md:grid-cols-2 gap-4">
    <Card>
      <div className="flex items-center gap-2 text-teal text-xs font-bold uppercase tracking-widest">
        <Info className="w-4 h-4" /> Informação geral
      </div>
      <h2 className="mt-2 text-xl font-bold text-foreground">Sinais comuns de estrabismo e ambliopia</h2>
      <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
        Esta lista é educativa e geral — <strong>não indica</strong> que algum destes sinais foi
        detetado na sua sessão. Serve para saber o que observar no dia a dia e quando vale a pena
        procurar avaliação.
      </p>
      <ul className="mt-4 space-y-1.5">
        {SINAIS_A_OBSERVAR.map((s) => (
          <li key={s} className="flex items-start gap-2 text-sm text-muted-foreground">
            <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-teal shrink-0" />
            {s}
          </li>
        ))}
      </ul>
    </Card>

    <Card>
      <div className="flex items-center gap-2 text-green text-xs font-bold uppercase tracking-widest">
        <Stethoscope className="w-4 h-4" /> Informação geral
      </div>
      <h2 className="mt-2 text-xl font-bold text-foreground">Abordagens terapêuticas mais comuns</h2>
      <p className="mt-3 text-sm text-muted-foreground">
        O tipo de desvio e o tratamento adequado só podem ser determinados por um oftalmologista,
        após exame presencial. Estas são apenas as opções mais frequentemente utilizadas.
      </p>
      <ul className="mt-4 space-y-2">
        {TRATAMENTOS_POSSIVEIS.map((t) => (
          <li key={t} className="flex items-start gap-3 p-3 rounded-xl bg-muted">
            <CheckCircle2 className="w-4 h-4 text-green mt-0.5 shrink-0" />
            <span className="text-sm text-foreground">{t}</span>
          </li>
        ))}
      </ul>
    </Card>
  </div>
);

const ClinicasPanel = () => (
  <div className="space-y-4">
    <div className="flex items-start gap-3 p-4 rounded-2xl bg-teal/5 border border-teal/20">
      <Eye className="w-5 h-5 text-teal shrink-0 mt-0.5" />
      <p className="text-sm text-foreground">
        Unidades de saúde parceiras com especialidade em oftalmologia e estrabismo, para
        confirmação clínica dos sinais registados.
      </p>
    </div>
    <div className="grid md:grid-cols-2 gap-4">
      {CLINICAS.map((c) => (
        <Card key={c.name}>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="text-base font-bold text-foreground">{c.name}</h3>
              <div className="text-xs text-muted-foreground inline-flex items-center gap-1 mt-2">
                <MapPin className="w-3 h-3" /> {c.city}
              </div>
            </div>
            <span className="shrink-0 text-xs font-semibold text-teal bg-teal/10 px-2.5 py-1 rounded-full">{c.price}</span>
          </div>
          <p className="mt-3 text-sm text-muted-foreground">{c.specialty}</p>
          <div className="mt-4 flex items-center justify-between">
            <a href={`tel:${c.phone}`} className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline">
              <Phone className="w-3.5 h-3.5" /> {c.phoneDisplay}
            </a>
            <button
              type="button"
              onClick={() => window.open(c.website, "_blank", "noopener,noreferrer")}
              className="text-xs font-semibold text-green inline-flex items-center gap-1 hover:gap-2 transition-all"
            >
              Agendar <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        </Card>
      ))}
    </div>
  </div>
);

const ExerciciosPanel = () => (
  <div className="grid sm:grid-cols-2 gap-4">
    {exercises.map((e) => (
      <Link
        key={e.to}
        to={e.to}
        className="group rounded-2xl bg-card border border-border shadow-card p-6 transition-all hover:-translate-y-1 hover:shadow-elevated hover:border-teal/40"
      >
        <div className="w-10 h-10 rounded-xl bg-teal/10 text-teal flex items-center justify-center">
          <Activity className="w-5 h-5" />
        </div>
        <h3 className="mt-4 text-base font-bold text-foreground">{e.title}</h3>
        <p className="mt-1 text-sm text-muted-foreground">{e.desc}</p>
        <div className="mt-4 flex items-center gap-1.5 text-sm font-semibold text-green/80 group-hover:text-green">
          Iniciar <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
        </div>
      </Link>
    ))}
  </div>
);

const ComunidadePanel = () => (
  <Card>
    <div className="flex flex-col md:flex-row md:items-center gap-6">
      <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-teal to-green flex items-center justify-center shrink-0">
        <Users className="w-8 h-8 text-white" />
      </div>
      <div className="flex-1">
        <h2 className="text-xl font-bold text-foreground">Não está sozinho/a nesta jornada</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Junte-se à comunidade <strong>Janelas Para a Alma</strong> — partilhe experiências, encontre apoio emocional e ligue-se a outras pessoas que vivem o estrabismo todos os dias.
        </p>
      </div>
      <Link
        to="/kamba"
        className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 transition-colors shrink-0"
      >
        Juntar-me <ArrowRight className="w-4 h-4" />
      </Link>
    </div>
  </Card>
);

export default Resultados;
