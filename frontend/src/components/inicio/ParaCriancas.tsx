import { useTranslation } from "react-i18next";
import { Gamepad2 } from "lucide-react";
import { localizar } from "@/i18n/rotas";
import { Botao } from "@/design/componentes/Botao";
import { TituloSeccao } from "@/design/componentes/TituloSeccao";
import { Contentor } from "@/design/layouts/Contentor";
import { Ligacao } from "@/design/Ligacao";

/**
 * "Para as crianças" (ESTRUTURA_SITE §5, secção 6): o jogo Inclusivamente,
 * curto. À direita, uma pergunta do jogo como imagem do produto real (não se
 * joga aqui: o botão leva ao jogo).
 */
const OPCOES = [
  ["A", "Inicio.jogoExemploA"],
  ["B", "Inicio.jogoExemploB"],
  ["C", "Inicio.jogoExemploC"],
  ["D", "Inicio.jogoExemploD"],
] as const;

export const ParaCriancas = () => {
  const { t } = useTranslation();
  return (
    <section aria-labelledby="inicio-criancas" className="bg-superficie py-16 lg:py-24">
      <Contentor className="grid items-center gap-12 lg:grid-cols-12 lg:gap-8">
        <div className="lg:col-span-6">
          <p className="text-legenda font-medium uppercase tracking-wide text-accao">{t("Inicio.jogoRotulo")}</p>
          <TituloSeccao id="inicio-criancas" className="mt-3">
            {t("Inicio.jogoTitulo")}
          </TituloSeccao>
          <p className="mt-4 max-w-xl text-corpo text-tinta-suave">{t("Inicio.jogoTexto")}</p>
          <Botao asChild className="mt-8">
            <Ligacao href={localizar("/jogo-curiosidades")}>
              <Gamepad2 /> {t("Inicio.jogoBotao")}
            </Ligacao>
          </Botao>
        </div>
        <figure
          aria-label={t("Inicio.jogoExemploRotulo")}
          className="rounded-cartao bg-superficie-alt p-6 sm:p-8 lg:col-span-5 lg:col-start-8"
        >
          <p className="text-titulo-p text-tinta">{t("Inicio.jogoExemploPergunta")}</p>
          <ul className="mt-6 grid gap-3 sm:grid-cols-2" aria-hidden>
            {OPCOES.map(([letra, chave], i) => (
              <li
                key={letra}
                className={
                  i === 0
                    ? "flex min-h-12 items-center gap-3 rounded-controlo border-2 border-sucesso bg-sucesso-suave px-4 text-corpo text-tinta"
                    : "flex min-h-12 items-center gap-3 rounded-controlo border border-linha-forte bg-superficie px-4 text-corpo text-tinta"
                }
              >
                <span className="font-medium text-tinta-suave">{letra}</span>
                {t(chave)}
              </li>
            ))}
          </ul>
        </figure>
      </Contentor>
    </section>
  );
};
