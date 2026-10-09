import { useCallback, useEffect, useMemo, useRef, useState, type MutableRefObject, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Coins, Eye, Flame, Gem, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import BaseExercise from "@/components/exercises/BaseExercise";
import type { GrupoExercicio } from "@/components/exercises/useAcaoDesbloqueio";
import PausaRespiracao from "@/components/visao/PausaRespiracao";
import ResumoTendencia from "@/components/visao/ResumoTendencia";
import { EstadoDaGravacao } from "@/components/visao/Resultados";
import {
  BotaoContinuar,
  EcraPasso,
  PassoBrilho,
  PassoCalibracao,
  PassoDistancia,
  PassoOculos,
  PassoRapido,
  PassoTaparOlho,
} from "@/components/visao/Passos";
import {
  useCalibracao,
  useDevicePixelRatio,
  useHistoricoVisao,
  useRegistoSessao,
  useTempoActivo,
} from "@/components/visao/hooks";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/contexts/ProfileContext";
import { perfilApi, type BonusAssiduidade, type OlhoMaisFraco, type SessaoExercicioPublica, type UnidadeLimiar } from "@/lib/apiClient";
import { disponivelNoIdiomaActual, localizar } from "@/i18n/rotas";
import { PX_POR_MM_NOMINAL } from "@/lib/visao/calibracao";
import { DISTANCIA_OMISSAO_MM } from "@/lib/visao/geometria";
import { IDS_AUTOAVALIACAO, diaLocal, minutosPorDia, sequenciaDeDias } from "@/lib/visao/progresso";
import { guardarEscolhas, lerEscolhas, podeUsarSessaoRapida } from "@/lib/visao/preparacao";
import { olhoMaisFracoPelaAcuidade, type Olho, type OlhoSessao } from "@/lib/visao/resultados";
import { ID_ACUIDADE } from "@/lib/visao/ids";
import {
  BLOCOS_POR_SESSAO,
  BLOCO_SEGUNDOS,
  PAUSA_SEGUNDOS,
  eTentativaDeControlo,
  sinaisDeControlo,
} from "@/lib/visao/treino";

export interface ContextoTreino {
  /** Olho treinado (o mais fraco); `null` nos treinos com os dois olhos. */
  olho: Olho | null;
  pxPorMm: number;
  calibrado: boolean;
  distanciaMm: number;
  devicePixelRatio: number;
  historico: SessaoExercicioPublica[];
}

/** O que a tarefa usa para reportar tentativas ao assistente. */
export interface ApiTarefa {
  /** A próxima tentativa deve ser um estímulo de controlo (muito fácil)? */
  proximaEControlo: () => boolean;
  /** Regista uma resposta (conta tempo activo, controlo e acertos). */
  registar: (r: { controlo: boolean; acertou: boolean }) => void;
  /** Só uma actividade em curso (não em pausa entre blocos). */
  activo: boolean;
}

export interface ResultadoTreino {
  limiar: number | null;
  unidade?: UnidadeLimiar;
  /** Texto curto para o resumo (ex.: "logMAR 0,35"). */
  resumo: string;
  sinais?: Record<string, unknown>;
}

interface AssistenteTreinoProps {
  exercicioId: string;
  grupo: GrupoExercicio;
  titulo: string;
  descricao: string;
  /** Treina só o olho mais fraco, com o outro tapado por tapa-olho. */
  monocular: boolean;
  /** Pede a distância (anéis e contraste). Sem isto, usa `distanciaFixaMm`. */
  comDistancia?: boolean;
  distanciaFixaMm?: number;
  /** Ecrã de aviso específico antes de começar (ex.: convergência). */
  aviso?: ReactNode;
  /** Bloqueia o treino e explica o que falta (ex.: "faça primeiro o teste"). */
  requisito?: (ctx: ContextoTreino) => ReactNode | null;
  tarefa: (api: ApiTarefa, ctx: ContextoTreino, resultado: MutableRefObject<(() => ResultadoTreino) | null>) => ReactNode;
}

type Etapa =
  | "olho"
  | "rapida"
  | "brilho"
  | "aviso"
  | "calibracao"
  | "oculos"
  | "tapar"
  | "distancia"
  | "bloco"
  | "pausa"
  | "resumo";

/**
 * Escolha do olho mais fraco, gravada no perfil. Com "não sei", recomenda
 * primeiro o Teste de Acuidade; depois de o fazer, sugere o olho com o pior
 * resultado -- mas é sempre o utilizador que confirma.
 */
export const EscolherOlho = ({
  aoEscolher,
  historico,
}: {
  aoEscolher: (o: Olho) => void;
  historico: SessaoExercicioPublica[] | null;
}) => {
  const { t } = useTranslation();
  const { profile, setProfile } = useProfile();
  const [naoSei, setNaoSei] = useState(profile?.olho_mais_fraco === "nao_sei");
  const [erro, setErro] = useState(false);
  const [aGravar, setAGravar] = useState(false);

  const escolher = async (o: OlhoMaisFraco) => {
    setErro(false);
    setAGravar(true);
    try {
      const p = await perfilApi.atualizar({ olho_mais_fraco: o });
      if (profile) setProfile({ ...profile, olho_mais_fraco: p.olho_mais_fraco ?? null });
      if (o === "nao_sei") setNaoSei(true);
      else aoEscolher(o);
    } catch {
      setErro(true);
    } finally {
      setAGravar(false);
    }
  };

  // Último Teste de Acuidade de cada olho (histórico: mais recentes primeiro).
  const ultimaAcuidade = (o: Olho) => historico?.find((s) => s.exercicio_id === ID_ACUIDADE && s.olho === o);
  const acuidadeD = ultimaAcuidade("direito");
  const acuidadeE = ultimaAcuidade("esquerdo");
  const temAcuidade = !!acuidadeD && !!acuidadeE;
  const sugerido = temAcuidade
    ? olhoMaisFracoPelaAcuidade({ direito: acuidadeD.limiar, esquerdo: acuidadeE.limiar })
    : null;
  const nomeOlho = (o: Olho) => (o === "direito" ? t("Visao.olhoDireito") : t("Visao.olhoEsquerdo")).toLowerCase();

  if (naoSei && sugerido)
    return (
      <EcraPasso
        icone={<Eye className="h-7 w-7" />}
        titulo={t("Visao.sugestaoOlhoTitulo", { olho: nomeOlho(sugerido) })}
        accao={
          <>
            <BotaoContinuar aoClicar={() => void escolher(sugerido)} desactivado={aGravar}>
              {t("Visao.treinarOlho", { olho: nomeOlho(sugerido) })}
            </BotaoContinuar>
            <Button asChild variant="outline" size="lg" className="w-full sm:w-auto">
              <Link to={localizar("/parceiros?agendar=optiotica")}>{t("Visao.marcarConsulta")}</Link>
            </Button>
            <Button variant="ghost" onClick={() => setNaoSei(false)}>
              {t("Visao.escolherOutroOlho")}
            </Button>
          </>
        }
      >
        <p className="text-sm text-muted-foreground">{t("Visao.sugestaoOlhoTexto")}</p>
        {erro && (
          <p className="text-sm text-destructive" role="alert">
            {t("Visao.erroAGuardarPerfil")}
          </p>
        )}
      </EcraPasso>
    );

  if (naoSei)
    return (
      <EcraPasso
        icone={<Eye className="h-7 w-7" />}
        titulo={t("Visao.naoSeiOlhoTitulo")}
        accao={
          <>
            <Button asChild size="lg" className="w-full bg-teal text-teal-foreground hover:bg-teal/90 sm:w-auto">
              <Link to={localizar("/exercicios/acuidade")}>
                {temAcuidade ? t("Visao.repetirTesteAcuidade") : t("Visao.fazerTesteAcuidade")}
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="w-full sm:w-auto">
              <Link to={localizar("/parceiros?agendar=optiotica")}>{t("Visao.marcarConsulta")}</Link>
            </Button>
            <Button variant="ghost" onClick={() => setNaoSei(false)}>
              {t("Visao.jaSeiOOlho")}
            </Button>
          </>
        }
      >
        <p className="text-sm text-muted-foreground">
          {temAcuidade ? t("Visao.acuidadeSemDiferencaOlhos") : t("Visao.naoSeiOlhoTexto")}
        </p>
      </EcraPasso>
    );

  return (
    <EcraPasso icone={<Eye className="h-7 w-7" />} titulo={t("Visao.qualOlhoMaisFraco")}>
      <p className="text-sm text-muted-foreground">{t("Visao.qualOlhoMaisFracoTexto")}</p>
      <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
        <Button size="lg" variant="outline" disabled={aGravar} onClick={() => void escolher("direito")}>
          {t("Visao.olhoDireito")}
        </Button>
        <Button size="lg" variant="outline" disabled={aGravar} onClick={() => void escolher("esquerdo")}>
          {t("Visao.olhoEsquerdo")}
        </Button>
        <Button size="lg" variant="ghost" disabled={aGravar} onClick={() => void escolher("nao_sei")}>
          {t("Visao.naoSei")}
        </Button>
      </div>
      {erro && (
        <p className="text-sm text-destructive" role="alert">
          {t("Visao.erroAGuardarPerfil")}
        </p>
      )}
    </EcraPasso>
  );
};

/**
 * Bónus de assiduidade no jogo Inclusivamente (Fase B): só aparece depois de a
 * API confirmar a gravação -- o valor vem sempre da resposta da API.
 */
const BonusDoJogo = ({ bonus }: { bonus: BonusAssiduidade }) => {
  const { t } = useTranslation();
  return (
    <div className="w-full rounded-xl border border-gold/50 bg-gold/10 p-4 text-sm text-foreground" role="status">
      <p className="flex items-center justify-center gap-2 font-semibold">
        <Coins className="h-4 w-4 text-gold" aria-hidden />
        {t("Visao.bonusMoedas", { moedas: bonus.moedas })}
      </p>
      {bonus.diamantes > 0 && (
        <p className="mt-1 flex items-center justify-center gap-2 font-semibold">
          <Gem className="h-4 w-4 text-teal" aria-hidden />
          {t("Visao.bonusMarco", { dias: bonus.dias_seguidos, diamantes: bonus.diamantes })}
        </p>
      )}
      {disponivelNoIdiomaActual("/jogo-curiosidades") && (
        <Link to={localizar("/jogo-curiosidades")} className="mt-2 inline-block text-sm font-medium text-navy underline underline-offset-2">
          {t("Visao.bonusIrAoJogo")}
        </Link>
      )}
    </div>
  );
};

/** "Hoje: X min · Sequência: N dias" a partir do histórico. */
export const ContadorDiario = ({ historico }: { historico: SessaoExercicioPublica[] }) => {
  const { t } = useTranslation();
  const hoje = new Date();
  const minutos = Math.round(minutosPorDia(historico).get(diaLocal(hoje)) ?? 0);
  const sequencia = sequenciaDeDias(historico, hoje);
  return (
    <p className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
      <Flame className="h-4 w-4 text-gold" aria-hidden />
      {sequencia === 1
        ? t("Visao.contadorDiarioUmDia", { minutos })
        : t("Visao.contadorDiario", { minutos, dias: sequencia })}
    </p>
  );
};

/**
 * Assistente comum aos treinos: olho mais fraco -> brilho -> cartão ->
 * óculos -> tapa-olho no outro olho -> (distância) -> blocos de 2 minutos
 * de tempo activo com pausa de respiração entre eles -> resumo e gravação.
 *
 * A tarefa fica montada durante toda a sessão (só se esconde nas pausas),
 * para o nível da escada continuar de um bloco para o seguinte.
 */
const AssistenteTreino = ({
  exercicioId,
  grupo,
  titulo,
  descricao,
  monocular,
  comDistancia = false,
  distanciaFixaMm = DISTANCIA_OMISSAO_MM,
  aviso,
  requisito,
  tarefa,
}: AssistenteTreinoProps) => {
  const { t } = useTranslation();
  const { isLoggedIn } = useAuth();
  const { profile, loading: perfilLoading } = useProfile();
  const { calibracao, guardar } = useCalibracao();
  const dpr = useDevicePixelRatio();
  const tempo = useTempoActivo();
  const { sessoes: historico, recarregar } = useHistoricoVisao();
  const { estado: gravacao, gravar, tentarDeNovo, bonus } = useRegistoSessao();

  const olhoPerfil =
    profile?.olho_mais_fraco === "direito" || profile?.olho_mais_fraco === "esquerdo" ? profile.olho_mais_fraco : null;
  const [olho, setOlho] = useState<Olho | null>(olhoPerfil);
  useEffect(() => {
    if (olhoPerfil && !olho) setOlho(olhoPerfil);
  }, [olho, olhoPerfil]);

  // Sessão rápida: com as escolhas da última vez neste aparelho, um só ecrã
  // de confirmação em vez dos 5-6 passos de preparação.
  const [escolhas] = useState(() => lerEscolhas(exercicioId));
  const rapidaDisponivel = podeUsarSessaoRapida({ escolhas, calibracao, monocular, olhoActual: olho });
  const [modoRapido, setModoRapido] = useState(false);

  const [etapa, setEtapa] = useState<Etapa>(() => (monocular ? "olho" : rapidaDisponivel ? "rapida" : "brilho"));
  // Perfil ainda a carregar mostra a escolha por instantes; salta-a quando chega.
  useEffect(() => {
    if (etapa === "olho" && olho) setEtapa(rapidaDisponivel ? "rapida" : "brilho");
  }, [etapa, olho, rapidaDisponivel]);

  const [distanciaMm, setDistanciaMm] = useState(distanciaFixaMm);
  const [usaCorreccao, setUsaCorreccao] = useState(false);
  const [bloco, setBloco] = useState(1);
  const inicioBloco = useRef(0);
  const inicioSessao = useRef(0);
  const tentativas = useRef(0);
  const controlos = useRef({ total: 0, errados: 0 });
  const resultadoRef = useRef<(() => ResultadoTreino) | null>(null);
  const [resumo, setResumo] = useState<{ resultado: ResultadoTreino; segundos: number; baixaAtencao: boolean } | null>(
    null,
  );

  const ctx: ContextoTreino = useMemo(
    () => ({
      olho: monocular ? olho : null,
      pxPorMm: calibracao?.pxPorMm ?? PX_POR_MM_NOMINAL,
      calibrado: calibracao?.calibrado ?? false,
      distanciaMm,
      devicePixelRatio: dpr,
      historico: historico ?? [],
    }),
    [calibracao, distanciaMm, dpr, historico, monocular, olho],
  );

  const terminar = useCallback(() => {
    tempo.pausar();
    const resultado = resultadoRef.current?.() ?? { limiar: null, resumo: "" };
    const segundos = tempo.lerSegundos();
    const sinais = { ...sinaisDeControlo(controlos.current.total, controlos.current.errados), blocos: bloco, ...resultado.sinais };
    setResumo({ resultado, segundos, baixaAtencao: sinais.baixa_atencao });
    setEtapa("resumo");
    if (segundos < 1) return; // nada feito: não se grava uma sessão vazia
    const olhoSessao: OlhoSessao = monocular && olho ? olho : "ambos";
    void gravar([
      {
        exercicio_id: exercicioId,
        olho: olhoSessao,
        duracao_segundos: Math.max(1, Math.round((Date.now() - inicioSessao.current) / 1000)),
        segundos_activos: segundos,
        limiar: resultado.limiar,
        unidade: resultado.unidade,
        distancia_mm: distanciaMm,
        px_por_mm: Math.round(ctx.pxPorMm * 1000) / 1000,
        calibrado: ctx.calibrado,
        sinais: { ...sinais, com_correccao: usaCorreccao },
      },
    ]).then(() => void recarregar());
  }, [bloco, ctx, distanciaMm, exercicioId, gravar, monocular, olho, recarregar, tempo, usaCorreccao]);

  // Fim de bloco: 2 minutos de tempo activo.
  useEffect(() => {
    if (etapa !== "bloco") return;
    if (tempo.segundos - inicioBloco.current < BLOCO_SEGUNDOS) return;
    if (bloco >= BLOCOS_POR_SESSAO) terminar();
    else {
      tempo.pausar();
      setEtapa("pausa");
    }
  }, [bloco, etapa, tempo, terminar]);

  // Guarda as escolhas quando o primeiro bloco arranca (estado já assente),
  // para a sessão rápida da próxima vez.
  const escolhasGuardadas = useRef(false);
  useEffect(() => {
    if (etapa !== "bloco" || escolhasGuardadas.current) return;
    escolhasGuardadas.current = true;
    guardarEscolhas(exercicioId, { distanciaMm, usaCorreccao, olho: monocular ? olho : null });
  }, [distanciaMm, etapa, exercicioId, monocular, olho, usaCorreccao]);

  const comecarBlocos = () => {
    inicioSessao.current = Date.now();
    inicioBloco.current = 0;
    tempo.iniciar();
    setEtapa("bloco");
  };

  const api: ApiTarefa = {
    proximaEControlo: () => eTentativaDeControlo(tentativas.current),
    registar: ({ controlo, acertou }) => {
      tentativas.current += 1;
      if (controlo) {
        controlos.current.total += 1;
        if (!acertou) controlos.current.errados += 1;
      }
      tempo.registar();
    },
    activo: etapa === "bloco",
  };

  const usarOrdemRapida = etapa === "rapida" || modoRapido;
  const passosRapidos = [
    ...(monocular ? [t("Visao.passoOlhoMaisFraco")] : []),
    t("Visao.passoPreparacao"),
    t("Visao.passoTreino"),
    t("Visao.passoResumo"),
  ];
  const ordemRapida: Etapa[] = [...(monocular ? (["olho"] as Etapa[]) : []), "rapida", "bloco", "resumo"];
  const passosCompletos = [
    ...(monocular ? [t("Visao.passoOlhoMaisFraco")] : []),
    t("Visao.passoEcra"),
    ...(aviso ? [t("Visao.passoAviso")] : []),
    t("Visao.passoCartao"),
    t("Visao.passoOculos"),
    ...(monocular ? [t("Visao.passoTapaOlho")] : []),
    ...(comDistancia ? [t("Visao.passoDistancia")] : []),
    t("Visao.passoTreino"),
    t("Visao.passoResumo"),
  ];
  const ordemCompleta: Etapa[] = [
    ...(monocular ? (["olho"] as Etapa[]) : []),
    "brilho",
    ...(aviso ? (["aviso"] as Etapa[]) : []),
    "calibracao",
    "oculos",
    ...(monocular ? (["tapar"] as Etapa[]) : []),
    ...(comDistancia ? (["distancia"] as Etapa[]) : []),
    "bloco",
    "resumo",
  ];
  const passos = usarOrdemRapida ? passosRapidos : passosCompletos;
  const ordem = usarOrdemRapida ? ordemRapida : ordemCompleta;
  const passoActual = ordem.indexOf(etapa === "pausa" ? "bloco" : etapa);
  const seguinte = (de: Etapa) => {
    const proxima = ordem[ordem.indexOf(de) + 1];
    if (proxima === "bloco") comecarBlocos();
    else setEtapa(proxima);
  };

  const bloqueio = isLoggedIn && historico !== null && requisito ? requisito(ctx) : null;
  const aCarregar = monocular && perfilLoading;

  let conteudo: ReactNode;
  if (aCarregar) conteudo = <div className="h-40" aria-busy />;
  else if (etapa === "olho") conteudo = <EscolherOlho aoEscolher={(o) => setOlho(o)} historico={historico} />;
  else if (bloqueio && etapa !== "resumo") conteudo = bloqueio;
  else
    conteudo = (
      <>
        {etapa === "rapida" && escolhas && (
          <div className="flex flex-col gap-4">
            <PassoRapido
              calibrado={ctx.calibrado}
              distanciaMm={escolhas.distanciaMm}
              comDistancia={comDistancia}
              usaCorreccao={escolhas.usaCorreccao}
              olhoATapar={monocular && olho ? (olho === "direito" ? "esquerdo" : "direito") : null}
              aviso={aviso}
              aoComecar={() => {
                if (comDistancia) setDistanciaMm(escolhas.distanciaMm);
                setUsaCorreccao(escolhas.usaCorreccao);
                setModoRapido(true);
                comecarBlocos();
              }}
              aoAlterar={() => setEtapa("brilho")}
            />
            {historico && <ContadorDiario historico={historico} />}
          </div>
        )}
        {etapa === "brilho" && (
          <div className="flex flex-col gap-4">
            <PassoBrilho aoContinuar={() => seguinte("brilho")} />
            {historico && <ContadorDiario historico={historico} />}
          </div>
        )}
        {etapa === "aviso" && aviso && (
          <EcraPasso titulo={t("Visao.antesDeComecar")} accao={<BotaoContinuar aoClicar={() => seguinte("aviso")} />}>
            {aviso}
          </EcraPasso>
        )}
        {etapa === "calibracao" && (
          <PassoCalibracao calibracao={calibracao} aoGuardar={guardar} aoContinuar={() => seguinte("calibracao")} />
        )}
        {etapa === "oculos" && (
          <PassoOculos
            exercicioDePerto={!comDistancia}
            aoResponder={(c) => {
              setUsaCorreccao(c);
              seguinte("oculos");
            }}
          />
        )}
        {etapa === "tapar" && olho && (
          <PassoTaparOlho
            olhoATapar={olho === "direito" ? "esquerdo" : "direito"}
            tapaOlho
            aoContinuar={() => seguinte("tapar")}
          />
        )}
        {etapa === "distancia" && (
          <PassoDistancia
            distanciaMm={distanciaMm}
            aoEscolher={(mm) => {
              setDistanciaMm(mm);
              seguinte("distancia");
            }}
          />
        )}

        {/* A tarefa fica montada entre blocos (só escondida na pausa). */}
        {(etapa === "bloco" || etapa === "pausa") && (
          <>
            <div hidden={etapa !== "bloco"}>
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                <span>
                  {t("Visao.blocoDe", { bloco, total: BLOCOS_POR_SESSAO })} ·{" "}
                  {t("Visao.tempoActivoBloco", {
                    segundos: Math.min(BLOCO_SEGUNDOS, Math.max(0, tempo.segundos - inicioBloco.current)),
                    total: BLOCO_SEGUNDOS,
                  })}
                </span>
                <Button size="sm" variant="ghost" className="gap-1.5" onClick={terminar}>
                  <Square className="h-3.5 w-3.5" /> {t("Visao.terminarAgora")}
                </Button>
              </div>
              {tarefa(api, ctx, resultadoRef)}
              {tempo.emPausa && etapa === "bloco" && (
                <p className="mt-3 text-center text-xs text-muted-foreground">{t("Visao.emPausaAutomatica")}</p>
              )}
            </div>
            {etapa === "pausa" && (
              <PausaRespiracao
                segundos={PAUSA_SEGUNDOS}
                comTapaOlho={monocular}
                aoTerminar={() => {
                  setBloco((b) => b + 1);
                  inicioBloco.current = tempo.lerSegundos();
                  tempo.iniciar();
                  setEtapa("bloco");
                }}
              />
            )}
          </>
        )}

        {etapa === "resumo" && resumo && (
          <section className="mx-auto flex max-w-xl flex-col items-center gap-4 text-center">
            <h2 className="text-xl font-bold text-foreground">{t("Visao.resumoTitulo")}</h2>
            <p className="text-sm text-muted-foreground">
              {t("Visao.resumoTempo", { minutos: Math.floor(resumo.segundos / 60), segundos: resumo.segundos % 60 })}
            </p>
            {resumo.resultado.resumo && <p className="text-lg font-semibold text-foreground">{resumo.resultado.resumo}</p>}
            {IDS_AUTOAVALIACAO.includes(exercicioId) && (
              <p className="text-sm text-muted-foreground">{t("Visao.autoAvaliacaoNota")}</p>
            )}
            {monocular && olho && historico && gravacao === "gravado" && (resumo.resultado.unidade === "logmar" || resumo.resultado.unidade === "log_cs") && (
              <ResumoTendencia sessoes={historico} exercicioId={exercicioId} olhos={[olho]} />
            )}
            {resumo.baixaAtencao && (
              <p className="rounded-lg bg-gold/10 px-3 py-2 text-sm text-foreground">{t("Visao.baixaAtencao")}</p>
            )}
            {resumo.segundos < 1 && <p className="text-sm text-muted-foreground">{t("Visao.nadaParaGuardar")}</p>}
            {historico && <ContadorDiario historico={historico} />}
            <EstadoDaGravacao estado={gravacao} aoTentarDeNovo={() => void tentarDeNovo()} />
            {gravacao === "gravado" && bonus && <BonusDoJogo bonus={bonus} />}
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
              <Button asChild size="lg" className="bg-teal text-teal-foreground hover:bg-teal/90">
                <Link to={localizar("/exercicios/progresso")}>{t("Visao.verProgresso")}</Link>
              </Button>
              <Button asChild variant="outline" size="lg">
                <Link to={localizar("/exercicios")}>{t("Visao.voltarAosExercicios")}</Link>
              </Button>
            </div>
          </section>
        )}
      </>
    );

  return (
    <BaseExercise
      title={titulo}
      description={descricao}
      exercicioId={exercicioId}
      grupo={grupo}
      tipo="treino"
      passos={passos}
      passoActual={Math.max(0, passoActual)}
    >
      {conteudo}
    </BaseExercise>
  );
};

export default AssistenteTreino;
