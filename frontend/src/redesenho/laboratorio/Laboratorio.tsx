import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion, type Variants } from "motion/react";
import {
  AlertCircle,
  ArrowRight,
  Eye,
  Flame,
  HeartPulse,
  Moon,
  ScanFace,
  ShieldCheck,
  Stethoscope,
  Sun,
  Timer,
} from "lucide-react";
// Na navegação o logótipo é pequeno: versão sem assinatura (docs/MARCA.md §2).
import logotipo from "../marca/logotipo-horizontal-sem-assinatura.svg";
import logotipoNegativo from "../marca/logotipo-horizontal-negativo-sem-assinatura.svg";
import { DIRECCOES, FONTES_GOOGLE, variaveis, type Direccao, type IdDireccao, type Tema } from "./direcoes";
import { Decoracao } from "./Decoracoes";
import { EcraRastreio } from "./EcraRastreio";

/**
 * Laboratório de identidade (Sprint 7). Só em desenvolvimento: três direcções
 * visuais completas para o dono do projecto escolher. Nada aqui é o site
 * final -- é o sítio onde se decide como o site vai ser.
 */

const useFontes = () => {
  useEffect(() => {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = FONTES_GOOGLE;
    document.head.appendChild(link);
    return () => link.remove();
  }, []);
};

const Titulo = ({ d, children, className = "" }: { d: Direccao; children: ReactNode; className?: string }) => (
  <h2
    className={`font-[family-name:var(--r-letra-titulo)] ${className}`}
    style={{ fontWeight: d.pesoTitulo, letterSpacing: d.espacamentoTitulo }}
  >
    {children}
  </h2>
);

const Botao = ({
  d,
  variante = "primario",
  children,
}: {
  d: Direccao;
  variante?: "primario" | "secundario" | "fantasma";
  children: ReactNode;
}) => {
  const estilos = {
    primario: "bg-[var(--r-prim)] text-[var(--r-sobre-prim)]",
    secundario: "border-2 border-[var(--r-tinta)] text-[var(--r-tinta)]",
    fantasma: "text-[var(--r-prim)] underline-offset-4 hover:underline",
  }[variante];
  return (
    <motion.button
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.97 }}
      transition={{ type: "spring", ...d.mola }}
      className={`inline-flex h-14 items-center justify-center gap-2 rounded-[var(--r-raio-botao)] px-7 text-base font-semibold focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-[var(--r-acento)] ${estilos}`}
    >
      {children}
    </motion.button>
  );
};

/** Título com uma palavra na cor de destaque, como "Visual" na capa do manual. */
const ComDestaque = ({ d }: { d: Direccao }) => {
  const i = d.titulo.indexOf(d.palavraDestaque);
  if (i < 0) return <>{d.titulo}</>;
  return (
    <>
      {d.titulo.slice(0, i)}
      <span className="text-[var(--r-destaque)]">{d.palavraDestaque}</span>
      {d.titulo.slice(i + d.palavraDestaque.length)}
    </>
  );
};

const PreVisualizacao = ({ d, tema }: { d: Direccao; tema: Tema }) => {
  const reduzido = useReducedMotion();
  const entrada: Variants = {
    oculto: { opacity: 0, y: reduzido ? 0 : 24 },
    visivel: (i: number) => ({ opacity: 1, y: 0, transition: { type: "spring", ...d.mola, delay: i * 0.08 } }),
  };
  // A direcção B abre sempre em marinho, como a capa do manual.
  const temaAbertura: Tema = d.aberturaEscura ? "escuro" : tema;

  return (
    <div className="font-[family-name:var(--r-letra-texto)] text-[17px] leading-relaxed text-[var(--r-tinta)]">
      <div
        className="text-[var(--r-tinta)]"
        style={{ ...(variaveis(d, temaAbertura) as CSSProperties), background: "var(--r-fundo)" }}
      >
      {/* Navegação */}
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <img
          src={temaAbertura === "claro" ? logotipo : logotipoNegativo}
          alt="Janelas Para Alma"
          className="h-12 w-auto"
        />
        <span className="hidden gap-8 text-[15px] font-medium text-[var(--r-suave)] md:flex">
          <a>Rastreio</a>
          <a>Treinos</a>
          <a>Clínicas</a>
          <a>Apoiar</a>
        </span>
        <span className="hidden sm:block">
          <Botao d={d}>Fazer rastreio</Botao>
        </span>
      </nav>

      {/* Abertura */}
      <section className="mx-auto grid max-w-6xl items-center gap-10 px-6 pb-20 pt-8 md:grid-cols-[1.1fr_1fr] md:pt-16">
        <div>
          <motion.p
            custom={0}
            variants={entrada}
            initial="oculto"
            animate="visivel"
            className="inline-flex items-center gap-2 rounded-full bg-[var(--r-sup-alt)] px-4 py-1.5 text-sm font-semibold text-[var(--r-prim)]"
          >
            <HeartPulse className="h-4 w-4" /> Saúde visual para famílias em Angola
          </motion.p>
          <motion.h1
            custom={1}
            variants={entrada}
            initial="oculto"
            animate="visivel"
            className={`mt-6 font-[family-name:var(--r-letra-titulo)] text-5xl leading-[1.04] ${d.titulo.length > 32 ? "md:text-6xl" : "md:text-7xl"}`}
            style={{ fontWeight: d.pesoTitulo, letterSpacing: d.espacamentoTitulo }}
          >
            <ComDestaque d={d} />
          </motion.h1>
          <motion.p custom={2} variants={entrada} initial="oculto" animate="visivel" className="mt-6 max-w-xl text-xl text-[var(--r-suave)]">
            {d.subtitulo}
          </motion.p>
          <motion.div custom={3} variants={entrada} initial="oculto" animate="visivel" className="mt-9 flex flex-wrap gap-3">
            <Botao d={d}>
              Começar rastreio <ArrowRight className="h-5 w-5" />
            </Botao>
            <Botao d={d} variante="secundario">
              Como funciona
            </Botao>
          </motion.div>
          <motion.ul
            custom={4}
            variants={entrada}
            initial="oculto"
            animate="visivel"
            className="mt-10 flex flex-wrap gap-x-6 gap-y-2 text-[15px] text-[var(--r-suave)]"
          >
            <li className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-[var(--r-sucesso)]" /> Nenhuma fotografia guardada
            </li>
            <li className="flex items-center gap-2">
              <Timer className="h-4 w-4 text-[var(--r-sucesso)]" /> Resultado em 2 minutos
            </li>
            <li className="flex items-center gap-2">
              <Stethoscope className="h-4 w-4 text-[var(--r-sucesso)]" /> Clínicas parceiras em Luanda
            </li>
          </motion.ul>
        </div>
        <motion.div
          initial={{ opacity: 0, scale: reduzido ? 1 : 0.92 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: "spring", ...d.mola, delay: 0.2 }}
          className="aspect-square w-full overflow-hidden rounded-[var(--r-raio)]"
        >
          <Decoracao id={d.id} tema={temaAbertura} />
        </motion.div>
      </section>
      </div>

      {/* Como funciona */}
      <section className="bg-[var(--r-sup)] py-20">
        <div className="mx-auto max-w-6xl px-6">
          <Titulo d={d} className="max-w-2xl text-4xl leading-tight md:text-5xl">
            Três passos, do telemóvel ao médico.
          </Titulo>
          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {[
              { icone: ScanFace, t: "Faça o rastreio", x: "Dois minutos com a câmara do telemóvel. Nada é gravado." },
              { icone: Eye, t: "Perceba o resultado", x: "Em palavras simples: está tudo bem, ou vale a pena ir ao médico." },
              { icone: Stethoscope, t: "Marque a consulta", x: "Escolha uma vaga numa clínica parceira, presencial ou por vídeo." },
            ].map(({ icone: Icone, t, x }, i) => (
              <motion.article
                key={t}
                initial={{ opacity: 0, y: reduzido ? 0 : 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-80px" }}
                transition={{ type: "spring", ...d.mola, delay: i * 0.1 }}
                className="rounded-[var(--r-raio)] border border-[var(--r-linha)] bg-[var(--r-fundo)] p-7"
              >
                <span className="font-[family-name:var(--r-letra-titulo)] text-5xl text-[var(--r-destaque)]" style={{ fontWeight: d.pesoTitulo }}>
                  {i + 1}
                </span>
                <Icone className="mt-4 h-7 w-7 text-[var(--r-prim)]" />
                <h3 className="mt-3 text-xl font-semibold">{t}</h3>
                <p className="mt-2 text-[var(--r-suave)]">{x}</p>
              </motion.article>
            ))}
          </div>
        </div>
      </section>

      {/* O rastreio repensado + treino diário */}
      <section className="mx-auto grid max-w-6xl items-center gap-14 px-6 py-24 md:grid-cols-2">
        <div>
          <Titulo d={d} className="text-4xl leading-tight md:text-5xl">
            O rastreio, repensado.
          </Titulo>
          <p className="mt-5 max-w-lg text-lg text-[var(--r-suave)]">
            Um passo por ecrã, uma instrução de cada vez, e no fim a pergunta que importa: o que faço agora? Toque nos
            pontos por baixo do telemóvel para ver cada passo.
          </p>
          <div className="mt-10 max-w-md rounded-[var(--r-raio)] bg-[var(--r-sup)] p-6 shadow-[0_20px_50px_-30px_rgba(0,0,0,0.35)]">
            <div className="flex items-center justify-between">
              <p className="font-semibold">Treino de hoje</p>
              <span className="flex items-center gap-1 rounded-full bg-[var(--r-acento)] px-3 py-1 text-sm font-semibold text-[var(--r-sobre-acento)]">
                <Flame className="h-4 w-4" /> 5 dias seguidos
              </span>
            </div>
            <p className="mt-1 text-sm text-[var(--r-suave)]">Treino de Anéis · olho esquerdo · 6 min</p>
            <div className="mt-4 h-3 overflow-hidden rounded-full bg-[var(--r-sup-alt)]">
              <motion.div
                className="h-full rounded-full bg-[var(--r-prim)]"
                initial={{ width: 0 }}
                whileInView={{ width: "64%" }}
                viewport={{ once: true }}
                transition={{ type: "spring", ...d.mola }}
              />
            </div>
            <p className="mt-3 text-sm">
              <strong>O olho esquerdo já lê 2 linhas mais pequenas</strong> do que há 3 semanas.
            </p>
          </div>
        </div>
        <EcraRastreio d={d} />
      </section>

      {/* Mostruário de componentes */}
      <section className="border-t border-[var(--r-linha)] bg-[var(--r-sup)] py-16">
        <div className="mx-auto max-w-6xl px-6">
          <p className="text-sm font-semibold uppercase tracking-wider text-[var(--r-suave)]">Componentes base</p>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Botao d={d}>Primário</Botao>
            <Botao d={d} variante="secundario">
              Secundário
            </Botao>
            <Botao d={d} variante="fantasma">
              Ligação
            </Botao>
            <span className="rounded-full bg-[var(--r-sup-alt)] px-3 py-1 text-sm font-semibold text-[var(--r-prim)]">Etiqueta</span>
            <span className="rounded-full bg-[var(--r-acento)] px-3 py-1 text-sm font-semibold text-[var(--r-sobre-acento)]">Novo</span>
          </div>
          <div className="mt-8 grid max-w-3xl gap-6 md:grid-cols-2">
            <label className="block">
              <span className="text-sm font-semibold">Nome da criança</span>
              <input
                className="mt-2 h-14 w-full rounded-[var(--r-raio-botao)] border-2 border-[var(--r-linha)] bg-[var(--r-fundo)] px-4 text-base outline-none focus:border-[var(--r-prim)]"
                defaultValue="Ana"
              />
            </label>
            <label className="block">
              <span className="text-sm font-semibold">Telefone</span>
              <span id="ajuda-telefone" className="mt-1 block text-sm text-[var(--r-suave)]">
                9 números, começa por 9
              </span>
              {/* Erro: cor funcional + ícone + texto, nunca só a cor (PESQUISA_UX §3). */}
              <span id="erro-telefone" className="mt-1 flex items-center gap-1.5 text-sm font-semibold text-[var(--r-erro)]">
                <AlertCircle className="h-4 w-4 shrink-0" /> Faltam números: um telemóvel angolano tem 9.
              </span>
              <input
                type="tel"
                inputMode="numeric"
                autoComplete="tel-national"
                className="mt-2 h-14 w-full rounded-[var(--r-raio-botao)] border-2 border-[var(--r-erro)] bg-[var(--r-fundo)] px-4 text-base outline-none"
                defaultValue="92"
                aria-invalid
                aria-describedby="ajuda-telefone erro-telefone"
              />
            </label>
          </div>
        </div>
      </section>
    </div>
  );
};

const Laboratorio = () => {
  useFontes();
  // Direcção e tema também no endereço (?d=viva&tema=escuro), para partilhar links.
  const params = new URLSearchParams(window.location.search);
  const inicialD = params.get("d");
  const [id, setIdEstado] = useState<IdDireccao>(inicialD && inicialD in DIRECCOES ? (inicialD as IdDireccao) : "clara");
  const [tema, setTemaEstado] = useState<Tema>(params.get("tema") === "escuro" ? "escuro" : "claro");
  const actualizarUrl = (novoId: IdDireccao, novoTema: Tema) =>
    window.history.replaceState(null, "", `?d=${novoId}&tema=${novoTema}`);
  const setId = (novo: IdDireccao) => {
    setIdEstado(novo);
    actualizarUrl(novo, tema);
  };
  const setTema = (f: (t: Tema) => Tema) => {
    const novo = f(tema);
    setTemaEstado(novo);
    actualizarUrl(id, novo);
  };
  const d = DIRECCOES[id];

  return (
    <div className="min-h-screen bg-neutral-100 text-neutral-900">
      {/* Barra do laboratório (neutra, fora da direcção avaliada) */}
      <div className="sticky top-0 z-50 border-b border-neutral-300 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-6 py-3 font-sans">
          <span className="mr-2 text-sm font-bold">Laboratório de identidade</span>
          <div role="tablist" aria-label="Direcção" className="flex gap-1 rounded-lg bg-neutral-100 p-1">
            {Object.values(DIRECCOES).map((x) => (
              <button
                key={x.id}
                role="tab"
                aria-selected={x.id === id}
                onClick={() => setId(x.id)}
                className="rounded-md px-3 py-1.5 text-sm font-medium aria-selected:bg-white aria-selected:shadow"
              >
                {x.nome}
              </button>
            ))}
          </div>
          <button
            onClick={() => setTema((t) => (t === "claro" ? "escuro" : "claro"))}
            className="flex items-center gap-2 rounded-lg border border-neutral-300 px-3 py-1.5 text-sm"
          >
            {tema === "claro" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
            {tema === "claro" ? "Tema escuro" : "Tema claro"}
          </button>
          <p className="basis-full text-sm text-neutral-600">
            <strong>{d.nome}.</strong> {d.ideia} <em>Para quem:</em> {d.paraQuem}
          </p>
        </div>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={`${id}-${tema}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          style={{ ...(variaveis(d, tema) as CSSProperties), background: "var(--r-fundo)" }}
        >
          <PreVisualizacao d={d} tema={tema} />
        </motion.div>
      </AnimatePresence>
    </div>
  );
};

export default Laboratorio;
