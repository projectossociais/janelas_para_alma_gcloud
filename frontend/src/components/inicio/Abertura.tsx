import { forwardRef } from "react";
import { Trans, useTranslation } from "react-i18next";
import { ArrowDown, ArrowRight, Camera, Eye, ShieldCheck } from "lucide-react";
import { localizar } from "@/i18n/rotas";
import { Botao } from "@/design/componentes/Botao";
import { Contentor } from "@/design/layouts/Contentor";
import { Ligacao } from "@/design/Ligacao";

/**
 * Abertura da página inicial (docs/ESTRUTURA_SITE.md §5, secção 1): o resultado
 * para o pai no título, três factos, uma acção principal. À direita, o
 * produto real (um ecrã do rastreio), não uma fotografia de banco.
 */
const TelemovelRastreio = () => {
  const { t } = useTranslation();
  return (
    <figure
      aria-label={t("Inicio.telemovelRotulo")}
      className="mx-auto w-full max-w-72 rounded-cartao border-8 border-tinta bg-superficie p-5 shadow-nivel-2 lg:max-w-80"
    >
      <p className="text-legenda font-medium text-tinta-suave">{t("Inicio.telemovelPasso")}</p>
      <div className="mt-2 flex gap-1" aria-hidden>
        <span className="h-1 flex-1 rounded-pilula bg-accao" />
        <span className="h-1 flex-1 rounded-pilula bg-accao" />
        <span className="h-1 flex-1 rounded-pilula bg-linha" />
        <span className="h-1 flex-1 rounded-pilula bg-linha" />
      </div>
      <p className="mt-5 text-titulo-p text-tinta">{t("Inicio.telemovelTitulo")}</p>
      <div className="mt-5 flex size-16 items-center justify-center rounded-pilula bg-accao-suave text-accao" aria-hidden>
        <Camera className="size-8" />
      </div>
      <ul className="mt-5 flex flex-col gap-3 text-legenda text-tinta-suave">
        <li className="flex gap-2">
          <Eye className="size-4 shrink-0 text-accao" aria-hidden /> {t("Inicio.telemovelPonto1")}
        </li>
        <li className="flex gap-2">
          <ShieldCheck className="size-4 shrink-0 text-accao" aria-hidden /> {t("Inicio.telemovelPonto2")}
        </li>
      </ul>
      {/* É uma imagem do produto, não um botão: não se pode carregar aqui. */}
      <span
        aria-hidden
        className="mt-6 flex min-h-12 items-center justify-center rounded-controlo bg-accao text-corpo font-medium text-sobre-accao"
      >
        {t("Inicio.telemovelBotao")}
      </span>
    </figure>
  );
};

export const Abertura = forwardRef<HTMLElement>((_, ref) => {
  const { t } = useTranslation();
  return (
    <section ref={ref} aria-labelledby="inicio-titulo" className="relative bg-fundo">
      <Contentor className="grid items-center gap-12 pb-16 pt-10 lg:grid-cols-12 lg:gap-8 lg:pb-0 lg:pt-20">
        <div className="lg:col-span-7 lg:pb-24">
          <h1 id="inicio-titulo" className="text-abertura text-tinta">
            <Trans
              i18nKey="Inicio.titulo"
              components={{ destaque: <span className="whitespace-nowrap text-destaque" /> }}
            />
          </h1>
          <p className="mt-6 max-w-xl text-corpo-g text-tinta-suave">{t("Inicio.subtitulo")}</p>
          <div className="mt-10 flex flex-wrap items-center gap-3">
            <Botao asChild tamanho="g">
              <Ligacao href={localizar("/scanner")}>
                {t("Inicio.fazerRastreio")} <ArrowRight />
              </Ligacao>
            </Botao>
            <Botao asChild variante="fantasma" tamanho="g">
              <a href="#como-funciona">
                {t("Inicio.comoFunciona")} <ArrowDown />
              </a>
            </Botao>
          </div>
        </div>
        <div className="lg:col-span-5 lg:translate-y-16">
          <TelemovelRastreio />
        </div>
      </Contentor>
    </section>
  );
});
Abertura.displayName = "Abertura";
