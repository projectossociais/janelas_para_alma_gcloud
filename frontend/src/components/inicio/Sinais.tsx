import { useTranslation } from "react-i18next";
import { ArrowRight } from "lucide-react";
import { localizar } from "@/i18n/rotas";
import { TituloSeccao } from "@/design/componentes/TituloSeccao";
import { Contentor } from "@/design/layouts/Contentor";
import { Ligacao } from "@/design/Ligacao";

/**
 * "É para o meu filho?" (ESTRUTURA_SITE §5, secção 2): sinais do dia a dia,
 * numa lista editorial numerada, com o título fixo à esquerda no computador.
 */
// Chaves escritas por inteiro, para aparecerem numa pesquisa pelo nome.
const SINAIS = [
  ["Inicio.sinal1Titulo", "Inicio.sinal1Texto"],
  ["Inicio.sinal2Titulo", "Inicio.sinal2Texto"],
  ["Inicio.sinal3Titulo", "Inicio.sinal3Texto"],
  ["Inicio.sinal4Titulo", "Inicio.sinal4Texto"],
  ["Inicio.sinal5Titulo", "Inicio.sinal5Texto"],
] as const;

export const Sinais = () => {
  const { t } = useTranslation();
  return (
    <section aria-labelledby="inicio-sinais" className="border-t border-linha bg-superficie py-16 lg:py-24">
      <Contentor className="grid gap-10 lg:grid-cols-12 lg:gap-8">
        <div className="lg:col-span-4">
          <div className="lg:sticky lg:top-28">
            <TituloSeccao id="inicio-sinais">{t("Inicio.sinaisTitulo")}</TituloSeccao>
            <p className="mt-4 text-corpo text-tinta-suave">{t("Inicio.sinaisTexto")}</p>
            <Ligacao
              href={localizar("/sobre")}
              className="mt-6 inline-flex min-h-alvo-app items-center gap-2 rounded-controlo font-medium text-accao underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foco"
            >
              {t("Inicio.sinaisLigacao")} <ArrowRight className="size-5" aria-hidden />
            </Ligacao>
          </div>
        </div>
        <ol className="lg:col-span-7 lg:col-start-6">
          {SINAIS.map(([titulo, texto], i) => (
            <li key={titulo} className="flex gap-6 border-b border-linha py-6 first:pt-0 last:border-0">
              <span className="text-titulo-m text-destaque" aria-hidden>
                {String(i + 1).padStart(2, "0")}
              </span>
              <div>
                <h3 className="text-titulo-p text-tinta">{t(titulo)}</h3>
                <p className="mt-1 text-corpo text-tinta-suave">{t(texto)}</p>
              </div>
            </li>
          ))}
        </ol>
      </Contentor>
    </section>
  );
};
