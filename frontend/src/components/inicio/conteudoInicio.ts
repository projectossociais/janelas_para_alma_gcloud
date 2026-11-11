/**
 * Conteúdo da página inicial que muda sem mexer no desenho: vídeos,
 * fotografias do terreno e histórias. Fica aqui, num só sítio, para ser
 * trocado pelo material real à medida que existir.
 */
import fotoEquipa from "@/assets/team-group-stairs.jpg";
import fotoEducacao from "@/assets/pillar-educacao.jpg";
import fotoExame from "@/assets/strabismus-exam.jpg";
import fotoParceiros from "@/assets/parceiros-hero.jpg";
import fotoComunidade from "@/assets/suporte-hero.jpg";
import fotoVoluntarios from "@/assets/benefit-teamwork.jpg";
import fotoAntes1 from "@/assets/strabismus-intro.jpg";
import fotoDepois1 from "@/assets/strabismus-treatment.jpg";
import fotoAntes3 from "@/assets/hero-bg.jpg";
import fotoDepois3 from "@/assets/impact-educacional.jpg";

// Estas duas vivem em `public/` (servidas tal como estão, sem passar pelo bundler).
const fotoAntes2 = "/strabismus-boy.webp";
const fotoDepois2 = "/estrabismo-intro-boy.jpg";

export interface Video {
  /** Id do vídeo no YouTube; `null` mostra o cartaz "Vídeo em breve". */
  youtubeId: string | null;
  titulo: string;
}

/**
 * Vídeos da secção "Veja o Janelas Para a Alma em Acção". Ainda não há
 * vídeos publicados: preencher `youtubeId` quando existirem. A reprodução usa
 * youtube-nocookie.com (sem cookies de seguimento até a pessoa carregar no play).
 */
export const VIDEO_PRINCIPAL: Video = { youtubeId: null, titulo: "EmAccao.videoPrincipal" };
export const VIDEOS_CURTOS: readonly Video[] = [
  { youtubeId: null, titulo: "EmAccao.videoCurto1" },
  { youtubeId: null, titulo: "EmAccao.videoCurto2" },
];

/** Fotografias do carrossel "no terreno". Trocar por fotografias reais das acções. */
export const FOTOS_NO_TERRENO: readonly { src: string; alt: string }[] = [
  { src: fotoEquipa, alt: "EmAccao.fotoEquipaAlt" },
  { src: fotoExame, alt: "EmAccao.fotoExameAlt" },
  { src: fotoEducacao, alt: "EmAccao.fotoEducacaoAlt" },
  { src: fotoComunidade, alt: "EmAccao.fotoComunidadeAlt" },
  { src: fotoParceiros, alt: "EmAccao.fotoParceirosAlt" },
  { src: fotoVoluntarios, alt: "EmAccao.fotoVoluntariosAlt" },
];

export interface Historia {
  id: string;
  titulo: string;
  resumo: string;
  fotoAntes: string;
  fotoDepois: string;
  /**
   * `true` enquanto a história for um exemplo composto, sem uma família real
   * por trás: o cartão di-lo. Uma história real só entra com o consentimento
   * escrito do representante legal (são crianças -- ver CLAUDE.md §4 e §9).
   */
  ilustrativa: boolean;
}

export const HISTORIAS: readonly Historia[] = [
  {
    id: "confianca",
    titulo: "Historias.historia1Titulo",
    resumo: "Historias.historia1Resumo",
    fotoAntes: fotoAntes1,
    fotoDepois: fotoDepois1,
    ilustrativa: true,
  },
  {
    id: "escola",
    titulo: "Historias.historia2Titulo",
    resumo: "Historias.historia2Resumo",
    fotoAntes: fotoAntes2,
    fotoDepois: fotoDepois2,
    ilustrativa: true,
  },
  {
    id: "familia",
    titulo: "Historias.historia3Titulo",
    resumo: "Historias.historia3Resumo",
    fotoAntes: fotoAntes3,
    fotoDepois: fotoDepois3,
    ilustrativa: true,
  },
];
