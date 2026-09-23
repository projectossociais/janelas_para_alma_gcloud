/**
 * Guarda contra texto português escrito directamente no código público, fora
 * de pt-AO.json: numa página inglesa apareceria em português (foi o caso de
 * mensagens de validação zod e de placeholders "email@exemplo.com").
 *
 * Procura literais de string com acentuação portuguesa. Comentários e
 * console.* são ignorados. As excepções abaixo são valores estáveis (chaves
 * de API) ou nomes próprios -- cada uma com o porquê.
 */
const fontes = import.meta.glob(
  [
    "/src/**/*.{ts,tsx}",
    "!/src/**/*.test.{ts,tsx}",
    "!/src/components/ui/**",
    "!/src/integrations/**",
    "!/src/pages/admin/**",
    "!/src/components/admin/**",
    "!/src/pages/RoadmapTecnico.tsx", // interno, só PT
    "!/src/pages/jogo/perguntasOffline.ts", // banco de perguntas offline, fora da Fase 3
    "!/src/i18n/**",
  ],
  { query: "?raw", import: "default", eager: true },
) as Record<string, string>;

const PERMITIDOS = new Set([
  // valores de diagnóstico: chave estável enviada/lida da API; o rótulo é traduzido
  "Alinhamento Fisiológico Normal",
  "Necessária Avaliação Oftalmológica",
  // províncias (nomes próprios)
  "Bié",
  "Huíla",
  "Uíge",
  // morada da Optioptika (nome próprio)
  "Urbanização Nova Vida, Rua 54, Centro Empresarial Living-Luanda, Lote 9, Luanda, Angola",
  // erros internos que nunca chegam ao ecrã em inglês (o ApiError é mapeado
  // por código HTTP; os do logótipo são apanhados com .catch(() => null))
  "Não foi possível enviar a imagem para o storage.",
  "Canvas indisponível para preparar o logótipo.",
  "Falha ao carregar o logótipo.",
]);

const LITERAL = /"((?:[^"\\\n]|\\.)*)"|'((?:[^'\\\n]|\\.)*)'|`((?:[^`\\]|\\.)*)`/g;
const ACENTO_PT = /[ãõçáàâéêíóôúÃÕÇÁÉÍÓÚ]/;

it("não há texto português escrito directamente no código público (fora de pt-AO.json)", () => {
  const achados: string[] = [];
  for (const [ficheiro, codigo] of Object.entries(fontes)) {
    codigo.split("\n").forEach((linha, i) => {
      const t = linha.trim();
      if (t.startsWith("//") || t.startsWith("*") || t.startsWith("/*") || t.startsWith("{/*")) return;
      if (/console\.(log|warn|error|info)\(/.test(t)) return;
      const semComentario = linha.replace(/\s\/\/\s.*$/, "");
      for (const m of semComentario.matchAll(LITERAL)) {
        const s = m[1] ?? m[2] ?? m[3] ?? "";
        if (ACENTO_PT.test(s) && !PERMITIDOS.has(s)) achados.push(`${ficheiro}:${i + 1}  ${s.slice(0, 70)}`);
      }
    });
  }
  expect(achados).toEqual([]);
});
