import { useTranslation } from "react-i18next";
import { TituloSeccao } from "@/design/componentes/TituloSeccao";
import { Contentor } from "@/design/layouts/Contentor";

/**
 * "Como faço?" (ESTRUTURA_SITE §5, secção 3): uma linha do tempo, não três
 * cartões. Horizontal no computador, vertical no telemóvel, com a linha a
 * ligar os passos nos dois casos.
 */
const PASSOS = [
  ["Inicio.passo1Titulo", "Inicio.passo1Texto"],
  ["Inicio.passo2Titulo", "Inicio.passo2Texto"],
  ["Inicio.passo3Titulo", "Inicio.passo3Texto"],
] as const;

export const ComoFunciona = () => {
  const { t } = useTranslation();
  return (
    <section id="como-funciona" aria-labelledby="inicio-como" className="scroll-mt-24 bg-fundo py-16 lg:py-24">
      <Contentor>
        <TituloSeccao id="inicio-como" className="max-w-2xl">
          {t("Inicio.comoTitulo")}
        </TituloSeccao>
        <ol className="relative mt-12 grid gap-10 lg:grid-cols-3 lg:gap-8">
          <span aria-hidden className="absolute left-5 top-5 hidden h-px w-2/3 bg-linha-forte lg:block" />
          {PASSOS.map(([titulo, texto], i) => (
            <li
              key={titulo}
              className="relative flex gap-5 before:absolute before:-bottom-10 before:left-5 before:top-10 before:w-px before:bg-linha-forte last:before:hidden lg:flex-col lg:before:hidden"
            >
              <span
                aria-hidden
                className="relative flex size-10 shrink-0 items-center justify-center rounded-pilula bg-accao text-corpo font-medium text-sobre-accao"
              >
                {i + 1}
              </span>
              <div>
                <h3 className="text-titulo-p text-tinta">{t(titulo)}</h3>
                <p className="mt-2 max-w-xs text-corpo text-tinta-suave">{t(texto)}</p>
              </div>
            </li>
          ))}
        </ol>
      </Contentor>
    </section>
  );
};
