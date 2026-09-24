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
import { Trans, useTranslation } from "react-i18next";
import i18n from "@/i18n";
import { localizar } from "@/i18n/rotas";
import { formatarData, formatarDataHora } from "@/i18n/formatar";
import { textoDoScannerNoIdioma } from "@/services/api/screeningApi";

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

/** O diagnóstico é um valor estável (português) que vem da API e serve de
 *  chave; só o rótulo mostrado é traduzido. Um valor desconhecido aparece tal
 *  como veio. */
const CHAVE_ROTULO_DIAGNOSTICO: Record<DiagnosisKey, string> = {
  Esotropia: "ScannerResultados.diagEsotropia",
  Exotropia: "ScannerResultados.diagExotropia",
  Hipertropia: "ScannerResultados.diagHipertropia",
  Hipotropia: "ScannerResultados.diagHipotropia",
  "Alinhamento Fisiológico Normal": "ScannerResultados.diagNormal",
  "Necessária Avaliação Oftalmológica": "ScannerResultados.diagAvaliacao",
};
const rotuloDiagnostico = (valor: string): string => {
  const chave = CHAVE_ROTULO_DIAGNOSTICO[valor as DiagnosisKey];
  return chave ? i18n.t(chave) : valor;
};
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
    get short() {
      return i18n.t("ScannerResultados.desvioConvergenteOlhoS");
    },
    get description() {
      return i18n.t("ScannerResultados.esotropiaEUmTipo");
    },
    get symptoms() {
      return [
      i18n.t("ScannerResultados.olhosVoltadosParaDentro"),
      i18n.t("ScannerResultados.visaoDuplaDiplopia"),
      i18n.t("ScannerResultados.fadigaOcularEDores"),
      i18n.t("ScannerResultados.inclinacaoOuRotacaoDa"),
    ];
    },
    get treatments() {
      return [
      i18n.t("ScannerResultados.oculosComCorreccaoHipermetropica"),
      i18n.t("ScannerResultados.terapiaVisualOrtoptica"),
      i18n.t("ScannerResultados.oclusaoComTampaoAmbliopia"),
      i18n.t("ScannerResultados.toxinaBotulinicaOuCirurgia"),
    ];
    },
  },
  Exotropia: {
    get short() {
      return i18n.t("ScannerResultados.desvioDivergenteOlhoS");
    },
    get description() {
      return i18n.t("ScannerResultados.exotropiaCaracterizaSePelo");
    },
    get symptoms() {
      return [
      i18n.t("ScannerResultados.olhoQueSeDesvia"),
      i18n.t("ScannerResultados.fecharUmOlhoSob"),
      i18n.t("ScannerResultados.dificuldadeDeVisaoDe"),
      i18n.t("ScannerResultados.fadigaVisualEmLeitura"),
    ];
    },
    get treatments() {
      return [
      i18n.t("ScannerResultados.exerciciosDeConvergenciaOcular"),
      i18n.t("ScannerResultados.oculosComPrismas"),
      i18n.t("ScannerResultados.terapiaVisualOrtoptica"),
      i18n.t("ScannerResultados.cirurgiaMuscularExtraocularQuando"),
    ];
    },
  },
  Hipertropia: {
    get short() {
      return i18n.t("ScannerResultados.desvioVerticalOlhoS");
    },
    get description() {
      return i18n.t("ScannerResultados.hipertropiaEUmDesvio");
    },
    get symptoms() {
      return [
      i18n.t("ScannerResultados.visaoDuplaVertical"),
      i18n.t("ScannerResultados.inclinacaoDaCabecaTorcicolo"),
      i18n.t("ScannerResultados.tonturaEDesconfortoVisual"),
      i18n.t("ScannerResultados.dificuldadeAoDescerEscadas"),
    ];
    },
    get treatments() {
      return [
      i18n.t("ScannerResultados.oculosComPrismasVerticais"),
      i18n.t("ScannerResultados.avaliacaoNeuroftalmologica"),
      i18n.t("ScannerResultados.toxinaBotulinicaEmCasos"),
      i18n.t("ScannerResultados.cirurgiaDosMusculosObliquos"),
    ];
    },
  },
  Hipotropia: {
    get short() {
      return i18n.t("ScannerResultados.desvioVerticalOlhoS2");
    },
    get description() {
      return i18n.t("ScannerResultados.hipotropiaEODesvio");
    },
    get symptoms() {
      return [
      i18n.t("ScannerResultados.visaoDuplaVertical"),
      i18n.t("ScannerResultados.posturaAnomalaDaCabeca"),
      i18n.t("ScannerResultados.limitacaoDosMovimentosOculares"),
      i18n.t("ScannerResultados.dificuldadeEmFocarObjectos"),
    ];
    },
    get treatments() {
      return [
      i18n.t("ScannerResultados.prismasCorrectivosNosOculos"),
      i18n.t("ScannerResultados.investigacaoDeCausasNeurologicas"),
      i18n.t("ScannerResultados.reabilitacaoOrtoptica"),
      i18n.t("ScannerResultados.cirurgiaMuscularCorrectiva"),
    ];
    },
  },
  "Alinhamento Fisiológico Normal": {
    get short() {
      return i18n.t("ScannerResultados.eixosVisuaisSimetricosE");
    },
    get description() {
      return i18n.t("ScannerResultados.aAnaliseDasTres");
    },
    get symptoms() {
      return [
      i18n.t("ScannerResultados.boaCoordenacaoBinocular"),
      i18n.t("ScannerResultados.ausenciaDeDiplopiaVisao"),
      i18n.t("ScannerResultados.confortoVisualNasPosicoes"),
    ];
    },
    get treatments() {
      return [
      i18n.t("ScannerResultados.manterConsultasOftalmologicasDe"),
      i18n.t("ScannerResultados.praticarPausasVisuaisRegulares"),
      i18n.t("ScannerResultados.utilizarProteccaoUvAo"),
    ];
    },
  },
  "Necessária Avaliação Oftalmológica": {
    get short() {
      return i18n.t("ScannerResultados.assimetriaDeReflexosOu");
    },
    get description() {
      return i18n.t("ScannerResultados.aTriagemAutomatizadaIdentificou");
    },
    get symptoms() {
      return [
      i18n.t("ScannerResultados.possivelDesvioIntermitenteNas"),
      i18n.t("ScannerResultados.desconfortoOuFadigaVisual"),
      i18n.t("ScannerResultados.dificuldadeDeFixacaoProlongada"),
    ];
    },
    get treatments() {
      return [
      i18n.t("ScannerResultados.consultaDeOftalmologiaOu"),
      i18n.t("ScannerResultados.exameDeMotilidadeOcular"),
      i18n.t("ScannerResultados.avaliacaoDeAcuidadeVisual"),
    ];
    },
  },
};

const tabs: { key: TabKey; label: string; icon: typeof Info }[] = [
  { key: "condicao", get label() {
    return i18n.t("ScannerResultados.oSeuResultado");
  }, icon: Info },
  { key: "clinicas", get label() {
    return i18n.t("ScannerResultados.clinicasPrecos");
  }, icon: MapPin },
  { key: "exercicios", get label() {
    return i18n.t("ScannerResultados.exercicios");
  }, icon: Activity },
  { key: "comunidade", get label() {
    return i18n.t("ScannerResultados.comunidade");
  }, icon: Users },
];

const ALL_CLINICS = {
  sagrada: {
    get name() {
      return i18n.t("ScannerResultados.clinicaSagradaEsperanca");
    },
    get city() {
      return i18n.t("ScannerResultados.luandaIlhaDeLuanda");
    },
    get specialty() {
      return i18n.t("ScannerResultados.oftalmologiaGeralEstrabismo");
    },
    get price() {
      return i18n.t("ScannerResultados.n25000A40");
    },
    phone: "+244923167950",
    phoneDisplay: "+244 923 167 950",
    website: "https://www.cse.co.ao",
  },
  optico: {
    get name() {
      return i18n.t("ScannerResultados.centroOpticoAngolano");
    },
    get city() {
      return i18n.t("ScannerResultados.luandaCallCenter");
    },
    get specialty() {
      return i18n.t("ScannerResultados.avaliacaoVisualOculos");
    },
    get price() {
      return i18n.t("ScannerResultados.n15000A22");
    },
    phone: "+244923400300",
    phoneDisplay: "+244 923 400 300",
    website: "https://centrooptico.co.ao",
  },
  multiperfil: {
    get name() {
      return i18n.t("ScannerResultados.clinicaMultiperfil");
    },
    get city() {
      return i18n.t("ScannerResultados.luandaMorroBento");
    },
    get specialty() {
      return i18n.t("ScannerResultados.pediatriaCirurgiaOftalmologica");
    },
    get price() {
      return i18n.t("ScannerResultados.n30000A45");
    },
    phone: "+244923501168",
    phoneDisplay: "+244 923 501 168",
    website: "https://www.multiperfil.co.ao",
  },
  girassol: {
    get name() {
      return i18n.t("ScannerResultados.hospitalGirassol");
    },
    get city() {
      return i18n.t("ScannerResultados.luandaMaianga");
    },
    get specialty() {
      return i18n.t("ScannerResultados.neuroftalmologiaExamesAvancados");
    },
    get price() {
      return i18n.t("ScannerResultados.n35000A55");
    },
    phone: "+244222641000",
    phoneDisplay: "+244 222 641 000",
    website: "https://www.hospitalgirassol.co.ao",
  },
} as const;

type ClinicRec = (typeof ALL_CLINICS)[keyof typeof ALL_CLINICS] & { subtitle: string };

// Função (e não constante): os `...ALL_CLINICS.x` copiam os valores dos
// getters no momento em que correm. Ao nível do módulo isso acontecia uma vez,
// em português, e a página inglesa (e o PDF) ficavam com as clínicas em PT.
const CLINIC_RECOMMENDATIONS = (): Record<DiagnosisKey, ClinicRec[]> => ({
  Esotropia: [
    { ...ALL_CLINICS.sagrada, get subtitle() {
      return i18n.t("ScannerResultados.centroDeExcelenciaEm");
    } },
    { ...ALL_CLINICS.optico, get subtitle() {
      return i18n.t("ScannerResultados.avaliacaoRefractivaComplementar");
    } },
  ],
  Exotropia: [
    { ...ALL_CLINICS.multiperfil, get subtitle() {
      return i18n.t("ScannerResultados.especialistasEmCirurgiaDivergente");
    } },
    { ...ALL_CLINICS.optico, get subtitle() {
      return i18n.t("ScannerResultados.avaliacaoRefractivaComplementar");
    } },
  ],
  Hipertropia: [
    { ...ALL_CLINICS.girassol, get subtitle() {
      return i18n.t("ScannerResultados.unidadeAvancadaDeNeuroftalmologia");
    } },
  ],
  Hipotropia: [
    { ...ALL_CLINICS.girassol, get subtitle() {
      return i18n.t("ScannerResultados.unidadeAvancadaDeNeuroftalmologia");
    } },
  ],
  "Alinhamento Fisiológico Normal": [
    { ...ALL_CLINICS.optico, get subtitle() {
      return i18n.t("ScannerResultados.examesDeRotinaCuidados");
    } },
    { ...ALL_CLINICS.sagrada, get subtitle() {
      return i18n.t("ScannerResultados.checkUpOftalmologicoAnual");
    } },
  ],
  "Necessária Avaliação Oftalmológica": [
    { ...ALL_CLINICS.sagrada, get subtitle() {
      return i18n.t("ScannerResultados.avaliacaoOrtopticaEEstrabismo");
    } },
    { ...ALL_CLINICS.multiperfil, get subtitle() {
      return i18n.t("ScannerResultados.diagnosticoDiferencialEspecializado");
    } },
  ],
});

const exercises = [
  { get title() {
    return i18n.t("ScannerResultados.convergencia");
  }, get to() {
    return localizar("/exercicios/convergencia");
  }, get desc() {
    return i18n.t("ScannerResultados.treinaACoordenacaoBinocular");
  } },
  { get title() {
    return i18n.t("ScannerResultados.cerebroVisao");
  }, get to() {
    return localizar("/exercicios/cerebro");
  }, get desc() {
    return i18n.t("ScannerResultados.estimulosCognitivosVisuais");
  } },
  { get title() {
    return i18n.t("ScannerResultados.trackingOcular");
  }, get to() {
    return localizar("/exercicios/tracking");
  }, get desc() {
    return i18n.t("ScannerResultados.movimentosSuavesDeSeguimento");
  } },
  { get title() {
    return i18n.t("ScannerResultados.relaxamento");
  }, get to() {
    return localizar("/exercicios/relaxamento");
  }, get desc() {
    return i18n.t("ScannerResultados.aliviaFadigaOcular");
  } },
];

/** A frase seguinte (`recomendaSeConsultaOftalmologica`) já começa com ". ":
 * sem isto, um texto que acabe em ponto dava "pedido.." (bug real). */
const semPontoFinal = (texto: string) => texto.replace(/[.\s]+$/, "");

const Resultados = () => {
  const { t: tr } = useTranslation();
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
      navigate(localizar("/scanner"), { replace: true });
      return;
    }
    try {
      setResult(JSON.parse(raw));
    } catch {
      navigate(localizar("/scanner"), { replace: true });
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
    () => (result ? CLINIC_RECOMMENDATIONS()[result.diagnosis] ?? CLINIC_RECOMMENDATIONS()[DIAGNOSIS_FALLBACK] : []),
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
    const formatted = formatarDataHora(date);
    const logo = await obterLogo().catch(() => null);

    const doc = new jsPDF({ unit: "pt", format: "a4" });
    const W = doc.internal.pageSize.getWidth();
    const H = doc.internal.pageSize.getHeight();
    const M = 48;

    const navy: [number, number, number] = [11, 27, 59];
    const teal: [number, number, number] = [31, 178, 158];
    const gold: [number, number, number] = [217, 175, 84];
    const green: [number, number, number] = [38, 115, 89];
    const blue: [number, number, number] = [37, 99, 235];
    const red: [number, number, number] = [220, 38, 38];
    const ink: [number, number, number] = [30, 41, 59];
    const muted: [number, number, number] = [100, 116, 139];
    const soft: [number, number, number] = [241, 245, 249];
    const corDiagnostico = isNormal ? green : red;

    // Header — logótipo oficial, centrado, seguido de uma barra divisória.
    let y = 24;
    if (logo) {
      const boxW = 180, boxH = 60;
      const ratio = logo.width / logo.height;
      const logoW = ratio > boxW / boxH ? boxW : boxH * ratio;
      const logoH = ratio > boxW / boxH ? boxW / ratio : boxH;
      doc.addImage(logo.dataUrl, "PNG", (W - logoW) / 2, y, logoW, logoH);
      y += boxH + 14;
    } else {
      y += 20;
    }
    doc.setFillColor(...navy);
    doc.rect(0, y, W, 4, "F");
    y += 26;

    // Introdução institucional (texto centrado, como no modelo oficial)
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(...teal);
    doc.text(tr("ScannerResultados.pdfSobreAPlataforma"), W / 2, y, { align: "center" });
    y += 18;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    doc.setTextColor(...ink);
    const introP1 = doc.splitTextToSize(
      tr("ScannerResultados.pdfIntroPlataforma"),
      W - M * 2
    );
    doc.text(introP1, W / 2, y, { align: "center" });
    y += introP1.length * 13 + 10;

    const introP2 = doc.splitTextToSize(
      tr("ScannerResultados.pdfIntroRelatorio"),
      W - M * 2
    );
    doc.text(introP2, W / 2, y, { align: "center" });
    y += introP2.length * 13 + 22;

    // Bloco "Relatório de Triagem..." / "Emitido em...", alinhado à direita
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    doc.setTextColor(...navy);
    doc.text(tr("ScannerResultados.pdfRelatorioTitulo"), W - M, y, { align: "right" });
    y += 13;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(...muted);
    doc.text(tr("ScannerResultados.pdfEmitidoEm", { formatted }), W - M, y, { align: "right" });
    y += 24;

    // Cartão de diagnóstico — compacto, sem glifo do olho.
    const cardH = 92;
    if (y > H - cardH - 40) { doc.addPage(); y = M; }
    doc.setFillColor(...soft);
    doc.roundedRect(M, y, W - M * 2, cardH, 12, 12, "F");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(...teal);
    doc.text(tr("ScannerResultados.pdfDiagnosticoOrientador"), M + 18, y + 24);

    doc.setFontSize(16);
    doc.setTextColor(...corDiagnostico);
    doc.text(rotuloDiagnostico(result.diagnosis), M + 18, y + 46);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(...ink);
    const shortLines = doc.splitTextToSize(info.short, W - M * 2 - 140);
    doc.text(shortLines, M + 18, y + 66);

    // Badge de confiança, discreto, alinhado à direita
    const badgeW = 74, badgeH = 34, badgeX = W - M - 18 - badgeW, badgeY = y + 14;
    doc.setFillColor(...green);
    doc.roundedRect(badgeX, badgeY, badgeW, badgeH, 8, 8, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.text(tr("ScannerResultados.pdfConfianca"), badgeX + badgeW / 2, badgeY + 13, { align: "center" });
    doc.setFontSize(12);
    doc.text(`${result.confidence}%`, badgeX + badgeW / 2, badgeY + 27, { align: "center" });

    y += cardH + 24;

    const heading = (title: string, color: [number, number, number]) => {
      if (y > H - 120) { doc.addPage(); y = M; }
      doc.setFont("helvetica", "bold");
      doc.setFontSize(13);
      doc.setTextColor(...color);
      doc.text(title, M, y);
      y += 18;
    };

    const bullets = (items: readonly string[]) => {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(...ink);
      items.forEach((t) => {
        if (y > H - 80) { doc.addPage(); y = M; }
        const wrapped = doc.splitTextToSize(t, W - M * 2 - 18);
        doc.setFillColor(...ink);
        doc.circle(M + 6, y + 4, 1.6, "F");
        doc.text(wrapped, M + 16, y + 6);
        y += wrapped.length * 13 + 4;
      });
      y += 6;
    };

    heading(tr("ScannerResultados.resultado"), red);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(...ink);
    const desc = doc.splitTextToSize(info.description, W - M * 2);
    doc.text(desc, M, y);
    y += desc.length * 13 + 16;

    if (!isNormal) {
      heading(tr("ScannerResultados.sinaisFrequentesDeEstrabismo"), gold);
      bullets(info.symptoms);
    }

    heading(tr("ScannerResultados.recomendacoes"), green);
    bullets(info.treatments);

    if (!isNormal) {
      heading(tr("ScannerResultados.clinicasRecomendadasEmAngola"), ink);
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
        doc.text(tr("ScannerResultados.pdfContacto", { phoneDisplay: c.phoneDisplay }), M + 14, y + 62);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(...gold);
        doc.text(c.price, W - M - 14, y + 18, { align: "right" });
        y += 88;
      });
    }

    heading(tr("ScannerResultados.recomendacoesGerais"), blue);
    bullets(
      isNormal
        ? [
            tr("ScannerResultados.utilizeOculosDeSol"),
            tr("ScannerResultados.facaPausasVisuaisRegulares"),
            tr("ScannerResultados.mantenhaExamesOftalmologicosDe"),
            tr("ScannerResultados.junteSeAComunidade2"),
          ]
        : [
            tr("ScannerResultados.procureAvaliacaoPresencialCom"),
            tr("ScannerResultados.realizeExamesDeRefraccao"),
            tr("ScannerResultados.mantenhaPausasVisuaisRegulares"),
            tr("ScannerResultados.inicieExerciciosVisuaisTerapeuticos"),
            tr("ScannerResultados.junteSeAComunidade3"),
          ]
    );

    // "AVISO IMPORTANTE" como badge centrado, com a caixa de texto por baixo
    if (y > H - 160) { doc.addPage(); y = M; }
    y += 10;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    const avisoLabel = tr("ScannerResultados.pdfAvisoImportante");
    const avisoW = doc.getTextWidth(avisoLabel) + 32;
    const avisoH = 26;
    doc.setFillColor(...soft);
    doc.roundedRect(W / 2 - avisoW / 2, y, avisoW, avisoH, avisoH / 2, avisoH / 2, "F");
    doc.setTextColor(...red);
    doc.text(avisoLabel, W / 2, y + avisoH / 2 + 4, { align: "center" });
    y += avisoH + 16;

    const discTexto =
      tr("ScannerResultados.pdfAvisoTexto");
    const disc = doc.splitTextToSize(discTexto, W - M * 2 - 48);
    const discBoxH = 32 + disc.length * 15;
    if (y > H - discBoxH - 20) { doc.addPage(); y = M; }
    doc.setFillColor(...soft);
    doc.roundedRect(M, y, W - M * 2, discBoxH, 10, 10, "F");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(...ink);
    doc.text(disc, M + 24, y + 24, { lineHeightFactor: 1.35 });
    y += discBoxH + 20;

    // Rodapé — logótipo pequeno à esquerda, contactos ao centro, paginação à direita.
    const footerH = 64;
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFillColor(...navy);
      doc.rect(0, H - footerH, W, footerH, "F");

      if (logo) {
        const fLogoH = 30;
        const fLogoW = (logo.width / logo.height) * fLogoH;
        doc.addImage(logo.dataUrl, "PNG", M, H - footerH + (footerH - fLogoH) / 2, fLogoW, fLogoH);
      }

      const contatoX = M + 130;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(255, 255, 255);
      doc.text(tr("ScannerResultados.pdfContactos"), contatoX, H - footerH + 18);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(200, 220, 235);
      doc.text("•  Luanda, Angola", contatoX, H - footerH + 31);
      doc.text("•  +244 926 969 819", contatoX, H - footerH + 42);
      doc.text("•  janelasparaalma18@gmail.com", contatoX, H - footerH + 53);

      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.text(tr("ScannerResultados.pdfPagina", { i, pageCount }), W - M, H - footerH / 2 + 3, { align: "right" });
    }

    doc.save(`${tr("ScannerResultados.pdfNomeFicheiro")}-${rotuloDiagnostico(result.diagnosis).toLowerCase()}-${date.toISOString().slice(0, 10)}.pdf`);
  };

  if (!result || !info) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-muted-foreground">
        {tr("ScannerResultados.aCarregarResultados")}
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />
      <BackButton fallbackPath={localizar("/scanner")} label={tr("ScannerResultados.novaAnalise")} />
      <main className="flex-1">
        <section className="container py-8 md:py-12">
          <div className="max-w-5xl mx-auto rounded-3xl bg-gradient-to-br from-navy to-navy/80 text-navy-foreground p-6 md:p-10 shadow-elevated animate-fade-in">
            <div className="flex items-center gap-2 text-teal text-xs font-bold uppercase tracking-widest">
              <CheckCircle2 className="w-4 h-4" />{" "}{tr("ScannerResultados.analiseConcluida")}
            </div>
            <h1 className="mt-3 text-3xl md:text-4xl font-bold leading-tight">
              <Trans i18nKey="ScannerResultados.diagnostico" components={{ span: <span className="text-gold" /> }} values={{ diagnosis: rotuloDiagnostico(result.diagnosis) }} />
            </h1>
            <p className="mt-3 text-sm md:text-base text-white/80 max-w-2xl">
              {semPontoFinal(textoDoScannerNoIdioma(result.apiData?.recomendacao) ?? info.short)}{tr("ScannerResultados.recomendaSeConsultaOftalmologica")}
            </p>

            <div className="mt-6 grid sm:grid-cols-3 gap-3">
              {[
                { l: tr("ScannerResultados.confiancaIa"), v: `${result.confidence}%` },
                { l: tr("ScannerResultados.tipo"), v: rotuloDiagnostico(result.diagnosis) },
                { l: tr("ScannerResultados.data"), v: formatarData(result.date) },
              ].map((m) => (
                <div key={m.l} className="rounded-2xl bg-white/10 backdrop-blur px-4 py-3">
                  <div className="text-xs text-white/70">{m.l}</div>
                  <div className="text-lg font-bold">{m.v}</div>
                </div>
              ))}
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-3 text-xs text-white/70">
              <span className="inline-flex items-center gap-1.5"><ShieldCheck className="w-4 h-4 text-teal" />{" "}{tr("ScannerResultados.dadosConfidenciais")}</span>
              <button
                onClick={() => void handleDownload()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
              >
                <Download className="w-3.5 h-3.5" />{" "}{tr("ScannerResultados.descarregarRelatorio")}
              </button>
            </div>
          </div>

          <div className="max-w-5xl mx-auto mt-5 flex items-start gap-3 p-4 rounded-2xl bg-gold/10 border border-gold/30 text-sm text-foreground">
            <AlertCircle className="w-5 h-5 text-gold shrink-0 mt-0.5" />
            <p>
              <Trans i18nKey="ScannerResultados.estaAnaliseEOrientadora" components={{ strong: <strong /> }} />
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

const CondicaoPanel = ({ diagnosis, info }: { diagnosis: DiagnosisKey; info: DiagnosisInfo }) => {
  const { t: tr } = useTranslation();
  return (
  <div className="grid md:grid-cols-2 gap-4">
    <Card>
      <div className="flex items-center gap-2 text-teal text-xs font-bold uppercase tracking-widest">
        <Info className="w-4 h-4" />{" "}{tr("ScannerResultados.oSeuResultado")}
      </div>
      <h2 className="mt-2 text-xl font-bold text-foreground"><Trans i18nKey="ScannerResultados.oQueE" values={{ diagnosis: rotuloDiagnostico(diagnosis) }} /></h2>
      <p className="mt-3 text-sm text-muted-foreground leading-relaxed">{info.description}</p>
      {diagnosis !== DIAGNOSTICO_NORMAL && (
        <div className="mt-5">
          <div className="text-xs font-semibold uppercase tracking-wider text-foreground/70 mb-2">{tr("ScannerResultados.sintomasFrequentes")}</div>
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
        <Stethoscope className="w-4 h-4" />{" "}{tr("ScannerResultados.oQueRecomendamos")}
      </div>
      <h2 className="mt-2 text-xl font-bold text-foreground">{tr("ScannerResultados.planoTerapeuticoOrientador")}</h2>
      <p className="mt-3 text-sm text-muted-foreground">
        <Trans i18nKey="ScannerResultados.asOpcoesAbaixoSao" values={{ diagnosis: rotuloDiagnostico(diagnosis) }} />
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
};

const ClinicasPanel = ({ clinics, diagnosis }: { clinics: ClinicRec[]; diagnosis: DiagnosisKey }) => {
  const { t } = useTranslation();
  return (
  <div className="space-y-4">
    <div className="flex items-start gap-3 p-4 rounded-2xl bg-teal/5 border border-teal/20">
      <Eye className="w-5 h-5 text-teal shrink-0 mt-0.5" />
      <p className="text-sm text-foreground">
        <Trans i18nKey="ScannerResultados.recomendacoesPersonalizadasComBase" components={{ strong: <strong /> }} values={{ diagnosis: rotuloDiagnostico(diagnosis) }} />
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
              {t("ScannerResultados.agendar")}{" "}<ArrowRight className="w-3 h-3" />
            </button>
          </div>
        </Card>
      ))}
    </div>
  </div>
);
};

const ExerciciosPanel = () => {
  const { t } = useTranslation();
  return (
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
          {t("ScannerResultados.iniciar")}{" "}<ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
        </div>
      </Link>
    ))}
  </div>
);
};

const ComunidadePanel = () => {
  const { t } = useTranslation();
  return (
  <Card>
    <div className="flex flex-col md:flex-row md:items-center gap-6">
      <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-teal to-green flex items-center justify-center shrink-0">
        <Users className="w-8 h-8 text-white" />
      </div>
      <div className="flex-1">
        <h2 className="text-xl font-bold text-foreground">{t("ScannerResultados.naoEstaSozinhoA")}</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          <Trans i18nKey="ScannerResultados.junteSeAComunidade" components={{ strong: <strong /> }} />
        </p>
      </div>
      <Link
        to={localizar("/kamba")}
        className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 transition-colors shrink-0"
      >
        {t("ScannerResultados.juntarMe")}{" "}<ArrowRight className="w-4 h-4" />
      </Link>
    </div>
  </Card>
);
};

export default Resultados;
