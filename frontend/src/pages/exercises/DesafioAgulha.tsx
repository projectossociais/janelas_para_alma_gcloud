import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import BaseExercise from "@/components/exercises/BaseExercise";
import BotaoOuvir from "@/components/visao/BotaoOuvir";
import { EcraPasso } from "@/components/visao/EcraPasso";
import EscolherOculos, { type ComOuSemOculos } from "@/components/visao/EscolherOculos";
import PaginaExercicio from "@/components/visao/PaginaExercicio";
import { CartaoOlho, EcraResultado } from "@/components/visao/Resultados";
import { useRegistoSessao } from "@/components/visao/hooks";
import { formatarDecimal } from "@/i18n/formatar";
import {
  MATERIAIS,
  TEMPO_MAX_S,
  planoDeRondas,
  pontosDaRonda,
  resumirJogador,
  type Material,
  type ResultadoRonda,
  type ResumoJogador,
} from "@/lib/visao/agulha";
import { ID_ESTEREOPSIA } from "@/lib/visao/ids";
import { falar, sinalSonoro } from "@/lib/visao/voz";
import { cn } from "@/lib/utils";
import TesteEstereopsia from "./TesteEstereopsia";

const EXERCICIO_ID = ID_ESTEREOPSIA;
const CHAVE_OCULOS = "jpa.visao.estereopsia.oculos";

type Fase = "espera" | "contagem" | "a_correr" | "feito";

/** As rondas, uma de cada vez: de quem é a vez, 3-2-1, o cronómetro e o árbitro. */
const Jogo = ({
  material,
  nomes,
  aoTerminar,
}: {
  material: Material;
  nomes: [string, string];
  aoTerminar: (res: ResultadoRonda[], segundos: number) => void;
}) => {
  const { t, i18n } = useTranslation();
  const [plano] = useState(() => planoDeRondas(2));
  const [i, setI] = useState(0);
  const [fase, setFase] = useState<Fase>("espera");
  const [contagem, setContagem] = useState(3);
  const [decorrido, setDecorrido] = useState(0);
  const [ultimos, setUltimos] = useState<number | null>(null);
  const resultados = useRef<ResultadoRonda[]>([]);
  const inicioRonda = useRef(0);
  const inicioJogo = useRef(Date.now());
  const ronda = plano[i];

  const anunciar = () =>
    ronda.condicao === "dois"
      ? t("Visao.agulhaVozDois", { nome: nomes[ronda.jogador] })
      : t("Visao.agulhaVozUm", { nome: nomes[ronda.jogador], olho: t(ronda.olhoTapado === "direito" ? "Visao.olhoDireito" : "Visao.olhoEsquerdo").toLowerCase() });

  const emEspera = fase === "espera";
  useEffect(() => {
    if (emEspera) falar(anunciar(), i18n.language);
    // Anuncia cada ronda uma vez.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i, emEspera]);

  // 3, 2, 1, já!
  useEffect(() => {
    if (fase !== "contagem") return;
    const id = window.setInterval(() => setContagem((c) => c - 1), 800);
    return () => window.clearInterval(id);
  }, [fase]);
  useEffect(() => {
    if (fase !== "contagem") return;
    if (contagem > 0) {
      sinalSonoro("tic");
      falar(String(contagem), i18n.language);
      return;
    }
    falar(t("Visao.agulhaJa"), i18n.language);
    inicioRonda.current = Date.now();
    setDecorrido(0);
    setFase("a_correr");
  }, [contagem, fase, i18n.language, t]);

  const fechar = (acertou: boolean, segundos: number) => {
    const r = { jogador: ronda.jogador, condicao: ronda.condicao, acertou, segundos: Math.round(segundos * 10) / 10 };
    resultados.current = [...resultados.current, r];
    setUltimos(pontosDaRonda(r.acertou, r.segundos));
    sinalSonoro(acertou ? "certo" : "errado");
    setFase("feito");
  };

  // O cronómetro; sem resposta em TEMPO_MAX_S, falhou.
  useEffect(() => {
    if (fase !== "a_correr") return;
    const id = window.setInterval(() => {
      const s = (Date.now() - inicioRonda.current) / 1000;
      if (s >= TEMPO_MAX_S) fechar(false, TEMPO_MAX_S);
      else setDecorrido(s);
    }, 100);
    return () => window.clearInterval(id);
    // `fechar` muda a cada render; o intervalo só depende da fase.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fase]);

  useEffect(() => {
    if (fase !== "feito") return;
    const id = window.setTimeout(() => {
      if (i + 1 < plano.length) {
        setI(i + 1);
        setContagem(3);
        setFase("espera");
      } else aoTerminar(resultados.current, Math.max(1, Math.round((Date.now() - inicioJogo.current) / 1000)));
    }, 1300);
    return () => window.clearTimeout(id);
  }, [aoTerminar, fase, i, plano.length]);

  const pontos = [0, 1].map((j) => resultados.current.filter((r) => r.jogador === j).reduce((p, r) => p + pontosDaRonda(r.acertou, r.segundos), 0));

  return (
    <div className="flex flex-col gap-4 text-left">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{t("Visao.agulhaRonda", { n: i + 1, total: plano.length })}</p>
      <p className="text-2xl font-bold text-foreground">{t("Visao.agulhaVez", { nome: nomes[ronda.jogador] })}</p>
      <p>
        <span className="inline-block rounded-full border-2 border-teal px-3 py-1 text-sm font-semibold text-foreground">
          {ronda.condicao === "dois"
            ? t("Visao.agulhaDoisOlhos")
            : t("Visao.agulhaUmOlho", { olho: t(ronda.olhoTapado === "direito" ? "Visao.olhoDireito" : "Visao.olhoEsquerdo").toLowerCase() })}
        </span>
      </p>
      <p className="text-sm text-muted-foreground">{t(`Visao.agulhaRegra_${material}`)}</p>
      <p className="text-center text-6xl font-bold tabular-nums text-teal" aria-live="polite">
        {fase === "contagem"
          ? Math.max(1, contagem)
          : fase === "a_correr"
            ? formatarDecimal(Math.min(decorrido, TEMPO_MAX_S), 1)
            : fase === "feito"
              ? ultimos
                ? `+${ultimos}`
                : "0"
              : "3"}
      </p>
      {fase === "espera" && (
        <Button size="lg" onClick={() => setFase("contagem")}>
          {t("Visao.agulhaPronto")}
        </Button>
      )}
      {fase === "a_correr" && (
        <div className="grid grid-cols-2 gap-2">
          <Button size="lg" className="h-20 text-lg" onClick={() => fechar(true, (Date.now() - inicioRonda.current) / 1000)}>
            {t("Visao.agulhaAcertou")}
          </Button>
          <Button size="lg" variant="outline" className="h-20 text-lg" onClick={() => fechar(false, (Date.now() - inicioRonda.current) / 1000)}>
            {t("Visao.agulhaFalhou")}
          </Button>
        </div>
      )}
      <div className="grid grid-cols-2 gap-2">
        {nomes.map((n, j) => (
          <div key={j} className="rounded-xl border border-border p-3 text-center">
            <p className="text-2xl font-bold tabular-nums text-foreground">{pontos[j]}</p>
            <p className="text-xs text-muted-foreground">{n}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

const ResultadoAgulha = ({
  res,
  nomes,
  material,
  segundos,
}: {
  res: ResultadoRonda[];
  nomes: [string, string];
  material: Material;
  segundos: number;
}) => {
  const { t } = useTranslation();
  const { estado, gravar, tentarDeNovo } = useRegistoSessao();
  const gravou = useRef(false);
  const resumos = useMemo<[ResumoJogador, ResumoJogador]>(() => [resumirJogador(res, 0), resumirJogador(res, 1)], [res]);

  useEffect(() => {
    if (gravou.current) return;
    gravou.current = true;
    const paraGravar = (r: ResumoJogador) => ({
      acertos_dois: r.acertosDois,
      acertos_um: r.acertosUm,
      tempo_dois_s: r.tempoDois,
      tempo_um_s: r.tempoUm,
      pontos: r.pontos,
      vantagem: r.vantagem,
    });
    void gravar([
      {
        exercicio_id: EXERCICIO_ID,
        olho: "ambos",
        duracao_segundos: segundos,
        segundos_activos: segundos,
        limiar: null,
        sinais: { modo: "agulha", material, jogador: paraGravar(resumos[0]), outro_jogador: paraGravar(resumos[1]) },
      },
    ]);
  }, [gravar, material, resumos, segundos]);

  const vencedor = resumos[0].pontos === resumos[1].pontos ? null : resumos[0].pontos > resumos[1].pontos ? 0 : 1;
  const tempo = (s: number | null) => (s === null ? "–" : `${formatarDecimal(s, 1)} s`);

  return (
    <EcraResultado
      titulo={vencedor === null ? t("Visao.agulhaEmpate") : t("Visao.agulhaGanhou", { nome: nomes[vencedor] })}
      gravacao={estado}
      aoTentarDeNovo={() => void tentarDeNovo()}
      sinais={resumos[0].vantagem === "nenhuma" ? [t("Visao.agulhaSinalNenhuma", { nome: nomes[0] })] : []}
      // Só o jogador 1 é avaliado; o outro jogador é a comparação (um adulto com boa visão acerta também com um olho).
      cartoes={resumos.map((r, j) => (
        <CartaoOlho
          key={j}
          titulo={t("Visao.agulhaPontos", { nome: nomes[j], pontos: r.pontos })}
          estado={j > 0 ? "indeterminado" : r.vantagem === "nenhuma" ? "sinal" : "ok"}
        >
          <p>{t("Visao.agulhaComDois", { n: r.acertosDois, tempo: tempo(r.tempoDois) })}</p>
          <p>{t("Visao.agulhaComUm", { n: r.acertosUm, tempo: tempo(r.tempoUm) })}</p>
          <p className="font-medium text-foreground">{t(`Visao.agulhaVantagem_${r.vantagem}`)}</p>
        </CartaoOlho>
      ))}
      notas={<p className="text-center text-xs text-muted-foreground">{t("Visao.agulhaNota")}</p>}
    />
  );
};

/** O desafio sem óculos: preparar, jogar, resultado. */
const DesafioSemOculos = () => {
  const { t } = useTranslation();
  const [fase, setFase] = useState<"preparar" | "jogo" | "fim">("preparar");
  const [material, setMaterial] = useState<Material>("lapis");
  const [nomes, setNomes] = useState<[string, string]>(() => [t("Visao.agulhaJogador1Omissao"), t("Visao.agulhaJogador2Omissao")]);
  const [fim, setFim] = useState<{ res: ResultadoRonda[]; segundos: number } | null>(null);

  let conteudo;
  if (fase === "preparar")
    conteudo = (
      <EcraPasso
        titulo={t("Visao.agulhaPrepararTitulo")}
        accao={
          <Button size="lg" onClick={() => setFase("jogo")}>
            {t("Visao.agulhaComecar")}
          </Button>
        }
      >
        <div className="w-full space-y-4 text-left text-sm">
          <div role="radiogroup" aria-label={t("Visao.agulhaMaterial")} className="flex flex-wrap gap-2">
            {MATERIAIS.map((m) => (
              <Button
                key={m}
                role="radio"
                aria-checked={material === m}
                size="sm"
                variant={material === m ? "default" : "outline"}
                className={cn(material === m && "bg-navy text-navy-foreground hover:bg-navy/90")}
                onClick={() => setMaterial(m)}
              >
                {t(`Visao.agulhaMaterial_${m}`)}
              </Button>
            ))}
          </div>
          <p className="text-foreground">{t(`Visao.agulhaRegra_${material}`)}</p>
          <p className="text-muted-foreground">{t("Visao.agulhaComoJogar")}</p>
          <BotaoOuvir texto={`${t(`Visao.agulhaRegra_${material}`)} ${t("Visao.agulhaComoJogar")}`} />
          {([0, 1] as const).map((j) => (
            <label key={j} className="block space-y-1">
              <span className="text-muted-foreground">{j === 0 ? t("Visao.agulhaJogador1") : t("Visao.agulhaJogador2")}</span>
              <input
                className="h-11 w-full rounded-md border border-input bg-background px-3 text-foreground"
                value={nomes[j]}
                maxLength={16}
                onChange={(e) => setNomes((ns) => (j === 0 ? [e.target.value, ns[1]] : [ns[0], e.target.value]))}
              />
            </label>
          ))}
        </div>
      </EcraPasso>
    );
  else if (fase === "jogo")
    conteudo = (
      <Jogo
        material={material}
        nomes={[nomes[0].trim() || t("Visao.agulhaJogador1Omissao"), nomes[1].trim() || t("Visao.agulhaJogador2Omissao")]}
        aoTerminar={(res, segundos) => {
          sinalSonoro("festa");
          setFim({ res, segundos });
          setFase("fim");
        }}
      />
    );
  else if (fim) conteudo = <ResultadoAgulha res={fim.res} nomes={nomes} material={material} segundos={fim.segundos} />;

  return (
    <PaginaExercicio>
      <BaseExercise
        title={t("Visao.estereoTitulo")}
        description={t("Visao.estereoDescricao")}
        exercicioId={EXERCICIO_ID}
        grupo="premium"
        tipo="teste"
        passos={[t("Visao.passoPreparar"), t("Visao.agulhaPassoJogo"), t("Visao.passoResultado")]}
        passoActual={{ preparar: 0, jogo: 1, fim: 2 }[fase]}
      >
        {conteudo}
      </BaseExercise>
    </PaginaExercicio>
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
 * jogo de família; com óculos 3D, o Teste de Estereopsia. Ver `lib/visao/agulha.ts`.
 */
const DesafioAgulha = () => {
  const { t } = useTranslation();
  const [oculos, setOculos] = useState<ComOuSemOculos | null>(null);
  if (oculos === "com") return <TesteEstereopsia />;
  if (oculos === "sem") return <DesafioSemOculos />;
  return (
    <PaginaExercicio>
      <BaseExercise title={t("Visao.estereoTitulo")} description={t("Visao.estereoDescricao")} exercicioId={EXERCICIO_ID} grupo="premium" tipo="teste">
        <EscolherOculos
          titulo={t("Visao.olhoMagicoOculosTitulo")}
          sem={{ titulo: t("Visao.agulhaSemOculos"), texto: t("Visao.agulhaSemOculosTexto") }}
          com={{ titulo: t("Visao.agulhaComOculos"), texto: t("Visao.agulhaComOculosTexto") }}
          inicial={lerOculos()}
          aoEscolher={(o) => {
            try {
              window.localStorage.setItem(CHAVE_OCULOS, o);
            } catch {
              // armazenamento bloqueado: pergunta-se outra vez
            }
            setOculos(o);
          }}
        />
      </BaseExercise>
    </PaginaExercicio>
  );
};

export default DesafioAgulha;
