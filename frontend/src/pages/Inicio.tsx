import { useRef } from "react";
import { useTranslation } from "react-i18next";
import { ArrowRight } from "lucide-react";
import { localizar } from "@/i18n/rotas";
import { Botao } from "@/design/componentes/Botao";
import { Ligacao } from "@/design/Ligacao";
import { useForaDoEcra } from "@/design/useForaDoEcra";
import { EstruturaSite } from "@/components/site/EstruturaSite";
import { Abertura } from "@/components/inicio/Abertura";
import { Sinais } from "@/components/inicio/Sinais";
import { ComoFunciona } from "@/components/inicio/ComoFunciona";
import { CampanhaDestaque } from "@/components/inicio/CampanhaDestaque";
import { DepoisDoRastreio } from "@/components/inicio/DepoisDoRastreio";
import { PorqueConfiar } from "@/components/inicio/PorqueConfiar";
import { ParaCriancas } from "@/components/inicio/ParaCriancas";
import { Apoiar, PerguntasRapidas } from "@/components/inicio/ApoiarEPerguntas";

/**
 * Página inicial do site novo (Sprint 7; docs/ESTRUTURA_SITE.md §5). Serve o
 * pai que chega preocupado: cada secção responde a uma pergunta dele, pela
 * ordem em que a faz. Substitui `Index.tsx`.
 *
 * No telemóvel, a barra "Fazer o rastreio grátis" aparece quando a abertura
 * (que já tem esse botão) sai do ecrã.
 */
const Inicio = () => {
  const { t } = useTranslation();
  const abertura = useRef<HTMLElement>(null);
  const passouAbertura = useForaDoEcra(abertura);

  return (
    <EstruturaSite
      barraVisivel={passouAbertura}
      barraMovel={
        <Botao asChild tamanho="g" larguraTotal>
          <Ligacao href={localizar("/scanner")}>
            {t("Inicio.barraMovel")} <ArrowRight />
          </Ligacao>
        </Botao>
      }
    >
      <Abertura ref={abertura} />
      <Sinais />
      <ComoFunciona />
      <CampanhaDestaque />
      <DepoisDoRastreio />
      <PorqueConfiar />
      <ParaCriancas />
      <Apoiar />
      <PerguntasRapidas />
    </EstruturaSite>
  );
};

export default Inicio;
