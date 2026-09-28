import { useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import BaseExercise from "@/components/exercises/BaseExercise";
import type { GrupoExercicio } from "@/components/exercises/useAcaoDesbloqueio";
import { useCalibracao, useDevicePixelRatio } from "@/components/visao/hooks";
import { PassoBrilho, PassoCalibracao, PassoDistancia, PassoOculos, PassoTaparOlho } from "@/components/visao/Passos";
import { DISTANCIA_OMISSAO_MM } from "@/lib/visao/geometria";
import { OLHOS, type Olho } from "@/lib/visao/resultados";

export interface ContextoTeste {
  pxPorMm: number;
  calibrado: boolean;
  distanciaMm: number;
  devicePixelRatio: number;
  usaCorreccao: boolean;
}

type Etapa =
  | { tipo: "brilho" }
  | { tipo: "calibracao" }
  | { tipo: "oculos" }
  | { tipo: "distancia" }
  | { tipo: "tapar"; olho: Olho }
  | { tipo: "tarefa"; olho: Olho }
  | { tipo: "resultado" };

interface AssistenteTesteProps<R> {
  exercicioId: string;
  grupo: GrupoExercicio;
  titulo: string;
  descricao: string;
  /** Pede a distância (acuidade, contraste, astigmatismo). */
  comDistancia?: boolean;
  /** A tarefa de um olho; chama `aoTerminar` com o resultado desse olho. */
  tarefa: (olho: Olho, ctx: ContextoTeste, aoTerminar: (r: R) => void) => ReactNode;
  /** Ecrã final; `repetirA` recomeça os dois olhos a outra distância. */
  resultado: (res: Record<Olho, R>, ctx: ContextoTeste, repetirA: (distanciaMm: number) => void) => ReactNode;
}

/**
 * Assistente comum aos testes monoculares: brilho no máximo -> cartão ->
 * óculos/lentes -> distância -> tape o olho esquerdo -> tarefa do olho
 * direito -> tape o olho direito -> tarefa do olho esquerdo -> resultado.
 * Um passo por ecrã, um olho de cada vez.
 */
function AssistenteTeste<R>({
  exercicioId,
  grupo,
  titulo,
  descricao,
  comDistancia = true,
  tarefa,
  resultado,
}: AssistenteTesteProps<R>) {
  const { t } = useTranslation();
  const { calibracao, guardar } = useCalibracao();
  const dpr = useDevicePixelRatio();
  const [etapa, setEtapa] = useState<Etapa>({ tipo: "brilho" });
  const [distanciaMm, setDistanciaMm] = useState(DISTANCIA_OMISSAO_MM);
  const [usaCorreccao, setUsaCorreccao] = useState(false);
  const [resultados, setResultados] = useState<Partial<Record<Olho, R>>>({});

  const ctx: ContextoTeste = {
    pxPorMm: calibracao?.pxPorMm ?? 96 / 25.4,
    calibrado: calibracao?.calibrado ?? false,
    distanciaMm,
    devicePixelRatio: dpr,
    usaCorreccao,
  };

  const nomesPassos = [
    t("Visao.passoEcra"),
    t("Visao.passoCartao"),
    t("Visao.passoOculos"),
    ...(comDistancia ? [t("Visao.passoDistancia")] : []),
    t("Visao.passoOlhoDireito"),
    t("Visao.passoOlhoEsquerdo"),
    t("Visao.passoResultado"),
  ];
  const indiceOlho = comDistancia ? 4 : 3;
  const passoActual = (() => {
    switch (etapa.tipo) {
      case "brilho":
        return 0;
      case "calibracao":
        return 1;
      case "oculos":
        return 2;
      case "distancia":
        return 3;
      case "tapar":
      case "tarefa":
        return indiceOlho + OLHOS.indexOf(etapa.olho);
      case "resultado":
        return nomesPassos.length - 1;
    }
  })();

  // Testa-se o olho direito com o esquerdo tapado, e depois o contrário.
  const outro = (o: Olho): Olho => (o === "direito" ? "esquerdo" : "direito");
  const primeiroOlho = OLHOS[0];

  const conteudo = (() => {
    switch (etapa.tipo) {
      case "brilho":
        return <PassoBrilho exercicioId={exercicioId} aoContinuar={() => setEtapa({ tipo: "calibracao" })} />;
      case "calibracao":
        return (
          <PassoCalibracao calibracao={calibracao} aoGuardar={guardar} aoContinuar={() => setEtapa({ tipo: "oculos" })} />
        );
      case "oculos":
        return (
          <PassoOculos
            aoResponder={(c) => {
              setUsaCorreccao(c);
              setEtapa(comDistancia ? { tipo: "distancia" } : { tipo: "tapar", olho: primeiroOlho });
            }}
          />
        );
      case "distancia":
        return (
          <PassoDistancia
            distanciaMm={distanciaMm}
            aoEscolher={(mm) => {
              setDistanciaMm(mm);
              setEtapa({ tipo: "tapar", olho: primeiroOlho });
            }}
          />
        );
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
              setEtapa(i + 1 < OLHOS.length ? { tipo: "tapar", olho: OLHOS[i + 1] } : { tipo: "resultado" });
            })}
          </div>
        );
      }
      case "resultado":
        return resultado(resultados as Record<Olho, R>, ctx, (mm) => {
          setDistanciaMm(mm);
          setResultados({});
          setEtapa({ tipo: "tapar", olho: primeiroOlho });
        });
    }
  })();

  return (
    <BaseExercise
      title={titulo}
      description={descricao}
      exercicioId={exercicioId}
      grupo={grupo}
      tipo="teste"
      passos={nomesPassos}
      passoActual={passoActual}
    >
      {conteudo}
    </BaseExercise>
  );
}

export default AssistenteTeste;
