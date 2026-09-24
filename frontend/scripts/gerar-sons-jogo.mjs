// Gera os sons provisórios do jogo "Inclusivamente" (public/audio/jogo/*.wav)
// por síntese simples de tons -- sem ficheiros de terceiros nem licenças.
// São placeholders: para trocar por gravações reais, basta substituir os
// ficheiros com o mesmo nome (o código só conhece os nomes).
//
//   node scripts/gerar-sons-jogo.mjs

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const PASTA = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "audio", "jogo");

const nota = (semitonsDesdeLa4) => 440 * 2 ** (semitonsDesdeLa4 / 12);
// Nomes em notação latina, relativos ao Lá4 (440 Hz).
const DO5 = nota(3), MI5 = nota(7), SOL5 = nota(10), LA5 = nota(12), DO6 = nota(15), MI6 = nota(19), SOL6 = nota(22);
const RE5 = nota(5), SOL4 = nota(-2), DO4 = nota(-9), MI4 = nota(-5), LA4 = nota(0), RE4 = nota(-7), MI3 = nota(-17), DO3 = nota(-21);

/** Mistura notas {freq, inicio, duracao, volume, forma} num Float32Array. */
function sintetizar(taxa, duracaoTotal, notas) {
  const amostras = new Float32Array(Math.round(taxa * duracaoTotal));
  for (const { freq, inicio, duracao, volume = 0.5, forma = "seno", ataque = 0.01 } of notas) {
    const i0 = Math.round(inicio * taxa);
    const n = Math.round(duracao * taxa);
    for (let i = 0; i < n && i0 + i < amostras.length; i++) {
      const t = i / taxa;
      // Envelope: ataque curto, decaimento exponencial até ao fim da nota.
      const env = Math.min(1, t / ataque) * Math.exp((-4 * t) / duracao) * (1 - i / n);
      const fase = 2 * Math.PI * freq * t;
      const onda =
        forma === "quadrada"
          ? Math.sign(Math.sin(fase)) * 0.5
          : Math.sin(fase) + 0.3 * Math.sin(2 * fase) + 0.1 * Math.sin(3 * fase);
      amostras[i0 + i] += onda * env * volume;
    }
  }
  // Normaliza para não saturar.
  const pico = amostras.reduce((m, v) => Math.max(m, Math.abs(v)), 0) || 1;
  const ganho = Math.min(1, 0.85 / pico);
  return amostras.map((v) => v * ganho);
}

/** WAV PCM 16-bit mono. */
function paraWav(taxa, amostras) {
  const dados = Buffer.alloc(amostras.length * 2);
  amostras.forEach((v, i) => dados.writeInt16LE(Math.round(Math.max(-1, Math.min(1, v)) * 32767), i * 2));
  const cabecalho = Buffer.alloc(44);
  cabecalho.write("RIFF", 0);
  cabecalho.writeUInt32LE(36 + dados.length, 4);
  cabecalho.write("WAVE", 8);
  cabecalho.write("fmt ", 12);
  cabecalho.writeUInt32LE(16, 16);
  cabecalho.writeUInt16LE(1, 20); // PCM
  cabecalho.writeUInt16LE(1, 22); // mono
  cabecalho.writeUInt32LE(taxa, 24);
  cabecalho.writeUInt32LE(taxa * 2, 28);
  cabecalho.writeUInt16LE(2, 32);
  cabecalho.writeUInt16LE(16, 34);
  cabecalho.write("data", 36);
  cabecalho.writeUInt32LE(dados.length, 40);
  return Buffer.concat([cabecalho, dados]);
}

const TAXA_EFEITOS = 22050;
const TAXA_MUSICA = 16000;

const sons = {
  // Duas notas a subir, curtas e brilhantes.
  "certo.wav": [TAXA_EFEITOS, 0.4, [
    { freq: MI5, inicio: 0, duracao: 0.14, volume: 0.5 },
    { freq: DO6, inicio: 0.1, duracao: 0.3, volume: 0.6 },
  ]],
  // Duas notas graves a descer.
  "errado.wav": [TAXA_EFEITOS, 0.5, [
    { freq: MI3, inicio: 0, duracao: 0.2, volume: 0.45, forma: "quadrada" },
    { freq: DO3, inicio: 0.18, duracao: 0.32, volume: 0.45, forma: "quadrada" },
  ]],
  // Toque curtíssimo para botões.
  "clique.wav": [TAXA_EFEITOS, 0.05, [{ freq: SOL6, inicio: 0, duracao: 0.04, volume: 0.35, ataque: 0.002 }]],
  // Arpejo de celebração.
  "level-up.wav": [TAXA_EFEITOS, 1.0, [
    { freq: DO5, inicio: 0, duracao: 0.25, volume: 0.45 },
    { freq: MI5, inicio: 0.1, duracao: 0.25, volume: 0.45 },
    { freq: SOL5, inicio: 0.2, duracao: 0.25, volume: 0.45 },
    { freq: DO6, inicio: 0.3, duracao: 0.65, volume: 0.55 },
    { freq: MI6, inicio: 0.3, duracao: 0.65, volume: 0.25 },
  ]],
};

// Música de fundo: 8 compassos curtos em pentatónica, calma, a 90 bpm, que
// termina em silêncio para o loop não dar estalo.
const BATIDA = 60 / 90;
const MELODIA = [DO5, MI5, SOL5, LA5, SOL5, MI5, RE5, MI5, SOL5, LA5, DO6, LA5, SOL5, MI5, RE5, DO5];
const BAIXO = [DO4, DO4, LA4, LA4, SOL4, SOL4, RE4, MI4];
const notasMusica = [
  ...MELODIA.map((freq, i) => ({ freq, inicio: i * (BATIDA / 2), duracao: BATIDA * 0.9, volume: 0.25 })),
  ...BAIXO.map((freq, i) => ({ freq: freq / 2, inicio: i * BATIDA, duracao: BATIDA * 1.6, volume: 0.3, ataque: 0.05 })),
];
const DURACAO_MUSICA = MELODIA.length * (BATIDA / 2) + 0.4;
sons["musica-fundo.wav"] = [TAXA_MUSICA, DURACAO_MUSICA, notasMusica];

mkdirSync(PASTA, { recursive: true });
for (const [nome, [taxa, duracao, notas]] of Object.entries(sons)) {
  const wav = paraWav(taxa, sintetizar(taxa, duracao, notas));
  writeFileSync(join(PASTA, nome), wav);
  console.log(`${nome}: ${(wav.length / 1024).toFixed(1)} KB`);
}
