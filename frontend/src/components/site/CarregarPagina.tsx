import { useTranslation } from "react-i18next";
import { useAtraso } from "@/design/useAtraso";

/**
 * Enquanto chega o ficheiro de uma página (divisão por rotas). Nada durante os
 * primeiros 400 ms, que é o normal numa ligação boa: um aviso que aparece e
 * desaparece logo é só um piscar (docs/PESQUISA_UX.md §3). Numa ligação lenta,
 * diz o que está a acontecer.
 */
export const CarregarPagina = () => {
  const { t } = useTranslation();
  const mostrar = useAtraso(true, 400);
  return (
    <div role="status" className="flex min-h-screen items-center justify-center bg-fundo p-6">
      {mostrar && <p className="text-corpo text-tinta-suave">{t("SiteNovo.aCarregarPagina")}</p>}
    </div>
  );
};
