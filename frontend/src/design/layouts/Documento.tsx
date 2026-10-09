import { useEffect, useState, type ReactNode } from "react";
import { cn } from "../cn";
import { Contentor } from "./Contentor";

/**
 * Arquétipo Documento (docs/LAYOUTS.md §2.6): Política, Termos, artigos. Ler
 * com atenção -- coluna de leitura (~65 caracteres), texto com entrelinha
 * generosa, títulos numerados (o número vem no próprio título) e, no
 * computador, um índice fixo à esquerda que marca a secção que se está a ler.
 * Sem ícones nem caixas: é um documento, não um folheto.
 *
 * Vive dentro da estrutura do site (cabeçalho e rodapé do `EstruturaSite`).
 */
export interface SeccaoDocumento {
  id: string;
  titulo: string;
  corpo: ReactNode;
}

export const Documento = ({
  titulo,
  introducao,
  nota,
  seccoes,
  rotuloIndice,
  rodape,
}: {
  titulo: string;
  introducao?: ReactNode;
  /** Ex.: a nota de que a tradução não é vinculativa. */
  nota?: ReactNode;
  seccoes: SeccaoDocumento[];
  /** Nome da navegação do índice (ex.: "Nesta página"). */
  rotuloIndice: string;
  /** Ex.: "Última actualização: ...". */
  rodape?: ReactNode;
}) => {
  const [actual, setActual] = useState<string | null>(seccoes[0]?.id ?? null);

  // O índice acompanha a leitura: marca a última secção cujo título já passou o topo.
  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    const visiveis = new Map<string, boolean>();
    const observador = new IntersectionObserver(
      (entradas) => {
        for (const e of entradas) visiveis.set(e.target.id, e.isIntersecting);
        const primeira = seccoes.find((s) => visiveis.get(s.id));
        if (primeira) setActual(primeira.id);
      },
      { rootMargin: "-80px 0px -60% 0px" },
    );
    for (const s of seccoes) {
      const el = document.getElementById(s.id);
      if (el) observador.observe(el);
    }
    return () => observador.disconnect();
  }, [seccoes]);

  return (
    <Contentor className="py-12 lg:py-16">
      <div className="lg:grid lg:grid-cols-[16rem_minmax(0,1fr)] lg:gap-12">
        <nav aria-label={rotuloIndice} className="hidden lg:block">
          <div className="sticky top-24">
            <p className="text-legenda font-medium text-tinta-suave">{rotuloIndice}</p>
            <ol className="mt-3 space-y-1 border-l border-linha">
              {seccoes.map((s) => (
                <li key={s.id}>
                  <a
                    href={`#${s.id}`}
                    aria-current={actual === s.id ? "location" : undefined}
                    className={cn(
                      "-ml-px block border-l-2 border-transparent py-1 pl-3 text-legenda text-tinta-suave",
                      "transition-colors duration-feedback hover:text-tinta",
                      "focus-visible:outline focus-visible:outline-2 focus-visible:outline-foco",
                      "aria-[current=location]:border-accao aria-[current=location]:font-medium aria-[current=location]:text-tinta",
                    )}
                  >
                    {s.titulo}
                  </a>
                </li>
              ))}
            </ol>
          </div>
        </nav>

        <article className="max-w-prose">
          <header>
            <h1 className="text-titulo-g text-tinta">{titulo}</h1>
            {introducao && <p className="mt-4 text-corpo-g text-tinta-suave">{introducao}</p>}
            {nota && <div className="mt-4">{nota}</div>}
          </header>

          <div className="mt-10 space-y-10 text-corpo leading-relaxed text-tinta [&_a]:font-medium [&_a]:text-accao [&_a]:underline [&_a]:underline-offset-2 [&_li]:mt-1.5 [&_p+p]:mt-3 [&_strong]:font-medium [&_ul]:mt-3 [&_ul]:list-disc [&_ul]:pl-5">
            {seccoes.map((s) => (
              <section key={s.id} id={s.id} aria-labelledby={`${s.id}-titulo`} className="scroll-mt-24">
                <h2 id={`${s.id}-titulo`} className="text-titulo-p text-tinta">
                  {s.titulo}
                </h2>
                <div className="mt-3">{s.corpo}</div>
              </section>
            ))}
          </div>

          {/* Um <p>, não <footer>: o rodapé da página é o do site, e há quem leia um <footer> como tal. */}
          {rodape && <p className="mt-12 border-t border-linha pt-6 text-legenda text-tinta-suave">{rodape}</p>}
        </article>
      </div>
    </Contentor>
  );
};
