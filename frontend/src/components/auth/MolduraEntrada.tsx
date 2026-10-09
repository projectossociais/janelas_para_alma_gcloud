import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { LigacaoRouter } from "@/components/site/LigacaoRouter";
import { ProvedorLigacao } from "@/design/Ligacao";
import { LayoutEntrada } from "@/design/layouts/LayoutEntrada";
import logotipo from "@/design/marca/logotipo-horizontal-negativo-sem-assinatura.svg";
import { localizar } from "@/i18n/rotas";

/**
 * A moldura das páginas de entrada que não são o formulário de entrar (confirmar
 * o email, definir nova password): o mesmo painel da marca e os mesmos factos
 * de `Auth.tsx`, para os passos da conta parecerem um só percurso.
 */
export const MolduraEntrada = ({ children }: { children: ReactNode }) => {
  const { t } = useTranslation();
  const inicio = localizar("/");
  return (
    <ProvedorLigacao componente={LigacaoRouter}>
      <LayoutEntrada
        logotipo={<img src={logotipo} alt="" />}
        inicio={{ href: inicio, rotulo: t("Auth.inicio") }}
        voltar={{ href: inicio, rotulo: t("Auth.voltarAoSite") }}
        frase={t("Auth.frase")}
        factos={[t("Auth.facto1"), t("Auth.facto2"), t("Auth.facto3")]}
        textoSaltar={t("Auth.saltar")}
      >
        {children}
      </LayoutEntrada>
    </ProvedorLigacao>
  );
};
