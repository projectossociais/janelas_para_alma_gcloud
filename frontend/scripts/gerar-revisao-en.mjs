/**
 * Gera docs/revisao-en-US.md a partir de src/i18n/revisao.json (categoria por
 * chave), src/i18n/revisao-notas.json (notas para quem revê) e dos dois
 * ficheiros de tradução. Correr depois de mudar qualquer um deles:
 *
 *   node scripts/gerar-revisao-en.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const raiz = join(dirname(fileURLToPath(import.meta.url)), "..");
const ler = (p) => JSON.parse(readFileSync(join(raiz, p), "utf8"));

const pt = ler("src/i18n/locales/pt-AO.json");
const en = ler("src/i18n/locales/en-US.json");
const revisao = ler("src/i18n/revisao.json");
const notas = ler("src/i18n/revisao-notas.json");

const valor = (arvore, chave) => chave.split(".").reduce((o, k) => o?.[k], arvore) ?? "";
const celula = (s) => String(s).replace(/\|/g, "\\|").replace(/\n+/g, "<br>");

const CATEGORIAS = [
  ["health", "Saúde (AMA)", "Afirmações médicas ou de saúde. Validar com um profissional antes de publicar."],
  ["legal", "Legal", "Política de Privacidade, Termos e textos com efeito jurídico. Rascunho: não é uma tradução jurídica validada."],
  ["duvida", "Dúvidas", "Escolhas de tradução ambíguas ou problemas já existentes no português."],
];

const linhas = [
  "# Revisão da tradução en-US",
  "",
  "Gerado por `frontend/scripts/gerar-revisao-en.mjs` a partir de `src/i18n/revisao.json`. Não editar à mão.",
  "",
  "| Categoria | Chaves |",
  "|---|---|",
  ...CATEGORIAS.map(([id, nome]) => `| ${nome} | ${Object.values(revisao).filter((c) => c === id).length} |`),
  "",
];

for (const [id, nome, descricao] of CATEGORIAS) {
  const chaves = Object.keys(revisao).filter((k) => revisao[k] === id);
  linhas.push(`## ${nome} (${chaves.length})`, "", descricao, "");
  const porPagina = Map.groupBy
    ? Map.groupBy(chaves, (k) => k.split(".")[0])
    : chaves.reduce((m, k) => m.set(k.split(".")[0], [...(m.get(k.split(".")[0]) ?? []), k]), new Map());
  for (const [pagina, lista] of [...porPagina].sort(([a], [b]) => a.localeCompare(b))) {
    linhas.push(`### ${pagina}`, "", "| Chave | Português | Inglês | Nota |", "|---|---|---|---|");
    for (const k of lista) {
      linhas.push(`| \`${k.slice(pagina.length + 1)}\` | ${celula(valor(pt, k))} | ${celula(valor(en, k))} | ${celula(notas[k] ?? "")} |`);
    }
    linhas.push("");
  }
}

writeFileSync(join(raiz, "..", "docs", "revisao-en-US.md"), linhas.join("\n"));
console.log(`docs/revisao-en-US.md: ${Object.keys(revisao).length} chaves`);
