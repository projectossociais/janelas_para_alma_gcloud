import { mediana, recortar } from "./imagem";
import { ajustarLimbo, estimarRaio, type MotivoFalhaLimbo } from "./limbo";
import { localizarReflexo, type MotivoFalhaReflexo } from "./reflexo";
import { falha, sucesso, type Circulo, type ImagemCinza, type Ponto, type Resultado } from "./tipos";

/**
 * Medição de um olho: onde está o reflexo e onde está o centro da íris.
 *
 * Recebe uma posição aproximada da íris (do detector de rosto, que erra alguns
 * píxeis) e mede tudo na fotografia em resolução total.
 */

/**
 * Íris com menos do que isto de diâmetro, em píxeis, está longe demais: um
 * desvio de 8 Δ ficaria abaixo de ~2,3 píxeis e o ruído dominaria
 * (docs/MOTOR_ANALISE_RASTREIO.md §4).
 */
export const DIAMETRO_IRIS_MINIMO_PX = 70;
/** O reflexo tem de cair dentro desta fracção do raio da íris (≈ 60 Δ). */
export const FRACAO_RAIO_REFLEXO_MAXIMA = 0.7;

export type MotivoFalhaOlho = MotivoFalhaReflexo | MotivoFalhaLimbo | "iris-pequena" | "reflexo-fora-da-iris";

export interface MedicaoOlho {
  reflexo: Ponto;
  iris: Circulo;
  erroLimboPx: number;
  contrasteReflexo: number;
}

export function medirOlho(img: ImagemCinza, aprox: Circulo): Resultado<MedicaoOlho, MotivoFalhaOlho> {
  // Recorte largo: o raio aproximado pode estar muito abaixo do real.
  const { imagem, origem } = recortar(img, aprox.centro, 3.2 * aprox.raio);
  const centroLocal = { x: aprox.centro.x - origem.x, y: aprox.centro.y - origem.y };
  // O raio mede-se na imagem; o de fora é só o ponto de partida.
  const raio = estimarRaio(imagem, centroLocal, 0.55 * aprox.raio, 1.9 * aprox.raio) ?? aprox.raio;
  const local: Circulo = { centro: centroLocal, raio };

  let reflexo = localizarReflexo(imagem, local);
  if (reflexo.ok === false && reflexo.motivo === "sem-reflexo") {
    // Desvios grandes põem o reflexo longe do centro; se o detector de rosto
    // também errou para o outro lado, fica fora da zona de procura. Segunda
    // tentativa, centrada no contorno da íris já ajustado.
    const limboInicial = ajustarLimbo(imagem, local);
    if (limboInicial.ok) reflexo = localizarReflexo(imagem, limboInicial.valor.circulo);
  }
  if (reflexo.ok === false) return falha(reflexo.motivo);

  // Tapa o reflexo (e uma margem de 1 píxel) com o tom da íris, para o
  // contorno não confundir as bordas do reflexo com o limbo.
  const tapar = new Set<number>();
  for (const k of reflexo.valor.pixeis) {
    const kx = k % imagem.largura;
    const ky = (k - kx) / imagem.largura;
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++) {
        const nx = kx + dx;
        const ny = ky + dy;
        if (nx >= 0 && ny >= 0 && nx < imagem.largura && ny < imagem.altura) tapar.add(ny * imagem.largura + nx);
      }
  }
  const vizinhanca: number[] = [];
  const r = 0.5 * local.raio;
  for (let y = Math.max(0, Math.floor(local.centro.y - r)); y <= Math.min(imagem.altura - 1, local.centro.y + r); y++)
    for (let x = Math.max(0, Math.floor(local.centro.x - r)); x <= Math.min(imagem.largura - 1, local.centro.x + r); x++) {
      const k = y * imagem.largura + x;
      if (!tapar.has(k)) vizinhanca.push(imagem.dados[k] ?? 0);
    }
  const tomIris = mediana(vizinhanca);
  for (const k of tapar) imagem.dados[k] = tomIris;

  const limbo = ajustarLimbo(imagem, local);
  if (limbo.ok === false) return falha(limbo.motivo);
  const iris = limbo.valor.circulo;
  if (2 * iris.raio < DIAMETRO_IRIS_MINIMO_PX) return falha("iris-pequena");
  const c = reflexo.valor.centro;
  if (Math.hypot(c.x - iris.centro.x, c.y - iris.centro.y) > FRACAO_RAIO_REFLEXO_MAXIMA * iris.raio) {
    return falha("reflexo-fora-da-iris");
  }

  return sucesso({
    reflexo: { x: c.x + origem.x, y: c.y + origem.y },
    iris: { centro: { x: iris.centro.x + origem.x, y: iris.centro.y + origem.y }, raio: iris.raio },
    erroLimboPx: limbo.valor.erroQuadraticoMedio,
    contrasteReflexo: reflexo.valor.contraste,
  });
}
