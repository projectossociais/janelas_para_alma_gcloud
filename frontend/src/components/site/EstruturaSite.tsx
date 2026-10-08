import type { ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Instagram, Mail, Phone } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { localizar } from "@/i18n/rotas";
import { LayoutSite } from "@/design/layouts/LayoutSite";
import { Ligacao, ProvedorLigacao } from "@/design/Ligacao";
import type { Destino } from "@/design/navegacao/tipos";
import logotipo from "@/design/marca/logotipo-horizontal-sem-assinatura.svg";
import logotipoCompleto from "@/design/marca/logotipo-horizontal.svg";
import { AlternarIdioma } from "./AlternarIdioma";
import { ContextoSiteNovo } from "./contextoSiteNovo";
import { LigacaoRouter } from "./LigacaoRouter";

/**
 * O arquétipo Site ligado ao site real (docs/LAYOUTS.md §2.1;
 * docs/ESTRUTURA_SITE.md §3 e §6): rotas bilingues (`localizar`), sessão,
 * idioma e contactos reais. Cada página migrada do site passa a usar esta
 * estrutura. As páginas públicas ainda por redesenhar também vivem aqui, por
 * transição (`PAGINAS_SITE` em `App.tsx`): o `Navbar`/`Footer` antigos
 * apagam-se lá dentro (`contextoSiteNovo.ts`).
 */

// Contactos reais da instituição (site actual, 2026-09-30). Não há NIF.
const TELEFONE = "+244 926 969 819";
const EMAIL = "janelasparaalma18@gmail.com";
const INSTAGRAM = "https://www.instagram.com/janelas_para_alma";

const logo = (src: string) => <img src={src} alt="" />;

export interface EstruturaSiteProps {
  children: ReactNode;
  barraMovel?: ReactNode;
  barraVisivel?: boolean;
}

export const EstruturaSite = ({ children, barraMovel, barraVisivel }: EstruturaSiteProps) => {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const { isLoggedIn } = useAuth();

  const em = (caminhoPt: string) => localizar(caminhoPt);
  const activo = (caminhoPt: string) => pathname === em(caminhoPt);

  const destinos: Destino[] = [
    { rotulo: t("SiteNovo.rastreio"), href: em("/scanner"), activo: activo("/scanner") },
    { rotulo: t("SiteNovo.treinos"), href: em("/exercicios"), activo: activo("/exercicios") },
    { rotulo: t("SiteNovo.clinicas"), href: em("/parceiros"), activo: activo("/parceiros") },
    {
      rotulo: t("SiteNovo.comunidade"),
      href: em("/kamba"),
      filhos: [
        { rotulo: t("SiteNovo.kamba"), descricao: t("SiteNovo.kambaDescricao"), href: em("/kamba"), activo: activo("/kamba") },
        { rotulo: t("SiteNovo.doar"), descricao: t("SiteNovo.doarDescricao"), href: em("/apoiar"), activo: activo("/apoiar") },
        { rotulo: t("SiteNovo.oculos"), descricao: t("SiteNovo.oculosDescricao"), href: em("/circular"), activo: activo("/circular") },
      ],
    },
    {
      rotulo: t("SiteNovo.sobre"),
      href: em("/impacto"),
      filhos: [
        { rotulo: t("SiteNovo.quemSomos"), descricao: t("SiteNovo.quemSomosDescricao"), href: em("/impacto"), activo: activo("/impacto") },
        { rotulo: t("SiteNovo.estrabismo"), descricao: t("SiteNovo.estrabismoDescricao"), href: em("/sobre"), activo: activo("/sobre") },
        { rotulo: t("SiteNovo.equipa"), descricao: t("SiteNovo.equipaDescricao"), href: em("/equipa"), activo: activo("/equipa") },
        { rotulo: t("SiteNovo.publicacoes"), href: em("/publicacoes"), activo: activo("/publicacoes") },
        { rotulo: t("SiteNovo.contactos"), href: em("/junte-se"), activo: activo("/junte-se") },
      ],
    },
  ].map((d) => ({ ...d, activo: d.activo || d.filhos?.some((f) => f.activo) }));

  // Com sessão, "Entrar" dá lugar a "A minha área" (o avatar vem com a App, Fase 4).
  const entrada = (
    <Ligacao
      href={isLoggedIn ? em("/dashboard") : em("/login")}
      className="inline-flex min-h-alvo-app items-center whitespace-nowrap rounded-controlo px-2 text-legenda font-medium text-accao hover:bg-accao-suave sm:px-3 sm:text-corpo focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foco"
    >
      {isLoggedIn ? t("SiteNovo.minhaArea") : t("SiteNovo.entrar")}
    </Ligacao>
  );

  return (
    <ProvedorLigacao componente={LigacaoRouter}>
      <LayoutSite
        textoSaltar={t("SiteNovo.saltar")}
        barraMovel={barraMovel}
        barraVisivel={barraVisivel}
        cabecalho={{
          logotipo: logo(logotipo),
          inicio: { href: em("/"), rotulo: t("SiteNovo.inicio") },
          destinos,
          accao: { rotulo: t("SiteNovo.fazerRastreio"), href: em("/scanner") },
          entrada,
          idioma: <AlternarIdioma />,
          textos: { navegacao: t("SiteNovo.navegacao"), menu: t("SiteNovo.menu"), fechar: t("SiteNovo.fechar") },
        }}
        rodape={{
          ajuda: {
            titulo: t("SiteNovo.ajudaTitulo"),
            texto: t("SiteNovo.ajudaTexto"),
            contactos: [
              { icone: <Phone aria-hidden />, rotulo: TELEFONE, href: `tel:${TELEFONE.replace(/\s/g, "")}` },
              { icone: <Mail aria-hidden />, rotulo: EMAIL, href: `mailto:${EMAIL}` },
              { icone: <Instagram aria-hidden />, rotulo: "@janelas_para_alma", href: INSTAGRAM },
            ],
          },
          colunas: [
            {
              titulo: t("SiteNovo.servico"),
              ligacoes: [
                { rotulo: t("SiteNovo.rastreio"), href: em("/scanner") },
                { rotulo: t("SiteNovo.treinosEmCasa"), href: em("/exercicios") },
                { rotulo: t("SiteNovo.clinicasParceiras"), href: em("/parceiros") },
                // O jogo não está no cabeçalho (5 destinos, docs/ESTRUTURA_SITE.md):
                // fica aqui, em todas as páginas públicas, e na secção da página inicial.
                { rotulo: t("SiteNovo.jogo"), href: em("/jogo-curiosidades") },
              ],
            },
            {
              titulo: t("SiteNovo.instituicao"),
              ligacoes: [
                { rotulo: t("SiteNovo.quemSomos"), href: em("/impacto") },
                { rotulo: t("SiteNovo.equipa"), href: em("/equipa") },
                { rotulo: t("SiteNovo.kamba"), href: em("/kamba") },
                { rotulo: t("SiteNovo.publicacoes"), href: em("/publicacoes") },
                { rotulo: t("SiteNovo.apoiar"), href: em("/apoiar") },
              ],
            },
            {
              titulo: t("SiteNovo.ajuda"),
              ligacoes: [
                { rotulo: t("SiteNovo.perguntas"), href: em("/faq") },
                { rotulo: t("SiteNovo.contactos"), href: em("/junte-se") },
                { rotulo: t("SiteNovo.paraClinicas"), href: em("/portal-clinico") },
              ],
            },
          ],
          logotipo: logo(logotipoCompleto),
          local: t("SiteNovo.local"),
          avisoClinico: t("SiteNovo.avisoClinico"),
          legais: [
            { rotulo: t("SiteNovo.privacidade"), href: em("/politica-de-privacidade") },
            { rotulo: t("SiteNovo.termos"), href: em("/termos-de-utilizacao") },
          ],
          direitos: t("SiteNovo.direitos", { ano: new Date().getFullYear() }),
          idioma: <AlternarIdioma />,
          rotuloNavegacao: t("SiteNovo.ligacoesRodape"),
        }}
      >
        <ContextoSiteNovo.Provider value={true}>{children}</ContextoSiteNovo.Provider>
      </LayoutSite>
    </ProvedorLigacao>
  );
};
