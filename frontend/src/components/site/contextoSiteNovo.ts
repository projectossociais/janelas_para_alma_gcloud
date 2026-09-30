import { createContext, useContext } from "react";

/**
 * Transição do redesenho: diz a uma página antiga que está dentro do
 * `EstruturaSite` (cabeçalho e rodapé novos). O `Navbar`, o `Footer` e o
 * `BackButton` antigos consultam isto para não se desenharem em duplicado nem
 * compensarem um cabeçalho fixo que já não existe. Sai quando todas as páginas
 * públicas estiverem redesenhadas.
 */
export const ContextoSiteNovo = createContext(false);
export const useDentroDoSiteNovo = () => useContext(ContextoSiteNovo);
