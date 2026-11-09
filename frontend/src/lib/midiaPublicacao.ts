/** Vídeos aceites na galeria de uma publicação (nunca na capa). */
export const TIPOS_DE_VIDEO_ACEITES = ["video/mp4", "video/webm"] as const;

/** Uma mídia da galeria de uma publicação é vídeo pela extensão da chave,
 *  que a API escolhe a partir do tipo do ficheiro (`.mp4` / `.webm`). */
export function eVideoDaGaleria(url: string): boolean {
  return /\.(mp4|webm)$/i.test(url.split(/[?#]/)[0]);
}

export type PedacoDeTexto = { tipo: "texto"; valor: string } | { tipo: "link"; valor: string };

const URL_NO_TEXTO = /(https?:\/\/[^\s<>"]+[^\s<>".,;:!?)\]])/g;

/** Parte o corpo de uma publicação em texto e links `http(s)://`, para os
 *  links (ex.: um formulário de inscrição) ficarem clicáveis. Só texto: o
 *  React escapa tudo, nunca se injecta HTML vindo da API. */
export function partirEmLinks(texto: string): PedacoDeTexto[] {
  return texto
    .split(URL_NO_TEXTO)
    .filter((p) => p !== "")
    .map((p) => (/^https?:\/\//.test(p) ? { tipo: "link", valor: p } : { tipo: "texto", valor: p }));
}
