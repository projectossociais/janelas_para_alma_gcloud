import { createContext, useContext, useState, type ReactNode } from "react";

/** Altura actual (px) da faixa de aviso (`SiteBanner`) -- existe só para o
 * `Navbar` (fixo, no topo) saber por quanto se deve deslocar para baixo,
 * já que os dois vivem em componentes separados e o banner pode não
 * existir, ter uma linha ou fazer wrap para duas em ecrãs estreitos.
 * Sem isto, o Navbar sobrepunha sempre o banner (ambos a competir pelo
 * mesmo `top: 0`), e como só o banner ficava em fluxo normal (não fixo),
 * desaparecia ao fazer scroll. */
interface SiteBannerCtx {
  altura: number;
  definirAltura: (altura: number) => void;
}

const Ctx = createContext<SiteBannerCtx>({ altura: 0, definirAltura: () => {} });

export const useSiteBannerAltura = () => useContext(Ctx).altura;

export const SiteBannerProvider = ({ children }: { children: ReactNode }) => {
  const [altura, definirAltura] = useState(0);
  return <Ctx.Provider value={{ altura, definirAltura }}>{children}</Ctx.Provider>;
};

export const useDefinirSiteBannerAltura = () => useContext(Ctx).definirAltura;
