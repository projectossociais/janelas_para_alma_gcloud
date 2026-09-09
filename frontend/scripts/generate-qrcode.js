// Gera os QR codes oficiais da Janelas Para a Alma para materiais impressos
// e digitais da Campanha de Conscientização sobre o Estrabismo.
//
// Uso:  npx --package qrcode node scripts/generate-qrcode.js
// (ou `npm install qrcode` primeiro, se preferires deixá-lo como dependência)
//
// Regenera os 3 ficheiros em public/assets/qrcode/. Corre de novo sempre que
// o URL oficial ou a cor da marca mudarem.

const QRCode = require("qrcode");
const fs = require("fs");
const path = require("path");

const URL = "https://www.janelasparaalma.com";
const OUT_DIR = path.join(__dirname, "..", "public", "assets", "qrcode");
const PNG_WIDTH = 1200; // > 1024px mínimo pedido
const MARGIN = 4; // módulos de zona neutra -- padrão para leitura fiável

// Teal escuro derivado do token da marca (--teal: 170 72% 42% em
// src/index.css), escurecido para ~22% de luminosidade. O teal claro da
// marca não tem contraste suficiente para garantir leitura fiável em
// impressões pequenas -- este escurecimento é só para o QR code.
const BRAND_TEAL_DARK = "#106053";

fs.mkdirSync(OUT_DIR, { recursive: true });

async function main() {
  // 1) SVG -- vetorial, módulos pretos, fundo transparente.
  const svg = await QRCode.toString(URL, {
    type: "svg",
    errorCorrectionLevel: "H",
    margin: MARGIN,
    color: { dark: "#000000ff", light: "#ffffff00" },
  });
  fs.writeFileSync(path.join(OUT_DIR, "qrcode-janelasparaalma.svg"), svg, "utf8");

  // 2) PNG de alta resolução, fundo transparente, módulos pretos.
  await QRCode.toFile(path.join(OUT_DIR, "qrcode-janelasparaalma-hq.png"), URL, {
    type: "png",
    errorCorrectionLevel: "H",
    width: PNG_WIDTH,
    margin: MARGIN,
    color: { dark: "#000000ff", light: "#ffffff00" },
  });

  // 3) PNG de alta resolução, cores da marca: módulos em teal escuro, fundo branco.
  await QRCode.toFile(path.join(OUT_DIR, "qrcode-janelasparaalma-brand.png"), URL, {
    type: "png",
    errorCorrectionLevel: "H",
    width: PNG_WIDTH,
    margin: MARGIN,
    color: { dark: BRAND_TEAL_DARK + "ff", light: "#ffffffff" },
  });

  console.log("QR codes gerados em:", OUT_DIR);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
