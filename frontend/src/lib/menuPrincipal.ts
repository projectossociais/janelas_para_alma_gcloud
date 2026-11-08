/**
 * Navegação principal do site (redesenho de 2026-10-26, inspirado na
 * arquitectura do Project Prakash): um só cabeçalho com menus suspensos, em
 * vez da barra de atalhos + gaveta lateral com a lista inteira.
 *
 * Fonte única para o cabeçalho (desktop e acordeão mobile) e para o teste que
 * garante que todo o destino existe no mapa de rotas (`i18n/rotas.ts`).
 * Os caminhos estão em português; os componentes passam-nos por `localizar`.
 * `rotulo`/`descricao` são chaves de tradução (`Cabecalho.*`).
 */

export interface ItemMenu {
  rotulo: string;
  descricao?: string;
  caminho: string;
}

export interface GrupoMenu {
  id: string;
  rotulo: string;
  /** Sem itens: é um link directo (o Blog). */
  caminho?: string;
  itens?: ItemMenu[];
}

export const MENU_PRINCIPAL: readonly GrupoMenu[] = [
  {
    id: "sobre",
    rotulo: "Cabecalho.sobreNos",
    itens: [
      { rotulo: "Cabecalho.aNossaEquipa", descricao: "Cabecalho.aNossaEquipaDescricao", caminho: "/equipa" },
      { rotulo: "Cabecalho.aNossaJornada", descricao: "Cabecalho.aNossaJornadaDescricao", caminho: "/impacto#sobre" },
      { rotulo: "Cabecalho.contactos", descricao: "Cabecalho.contactosDescricao", caminho: "/junte-se#contacto" },
      { rotulo: "Cabecalho.perguntasFrequentes", caminho: "/faq" },
    ],
  },
  {
    id: "trabalho",
    rotulo: "Cabecalho.oNossoTrabalho",
    itens: [
      { rotulo: "Cabecalho.meuKamba", descricao: "Cabecalho.meuKambaDescricao", caminho: "/kamba" },
      { rotulo: "Cabecalho.publicacoes", descricao: "Cabecalho.publicacoesDescricao", caminho: "/publicacoes" },
      // Ainda não há um blog separado das publicações: os dois levam à mesma página.
      { rotulo: "Cabecalho.blogItem", descricao: "Cabecalho.blogDescricao", caminho: "/publicacoes#artigos" },
      { rotulo: "Cabecalho.oEstrabismo", descricao: "Cabecalho.oEstrabismoDescricao", caminho: "/sobre" },
    ],
  },
  {
    id: "servicos",
    rotulo: "Cabecalho.servicos",
    itens: [
      { rotulo: "Cabecalho.triagemOcular", descricao: "Cabecalho.triagemOcularDescricao", caminho: "/scanner" },
      { rotulo: "Cabecalho.exerciciosVisuais", descricao: "Cabecalho.cienciaTerapiaDescricao", caminho: "/exercicios" },
      { rotulo: "Cabecalho.jogoInclusivamente", descricao: "Cabecalho.jogoInclusivamenteDescricao", caminho: "/jogo-curiosidades" },
    ],
  },
  {
    id: "portal",
    rotulo: "Cabecalho.portalClinico",
    itens: [
      { rotulo: "Cabecalho.redeDeParceiros", descricao: "Cabecalho.clinicasParceirasDescricao", caminho: "/parceiros" },
      { rotulo: "Cabecalho.opticaOptioptika", descricao: "Cabecalho.opticaOptioptikaDescricao", caminho: "/portal-clinico/optioptika" },
    ],
  },
];

/** O botão de destaque "Doar agora", com o seu próprio menu. */
export const MENU_DOAR: readonly ItemMenu[] = [
  { rotulo: "Cabecalho.doarUmaVez", descricao: "Cabecalho.doarUmaVezDescricao", caminho: "/apoiar?modo=unica" },
  { rotulo: "Cabecalho.doarMensalmente", descricao: "Cabecalho.doarMensalmenteDescricao", caminho: "/apoiar?modo=mensal" },
];
