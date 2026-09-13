import { useEffect, useMemo, useRef, useState } from "react";
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
import logoImg from "@/assets/logo.png";

interface LogoBitmap {
  dataUrl: string;
  width: number;
  height: number;
}

/**
 * jsPDF `addImage` exige um data URL — o URL que o Vite dá ao importar o
 * ficheiro (`/src/assets/...` em dev, hash em build) não é aceite de forma
 * fiável entre navegadores. Desenha-se num canvas só para extrair o base64.
 */
const carregarLogoComoDataUrl = (src: string): Promise<LogoBitmap> =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) return reject(new Error("Canvas indisponível para preparar o logótipo."));
      ctx.drawImage(img, 0, 0);
      resolve({ dataUrl: canvas.toDataURL("image/png"), width: img.naturalWidth, height: img.naturalHeight });
    };
    img.onerror = () => reject(new Error("Falha ao carregar o logótipo."));
    img.src = src;
  });

type DiagnosisKey =
  | "Esotropia"
  | "Exotropia"
  | "Hipertropia"
  | "Hipotropia"
  | "Alinhamento Fisiológico Normal"
  | "Necessária Avaliação Oftalmológica";

const DIAGNOSIS_FALLBACK: DiagnosisKey = "Necessária Avaliação Oftalmológica";
const DIAGNOSTICO_NORMAL: DiagnosisKey = "Alinhamento Fisiológico Normal";

type TabKey = "condicao" | "clinicas" | "exercicios" | "comunidade";

type DiagnosisInfo = {
  short: string;
  description: string;
  symptoms: string[];
  treatments: string[];
};

const DIAGNOSIS_DATA: Record<DiagnosisKey, DiagnosisInfo> = {
  Esotropia: {
    short: "Desvio convergente — olho(s) voltado(s) para dentro",
    description:
      "Esotropia é um tipo de estrabismo em que um ou ambos os olhos se desviam para dentro, em direção ao nariz. Pode surgir na infância ou na idade adulta e, quando não tratada, pode causar ambliopia (olho preguiçoso) e perda da visão binocular.",
    symptoms: [
      "Olhos voltados para dentro",
      "Visão dupla (diplopia)",
      "Fadiga ocular e dores de cabeça",
      "Inclinação ou rotação da cabeça",
    ],
    treatments: [
      "Óculos com correção hipermetrópica",
      "Terapia visual ortóptica",
      "Oclusão com tampão (ambliopia)",
      "Toxina botulínica ou cirurgia em casos selecionados",
    ],
  },
  Exotropia: {
    short: "Desvio divergente — olho(s) voltado(s) para fora",
    description:
      "Exotropia caracteriza-se pelo desvio de um ou ambos os olhos para fora, afastando-se do nariz. Frequentemente é intermitente e mais evidente em situações de fadiga, sonolência ou fixação à distância.",
    symptoms: [
      "Olho que se desvia para fora",
      "Fechar um olho sob luz intensa",
      "Dificuldade de visão de profundidade",
      "Fadiga visual em leitura prolongada",
    ],
    treatments: [
      "Exercícios de convergência ocular",
      "Óculos com prismas",
      "Terapia visual ortóptica",
      "Cirurgia muscular extraocular quando indicado",
    ],
  },
  Hipertropia: {
    short: "Desvio vertical — olho(s) voltado(s) para cima",
    description:
      "Hipertropia é um desvio vertical no qual um dos olhos se posiciona mais alto do que o outro. Pode estar relacionada a alterações dos músculos oblíquos ou a causas neurológicas e provoca frequentemente visão dupla.",
    symptoms: [
      "Visão dupla vertical",
      "Inclinação da cabeça (torcicolo ocular)",
      "Tontura e desconforto visual",
      "Dificuldade ao descer escadas",
    ],
    treatments: [
      "Óculos com prismas verticais",
      "Avaliação neuroftalmológica",
      "Toxina botulínica em casos selecionados",
      "Cirurgia dos músculos oblíquos",
    ],
  },
  Hipotropia: {
    short: "Desvio vertical — olho(s) voltado(s) para baixo",
    description:
      "Hipotropia é o desvio vertical em que um dos olhos se posiciona mais baixo do que o outro. Pode resultar de paralisias musculares, traumatismos ou alterações orbitárias e exige avaliação especializada.",
    symptoms: [
      "Visão dupla vertical",
      "Postura anómala da cabeça",
      "Limitação dos movimentos oculares",
      "Dificuldade em focar objetos elevados",
    ],
    treatments: [
      "Prismas corretivos nos óculos",
      "Investigação de causas neurológicas",
      "Reabilitação ortóptica",
      "Cirurgia muscular corretiva",
    ],
  },
  "Alinhamento Fisiológico Normal": {
    short: "Eixos visuais simétricos e alinhamento dentro dos parâmetros normais",
    description:
      "A análise das três posições do olhar não detetou desvios manifestos nem assimetrias corneanas significativas. Os eixos visuais mantêm-se paralelos e com boa resposta de fixação.",
    symptoms: [
      "Boa coordenação binocular",
      "Ausência de diplopia (visão dupla)",
      "Conforto visual nas posições de fixação",
    ],
    treatments: [
      "Manter consultas oftalmológicas de rotina anuais",
      "Praticar pausas visuais regulares durante o trabalho com ecrãs",
      "Utilizar proteção UV ao ar livre",
    ],
  },
  "Necessária Avaliação Oftalmológica": {
    short: "Assimetria de reflexos ou padrão de incomitância detetado",
    description:
      "A triagem automatizada identificou variações no alinhamento ocular entre as posições de fixação ou qualidade insuficiente para descartar desalinhamento. Recomenda-se exame clínico presencial.",
    symptoms: [
      "Possível desvio intermitente nas posições laterais",
      "Desconforto ou fadiga visual ao mudar o foco",
      "Dificuldade de fixação prolongada",
    ],
    treatments: [
      "Consulta de oftalmologia ou ortóptica presencial",
      "Exame de motilidade ocular extrínseca e cover test",
      "Avaliação de acuidade visual e refração sob cicloplegia",
    ],
  },
};

const tabs: { key: TabKey; label: string; icon: typeof Info }[] = [
  { key: "condicao", label: "O Seu Resultado", icon: Info },
  { key: "clinicas", label: "Clínicas & Preços", icon: MapPin },
  { key: "exercicios", label: "Exercícios", icon: Activity },
  { key: "comunidade", label: "Comunidade", icon: Users },
];

const ALL_CLINICS = {
  sagrada: {
    name: "Clínica Sagrada Esperança",
    city: "Luanda · Ilha de Luanda",
    specialty: "Oftalmologia geral & estrabismo",
    price: "25.000 – 40.000 AOA",
    phone: "+244923167950",
    phoneDisplay: "+244 923 167 950",
    website: "https://www.cse.co.ao",
  },
  optico: {
    name: "Centro Óptico Angolano",
    city: "Luanda · Call Center",
    specialty: "Avaliação visual & óculos",
    price: "15.000 – 22.000 AOA",
    phone: "+244923400300",
    phoneDisplay: "+244 923 400 300",
    website: "https://centrooptico.co.ao",
  },
  multiperfil: {
    name: "Clínica Multiperfil",
    city: "Luanda · Morro Bento",
    specialty: "Pediatria & cirurgia oftalmológica",
    price: "30.000 – 45.000 AOA",
    phone: "+244923501168",
    phoneDisplay: "+244 923 501 168",
    website: "https://www.multiperfil.co.ao",
  },
  girassol: {
    name: "Hospital Girassol",
    city: "Luanda · Maianga",
    specialty: "Neuroftalmologia & exames avançados",
    price: "35.000 – 55.000 AOA",
    phone: "+244222641000",
    phoneDisplay: "+244 222 641 000",
    website: "https://www.hospitalgirassol.co.ao",
  },
} as const;

type ClinicRec = (typeof ALL_CLINICS)[keyof typeof ALL_CLINICS] & { subtitle: string };

const CLINIC_RECOMMENDATIONS: Record<DiagnosisKey, ClinicRec[]> = {
  Esotropia: [
    { ...ALL_CLINICS.sagrada, subtitle: "Centro de Excelência em Desvios Convergentes" },
    { ...ALL_CLINICS.optico, subtitle: "Avaliação refrativa complementar" },
  ],
  Exotropia: [
    { ...ALL_CLINICS.multiperfil, subtitle: "Especialistas em Cirurgia Divergente" },
    { ...ALL_CLINICS.optico, subtitle: "Avaliação refrativa complementar" },
  ],
  Hipertropia: [
    { ...ALL_CLINICS.girassol, subtitle: "Unidade Avançada de Neuroftalmologia Vertical" },
  ],
  Hipotropia: [
    { ...ALL_CLINICS.girassol, subtitle: "Unidade Avançada de Neuroftalmologia Vertical" },
  ],
  "Alinhamento Fisiológico Normal": [
    { ...ALL_CLINICS.optico, subtitle: "Exames de rotina & cuidados preventivos" },
    { ...ALL_CLINICS.sagrada, subtitle: "Check-up oftalmológico anual" },
  ],
  "Necessária Avaliação Oftalmológica": [
    { ...ALL_CLINICS.sagrada, subtitle: "Avaliação ortóptica e estrabismo" },
    { ...ALL_CLINICS.multiperfil, subtitle: "Diagnóstico diferencial especializado" },
  ],
};

const exercises = [
  { title: "Convergência", to: "/exercicios/convergencia", desc: "Treina a coordenação binocular." },
  { title: "Cérebro & Visão", to: "/exercicios/cerebro", desc: "Estímulos cognitivos visuais." },
  { title: "Tracking Ocular", to: "/exercicios/tracking", desc: "Movimentos suaves de seguimento." },
  { title: "Relaxamento", to: "/exercicios/relaxamento", desc: "Alivia fadiga ocular." },
];

const Resultados = () => {
  const navigate = useNavigate();
  const [tab, setTab] = useState<TabKey>("condicao");
  const [result, setResult] = useState<{
    diagnosis: DiagnosisKey;
    confidence: number;
    date: string;
    apiData?: { recomendacao?: string; aviso?: string } | null;
  } | null>(null);

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

  // `result` vem de sessionStorage sem validação de esquema — a API pode, no
  // limite, ter sido chamada antes de os dicionários abaixo serem
  // atualizados. O fallback garante que o ecrã nunca fica preso em
  // "A carregar resultados…" por uma chave desconhecida.
  const info = useMemo(
    () => (result ? DIAGNOSIS_DATA[result.diagnosis] ?? DIAGNOSIS_DATA[DIAGNOSIS_FALLBACK] : null),
    [result]
  );
  const recommendedClinics = useMemo<ClinicRec[]>(
    () => (result ? CLINIC_RECOMMENDATIONS[result.diagnosis] ?? CLINIC_RECOMMENDATIONS[DIAGNOSIS_FALLBACK] : []),
    [result]
  );

  const isNormal = result?.diagnosis === DIAGNOSTICO_NORMAL;
  const visibleTabs = useMemo(() => tabs.filter((t) => !(t.key === "clinicas" && isNormal)), [isNormal]);

  // Carregado uma única vez e reutilizado — não há motivo para re-converter o
  // logótipo em base64 a cada download.
  const logoRef = useRef<Promise<LogoBitmap> | null>(null);
  const obterLogo = () => {
    if (!logoRef.current) logoRef.current = carregarLogoComoDataUrl(logoImg);
    return logoRef.current;
  };

  const handleDownload = async () => {
    if (!result || !info) return;
    const date = new Date(result.date);
    const formatted = date.toLocaleString("pt-PT");
    const logo = await obterLogo().catch(() => null);

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

    // Header — logótipo oficial (o glifo geométrico deixou de existir).
    const headerH = 96;
    doc.setFillColor(255, 255, 255);
    doc.rect(0, 0, W, headerH, "F");
    doc.setFillColor(...teal);
    doc.rect(0, headerH, W, 4, "F");

    if (logo) {
      const logoH = 44;
      const logoW = (logo.width / logo.height) * logoH;
      doc.addImage(logo.dataUrl, "PNG", M, (headerH - logoH) / 2, logoW, logoH);
    }

    doc.setTextColor(...navy);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text("Relatório de Triagem Visual Automática", W - M, 40, { align: "right" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...muted);
    doc.text(`Emitido em ${formatted}`, W - M, 54, { align: "right" });

    // Introdução institucional
    let y = headerH + 26;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(...teal);
    doc.text("SOBRE A PLATAFORMA", M, y);
    y += 14;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    doc.setTextColor(...ink);
    const introLines = doc.splitTextToSize(
      "O Janelas Para a Alma realiza uma triagem visual geométrica. Este relatório fornece uma " +
        "orientação com base no alinhamento detetado, não constituindo um diagnóstico clínico.",
      W - M * 2
    );
    doc.text(introLines, M, y);
    y += introLines.length * 12 + 24;

    // Diagnosis card with deviation glyph
    doc.setFillColor(...soft);
    doc.roundedRect(M, y, W - M * 2, 110, 12, 12, "F");

    const gx = M + 60, gy = y + 55;
    doc.setDrawColor(...navy);
    doc.setLineWidth(1.2);
    doc.setFillColor(255, 255, 255);
    doc.ellipse(gx, gy, 26, 16, "FD");
    const offsets: Record<string, [number, number]> = {
      Esotropia: [8, 0],
      Exotropia: [-8, 0],
      Hipertropia: [0, -6],
      Hipotropia: [0, 6],
    };
    const [ox, oy] = offsets[result.diagnosis] || [0, 0];
    doc.setFillColor(...teal);
    doc.circle(gx + ox, gy + oy, 7, "F");
    doc.setFillColor(...navy);
    doc.circle(gx + ox, gy + oy, 3, "F");
    doc.setDrawColor(...gold);
    doc.setLineWidth(1.5);
    doc.line(gx, gy, gx + ox * 1.6, gy + oy * 1.6);

    doc.setTextColor(...muted);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.text("DIAGNÓSTICO ORIENTADOR", M + 110, y + 28);

    doc.setTextColor(...navy);
    doc.setFontSize(22);
    doc.text(result.diagnosis, M + 110, y + 54);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(...ink);
    const shortLines = doc.splitTextToSize(info.short, W - M * 2 - 130);
    doc.text(shortLines, M + 110, y + 72);

    doc.setFillColor(...teal);
    doc.roundedRect(W - M - 110, y + 18, 90, 28, 14, 14, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text(`Confiança ${result.confidence}%`, W - M - 65, y + 36, { align: "center" });

    y += 134;

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

    section("O Seu Resultado", teal);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(...ink);
    const desc = doc.splitTextToSize(info.description, W - M * 2);
    doc.text(desc, M, y + 6);
    y += desc.length * 13 + 16;

    if (!isNormal) {
      if (y > H - 100) { doc.addPage(); y = M; }
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9.5);
      doc.setTextColor(...navy);
      doc.text("Sintomas frequentes", M, y);
      y += 16;
      bullets(info.symptoms);
    }

    section("O que recomendamos", teal);
    bullets(info.treatments);

    if (!isNormal) {
      section("Clínicas Recomendadas em Angola", navy);
      recommendedClinics.forEach((c) => {
        if (y > H - 110) { doc.addPage(); y = M; }
        doc.setFillColor(...soft);
        doc.roundedRect(M, y, W - M * 2, 78, 10, 10, "F");
        doc.setFillColor(...teal);
        doc.rect(M, y, 4, 78, "F");
        doc.setTextColor(...navy);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(11);
        doc.text(c.name, M + 14, y + 18);
        doc.setFont("helvetica", "italic");
        doc.setFontSize(9);
        doc.setTextColor(...teal);
        doc.text(c.subtitle, M + 14, y + 32);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        doc.setTextColor(...ink);
        doc.text(`${c.city}  ·  ${c.specialty}`, M + 14, y + 48);
        doc.setTextColor(...muted);
        doc.text(`Contacto: ${c.phoneDisplay}`, M + 14, y + 62);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(...gold);
        doc.text(c.price, W - M - 14, y + 18, { align: "right" });
        y += 88;
      });
    }

    section("Recomendações Gerais", gold);
    bullets(
      isNormal
        ? [
            "Utilize óculos de sol com proteção UV sempre que estiver ao ar livre.",
            "Faça pausas visuais regulares — regra 20-20-20 (a cada 20 min, olhe 20 seg para algo a 6 metros).",
            "Mantenha exames oftalmológicos de rotina, pelo menos uma vez por ano.",
            "Junte-se à comunidade Janelas Para a Alma para acompanhar novidades de saúde visual.",
          ]
        : [
            "Procure avaliação presencial com oftalmologista qualificado.",
            "Realize exames de refração e teste de cobertura ocular.",
            "Mantenha pausas visuais regulares (regra 20-20-20).",
            "Inicie exercícios visuais terapêuticos sob orientação profissional.",
            "Junte-se à comunidade Janelas Para a Alma para apoio emocional.",
          ]
    );

    const discTexto =
      "Os resultados desta triagem são informativos, baseados em biometria facial, e não substituem " +
      "uma avaliação oftalmológica presencial. A plataforma Janelas Para a Alma isenta-se de " +
      "responsabilidade por diagnósticos ou ações médicas tomadas com base neste documento. Em caso " +
      "de desconforto visual, consulte imediatamente um especialista.";
    const disc = doc.splitTextToSize(discTexto, W - M * 2 - 24);
    const discBoxH = 34 + disc.length * 11;
    if (y > H - discBoxH - 20) { doc.addPage(); y = M; }
    doc.setFillColor(255, 247, 224);
    doc.roundedRect(M, y, W - M * 2, discBoxH, 8, 8, "F");
    doc.setTextColor(...navy);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text("AVISO IMPORTANTE", M + 12, y + 18);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(...ink);
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

      const emailTexto = "janelasparaalma18@gmail.com";
      if (logo) {
        const smallH = 14;
        const smallW = (logo.width / logo.height) * smallH;
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        const emailW = doc.getTextWidth(emailTexto);
        const groupW = smallW + 6 + emailW;
        const startX = W / 2 - groupW / 2;
        doc.addImage(logo.dataUrl, "PNG", startX, H - 14 - smallH / 2, smallW, smallH);
        doc.setTextColor(255, 255, 255);
        doc.text(emailTexto, startX + smallW + 6, H - 14);
      } else {
        doc.setTextColor(255, 255, 255);
        doc.text(emailTexto, W / 2, H - 14, { align: "center" });
      }
      doc.setTextColor(180, 220, 215);
      doc.text(`Página ${i} de ${pageCount}`, W - M, H - 14, { align: "right" });
    }

    doc.save(`relatorio-janelas-${result.diagnosis.toLowerCase()}-${date.toISOString().slice(0, 10)}.pdf`);
  };

  if (!result || !info) {
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
              <CheckCircle2 className="w-4 h-4" /> Análise concluída
            </div>
            <h1 className="mt-3 text-3xl md:text-4xl font-bold leading-tight">
              Diagnóstico: <span className="text-gold">{result.diagnosis}</span>
            </h1>
            <p className="mt-3 text-sm md:text-base text-white/80 max-w-2xl">
              {result.apiData?.recomendacao || info.short}. Recomenda-se consulta oftalmológica para confirmação e
              plano terapêutico personalizado.
            </p>

            <div className="mt-6 grid sm:grid-cols-3 gap-3">
              {[
                { l: "Confiança IA", v: `${result.confidence}%` },
                { l: "Tipo", v: result.diagnosis },
                { l: "Data", v: new Date(result.date).toLocaleDateString("pt-PT") },
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
                onClick={() => void handleDownload()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
              >
                <Download className="w-3.5 h-3.5" /> Descarregar relatório
              </button>
            </div>
          </div>

          <div className="max-w-5xl mx-auto mt-5 flex items-start gap-3 p-4 rounded-2xl bg-gold/10 border border-gold/30 text-sm text-foreground">
            <AlertCircle className="w-5 h-5 text-gold shrink-0 mt-0.5" />
            <p>
              Esta análise é orientadora e <strong>não substitui</strong> avaliação médica. Procure sempre um profissional de saúde visual qualificado.
            </p>
          </div>

          <div className="max-w-5xl mx-auto mt-8">
            <div className="flex flex-wrap gap-2 p-1.5 rounded-2xl bg-muted">
              {visibleTabs.map((t) => {
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
              {tab === "condicao" && <CondicaoPanel diagnosis={result.diagnosis} info={info} />}
              {tab === "clinicas" && !isNormal && (
                <ClinicasPanel clinics={recommendedClinics} diagnosis={result.diagnosis} />
              )}
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

const CondicaoPanel = ({ diagnosis, info }: { diagnosis: DiagnosisKey; info: DiagnosisInfo }) => (
  <div className="grid md:grid-cols-2 gap-4">
    <Card>
      <div className="flex items-center gap-2 text-teal text-xs font-bold uppercase tracking-widest">
        <Info className="w-4 h-4" /> O Seu Resultado
      </div>
      <h2 className="mt-2 text-xl font-bold text-foreground">O que é {diagnosis}?</h2>
      <p className="mt-3 text-sm text-muted-foreground leading-relaxed">{info.description}</p>
      {diagnosis !== DIAGNOSTICO_NORMAL && (
        <div className="mt-5">
          <div className="text-xs font-semibold uppercase tracking-wider text-foreground/70 mb-2">Sintomas frequentes</div>
          <ul className="space-y-1.5">
            {info.symptoms.map((s) => (
              <li key={s} className="flex items-start gap-2 text-sm text-muted-foreground">
                <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-teal shrink-0" />
                {s}
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>

    <Card>
      <div className="flex items-center gap-2 text-green text-xs font-bold uppercase tracking-widest">
        <Stethoscope className="w-4 h-4" /> O que recomendamos
      </div>
      <h2 className="mt-2 text-xl font-bold text-foreground">Plano terapêutico orientador</h2>
      <p className="mt-3 text-sm text-muted-foreground">
        As opções abaixo são habitualmente utilizadas para casos de {diagnosis}. A escolha final deve ser feita por um oftalmologista.
      </p>
      <ul className="mt-4 space-y-2">
        {info.treatments.map((t) => (
          <li key={t} className="flex items-start gap-3 p-3 rounded-xl bg-muted">
            <CheckCircle2 className="w-4 h-4 text-green mt-0.5 shrink-0" />
            <span className="text-sm text-foreground">{t}</span>
          </li>
        ))}
      </ul>
    </Card>
  </div>
);

const ClinicasPanel = ({ clinics, diagnosis }: { clinics: ClinicRec[]; diagnosis: DiagnosisKey }) => (
  <div className="space-y-4">
    <div className="flex items-start gap-3 p-4 rounded-2xl bg-teal/5 border border-teal/20">
      <Eye className="w-5 h-5 text-teal shrink-0 mt-0.5" />
      <p className="text-sm text-foreground">
        Recomendações <strong>personalizadas</strong> com base no diagnóstico de <strong>{diagnosis}</strong>. Estas unidades de saúde dispõem da especialidade mais adequada ao seu caso.
      </p>
    </div>
    <div className="grid md:grid-cols-2 gap-4">
      {clinics.map((c) => (
        <Card key={c.name}>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="text-base font-bold text-foreground">{c.name}</h3>
              <div className="mt-1 inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-teal/10 text-teal text-[11px] font-semibold">
                <Stethoscope className="w-3 h-3" /> {c.subtitle}
              </div>
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
