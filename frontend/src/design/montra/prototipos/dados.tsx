import { Instagram, Mail, Phone } from "lucide-react";
import { Ligacao } from "../../Ligacao";
import type { CabecalhoSiteProps } from "../../navegacao/CabecalhoSite";
import type { RodapeProps } from "../../navegacao/Rodape";
import type { TemaEfectivo } from "../../useTema";
import logotipo from "../../marca/logotipo-horizontal-sem-assinatura.svg";
import logotipoNegativo from "../../marca/logotipo-horizontal-negativo-sem-assinatura.svg";
import logotipoCompleto from "../../marca/logotipo-horizontal.svg";
import logotipoCompletoNegativo from "../../marca/logotipo-horizontal-negativo.svg";

/**
 * Dados partilhados pelos protótipos (só em desenvolvimento). No site real o
 * texto vem do i18n; aqui é português directo para ver os arquétipos.
 * Contactos reais do site actual (docs/ESTRUTURA_SITE.md §6).
 */

export const logo = (tema: TemaEfectivo, completo = false) => (
  <img
    src={completo ? (tema === "claro" ? logotipoCompleto : logotipoCompletoNegativo) : tema === "claro" ? logotipo : logotipoNegativo}
    alt=""
  />
);

export const cabecalhoSite = (tema: TemaEfectivo, activo?: string): CabecalhoSiteProps => ({
  logotipo: logo(tema),
  inicio: { href: "/_montra/prototipos/site", rotulo: "Janelas Para a Alma, início" },
  destinos: [
    { rotulo: "Rastreio", href: "/_montra/prototipos/tarefa", activo: activo === "rastreio" },
    { rotulo: "Treinos", href: "#treinos" },
    { rotulo: "Clínicas", href: "#clinicas" },
    {
      rotulo: "Comunidade",
      href: "#comunidade",
      filhos: [
        { rotulo: "Meu Kamba Estrábico", descricao: "As acções que já fizemos e as próximas", href: "#kamba" },
        { rotulo: "Ser voluntário", descricao: "Junte-se às acções no terreno", href: "#voluntario" },
        { rotulo: "Doar", descricao: "Dinheiro ou materiais para quem precisa", href: "#doar" },
        { rotulo: "Doar óculos usados", descricao: "Ganham uma segunda vida", href: "#oculos" },
      ],
    },
    {
      rotulo: "Sobre",
      href: "#sobre",
      filhos: [
        { rotulo: "Quem somos", descricao: "A história, a equipa e o que fazemos", href: "#quem-somos" },
        { rotulo: "O que é o estrabismo", descricao: "Sinais, causas e tratamento, em palavras simples", href: "#estrabismo" },
        { rotulo: "Publicações", href: "#publicacoes" },
        { rotulo: "Contactos", href: "#contactos" },
      ],
    },
  ],
  accao: { rotulo: "Fazer rastreio", href: "/_montra/prototipos/tarefa" },
  entrada: (
    <Ligacao
      href="/_montra/prototipos/entrar"
      className="inline-flex min-h-alvo-app items-center rounded-controlo px-3 text-corpo font-medium text-accao hover:bg-accao-suave focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foco"
    >
      Entrar
    </Ligacao>
  ),
  idioma: (
    <a
      href="#en"
      lang="en"
      className="inline-flex min-h-alvo-app items-center rounded-controlo px-2 text-legenda font-medium text-tinta-suave hover:text-tinta"
    >
      English
    </a>
  ),
  textos: { navegacao: "Navegação principal", menu: "Menu", fechar: "Fechar" },
});

export const rodape = (tema: TemaEfectivo): RodapeProps => ({
  ajuda: {
    titulo: "Precisa de ajuda?",
    texto: "Fale connosco. Respondemos a pais, clínicas e voluntários.",
    contactos: [
      { icone: <Phone aria-hidden />, rotulo: "+244 926 969 819", href: "tel:+244926969819" },
      { icone: <Mail aria-hidden />, rotulo: "janelasparaalma18@gmail.com", href: "mailto:janelasparaalma18@gmail.com" },
      { icone: <Instagram aria-hidden />, rotulo: "@janelas_para_alma", href: "https://www.instagram.com/janelas_para_alma" },
    ],
  },
  colunas: [
    {
      titulo: "Serviço",
      ligacoes: [
        { rotulo: "Rastreio", href: "#rastreio" },
        { rotulo: "Treinos em casa", href: "#treinos" },
        { rotulo: "Clínicas parceiras", href: "#clinicas" },
        { rotulo: "Preços e Premium", href: "#premium" },
      ],
    },
    {
      titulo: "Instituição",
      ligacoes: [
        { rotulo: "Quem somos", href: "#quem-somos" },
        { rotulo: "Comunidade", href: "#comunidade" },
        { rotulo: "Publicações", href: "#publicacoes" },
        { rotulo: "Apoiar", href: "#doar" },
      ],
    },
    {
      titulo: "Ajuda",
      ligacoes: [
        { rotulo: "Perguntas frequentes", href: "#faq" },
        { rotulo: "Contactos", href: "#contactos" },
        { rotulo: "Para clínicas", href: "#para-clinicas" },
      ],
    },
  ],
  logotipo: logo(tema, true),
  local: "Luanda, Angola",
  avisoClinico: "O Janelas Para a Alma faz triagem e treino de apoio. Não substitui uma consulta médica.",
  legais: [
    { rotulo: "Privacidade", href: "#privacidade" },
    { rotulo: "Termos", href: "#termos" },
  ],
  direitos: "© 2026 Janelas Para a Alma",
  rotuloNavegacao: "Ligações do rodapé",
});
