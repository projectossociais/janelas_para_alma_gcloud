import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ArrowRight, CalendarCheck, Camera, Check, Eye, Glasses, Ruler, ShieldCheck, Sun } from "lucide-react";
import type { Direccao } from "./direcoes";

/**
 * O início do rastreio repensado de raiz (não é o ecrã actual pintado de novo):
 * um passo por ecrã, preparação verificável, instrução única durante a
 * captura, e um resultado que diz o que fazer a seguir. Corre sozinho em
 * demonstração; os pontos em baixo deixam saltar de passo.
 */
const PASSOS = ["preparar", "camara", "captar", "resultado"] as const;
type Passo = (typeof PASSOS)[number];

const PREPARACAO = [
  { icone: Sun, texto: "Luz de frente, sem janela atrás" },
  { icone: Ruler, texto: "Telemóvel à altura dos olhos, a um braço" },
  { icone: Glasses, texto: "Tire os óculos, se usar" },
];

export const EcraRastreio = ({ d }: { d: Direccao }) => {
  const reduzido = useReducedMotion();
  const [passo, setPasso] = useState<Passo>("preparar");
  const [marcados, setMarcados] = useState(0);
  const [automatico, setAutomatico] = useState(true);

  // Demonstração: vai marcando a preparação e avança sozinha.
  useEffect(() => {
    if (!automatico) return;
    const id = window.setTimeout(() => {
      if (passo === "preparar" && marcados < PREPARACAO.length) setMarcados((m) => m + 1);
      else if (passo === "preparar") setPasso("camara");
      else if (passo === "camara") setPasso("captar");
      else if (passo === "captar") setPasso("resultado");
      else {
        setMarcados(0);
        setPasso("preparar");
      }
    }, passo === "preparar" ? 900 : 3200);
    return () => window.clearTimeout(id);
  }, [automatico, marcados, passo]);

  const ir = (p: Passo) => {
    setAutomatico(false);
    setPasso(p);
    setMarcados(p === "preparar" ? 0 : PREPARACAO.length);
  };

  const transicao = reduzido ? { duration: 0 } : { type: "spring" as const, ...d.mola };

  return (
    <div className="mx-auto w-[300px] rounded-[44px] border-[10px] border-[var(--r-tinta)] bg-[var(--r-sup)] p-5 shadow-[0_30px_80px_-30px_rgba(0,0,0,0.45)]">
      <div className="mx-auto mb-4 h-1.5 w-20 rounded-full bg-[var(--r-linha)]" />
      <div className="relative h-[430px] overflow-hidden">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={passo}
            initial={{ opacity: 0, x: reduzido ? 0 : 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: reduzido ? 0 : -40 }}
            transition={transicao}
            className="absolute inset-0 flex flex-col"
          >
            {passo === "preparar" && (
              <>
                <p className="text-xs font-semibold uppercase tracking-wider text-[var(--r-prim)]">Passo 1 de 4</p>
                <h3 className="mt-1 font-[family-name:var(--r-letra-titulo)] text-2xl leading-tight" style={{ fontWeight: Math.max(d.pesoTitulo, 500) }}>
                  Antes de começar
                </h3>
                <ul className="mt-5 space-y-3">
                  {PREPARACAO.map(({ icone: Icone, texto }, i) => {
                    const feito = i < marcados;
                    return (
                      <motion.li
                        key={texto}
                        layout
                        className="flex items-center gap-3 rounded-[var(--r-raio)] border border-[var(--r-linha)] p-3"
                        animate={{ backgroundColor: feito ? "var(--r-sup-alt)" : "var(--r-sup)" }}
                      >
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--r-sup-alt)] text-[var(--r-prim)]">
                          <Icone className="h-4 w-4" />
                        </span>
                        <span className="flex-1 text-sm leading-snug">{texto}</span>
                        <motion.span
                          className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-[var(--r-prim)]"
                          animate={{ backgroundColor: feito ? "var(--r-prim)" : "rgba(0,0,0,0)" }}
                        >
                          {feito && <Check className="h-3.5 w-3.5 text-[var(--r-sobre-prim)]" strokeWidth={3} />}
                        </motion.span>
                      </motion.li>
                    );
                  })}
                </ul>
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={() => ir("camara")}
                  className="mt-auto flex h-14 items-center justify-center gap-2 rounded-[var(--r-raio-botao)] bg-[var(--r-prim)] text-base font-semibold text-[var(--r-sobre-prim)] disabled:opacity-40"
                  disabled={marcados < PREPARACAO.length}
                >
                  Estou pronto <ArrowRight className="h-4 w-4" />
                </motion.button>
              </>
            )}

            {passo === "camara" && (
              // Explicar antes de pedir: o pedido do browser só aparece depois
              // de a pessoa saber porquê e o que acontece à imagem.
              <>
                <p className="text-xs font-semibold uppercase tracking-wider text-[var(--r-prim)]">Passo 2 de 4</p>
                <h3 className="mt-1 font-[family-name:var(--r-letra-titulo)] text-2xl leading-tight" style={{ fontWeight: Math.max(d.pesoTitulo, 500) }}>
                  Vamos usar a câmara
                </h3>
                <div className="mt-5 flex h-24 w-24 items-center justify-center self-center rounded-full bg-[var(--r-sup-alt)] text-[var(--r-prim)]">
                  <Camera className="h-10 w-10" />
                </div>
                <ul className="mt-5 space-y-3 text-sm leading-snug">
                  <li className="flex gap-2">
                    <Eye className="mt-0.5 h-4 w-4 shrink-0 text-[var(--r-prim)]" />
                    Serve só para medir se os olhos estão alinhados.
                  </li>
                  <li className="flex gap-2">
                    <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[var(--r-prim)]" />
                    A imagem é apagada logo a seguir. Nunca guardamos fotografias.
                  </li>
                </ul>
                <p className="mt-4 text-xs text-[var(--r-suave)]">A seguir, o telemóvel pede autorização.</p>
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={() => ir("captar")}
                  className="mt-auto flex h-14 items-center justify-center gap-2 rounded-[var(--r-raio-botao)] bg-[var(--r-prim)] text-base font-semibold text-[var(--r-sobre-prim)]"
                >
                  Permitir a câmara
                </motion.button>
                <button className="mt-2 h-11 text-sm font-semibold text-[var(--r-prim)]">Agora não</button>
              </>
            )}

            {passo === "captar" && (
              <div className="flex h-full flex-col items-center">
                <p className="self-start text-xs font-semibold uppercase tracking-wider text-[var(--r-prim)]">Passo 3 de 4</p>
                <h3 className="mt-1 self-start font-[family-name:var(--r-letra-titulo)] text-2xl leading-tight" style={{ fontWeight: Math.max(d.pesoTitulo, 500) }}>
                  Olhe para o ponto
                </h3>
                <div className="relative mt-6 flex h-64 w-48 items-center justify-center">
                  <motion.div
                    className="absolute inset-0 rounded-[50%] border-[3px] border-dashed border-[var(--r-prim)]"
                    animate={reduzido ? undefined : { scale: [1, 1.03, 1] }}
                    transition={{ duration: 2, repeat: Infinity }}
                  />
                  <motion.span
                    className="h-5 w-5 rounded-full bg-[var(--r-acento)]"
                    animate={reduzido ? undefined : { scale: [1, 1.5, 1], opacity: [1, 0.6, 1] }}
                    transition={{ duration: 1.2, repeat: Infinity }}
                  />
                </div>
                <div className="mt-6 h-2 w-full overflow-hidden rounded-full bg-[var(--r-sup-alt)]">
                  <motion.div
                    className="h-full rounded-full bg-[var(--r-prim)]"
                    initial={{ width: "0%" }}
                    animate={{ width: "100%" }}
                    transition={{ duration: 3, ease: "linear" }}
                  />
                </div>
                <p className="mt-2 text-sm text-[var(--r-suave)]">Fique quieto 3 segundos. Nada é gravado.</p>
              </div>
            )}

            {passo === "resultado" && (
              <>
                <p className="text-xs font-semibold uppercase tracking-wider text-[var(--r-prim)]">Passo 4 de 4</p>
                <h3 className="mt-1 font-[family-name:var(--r-letra-titulo)] text-2xl leading-tight" style={{ fontWeight: Math.max(d.pesoTitulo, 500) }}>
                  Vale a pena ir ao oftalmologista
                </h3>
                <p className="mt-3 text-sm leading-relaxed text-[var(--r-suave)]">
                  Encontrámos um sinal de que os olhos podem não estar alinhados. Isto não é um diagnóstico: só um médico pode
                  confirmar.
                </p>
                <div className="mt-5 rounded-[var(--r-raio)] bg-[var(--r-sup-alt)] p-4">
                  <p className="text-xs font-semibold uppercase tracking-wider text-[var(--r-suave)]">Próximo passo</p>
                  <p className="mt-1 font-semibold">Consulta na Optioptika, Luanda</p>
                  <p className="text-sm text-[var(--r-suave)]">Próxima vaga: quinta, 10:30</p>
                </div>
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  className="mt-auto flex h-14 items-center justify-center gap-2 rounded-[var(--r-raio-botao)] bg-[var(--r-prim)] text-base font-semibold text-[var(--r-sobre-prim)]"
                >
                  <CalendarCheck className="h-4 w-4" /> Marcar consulta
                </motion.button>
                <button className="mt-2 h-11 text-sm font-semibold text-[var(--r-prim)]">Guardar e decidir depois</button>
              </>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
      <div className="mt-4 flex justify-center gap-2" role="tablist" aria-label="Passos da demonstração">
        {PASSOS.map((p) => (
          <button
            key={p}
            role="tab"
            aria-selected={passo === p}
            aria-label={p}
            onClick={() => ir(p)}
            className="h-2.5 rounded-full bg-[var(--r-linha)] transition-[width] aria-selected:bg-[var(--r-prim)]"
            style={{ width: passo === p ? 28 : 10 }}
          />
        ))}
      </div>
    </div>
  );
};
