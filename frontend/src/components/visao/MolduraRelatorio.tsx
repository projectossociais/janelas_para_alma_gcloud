import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Printer } from "lucide-react";
import { Botao } from "@/design/componentes/Botao";
import { Contentor, SaltarConteudo } from "@/design/layouts/Contentor";

/**
 * A página à volta de um relatório (o semanal da família e o que o médico abre):
 * uma barra fina em cima, com o que se faz à folha (voltar, imprimir), e a folha
 * por baixo. A barra e tudo o que não é a folha **não saem no papel**
 * (`print:hidden`); a folha é a de sempre (`FolhaRelatorio`, CLAUDE.md §6,
 * "layout de relatório, não de folheto").
 */
export const MolduraRelatorio = ({
  esquerda,
  podeImprimir = true,
  antesDaFolha,
  children,
}: {
  /** O que fica à esquerda da barra (voltar, ou o símbolo e a validade do link). */
  esquerda: ReactNode;
  podeImprimir?: boolean;
  /** Conteúdo do ecrã que não é do relatório (ex.: partilhar com o médico); nunca se imprime. */
  antesDaFolha?: ReactNode;
  children: ReactNode;
}) => {
  const { t } = useTranslation();
  return (
    <div className="min-h-screen bg-fundo text-corpo text-tinta print:min-h-0 print:bg-white">
      <div className="print:hidden">
        <SaltarConteudo rotulo={t("Visao.saltarParaRelatorio")} />
      </div>
      <header className="border-b border-linha bg-superficie print:hidden">
        <Contentor largura="texto" className="flex min-h-16 flex-wrap items-center justify-between gap-3 py-2">
          <div className="flex min-w-0 items-center gap-3">{esquerda}</div>
          <Botao onClick={() => window.print()} disabled={!podeImprimir}>
            <Printer aria-hidden /> {t("Visao.imprimir")}
          </Botao>
        </Contentor>
      </header>
      <main id="conteudo" tabIndex={-1} className="outline-none">
        <Contentor largura="texto" className="py-8 print:max-w-none print:p-0">
          {antesDaFolha && <div className="mb-8 print:hidden">{antesDaFolha}</div>}
          {children}
        </Contentor>
      </main>
    </div>
  );
};
