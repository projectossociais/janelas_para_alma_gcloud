import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";
import { cn } from "../cn";

/**
 * Carrossel acessível (padrão WAI-ARIA "Carousel"), decidido pelo dono do projecto
 * a 2026-10-05 para os parceiros da página inicial, contra a regra inicial de não
 * ter carrosséis (docs/PESQUISA_UX.md §2). Por isso tem tudo o que essa regra
 * temia, resolvido:
 *
 * - passa sozinho (`intervaloMs`), mas **pode ser parado** (botão; WCAG 2.2.2);
 * - pára sozinho enquanto a pessoa lhe toca, passa o rato ou usa o teclado lá
 *   dentro, e quando está fora do ecrã;
 * - **não se mexe** com "reduzir movimento" ligado no sistema;
 * - dá para deslizar com o dedo (é uma faixa com encaixe, não uma animação);
 * - onde tudo cabe de uma vez, não há nada para passar: sem setas nem pausa.
 */
export interface CarrosselProps {
  itens: readonly ReactNode[];
  /** Nome da região (ex.: "Parceiros"). */
  rotulo: string;
  /** `parar`/`retomar` só são precisos com `comPausa`. */
  textos: { anterior: string; seguinte: string; parar?: string; retomar?: string };
  intervaloMs?: number;
  /**
   * Botão visível para parar a passagem (WCAG 2.2.2). Ligado por omissão. Os
   * parceiros desligam-no por decisão do dono do projecto (2026-10-05): continua a
   * parar ao tocar, ao passar o rato, com o teclado e com "reduzir movimento".
   */
  comPausa?: boolean;
  className?: string;
}

const movimentoReduzido = () =>
  typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export const Carrossel = ({ itens, rotulo, textos, intervaloMs = 3000, comPausa = true, className }: CarrosselProps) => {
  const faixa = useRef<HTMLUListElement>(null);
  const [transborda, setTransborda] = useState(false);
  const [paradoPeloUtilizador, setParadoPeloUtilizador] = useState(false);
  const [emUso, setEmUso] = useState(false);
  const [visivel, setVisivel] = useState(true);
  const [reduzido] = useState(movimentoReduzido);

  // Há mais itens do que cabem? Mede-se ao montar e quando muda o tamanho.
  useEffect(() => {
    const el = faixa.current;
    if (!el) return;
    const medir = () => setTransborda(el.scrollWidth > el.clientWidth + 1);
    medir();
    if (typeof ResizeObserver === "undefined") return;
    const observador = new ResizeObserver(medir);
    observador.observe(el);
    return () => observador.disconnect();
  }, [itens.length]);

  // Fora do ecrã não se mexe (ninguém o está a ver).
  useEffect(() => {
    const el = faixa.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const observador = new IntersectionObserver(([e]) => setVisivel(!!e?.isIntersecting));
    observador.observe(el);
    return () => observador.disconnect();
  }, []);

  /** Passo de um item: a largura do primeiro item mais o espaço entre itens. */
  const passo = () => {
    const el = faixa.current;
    const primeiro = el?.firstElementChild as HTMLElement | null;
    if (!el || !primeiro) return 0;
    const espaco = parseFloat(getComputedStyle(el).columnGap || "0") || 0;
    return primeiro.offsetWidth + espaco;
  };

  const mover = useCallback((sentido: 1 | -1) => {
    const el = faixa.current;
    if (!el) return;
    const fim = el.scrollWidth - el.clientWidth;
    const p = passo();
    // Dá a volta: depois do último volta ao primeiro, e antes do primeiro vai ao último.
    let alvo = el.scrollLeft + sentido * p;
    if (sentido === 1 && el.scrollLeft >= fim - 1) alvo = 0;
    else if (sentido === -1 && el.scrollLeft <= 1) alvo = fim;
    el.scrollTo({ left: Math.max(0, Math.min(fim, alvo)), behavior: reduzido ? "auto" : "smooth" });
  }, [reduzido]);

  const automatico = transborda && !reduzido && !paradoPeloUtilizador;
  const aPassar = automatico && !emUso && visivel;
  useEffect(() => {
    if (!aPassar) return;
    const id = window.setInterval(() => mover(1), intervaloMs);
    return () => window.clearInterval(id);
  }, [aPassar, intervaloMs, mover]);

  const botao =
    "flex min-h-alvo-app min-w-alvo-app items-center justify-center rounded-pilula border border-linha-forte text-tinta " +
    "transition-colors duration-feedback hover:bg-superficie-alt " +
    "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foco [&_svg]:size-5";

  return (
    <section
      aria-roledescription="carrossel"
      aria-label={rotulo}
      // `min-w-0`: sem isto, numa grelha ou flex, a faixa estica o pai à largura de
      // todos os itens e a página inteira passa a deslizar para o lado.
      // O pai, se for item de grelha, também precisa de `min-w-0`.
      className={cn("min-w-0", className)}
      onPointerEnter={() => setEmUso(true)}
      onPointerLeave={() => setEmUso(false)}
      onFocus={() => setEmUso(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setEmUso(false);
      }}
      onTouchStart={() => setEmUso(true)}
      onTouchEnd={() => setEmUso(false)}
    >
      <ul
        ref={faixa}
        // Enquanto passa sozinho, não se anuncia cada mudança (seria ruído).
        aria-live={aPassar ? "off" : "polite"}
        className="flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-smooth pb-2 motion-reduce:scroll-auto"
      >
        {itens.map((item, i) => (
          <li key={i} className="shrink-0 snap-start">
            {item}
          </li>
        ))}
      </ul>
      {transborda && (
        <div className="mt-4 flex items-center gap-2">
          <button type="button" className={botao} aria-label={textos.anterior} onClick={() => mover(-1)}>
            <ChevronLeft aria-hidden />
          </button>
          <button type="button" className={botao} aria-label={textos.seguinte} onClick={() => mover(1)}>
            <ChevronRight aria-hidden />
          </button>
          {comPausa && !reduzido && (
            <button
              type="button"
              className={cn(botao, "ml-auto")}
              aria-label={paradoPeloUtilizador ? textos.retomar : textos.parar}
              onClick={() => setParadoPeloUtilizador((p) => !p)}
            >
              {paradoPeloUtilizador ? <Play aria-hidden /> : <Pause aria-hidden />}
            </button>
          )}
        </div>
      )}
    </section>
  );
};
