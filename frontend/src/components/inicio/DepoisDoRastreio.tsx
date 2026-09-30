import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { CalendarCheck, Eye, Video } from "lucide-react";
import { localizar } from "@/i18n/rotas";
import { Botao } from "@/design/componentes/Botao";
import { TituloSeccao } from "@/design/componentes/TituloSeccao";
import { Contentor } from "@/design/layouts/Contentor";
import { Ligacao } from "@/design/Ligacao";

/**
 * "E depois?" (ESTRUTURA_SITE §5, secção 4): as duas saídas lado a lado, com o
 * preço dito às claras (NN/g, confiança: transparência logo à cabeça).
 */
const Saida = ({
  icone,
  titulo,
  texto,
  factos,
  accao,
}: {
  icone: ReactNode;
  titulo: string;
  texto: string;
  factos: [string, ReactNode][];
  accao: ReactNode;
}) => (
  <article className="flex flex-col rounded-cartao bg-superficie p-6 shadow-nivel-1 sm:p-8">
    <span className="text-accao [&_svg]:size-8" aria-hidden>
      {icone}
    </span>
    <h3 className="mt-6 text-titulo-m text-tinta">{titulo}</h3>
    <p className="mt-3 text-corpo text-tinta-suave">{texto}</p>
    <dl className="mt-6 grid grid-cols-2 gap-4 border-t border-linha pt-6 text-legenda">
      {factos.map(([rotulo, valor]) => (
        <div key={rotulo}>
          <dt className="text-tinta-suave">{rotulo}</dt>
          <dd className="mt-1 font-medium text-tinta">{valor}</dd>
        </div>
      ))}
    </dl>
    <div className="mt-auto pt-8">{accao}</div>
  </article>
);

export const DepoisDoRastreio = () => {
  const { t } = useTranslation();
  return (
    <section aria-labelledby="inicio-depois" className="bg-superficie-alt py-16 lg:py-24">
      <Contentor>
        <TituloSeccao id="inicio-depois">{t("Inicio.depoisTitulo")}</TituloSeccao>
        <div className="mt-10 grid gap-6 md:grid-cols-2">
          <Saida
            icone={<CalendarCheck />}
            titulo={t("Inicio.consultaTitulo")}
            texto={t("Inicio.consultaTexto")}
            factos={[
              [t("Inicio.consultaClinicaRotulo"), t("Inicio.consultaClinica")],
              [
                t("Inicio.consultaComoRotulo"),
                <span key="como" className="inline-flex items-center gap-1.5">
                  <Video className="size-4" aria-hidden /> {t("Inicio.consultaComo")}
                </span>,
              ],
            ]}
            accao={
              <Botao asChild variante="secundario">
                <Ligacao href={localizar("/marcar-consulta")}>{t("Inicio.consultaBotao")}</Ligacao>
              </Botao>
            }
          />
          <Saida
            icone={<Eye />}
            titulo={t("Inicio.treinosTitulo")}
            texto={t("Inicio.treinosTexto")}
            factos={[
              [t("Inicio.treinosExperimentarRotulo"), t("Inicio.treinosExperimentar")],
              [t("Inicio.treinosDepoisRotulo"), t("Inicio.treinosPreco")],
            ]}
            accao={
              <Botao asChild variante="secundario">
                <Ligacao href={localizar("/exercicios")}>{t("Inicio.treinosBotao")}</Ligacao>
              </Botao>
            }
          />
        </div>
      </Contentor>
    </section>
  );
};
