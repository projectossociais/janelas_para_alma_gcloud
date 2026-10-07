import { useTranslation } from "react-i18next";
import { ArrowRight, Plus } from "lucide-react";
import { localizar } from "@/i18n/rotas";
import { Botao } from "@/design/componentes/Botao";
import { TituloSeccao } from "@/design/componentes/TituloSeccao";
import { Contentor } from "@/design/layouts/Contentor";
import { Ligacao } from "@/design/Ligacao";
import { Simbolo } from "@/design/marca/Simbolo";

/**
 * Apoiar (ESTRUTURA_SITE §5, secção 7): o doador tem o seu lugar, sem disputar
 * a abertura com o pai que chega preocupado.
 */
export const Apoiar = () => {
  const { t } = useTranslation();
  return (
    <section aria-labelledby="inicio-apoiar" className="bg-fundo py-16 lg:py-24">
      <Contentor className="grid items-center gap-10 lg:grid-cols-12">
        <div className="w-32 lg:col-span-3 lg:w-40">
          <Simbolo fundo="claro" />
        </div>
        <div className="lg:col-span-7 lg:col-start-5">
          <TituloSeccao id="inicio-apoiar">{t("Inicio.apoiarTitulo")}</TituloSeccao>
          <p className="mt-4 max-w-xl text-corpo text-tinta-suave">{t("Inicio.apoiarTexto")}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Botao asChild variante="secundario">
              <Ligacao href={localizar("/apoiar")}>{t("Inicio.apoiarDoar")}</Ligacao>
            </Botao>
            <Botao asChild variante="fantasma">
              <Ligacao href={localizar("/kamba")}>{t("Inicio.apoiarVoluntario")}</Ligacao>
            </Botao>
          </div>
        </div>
      </Contentor>
    </section>
  );
};

/**
 * Perguntas rápidas (ESTRUTURA_SITE §5, secção 8): as dúvidas que travam,
 * respondidas sem sair da página. `<details>` nativo: teclado e leitores de
 * ecrã funcionam sem JavaScript.
 */
const PERGUNTAS = [
  ["Inicio.pergunta1", "Inicio.resposta1"],
  ["Inicio.pergunta2", "Inicio.resposta2"],
  ["Inicio.pergunta3", "Inicio.resposta3"],
  ["Inicio.pergunta4", "Inicio.resposta4"],
] as const;

export const PerguntasRapidas = () => {
  const { t } = useTranslation();
  return (
    <section aria-labelledby="inicio-perguntas" className="border-t border-linha bg-superficie py-16 lg:py-24">
      <Contentor largura="texto">
        <TituloSeccao id="inicio-perguntas">{t("Inicio.perguntasTitulo")}</TituloSeccao>
        <div className="mt-8 divide-y divide-linha border-y border-linha">
          {PERGUNTAS.map(([pergunta, resposta]) => (
            <details key={pergunta} className="group">
              <summary className="flex min-h-16 cursor-pointer list-none items-center justify-between gap-4 rounded-controlo text-corpo-g font-medium text-tinta focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foco [&::-webkit-details-marker]:hidden">
                {t(pergunta)}
                <Plus
                  aria-hidden
                  className="size-5 shrink-0 text-accao transition-transform duration-transicao group-open:rotate-45 motion-reduce:transition-none"
                />
              </summary>
              <p className="pb-6 text-corpo text-tinta-suave">{t(resposta)}</p>
            </details>
          ))}
        </div>
        <Ligacao
          href={localizar("/faq")}
          className="mt-8 inline-flex min-h-alvo-app items-center gap-2 rounded-controlo font-medium text-accao underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foco"
        >
          {t("Inicio.perguntasTodas")} <ArrowRight className="size-5" aria-hidden />
        </Ligacao>
      </Contentor>
    </section>
  );
};
