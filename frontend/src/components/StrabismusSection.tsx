import { useState, useRef } from "react";
import { ChevronLeft, ChevronRight, Eye, Brain, Dna, AlertTriangle, Stethoscope, BookOpen, ExternalLink } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import strabismusAnatomy from "@/assets/strabismus-anatomy.jpg";
const strabismusChild = "/eye-comparison.webp";

import strabismusExamAsset from "@/assets/tratamento-exam.jpg.asset.json";
const strabismusExam = strabismusExamAsset.url;
import strabismusTypesAsset from "@/assets/tipos-estrabismo.jpg.asset.json";
const strabismusTypes = strabismusTypesAsset.url;
import strabismusTreatmentAsset from "@/assets/consequencias-estrabismo.jpg.asset.json";
const strabismusTreatment = strabismusTreatmentAsset.url;

const cards = [
  {
    number: "01",
    icon: Eye,
    title: "Definição",
    summary: "Um desalinhamento dos olhos, onde não apontam para a mesma direção em simultâneo.",
    image: strabismusAnatomy,
    detail: {
      heading: "O que é o Estrabismo?",
      paragraphs: [
        "O estrabismo é uma condição oftalmológica caracterizada pelo desalinhamento dos eixos visuais: os olhos não apontam para o mesmo ponto ao mesmo tempo. Um olho pode desviar-se para dentro, para fora, para cima ou para baixo, enquanto o outro fixa normalmente.",
        "Esta condição afeta cerca de 2 a 4% da população mundial e pode surgir em qualquer idade, embora seja mais frequente na infância. Quando não diagnosticado e tratado precocemente, pode comprometer gravemente o desenvolvimento visual e psicossocial do indivíduo.",
      ],
    },
  },
  {
    number: "02",
    icon: Dna,
    title: "Causas",
    summary: "Pode resultar de fatores genéticos, problemas refrativos não corrigidos ou anomalias musculares.",
    image: strabismusChild,
    detail: {
      heading: "Causas do Estrabismo",
      paragraphs: [
        "O estrabismo pode ter origem em múltiplos fatores: hereditariedade (história familiar), erros refrativos não corrigidos (hipermetropia acentuada), paralisias ou anomalias dos músculos extraoculares, lesões neurológicas, prematuridade e síndromes genéticas.",
        "Em muitos casos, a causa é multifatorial. Um diagnóstico precoce — idealmente antes dos 6 anos — é fundamental para maximizar as hipóteses de recuperação funcional e estética.",
      ],
    },
  },
  {
    number: "03",
    icon: Brain,
    title: "Tipos Comuns",
    summary: "Esotropia (desvio para dentro), Exotropia (para fora), Hipertropia (para cima) e Hipotropia (para baixo).",
    image: strabismusTypes,
    detail: {
      heading: "Tipos de Estrabismo",
      paragraphs: [
        "Os quatro tipos principais classificam-se pela direção do desvio: Esotropia — o olho desvia-se para dentro (convergente); Exotropia — o olho desvia-se para fora (divergente); Hipertropia — desvio para cima; Hipotropia — desvio para baixo.",
        "Existem ainda classificações por idade de início (congénito vs. adquirido), frequência (constante vs. intermitente) e lateralidade (unilateral vs. alternante). Cada tipo requer uma abordagem terapêutica específica.",
      ],
    },
  },
  {
    number: "04",
    icon: AlertTriangle,
    title: "Consequências",
    summary: "Quando não tratado, pode causar ambliopia ('olho preguiçoso'), visão dupla e profundo impacto psicossocial.",
    image: strabismusTreatment,
    detail: {
      heading: "Consequências do Estrabismo Não Tratado",
      paragraphs: [
        "A principal consequência funcional é a ambliopia — o cérebro 'desliga' progressivamente a imagem do olho desviado, levando a uma perda permanente de acuidade visual nesse olho se não for tratada na infância.",
        "Para além da componente clínica, o impacto psicossocial é devastador: baixa autoestima, bullying escolar, isolamento social e discriminação laboral são realidades quotidianas para milhões de pessoas com estrabismo visível em todo o mundo.",
      ],
    },
  },
  {
    number: "05",
    icon: Stethoscope,
    title: "Tratamento",
    summary: "Correção ótica (óculos), terapia visual, oclusão (penso) ou cirurgia muscular, dependendo do caso.",
    image: strabismusExam,
    detail: {
      heading: "Opções de Tratamento",
      paragraphs: [
        "O tratamento depende do tipo, grau e idade do paciente. As opções incluem: correção ótica com óculos ou lentes de contacto (especialmente em casos refrativos); terapia visual (exercícios ortópticos); oclusão — tapar o olho dominante com penso para estimular o mais fraco.",
        "Em casos mais graves ou que não respondem ao tratamento conservador, a cirurgia aos músculos extraoculares pode ser necessária para realinhar os eixos visuais. O sucesso é significativamente maior quando o tratamento é iniciado precocemente.",
      ],
    },
  },
];

const references = [
  {
    label: "Arquivos Brasileiros de Oftalmologia (SciELO) ↗",
    href: "https://www.scielo.br/j/abo/a/9KXCHZM4pZ5jfTvVyKrpNPQ/?lang=pt",
  },
  {
    label: "Estrabismo para Totós - Sociedade Portuguesa de Oftalmologia (PDF) ↗",
    href: "https://www.spoftalmologia.pt/wp-content/uploads/2016/10/estrabismo-para-totos-pdf.pdf",
  },
  {
    label: "Documentação de Apoio Janelas para a Alma ↗",
    href: "https://share.google/nSGjEhSIYevW20C22",
  },
];

const StrabismusSection = () => {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const [articleOpen, setArticleOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const scroll = (direction: "left" | "right") => {
    if (!scrollRef.current) return;
    const amount = scrollRef.current.offsetWidth * 0.85;
    scrollRef.current.scrollBy({
      left: direction === "left" ? -amount : amount,
      behavior: "smooth",
    });
  };

  return (
    <section id="estrabismo" className="py-20 md:py-28 bg-muted/50">
      {/* Preload images */}
      <div className="hidden" aria-hidden="true">
        {cards.map((c, i) => (
          <img key={i} src={c.image} alt="" />
        ))}
      </div>

      <div className="container">
        <div className="text-center mb-16 space-y-4">
          <span className="text-sm font-medium tracking-widest uppercase text-teal">
            Compreender o Estrabismo
          </span>
          <h2 className="text-3xl md:text-5xl font-bold text-foreground">
            O que é o Estrabismo?
          </h2>
          <p className="max-w-2xl mx-auto text-muted-foreground leading-relaxed">
            Desmistificar a condição para promover a inclusão e o tratamento atempado.
          </p>
        </div>

        {/* Carousel */}
        <div className="relative group/carousel">
          <div
            ref={scrollRef}
            className="flex gap-6 overflow-x-auto scroll-smooth snap-x snap-mandatory pb-4 -mx-4 px-4 scrollbar-hide touch-pan-x"
            style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
          >
            {cards.map((card, i) => {
              const Icon = card.icon;
              return (
                <button
                  key={i}
                  onClick={() => setOpenIndex(i)}
                  className="snap-start shrink-0 w-[85%] sm:w-[70%] md:w-[45%] lg:w-[32%] xl:w-[22%] rounded-2xl overflow-hidden bg-card shadow-card border border-border/50 transition-all hover:shadow-elevated hover:scale-[1.02] cursor-pointer text-left focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 group"
                >
                  <div className="relative aspect-[4/3] overflow-hidden">
                    <img
                      src={card.image}
                      alt={card.title}
                      className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                    />
                    <div className="absolute top-4 left-4 bg-navy text-navy-foreground px-3 py-1.5 rounded-lg font-bold text-sm">
                      {card.number}
                    </div>
                    <div className="absolute bottom-4 right-4 w-10 h-10 rounded-xl bg-teal/90 flex items-center justify-center">
                      <Icon className="w-5 h-5 text-white" />
                    </div>
                  </div>
                  <div className="p-6 space-y-3">
                    <h3 className="text-xl font-bold text-foreground">{card.title}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed line-clamp-3">
                      {card.summary}
                    </p>
                    <span className="inline-block text-xs text-teal font-medium">
                      Saber mais →
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Navigation arrows */}
          <button
            onClick={() => scroll("left")}
            className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-2 flex items-center justify-center w-10 h-10 rounded-full bg-card shadow-elevated border border-border/50 text-foreground hover:bg-muted z-10 opacity-0 group-hover/carousel:opacity-100 transition-opacity duration-300"
            aria-label="Anterior"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button
            onClick={() => scroll("right")}
            className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-2 flex items-center justify-center w-10 h-10 rounded-full bg-card shadow-elevated border border-border/50 text-foreground hover:bg-muted z-10 opacity-0 group-hover/carousel:opacity-100 transition-opacity duration-300"
            aria-label="Próximo"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        {/* Global CTA Button */}
        <div className="flex justify-center mt-12">
          <Button
            size="lg"
            onClick={() => setArticleOpen(true)}
            className="gap-2 text-base px-8 py-6"
          >
            <BookOpen className="w-5 h-5" />
            Ler Artigo Completo sobre Estrabismo
          </Button>
        </div>
      </div>

      {/* Card Detail Modals */}
      {cards.map((card, i) => {
        const Icon = card.icon;
        return (
          <Dialog key={i} open={openIndex === i} onOpenChange={(v) => !v && setOpenIndex(null)}>
            <DialogContent className="sm:max-w-xl max-h-[85vh] p-0 overflow-hidden">
              <DialogHeader className="px-6 pt-6 pb-0">
                <DialogTitle className="flex items-center gap-3 text-xl">
                  <span className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-teal/10 text-teal">
                    <Icon className="w-5 h-5" />
                  </span>
                  {card.detail.heading}
                </DialogTitle>
                <DialogDescription className="sr-only">
                  Detalhes sobre {card.title}
                </DialogDescription>
              </DialogHeader>
              <ScrollArea className="max-h-[calc(85vh-80px)]">
                <div className="px-6 pb-6 space-y-5 pt-4">
                  <div className="rounded-xl overflow-hidden">
                    <img
                      src={card.image}
                      alt={card.title}
                      className="w-full aspect-video object-cover"
                    />
                  </div>
                  {card.detail.paragraphs.map((p, j) => (
                    <p key={j} className="text-muted-foreground leading-relaxed">
                      {p}
                    </p>
                  ))}
                </div>
              </ScrollArea>
            </DialogContent>
          </Dialog>
        );
      })}

      {/* Full Article Modal */}
      <Dialog open={articleOpen} onOpenChange={setArticleOpen}>
        <DialogContent className="sm:max-w-3xl max-h-[90vh] p-0 overflow-hidden">
          <DialogHeader className="px-8 pt-8 pb-0">
            <DialogTitle className="text-2xl md:text-3xl font-bold leading-tight">
              Compreender o Estrabismo: Causas, Impactos e Tratamentos
            </DialogTitle>
            <DialogDescription className="text-base text-muted-foreground mt-2">
              Um guia educativo completo sobre a condição que afeta milhões de pessoas em todo o mundo.
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[calc(90vh-100px)]">
            <article className="px-8 pb-16 pt-6 space-y-8 text-foreground">
              {/* Introduction */}
              <p className="text-muted-foreground leading-relaxed text-base">
                O estrabismo é uma das condições oftalmológicas mais comuns a nível global, afetando entre 2% a 4% da população. Apesar da sua prevalência, continua a ser uma condição frequentemente mal compreendida, cercada de estigma social e, em muitas regiões do mundo, sem acesso adequado a diagnóstico e tratamento. Este artigo visa desmistificar o estrabismo, apresentando de forma acessível as suas causas, tipos, consequências e opções terapêuticas.
              </p>

              {/* Definição */}
              <section className="space-y-3">
                <h3 className="text-xl font-bold flex items-center gap-2">
                  <Eye className="w-5 h-5 text-teal" />
                  1. Definição
                </h3>
                <p className="text-muted-foreground leading-relaxed">
                  O estrabismo consiste no desalinhamento dos eixos visuais, ou seja, os dois olhos não fixam o mesmo ponto simultaneamente. Um dos olhos pode desviar-se para dentro (convergente), para fora (divergente), para cima ou para baixo, enquanto o outro mantém a fixação correta. Esta falta de coordenação entre os músculos extraoculares pode ser constante ou intermitente e pode alternar entre os dois olhos.
                </p>
                <p className="text-muted-foreground leading-relaxed">
                  A condição pode manifestar-se desde o nascimento (estrabismo congénito) ou desenvolver-se mais tarde na infância ou mesmo na idade adulta. O diagnóstico precoce é essencial para evitar complicações irreversíveis no sistema visual.
                </p>
              </section>

              {/* Causas */}
              <section className="space-y-3">
                <h3 className="text-xl font-bold flex items-center gap-2">
                  <Dna className="w-5 h-5 text-teal" />
                  2. Causas
                </h3>
                <p className="text-muted-foreground leading-relaxed">
                  As causas do estrabismo são variadas e frequentemente multifatoriais. Os principais fatores incluem: predisposição genética e história familiar de estrabismo; erros refrativos não corrigidos, como hipermetropia significativa; anomalias anatómicas ou funcionais dos músculos extraoculares; lesões neurológicas que afetam os nervos cranianos (III, IV e VI); prematuridade e baixo peso ao nascer; e síndromes genéticas como a Síndrome de Down.
                </p>
                <p className="text-muted-foreground leading-relaxed">
                  Nalguns casos, o estrabismo pode surgir como consequência de outras patologias oculares, como cataratas congénitas ou tumores intraoculares, que impedem a formação de uma imagem nítida e desencadeiam o desalinhamento como mecanismo compensatório.
                </p>
              </section>

              {/* Tipos */}
              <section className="space-y-3">
                <h3 className="text-xl font-bold flex items-center gap-2">
                  <Brain className="w-5 h-5 text-teal" />
                  3. Tipos de Estrabismo
                </h3>
                <p className="text-muted-foreground leading-relaxed">
                  A classificação do estrabismo baseia-se primariamente na direção do desvio ocular: <strong>Esotropia</strong> (desvio para dentro, o tipo mais comum na infância); <strong>Exotropia</strong> (desvio para fora, frequentemente intermitente); <strong>Hipertropia</strong> (desvio para cima); e <strong>Hipotropia</strong> (desvio para baixo).
                </p>
                <p className="text-muted-foreground leading-relaxed">
                  Adicionalmente, o estrabismo pode ser classificado quanto à frequência (constante vs. intermitente), lateralidade (unilateral vs. alternante), idade de início (infantil vs. adquirido) e etiologia (paralítico vs. não paralítico). Cada subtipo exige uma avaliação específica e influencia diretamente a abordagem terapêutica.
                </p>
              </section>

              {/* Consequências */}
              <section className="space-y-3">
                <h3 className="text-xl font-bold flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-teal" />
                  4. Consequências
                </h3>
                <p className="text-muted-foreground leading-relaxed">
                  A consequência clínica mais grave do estrabismo não tratado é a <strong>ambliopia</strong>, popularmente conhecida como "olho preguiçoso". O cérebro, ao receber duas imagens distintas e impossíveis de fundir, suprime progressivamente a imagem proveniente do olho desviado. Se esta supressão se tornar permanente durante o período crítico do desenvolvimento visual (até aos 7-8 anos), a perda de acuidade visual nesse olho pode ser irreversível.
                </p>
                <p className="text-muted-foreground leading-relaxed">
                  Para além das consequências visuais, o impacto psicossocial é profundo e frequentemente subestimado: crianças com estrabismo são alvo de bullying escolar; adultos reportam dificuldades em entrevistas de emprego e interações sociais; a autoestima e a saúde mental são gravemente afetadas. Estudos demonstram que o estrabismo visível influencia negativamente a perceção de competência e atratividade por parte de terceiros.
                </p>
              </section>

              {/* Tratamento */}
              <section className="space-y-3">
                <h3 className="text-xl font-bold flex items-center gap-2">
                  <Stethoscope className="w-5 h-5 text-teal" />
                  5. Tratamento
                </h3>
                <p className="text-muted-foreground leading-relaxed">
                  O tratamento do estrabismo é individualizado e pode incluir uma ou mais abordagens: <strong>Correção ótica</strong> — óculos ou lentes de contacto para corrigir erros refrativos subjacentes; <strong>Terapia de oclusão</strong> — tapar o olho dominante com penso adesivo para estimular o desenvolvimento visual do olho mais fraco; <strong>Exercícios ortópticos</strong> — terapia visual para melhorar a coordenação binocular.
                </p>
                <p className="text-muted-foreground leading-relaxed">
                  Em casos que não respondem ao tratamento conservador, a <strong>cirurgia aos músculos extraoculares</strong> permite realinhar os eixos visuais. A intervenção cirúrgica, realizada sob anestesia geral em crianças, tem taxas de sucesso elevadas, especialmente quando realizada precocemente. O acompanhamento pós-operatório e a reabilitação visual são fundamentais para consolidar os resultados.
                </p>
              </section>

              {/* References */}
              <section className="mt-10 pt-8 border-t border-border space-y-4">
                <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
                  <BookOpen className="w-5 h-5 text-teal" />
                  Referências e Fontes Consultadas
                </h3>
                <ul className="space-y-3">
                  {references.map((ref, idx) => (
                    <li key={idx}>
                      <a
                        href={ref.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 text-teal hover:underline text-sm font-medium transition-colors"
                      >
                        <ExternalLink className="w-4 h-4 shrink-0" />
                        {ref.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </section>
            </article>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </section>
  );
};

export default StrabismusSection;
