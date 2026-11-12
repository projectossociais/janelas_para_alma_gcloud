import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import BaseExercise from "@/components/exercises/BaseExercise";
import { BotaoContinuar, EcraPasso } from "@/components/visao/EcraPasso";
import EscolherOculos, { TrocarModo, type ComOuSemOculos } from "@/components/visao/EscolherOculos";
import PaginaExercicio from "@/components/visao/PaginaExercicio";
import { CartaoOlho, EcraResultado } from "@/components/visao/Resultados";
import { useRegistoSessao } from "@/components/visao/hooks";
import { TENTATIVAS, olhoTapado, resumirAgulha, type Condicao } from "@/lib/visao/agulha";
import { ID_ESTEREOPSIA } from "@/lib/visao/ids";
import type { Olho } from "@/lib/visao/resultados";
import { sinalSonoro } from "@/lib/visao/voz";
import { cn } from "@/lib/utils";
import TesteEstereopsia from "./TesteEstereopsia";

const EXERCICIO_ID = ID_ESTEREOPSIA;
const CHAVE_OCULOS = "jpa.visao.estereopsia.oculos";

/** A animação: o dedo da criança desce de cima até à ponta do lápis que o adulto segura de pé. */
const CSS_DEMO = `
@keyframes jpa-agulha-dedo { 0%, 10% { transform: translate(-34px, -22px); } 55%, 75% { transform: translate(0, 0); } 100% { transform: translate(-34px, -22px); } }
@keyframes jpa-agulha-toque { 0%, 52% { opacity: 0; } 58%, 72% { opacity: 1; } 80%, 100% { opacity: 0; } }
.jpa-agulha-dedo { animation: jpa-agulha-dedo 3s ease-in-out infinite; }
.jpa-agulha-toque { animation: jpa-agulha-toque 3s ease-in-out infinite; }
@media (prefers-reduced-motion: reduce) { .jpa-agulha-dedo, .jpa-agulha-toque { animation: none; } }
`;
const DemoLapis = () => {
  const { t } = useTranslation();
  return (
    <svg viewBox="0 0 300 160" role="img" aria-label={t("Visao.agulhaDemoRotulo")} className="h-auto w-full rounded-xl" style={{ backgroundColor: "#f6f1e4" }}>
      <style>{CSS_DEMO}</style>
      <rect x={150} y={62} width={10} height={70} rx={2} fill="#f0b429" />
      <path d="M150 62 L155 46 L160 62 Z" fill="#e8c9a0" />
      <path d="M153.6 50.5 L155 46 L156.4 50.5 Z" fill="#2d2a26" />
      <rect x={138} y={112} width={34} height={34} rx={14} fill="#c99a73" />
      <g className="jpa-agulha-dedo">
        <path d="M-10 -6 L112 16" stroke="#a0714d" strokeWidth={20} strokeLinecap="round" />
        <ellipse cx={124} cy={22} rx={16} ry={12} fill="#a0714d" />
        <path d="M134 26 L152 41" stroke="#a0714d" strokeWidth={8} strokeLinecap="round" />
        <ellipse cx={151} cy={39.5} rx={2.6} ry={2} fill="#e9c9ad" transform="rotate(40 151 39.5)" />
      </g>
      <circle className="jpa-agulha-toque" cx={155} cy={45} r={9} fill="none" stroke="#2f7d4f" strokeWidth={3} />
      <g fontSize={11} fill="#5e5b53">
        <text x={40} y={66}>{t("Visao.agulhaDemoDedo")}</text>
        <text x={155} y={156} textAnchor="middle">
          {t("Visao.agulhaDemoMao")}
        </text>
      </g>
    </svg>
  );
};

/** Os dois olhos da criança, de frente; com uma mão por cima do olho tapado. */
const Olhos = ({ tapa }: { tapa: Olho | null }) => (
  <svg viewBox="0 0 92 40" width={70} height={30} aria-hidden className="shrink-0">
    {[22, 70].map((cx) => (
      <g key={cx}>
        <ellipse cx={cx} cy={20} rx={18} ry={11} fill="#ffffff" stroke="#3b2a20" strokeWidth={2} />
        <circle cx={cx} cy={20} r={7} fill="#7a4e2d" />
        <circle cx={cx} cy={20} r={3} fill="#111111" />
      </g>
    ))}
    {/* De frente, o olho esquerdo dela fica à direita de quem vê. */}
    {tapa && <rect x={tapa === "esquerdo" ? 48 : 0} y={2} width={44} height={36} rx={16} fill="#c99a73" />}
  </svg>
);

/** O modo da tentativa: dois olhos, ou qual olho tapar. */
const Modo = ({ tapa, titulo, ajuda }: { tapa: Olho | null; titulo: string; ajuda: string }) => (
  <div className="flex w-full items-center gap-3 rounded-xl bg-muted px-3 py-2 text-left">
    <Olhos tapa={tapa} />
    <div>
      <p className="font-bold text-foreground">{titulo}</p>
      <p className="text-sm text-muted-foreground">{ajuda}</p>
    </div>
  </div>
);

/** As tentativas de uma condição: verde acertou, vermelho falhou, contorno na de agora. */
const Pontos = ({ lista, agora, rotulo }: { lista: readonly boolean[]; agora?: number; rotulo: string }) => (
  <div className="flex gap-1.5" role="img" aria-label={rotulo}>
    {Array.from({ length: TENTATIVAS }, (_, i) => {
      const v = lista[i];
      return (
        <span
          key={i}
          className={cn(
            "grid h-6 w-6 place-items-center rounded-full border-2 border-border text-white",
            v === true && "border-[#2f7d4f] bg-[#2f7d4f]",
            v === false && "border-[#b23b2e] bg-[#b23b2e]",
            i === agora && "border-[3px] border-[#c2410c]",
          )}
        >
          {v === true && <Check className="h-3.5 w-3.5" aria-hidden />}
          {v === false && <X className="h-3.5 w-3.5" aria-hidden />}
        </span>
      );
    })}
  </div>
);

type Etapa = { e: "como" } | { e: "bloco"; c: Condicao } | { e: "tentativa"; c: Condicao } | { e: "fim" };

/** O desafio sem óculos: como se faz, 5 tentativas com os dois olhos, 5 com um, resultado. */
const DesafioSemOculos = ({ aoTrocarModo }: { aoTrocarModo: () => void }) => {
  const { t } = useTranslation();
  const [etapa, setEtapa] = useState<Etapa>({ e: "como" });
  const [tentativas, setTentativas] = useState<Record<Condicao, boolean[]>>({ dois: [], um: [] });
  const inicio = useRef(Date.now());

  const nomeOlho = (o: Olho) => t(o === "direito" ? "Visao.olhoDireito" : "Visao.olhoEsquerdo").toLowerCase();
  const passos = [t("Visao.passoPreparar"), t("Visao.agulhaModo_dois"), t("Visao.agulhaModo_um"), t("Visao.passoResultado")];
  const passoActual = etapa.e === "como" ? 0 : etapa.e === "fim" ? 3 : etapa.c === "dois" ? 1 : 2;

  const responder = (c: Condicao, acertou: boolean) => {
    sinalSonoro(acertou ? "certo" : "errado");
    const lista = [...tentativas[c], acertou];
    setTentativas((ts) => ({ ...ts, [c]: lista }));
    if (lista.length < TENTATIVAS) return;
    if (c === "dois") setEtapa({ e: "bloco", c: "um" });
    else {
      sinalSonoro("festa");
      setEtapa({ e: "fim" });
    }
  };

  let conteudo;
  if (etapa.e === "como") {
    const lista = [1, 2, 3].map((n) => t(`Visao.agulhaComo${n}`));
    conteudo = (
      <EcraPasso
        titulo={t("Visao.agulhaComoTitulo")}
        accao={<BotaoContinuar aoClicar={() => setEtapa({ e: "bloco", c: "dois" })}>{t("Visao.agulhaComecar")}</BotaoContinuar>}
      >
        <div className="w-full space-y-3 text-left">
          <DemoLapis />
          <ol className="list-decimal space-y-1 pl-5 text-base text-foreground">
            {lista.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ol>
          <TrocarModo para="com" aoTrocar={aoTrocarModo} />
        </div>
      </EcraPasso>
    );
  } else if (etapa.e === "bloco") {
    const c = etapa.c;
    conteudo = (
      <EcraPasso
        titulo={t(`Visao.agulhaBlocoTitulo_${c}`)}
        accao={<BotaoContinuar aoClicar={() => setEtapa({ e: "tentativa", c })}>{t("Visao.agulhaVamos")}</BotaoContinuar>}
      >
        <div className="w-full space-y-3 text-left">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("Visao.agulhaParte", { n: c === "dois" ? 1 : 2, total: 2 })}</p>
          <Modo tapa={c === "um" ? olhoTapado(0) : null} titulo={t(`Visao.agulhaModo_${c}`)} ajuda={t(`Visao.agulhaBlocoAjuda_${c}`, { n: TENTATIVAS })} />
          <DemoLapis />
        </div>
      </EcraPasso>
    );
  } else if (etapa.e === "tentativa") {
    const c = etapa.c;
    const lista = tentativas[c];
    const i = lista.length;
    const tapa = c === "um" ? olhoTapado(i) : null;
    conteudo = (
      <section className="mx-auto flex max-w-xl flex-col items-center gap-4 text-center">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {t("Visao.agulhaTentativa", { modo: t(`Visao.agulhaModo_${c}`), n: i + 1, total: TENTATIVAS })}
        </p>
        <Modo
          tapa={tapa}
          titulo={tapa ? t("Visao.agulhaTapaOlho", { olho: nomeOlho(tapa) }) : t("Visao.agulhaOlhosAbertos")}
          ajuda={tapa ? t("Visao.agulhaTapaOlhoAjuda") : t("Visao.agulhaOlhosAbertosAjuda")}
        />
        <Pontos lista={lista} agora={i} rotulo={t("Visao.agulhaAcertos", { n: lista.filter(Boolean).length, total: TENTATIVAS })} />
        <h2 className="text-2xl font-bold text-foreground">{t("Visao.agulhaPergunta")}</h2>
        <div className="grid w-full grid-cols-2 gap-3">
          <Button
            className="h-24 flex-col gap-1 bg-[#2f7d4f] text-xl font-bold text-white hover:bg-[#2f7d4f]/90 [&_svg]:size-8"
            onClick={() => responder(c, true)}
          >
            <Check aria-hidden />
            {t("Visao.agulhaAcertou")}
          </Button>
          <Button
            className="h-24 flex-col gap-1 bg-[#b23b2e] text-xl font-bold text-white hover:bg-[#b23b2e]/90 [&_svg]:size-8"
            onClick={() => responder(c, false)}
          >
            <X aria-hidden />
            {t("Visao.agulhaFalhou")}
          </Button>
        </div>
        <p className="text-sm text-muted-foreground">{i ? t("Visao.agulhaDicaMudar") : t("Visao.agulhaDicaPrimeira")}</p>
        {i > 0 && (
          <Button variant="ghost" size="sm" onClick={() => setTentativas((ts) => ({ ...ts, [c]: ts[c].slice(0, -1) }))}>
            {t("Visao.agulhaCorrigir")}
          </Button>
        )}
      </section>
    );
  } else conteudo = <ResultadoAgulha tentativas={tentativas} segundos={Math.max(1, Math.round((Date.now() - inicio.current) / 1000))} />;

  return (
    <PaginaExercicio>
      <BaseExercise
        title={t("Visao.estereoTitulo")}
        description={t("Visao.estereoDescricao")}
        exercicioId={EXERCICIO_ID}
        tipo="teste"
        passos={passos}
        passoActual={passoActual}
      >
        {conteudo}
      </BaseExercise>
    </PaginaExercicio>
  );
};

const ResultadoAgulha = ({ tentativas, segundos }: { tentativas: Record<Condicao, boolean[]>; segundos: number }) => {
  const { t } = useTranslation();
  const { estado, gravar, tentarDeNovo } = useRegistoSessao();
  const gravou = useRef(false);
  const r = useMemo(() => resumirAgulha(tentativas), [tentativas]);

  useEffect(() => {
    if (gravou.current) return;
    gravou.current = true;
    void gravar([
      {
        exercicio_id: EXERCICIO_ID,
        olho: "ambos",
        duracao_segundos: segundos,
        segundos_activos: segundos,
        limiar: null,
        sinais: {
          modo: "agulha",
          versao: 2,
          // O mesmo formato da versão 1 (o relatório lê `jogador`), agora sem tempos nem segundo jogador.
          jogador: { acertos_dois: r.acertosDois, acertos_um: r.acertosUm, tentativas: TENTATIVAS, vantagem: r.vantagem },
          tentativas: {
            dois: tentativas.dois,
            um: tentativas.um.map((acertou, i) => ({ tapado: olhoTapado(i), acertou })),
          },
        },
      },
    ]);
  }, [gravar, r, segundos, tentativas]);

  return (
    <EcraResultado
      titulo={t(`Visao.agulhaVeredicto_${r.vantagem}`)}
      gravacao={estado}
      aoTentarDeNovo={() => void tentarDeNovo()}
      sinais={r.vantagem === "nenhuma" ? [t("Visao.agulhaVeredictoTexto_nenhuma")] : []}
      cartoes={(["dois", "um"] as const).map((c) => {
        const n = c === "dois" ? r.acertosDois : r.acertosUm;
        return (
          <CartaoOlho key={c} titulo={t(`Visao.agulhaModo_${c}`)} estado={c === "um" ? "indeterminado" : r.vantagem === "nenhuma" ? "sinal" : "ok"}>
            <p className="text-2xl font-bold text-foreground">{t("Visao.agulhaAcertos", { n, total: TENTATIVAS })}</p>
            <div className="flex justify-center">
              <Pontos lista={tentativas[c]} rotulo={t("Visao.agulhaAcertos", { n, total: TENTATIVAS })} />
            </div>
          </CartaoOlho>
        );
      })}
      notas={
        <div className="space-y-2 text-center text-sm text-muted-foreground">
          {r.vantagem !== "nenhuma" && <p className="text-foreground">{t(`Visao.agulhaVeredictoTexto_${r.vantagem}`)}</p>}
          <p>{t("Visao.agulhaPorque")}</p>
          <p className="text-xs">{t("Visao.agulhaNota")}</p>
        </div>
      }
    />
  );
};

const lerOculos = (): ComOuSemOculos | null => {
  try {
    const v = window.localStorage.getItem(CHAVE_OCULOS);
    return v === "com" || v === "sem" ? v : null;
  } catch {
    return null;
  }
};

/**
 * Desafio da Agulha (id `estereopsia`, Premium). Sem óculos (por omissão), o
 * dedo na ponta do lápis; com óculos 3D, o Teste de Estereopsia. Ver
 * `lib/visao/agulha.ts`.
 */
const DesafioAgulha = () => {
  const { t } = useTranslation();
  // Com a escolha guardada neste aparelho, entra directo nesse modo.
  const [oculos, setOculos] = useState<ComOuSemOculos | null>(() => lerOculos());
  const escolher = (o: ComOuSemOculos) => {
    try {
      window.localStorage.setItem(CHAVE_OCULOS, o);
    } catch {
      // armazenamento bloqueado: pergunta-se outra vez
    }
    setOculos(o);
  };
  if (oculos === "com") return <TesteEstereopsia aoTrocarModo={() => escolher("sem")} />;
  if (oculos === "sem") return <DesafioSemOculos aoTrocarModo={() => escolher("com")} />;
  return (
    <PaginaExercicio>
      <BaseExercise title={t("Visao.estereoTitulo")} description={t("Visao.estereoDescricao")} exercicioId={EXERCICIO_ID} tipo="teste">
        <EscolherOculos
          titulo={t("Visao.olhoMagicoOculosTitulo")}
          sem={{ titulo: t("Visao.agulhaSemOculos"), texto: t("Visao.agulhaSemOculosTexto") }}
          com={{ titulo: t("Visao.agulhaComOculos"), texto: t("Visao.agulhaComOculosTexto") }}
          inicial={null}
          aoEscolher={escolher}
        />
      </BaseExercise>
    </PaginaExercicio>
  );
};

export default DesafioAgulha;
