import { ajustarCirculoRobusto, distanciaElipse, refinarElipseAlinhada, type Elipse } from "./geometria";
import { amostrar } from "./imagem";
import { falha, sucesso, type Circulo, type ImagemCinza, type Ponto, type Resultado } from "./tipos";

/**
 * Contorno da íris (limbo): a fronteira entre a íris (escura) e a esclera
 * (branca). O centro do círculo ajustado é a referência de onde o reflexo
 * deveria estar.
 *
 * Só se usam os sectores laterais: em cima e em baixo, as pálpebras tapam o
 * limbo e o contorno encontrado seria o da pálpebra. A pupila não se usa: em
 * íris escuras quase não se distingue da íris.
 */

/** Sectores usados, em graus a partir da horizontal (0° = direita da imagem). */
export const MEIA_ABERTURA_SECTOR_GRAUS = 40;
export const PASSO_ANGULAR_GRAUS = 2;
/** Sector inferior, mais estreito (graus para cada lado da vertical). */
export const MEIA_ABERTURA_SECTOR_INFERIOR_GRAUS = 20;
const SECTORES: readonly (readonly [number, number])[] = [
  [0, MEIA_ABERTURA_SECTOR_GRAUS],
  [180, MEIA_ABERTURA_SECTOR_GRAUS],
  [90, MEIA_ABERTURA_SECTOR_INFERIOR_GRAUS],
];
/** Procura ao longo de cada raio, em fracção do raio aproximado. */
export const PROCURA_INICIO = 0.55;
export const PROCURA_FIM = 1.5;
/** Diferença mínima esclera − íris junto à fronteira (0–255). */
export const CONTRASTE_MINIMO_LIMBO = 35;
export const PONTOS_MINIMOS = 20;
/** Um ajuste aceitável: pelo menos esta fracção dos pontos concorda com o círculo... */
export const FRACAO_MINIMA_PONTOS = 0.6;
/** ...e os pontos aceites ficam, em média, a menos disto do círculo (píxeis). */
export const ERRO_MAXIMO_PX = 0.8;

export type MotivoFalhaLimbo = "limbo-nao-encontrado" | "limbo-irregular";

export interface Limbo {
  circulo: Circulo;
  erroQuadraticoMedio: number;
  /** Fracção dos pontos de contorno que concordam com o círculo. */
  fracaoPontos: number;
}

const PASSO_AMOSTRA = 0.25;

/** Um ponto do contorno ao longo de um raio, ou `null` se não houver fronteira clara. */
function fronteiraNoRaio(img: ImagemCinza, aprox: Circulo, angulo: number): Ponto | null {
  const cos = Math.cos(angulo);
  const sin = Math.sin(angulo);
  const s0 = PROCURA_INICIO * aprox.raio;
  const s1 = PROCURA_FIM * aprox.raio;
  const n = Math.floor((s1 - s0) / PASSO_AMOSTRA) + 1;
  const perfil = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const s = s0 + i * PASSO_AMOSTRA;
    perfil[i] = amostrar(img, aprox.centro.x + s * cos, aprox.centro.y + s * sin);
  }
  // Suavização [1 2 1]/4 duas vezes, depois derivada central.
  let suave = perfil;
  for (let passagem = 0; passagem < 2; passagem++) {
    const novo = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      novo[i] = ((suave[Math.max(0, i - 1)] ?? 0) + 2 * (suave[i] ?? 0) + (suave[Math.min(n - 1, i + 1)] ?? 0)) / 4;
    }
    suave = novo;
  }
  let melhor = -1;
  let gradMax = 0;
  for (let i = 1; i < n - 1; i++) {
    const g = ((suave[i + 1] ?? 0) - (suave[i - 1] ?? 0)) / 2;
    if (g > gradMax) {
      gradMax = g;
      melhor = i;
    }
  }
  if (melhor < 1 || melhor >= n - 1) return null;

  // Tem de ser mesmo uma passagem escura → clara (íris → esclera).
  const janela = Math.round(2 / PASSO_AMOSTRA);
  const media = (a: number, b: number) => {
    let s = 0, c = 0;
    for (let i = Math.max(0, a); i <= Math.min(n - 1, b); i++) { s += perfil[i] ?? 0; c++; }
    return c ? s / c : 0;
  };
  const dentro = media(melhor - 2 * janela, melhor - janela);
  const fora = media(melhor + janela, melhor + 2 * janela);
  if (fora - dentro < CONTRASTE_MINIMO_LIMBO) return null;

  // Pico da derivada por interpolação parabólica (precisão abaixo da amostra).
  const g = (i: number) => ((suave[i + 1] ?? 0) - (suave[i - 1] ?? 0)) / 2;
  let ajuste = 0;
  if (melhor >= 2 && melhor <= n - 3) {
    const a = g(melhor - 1);
    const b = g(melhor);
    const c = g(melhor + 1);
    const den = a - 2 * b + c;
    if (Math.abs(den) > 1e-9) ajuste = Math.max(-0.5, Math.min(0.5, (0.5 * (a - c)) / den));
  }
  const s = s0 + (melhor + ajuste) * PASSO_AMOSTRA;
  return { x: aprox.centro.x + s * cos, y: aprox.centro.y + s * sin };
}

/**
 * Raio da íris, grosseiro, medido na imagem: a transição escuro → claro mais
 * forte no perfil médio dos raios laterais, entre `de` e `ate` píxeis do
 * centro. Serve para não depender da estimativa vinda de fora (detector de
 * rosto, ou distância entre os olhos, que em crianças erra 20% ou mais).
 */
export function estimarRaio(img: ImagemCinza, centro: Ponto, de: number, ate: number): number | null {
  const passo = 0.5;
  const n = Math.floor((ate - de) / passo) + 1;
  if (n < 5) return null;
  const perfil = new Float64Array(n);
  let raios = 0;
  for (const centroSector of [0, 180]) {
    for (let d = -MEIA_ABERTURA_SECTOR_GRAUS; d <= MEIA_ABERTURA_SECTOR_GRAUS; d += 4) {
      const a = ((centroSector + d) * Math.PI) / 180;
      for (let i = 0; i < n; i++) {
        const s = de + i * passo;
        perfil[i]! += amostrar(img, centro.x + s * Math.cos(a), centro.y + s * Math.sin(a));
      }
      raios++;
    }
  }
  // Derivada sobre uma janela de 2 px (robusta ao ruído e à textura).
  const meia = 4;
  let melhor = -1;
  let gradMax = 0;
  for (let i = meia; i < n - meia; i++) {
    const g = ((perfil[i + meia] ?? 0) - (perfil[i - meia] ?? 0)) / raios;
    if (g > gradMax) {
      gradMax = g;
      melhor = i;
    }
  }
  return melhor < 0 || gradMax < CONTRASTE_MINIMO_LIMBO ? null : de + melhor * passo;
}

export function ajustarLimbo(img: ImagemCinza, aprox: Circulo): Resultado<Limbo, MotivoFalhaLimbo> {
  const pontos: Ponto[] = [];
  let tentados = 0;
  // Lados (0° e 180°) e, mais estreito, o fundo (90°: y cresce para baixo). A
  // pálpebra de baixo tapa menos a íris do que a de cima; esses pontos ancoram o
  // centro vertical, que só com os lados ficava enviesado (testes de robustez).
  for (const [centroSector, meia] of SECTORES) {
    for (let d = -meia; d <= meia; d += PASSO_ANGULAR_GRAUS) {
      tentados++;
      const p = fronteiraNoRaio(img, aprox, ((centroSector + d) * Math.PI) / 180);
      if (p) pontos.push(p);
    }
  }
  if (pontos.length < PONTOS_MINIMOS) return falha("limbo-nao-encontrado");

  // A íris parece elíptica quando o olho está rodado em relação à câmara, ou
  // seja, no olho desviado; um círculo enviesava aí o centro (apanhado pelos
  // testes de robustez). Ajusta-se uma elipse alinhada; o círculo é o recurso.
  const circulo = ajustarCirculoRobusto(pontos, { limiarPx: 1, iteracoes: 300, semente: 7 });
  const largo = ajustarCirculoRobusto(pontos, { limiarPx: 2, iteracoes: 300, semente: 7 });
  if (!circulo && !largo) return falha("limbo-nao-encontrado");
  // Candidata elíptica, a partir do círculo tolerante.
  let candidata: Elipse | null = null;
  let aceitesElipse: Ponto[] = [];
  if (largo) {
    candidata = refinarElipseAlinhada(largo.inliers, largo.circulo);
    aceitesElipse = pontos.filter((p) => Math.abs(distanciaElipse(p, candidata!)) <= 1);
    if (aceitesElipse.length >= PONTOS_MINIMOS) {
      candidata = refinarElipseAlinhada(aceitesElipse, { centro: candidata.centro, raio: (candidata.a + candidata.b) / 2 });
      aceitesElipse = pontos.filter((p) => Math.abs(distanciaElipse(p, candidata!)) <= 1);
    }
  }
  // Com os pontos de baixo, o semi-eixo vertical fica determinado e a elipse é
  // estável: é o modelo principal. O círculo fica para quando a elipse falha
  // (poucos pontos, ou não aceita pelo menos tantos pontos como o círculo).
  const pontosCirculo = circulo?.inliers.length ?? 0;
  const usarElipse = !!candidata && aceitesElipse.length >= Math.max(PONTOS_MINIMOS, pontosCirculo);
  const elipse: Elipse = usarElipse
    ? candidata!
    : { centro: circulo!.circulo.centro, a: circulo!.circulo.raio, b: circulo!.circulo.raio };
  const aceites = usarElipse ? aceitesElipse : circulo!.inliers;
  const erro = Math.sqrt(aceites.reduce((s, p) => s + distanciaElipse(p, elipse) ** 2, 0) / Math.max(1, aceites.length));
  const fracaoPontos = aceites.length / tentados;
  const raioPlausivel = elipse.a > 0.6 * aprox.raio && elipse.a < 1.5 * aprox.raio;
  const achatamentoPlausivel = elipse.a / elipse.b > 0.7 && elipse.a / elipse.b < 1.3;
  if (fracaoPontos < FRACAO_MINIMA_PONTOS || erro > ERRO_MAXIMO_PX || !raioPlausivel || !achatamentoPlausivel) {
    return falha("limbo-irregular");
  }
  // O raio é o semi-eixo horizontal: a escala do motor vem do diâmetro horizontal da íris.
  return sucesso({ circulo: { centro: elipse.centro, raio: elipse.a }, erroQuadraticoMedio: erro, fracaoPontos });
}
