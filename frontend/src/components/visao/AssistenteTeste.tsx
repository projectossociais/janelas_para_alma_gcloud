import { useEffect, useRef, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import BaseExercise from "@/components/exercises/BaseExercise";
import { useCalibracao, useDevicePixelRatio } from "@/components/visao/hooks";
import { NotaPreparacao, PassoCalibracao, PassoDistancia, PassoOculos, PassoTaparOlho } from "@/components/visao/Passos";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/contexts/ProfileContext";
import { perfilApi } from "@/lib/apiClient";
import { DISTANCIA_OMISSAO_MM } from "@/lib/visao/geometria";
import { OLHOS, type Olho } from "@/lib/visao/resultados";

export interface ContextoTeste {
  pxPorMm: number;
  calibrado: boolean;
  distanciaMm: number;
  /** A distância foi medida pelo ponto cego (e não escolhida). */
  distanciaMedida: boolean;
  devicePixelRatio: number;
  usaCorreccao: boolean;
}

type Etapa =
  | { tipo: "inicio" }
  | { tipo: "calibracao" }
  | { tipo: "oculos" }
  | { tipo: "distancia" }
  | { tipo: "preparacao" }
  | { tipo: "tapar"; olho: Olho }
  | { tipo: "tarefa"; olho: Olho }
  | { tipo: "resultado" };

type Comum = "calibracao" | "oculos" | "distancia" | "preparacao";

interface AssistenteTesteProps<R> {
  exercicioId: string;
  titulo: string;
  descricao: string;
  /** Pede a distância ao ecrã (testes ao perto). */
  comDistancia?: boolean;
  /**
   * Um passo próprio do teste antes do primeiro olho (ex.: montar o teste a
   * 3 metros). `render` chama `aoContinuar` quando estiver pronto.
   */
  preparacao?: { nome: string; render: (aoContinuar: () => void, ctx: ContextoTeste) => ReactNode };
  /**
   * A tarefa já tem o seu próprio ecrã "tape o outro olho e comece": sem isto,
   * eram dois ecrãs seguidos a dizer o mesmo.
   */
  semPassoTapar?: boolean;
  /** A tarefa de um olho; chama `aoTerminar` com o resultado desse olho. */
  tarefa: (olho: Olho, ctx: ContextoTeste, aoTerminar: (r: R) => void) => ReactNode;
  /** Ecrã final; `repetirA` recomeça os dois olhos a outra distância. */
  resultado: (res: Record<Olho, R>, ctx: ContextoTeste, repetirA: (distanciaMm: number) => void) => ReactNode;
}

/**
 * Assistente comum aos testes monoculares: cartão -> óculos/lentes ->
 * (distância) -> (preparação do teste) -> tape o olho esquerdo -> tarefa do
 * olho direito -> tape o olho direito -> tarefa do olho esquerdo -> resultado.
 * Um passo por ecrã, um olho de cada vez.
 *
 * Só se pergunta o que ainda não se sabe (2026-11-11, como nos treinos): o
 * cartão salta com o ecrã já calibrado, os óculos de graduação perguntam-se
 * uma vez e ficam no perfil (`usa_oculos`), e o brilho é uma linha por baixo
 * dos passos (`NotaPreparacao`), que também deixa calibrar de novo.
 */
function AssistenteTeste<R>({
  exercicioId,
  titulo,
  descricao,
  comDistancia = true,
  preparacao,
  semPassoTapar = false,
  tarefa,
  resultado,
}: AssistenteTesteProps<R>) {
  const { t } = useTranslation();
  const { isLoggedIn } = useAuth();
  const { profile, setProfile, loading: perfilLoading } = useProfile();
  const { calibracao, guardar } = useCalibracao();
  const dpr = useDevicePixelRatio();
  const [etapa, setEtapa] = useState<Etapa>({ tipo: "inicio" });
  const [distanciaMm, setDistanciaMm] = useState(DISTANCIA_OMISSAO_MM);
  const [distanciaMedida, setDistanciaMedida] = useState(false);
  const [recalibrar, setRecalibrar] = useState(false);
  /** Resposta desta sessão; sem ela, vale a do perfil. */
  const [respostaOculos, setRespostaOculos] = useState<boolean | null>(null);
  const [resultados, setResultados] = useState<Partial<Record<Olho, R>>>({});

  const oculosPerfil = typeof profile?.usa_oculos === "boolean" ? profile.usa_oculos : null;
  // Um passo que já apareceu nesta sessão fica na barra de passos até ao fim.
  const vistos = useRef({ cartao: false, oculos: false });
  if (etapa.tipo === "calibracao") vistos.current.cartao = true;
  if (etapa.tipo === "oculos") vistos.current.oculos = true;

  const ctx: ContextoTeste = {
    pxPorMm: calibracao?.pxPorMm ?? 96 / 25.4,
    calibrado: calibracao?.calibrado ?? false,
    distanciaMm,
    distanciaMedida,
    devicePixelRatio: dpr,
    usaCorreccao: respostaOculos ?? oculosPerfil ?? false,
  };

  // [passo, nome na barra, entra?]
  const comuns: [Comum, string, boolean][] = [
    ["calibracao", t("Visao.passoCartao"), calibracao === null || recalibrar || vistos.current.cartao],
    ["oculos", t("Visao.passoOculos"), oculosPerfil === null || vistos.current.oculos],
    ["distancia", t("Visao.passoDistancia"), comDistancia],
    ["preparacao", preparacao?.nome ?? "", !!preparacao],
  ];
  const activos = comuns.filter(([, , entra]) => entra);
  const nomesPassos = [
    ...activos.map(([, nome]) => nome),
    t("Visao.passoOlhoDireito"),
    t("Visao.passoOlhoEsquerdo"),
    t("Visao.passoResultado"),
  ];
  const passoActual = (() => {
    switch (etapa.tipo) {
      case "inicio":
        return 0;
      case "tapar":
      case "tarefa":
        return activos.length + OLHOS.indexOf(etapa.olho);
      case "resultado":
        return nomesPassos.length - 1;
      default:
        return Math.max(0, activos.findIndex(([p]) => p === etapa.tipo));
    }
  })();

  // Testa-se o olho direito com o esquerdo tapado, e depois o contrário.
  const outro = (o: Olho): Olho => (o === "direito" ? "esquerdo" : "direito");
  const antesDoOlho = (olho: Olho): Etapa => (semPassoTapar ? { tipo: "tarefa", olho } : { tipo: "tapar", olho });
  /** O passo comum a seguir a `de` (ou o primeiro, sem `de`); depois deles, o primeiro olho. */
  const depoisDe = (de?: Comum) => {
    const proximo = activos[de ? activos.findIndex(([p]) => p === de) + 1 : 0];
    setEtapa(proximo ? { tipo: proximo[0] } : antesDoOlho(OLHOS[0]));
  };

  // Só com o perfil carregado se sabe o que falta perguntar.
  useEffect(() => {
    if (etapa.tipo === "inicio" && !perfilLoading) depoisDe();
    // `depoisDe` muda a cada render; só interessa quando o perfil chega.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [etapa.tipo, perfilLoading]);

  const aPreparar = etapa.tipo === "calibracao" || etapa.tipo === "oculos" || etapa.tipo === "preparacao" || etapa.tipo === "tapar";

  const conteudo = (() => {
    switch (etapa.tipo) {
      case "inicio":
        return <div className="h-40" aria-busy />;
      case "calibracao":
        return (
          <PassoCalibracao
            calibracao={calibracao}
            forcar={recalibrar}
            aoGuardar={guardar}
            aoContinuar={() => depoisDe("calibracao")}
          />
        );
      case "oculos":
        return (
          <PassoOculos
            aoResponder={(c) => {
              setRespostaOculos(c);
              // Fica no perfil para não se voltar a perguntar. Se a gravação
              // falhar, o teste segue e pergunta-se outra vez da próxima.
              if (isLoggedIn && c !== oculosPerfil)
                perfilApi
                  .atualizar({ usa_oculos: c })
                  .then((p) => profile && setProfile({ ...profile, usa_oculos: p.usa_oculos ?? null }))
                  .catch(() => undefined);
              depoisDe("oculos");
            }}
          />
        );
      case "distancia":
        return (
          <PassoDistancia
            distanciaMm={distanciaMm}
            pxPorMm={ctx.pxPorMm}
            aoEscolher={(mm, medida) => {
              setDistanciaMm(mm);
              setDistanciaMedida(medida);
              depoisDe("distancia");
            }}
          />
        );
      case "preparacao":
        return preparacao?.render(() => depoisDe("preparacao"), ctx);
      case "tapar":
        return (
          <PassoTaparOlho
            olhoATapar={outro(etapa.olho)}
            tapaOlho={false}
            aoContinuar={() => setEtapa({ tipo: "tarefa", olho: etapa.olho })}
          />
        );
      case "tarefa": {
        const olho = etapa.olho;
        return (
          <div key={`${olho}-${distanciaMm}`}>
            {tarefa(olho, ctx, (r) => {
              setResultados((prev) => ({ ...prev, [olho]: r }));
              const i = OLHOS.indexOf(olho);
              setEtapa(i + 1 < OLHOS.length ? antesDoOlho(OLHOS[i + 1]) : { tipo: "resultado" });
            })}
          </div>
        );
      }
      case "resultado":
        return resultado(resultados as Record<Olho, R>, ctx, (mm) => {
          setDistanciaMm(mm);
          setDistanciaMedida(false);
          setResultados({});
          setEtapa(antesDoOlho(OLHOS[0]));
        });
    }
  })();

  return (
    <BaseExercise
      title={titulo}
      description={descricao}
      exercicioId={exercicioId}
      tipo="teste"
      passos={nomesPassos}
      passoActual={passoActual}
    >
      {conteudo}
      {aPreparar && (
        <NotaPreparacao
          aoCalibrarDeNovo={
            calibracao && etapa.tipo !== "calibracao"
              ? () => {
                  setRecalibrar(true);
                  setEtapa({ tipo: "calibracao" });
                }
              : undefined
          }
        />
      )}
    </BaseExercise>
  );
}

export default AssistenteTeste;
