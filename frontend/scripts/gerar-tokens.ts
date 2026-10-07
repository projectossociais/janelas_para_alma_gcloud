/**
 * Gera src/design/tokens.css a partir de src/design/tokens.ts.
 * Correr com `npm run tokens` depois de mudar um token. O teste
 * `tokens.test.ts` falha se o CSS não estiver em dia.
 */
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { gerarCss } from "../src/design/tokens";

const destino = fileURLToPath(new URL("../src/design/tokens.css", import.meta.url));
writeFileSync(destino, gerarCss(), "utf8");
console.log(`tokens.css gerado: ${destino}`);
