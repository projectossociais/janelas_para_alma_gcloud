import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Botao } from "@/design/componentes/Botao";
import { faseRespiracao, type FaseRespiracao } from "@/lib/visao/respiracao";

const CHAVES_FASE: Record<FaseRespiracao, string> = {
  inspire: "Visao.inspire",
  sustenha: "Visao.sustenha",
  expire: "Visao.expire",
};

/**
 * Pausa curta entre blocos de treino, com respiração guiada (a mecânica do
 * antigo "Relaxamento e Respiração"). Não é tratamento: serve para descansar
 * os olhos. Um só `requestAnimationFrame`; a escala da orbe só é escrita
 * aqui, nunca com uma `transition` CSS por cima (CLAUDE.md §6).
 */
const PausaRespiracao = ({
  segundos,
  aoTerminar,
  comTapaOlho = true,
}: {
  segundos: number;
  aoTerminar: () => void;
  /** Treinos com os dois olhos (convergência) não mandam destapar o olho. */
  comTapaOlho?: boolean;
}) => {
  const { t } = useTranslation();
  const orbe = useRef<HTMLDivElement>(null);
  const [fase, setFase] = useState<FaseRespiracao>("inspire");
  const [restantes, setRestantes] = useState(segundos);
  const terminar = useRef(aoTerminar);
  terminar.current = aoTerminar;

  useEffect(() => {
    const inicio = performance.now();
    let raf = 0;
    let faseAnterior: FaseRespiracao | null = null;
    let restantesAnterior = segundos;
    const animar = (agora: number) => {
      const decorrido = agora - inicio;
      const { fase: f, escala } = faseRespiracao(decorrido);
      if (orbe.current) orbe.current.style.transform = `translate(-50%, -50%) scale(${escala})`;
      if (f !== faseAnterior) setFase((faseAnterior = f));
      const r = Math.max(0, Math.ceil(segundos - decorrido / 1000));
      if (r !== restantesAnterior) setRestantes((restantesAnterior = r));
      if (r === 0) {
        terminar.current();
        return;
      }
      raf = requestAnimationFrame(animar);
    };
    raf = requestAnimationFrame(animar);
    return () => cancelAnimationFrame(raf);
  }, [segundos]);

  return (
    <section className="mx-auto flex max-w-md flex-col items-center gap-5 text-center" aria-live="polite">
      <h2 className="text-xl font-bold text-foreground">{t("Visao.pausaTitulo")}</h2>
      <p className="text-sm text-muted-foreground">{comTapaOlho ? t("Visao.pausaTexto") : t("Visao.pausaTextoDoisOlhos")}</p>
      <div className="relative h-44 w-44">
        <div
          ref={orbe}
          className="absolute left-1/2 top-1/2 h-24 w-24 rounded-full bg-gradient-to-br from-acento to-accao opacity-80"
          style={{ transform: "translate(-50%, -50%) scale(1)" }}
          aria-hidden
        />
      </div>
      <p className="text-lg font-semibold text-foreground">{t(CHAVES_FASE[fase])}</p>
      <p className="text-xs tabular-nums text-muted-foreground">{t("Visao.pausaFaltam", { segundos: restantes })}</p>
      <Botao variante="fantasma" onClick={aoTerminar}>
        {t("Visao.saltarPausa")}
      </Botao>
    </section>
  );
};

export default PausaRespiracao;
