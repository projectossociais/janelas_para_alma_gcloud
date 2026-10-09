import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { ChevronDown } from "lucide-react";
import { Trans, useTranslation } from "react-i18next";
import { Contentor } from "@/design/layouts/Contentor";
import i18n from "@/i18n";
import { localizar } from "@/i18n/rotas";

interface FaqItem {
  pergunta: string;
  resposta: ReactNode;
}

const ligacao = (rota: string) => <Link to={localizar(rota)} />;

// Para acrescentar uma pergunta: um novo objecto aqui, com o mesmo formato.
const FAQ_ITEMS: FaqItem[] = [
  {
    get pergunta() {
      return i18n.t("Faq.osMeusDadosDe");
    },
    get resposta() {
      return <Trans i18nKey="Faq.simOsDadosDe" components={{ ligacao: ligacao("/politica-de-privacidade") }} />;
    },
  },
  {
    get pergunta() {
      return i18n.t("Faq.possoApagarAMinha");
    },
    get resposta() {
      return <Trans i18nKey="Faq.simAQualquerMomento" components={{ ligacao: ligacao("/politica-de-privacidade") }} />;
    },
  },
  {
    get pergunta() {
      return i18n.t("Faq.oResultadoDaTriagem");
    },
    get resposta() {
      return <Trans i18nKey="Faq.naoORastreioDigital" components={{ ligacao: ligacao("/termos-de-utilizacao") }} />;
    },
  },
  {
    get pergunta() {
      return i18n.t("Faq.aPlataformaPartilhaOs");
    },
    get resposta() {
      return <Trans i18nKey="Faq.soQuandoOUtilizador" components={{ ligacao: ligacao("/politica-de-privacidade") }} />;
    },
  },
  {
    get pergunta() {
      return i18n.t("Faq.oSiteUtilizaCookies");
    },
    get resposta() {
      return <Trans i18nKey="Faq.utilizamosApenasCookiesTecnicos" components={{ ligacao: ligacao("/politica-de-privacidade") }} />;
    },
  },
];

/**
 * Perguntas frequentes com o elemento nativo `<details>`: abre e fecha sem
 * JavaScript, com teclado e leitor de ecrã de série, e o texto encontra-se com
 * a pesquisa do navegador (Ctrl+F abre a resposta).
 */
const Faq = () => {
  const { t } = useTranslation();
  return (
    <Contentor className="py-12 lg:py-16">
      <div className="max-w-3xl">
        <h1 className="text-titulo-g text-tinta">{t("Faq.perguntasFrequentes")}</h1>
        <p className="mt-4 text-corpo-g text-tinta-suave">{t("Faq.respostasRapidasSobrePrivacidade")}</p>

        <div className="mt-10 divide-y divide-linha border-y border-linha">
          {FAQ_ITEMS.map((item, i) => (
            <details key={item.pergunta} open={i === 0} className="group">
              <summary
                className="flex min-h-alvo-app cursor-pointer list-none items-center justify-between gap-4 py-5 text-corpo-g font-medium text-tinta focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foco [&::-webkit-details-marker]:hidden"
              >
                {item.pergunta}
                <ChevronDown className="size-5 shrink-0 text-tinta-suave transition-transform duration-transicao group-open:rotate-180 motion-reduce:transition-none" aria-hidden />
              </summary>
              <div className="pb-6 text-corpo leading-relaxed text-tinta-suave [&_a]:font-medium [&_a]:text-accao [&_a]:underline [&_a]:underline-offset-2">
                {item.resposta}
              </div>
            </details>
          ))}
        </div>

        <p className="mt-8 text-corpo text-tinta-suave [&_a]:font-medium [&_a]:text-accao [&_a]:underline [&_a]:underline-offset-2">
          <Trans i18nKey="Faq.naoEncontrouAResposta" components={{ a: <a href="mailto:janelasparaalma18@gmail.com" /> }} />
        </p>
      </div>
    </Contentor>
  );
};

export default Faq;
