// Orçamento de peso do site, corrido na CI depois do `npm run build`.
//
// Protege o que a divisão por rotas e a limpeza de imagens ganharam
// (2026-09-30: pacote principal de 649 para 300 KB gzip; imagens de 2,5 MB
// para 600 KB). Falha se o pacote principal passar do limite ou se alguma
// imagem publicada for demasiado pesada. Subir um limite é uma decisão: fazê-lo
// aqui, com o motivo no commit.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { gzipSync } from "node:zlib";

const LIMITE_PACOTE_PRINCIPAL_KB = 320; // gzip
const LIMITE_IMAGEM_KB = 400;

const pasta = join(process.cwd(), "dist", "assets");
const kb = (bytes) => Math.round(bytes / 1024);
const erros = [];

// O pacote principal é o <script type="module"> que o index.html carrega.
const html = readFileSync(join(process.cwd(), "dist", "index.html"), "utf-8");
const principal = [...html.matchAll(/<script[^>]*type="module"[^>]*src="\/assets\/([^"]+\.js)"/g)].map((m) => m[1]);
if (principal.length !== 1) erros.push(`esperava um pacote principal no index.html, encontrei ${principal.length}`);
for (const f of principal) {
  const gz = kb(gzipSync(readFileSync(join(pasta, f))).length);
  console.log(`pacote principal ${f}: ${gz} KB gzip (limite ${LIMITE_PACOTE_PRINCIPAL_KB})`);
  if (gz > LIMITE_PACOTE_PRINCIPAL_KB) erros.push(`${f} tem ${gz} KB gzip, acima de ${LIMITE_PACOTE_PRINCIPAL_KB}`);
}

// Todas as imagens publicadas, também em subpastas (ex.: dist/assets/kamba).
const dist = join(process.cwd(), "dist");
const imagens = readdirSync(dist, { recursive: true })
  .map(String)
  .filter((f) => /\.(png|jpe?g|webp|gif|svg)$/i.test(f))
  .map((f) => join(dist, f));
for (const f of imagens) {
  const tamanho = kb(statSync(f).size);
  if (tamanho > LIMITE_IMAGEM_KB) erros.push(`${f} tem ${tamanho} KB, acima de ${LIMITE_IMAGEM_KB}`);
}

if (erros.length) {
  console.error("Orçamento de peso ultrapassado:\n- " + erros.join("\n- "));
  process.exit(1);
}
console.log(`orçamento cumprido (${imagens.length} imagens verificadas)`);
