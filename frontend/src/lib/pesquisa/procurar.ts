/**
 * Motor da pesquisa do site (a lupa do cabeçalho). TypeScript puro, sem React
 * nem traduções: recebe entradas já com o texto no idioma da página e devolve
 * as que respondem ao que a pessoa escreveu, por ordem de relevância.
 *
 * Regras:
 * - Sem acentos nem maiúsculas: "oculos" encontra "óculos".
 * - Todas as palavras escritas têm de aparecer na mesma entrada (as palavras
 *   de ligação -- "de", "o", "para" -- não contam).
 * - Basta o início da palavra ("estrab" encontra "estrabismo") e o plural não
 *   atrapalha ("doações" encontra "doação").
 * - Um erro de uma letra é tolerado no título, na descrição e nas
 *   palavras-chave ("estrabizmo"), mas vale menos do que acertar.
 * - Título pesa mais do que palavras-chave, estas mais do que a descrição, e
 *   o texto corrido da página é o que pesa menos. A palavra inteira vale o
 *   dobro do início de uma palavra ("conta" prefere "criar conta" a "contactos").
 */

export type TipoResultado = "pagina" | "exercicio" | "seccao" | "pergunta" | "publicacao" | "clinica";

export interface EntradaPesquisa {
  id: string;
  tipo: TipoResultado;
  titulo: string;
  descricao: string;
  /** Destino já no idioma da página (com âncora, se for uma secção). */
  caminho: string;
  /** Sinónimos e termos que as pessoas usam e que não estão no título. */
  palavras?: string;
  /** Texto corrido da página: cada elemento é uma frase ou um parágrafo. */
  textos?: readonly string[];
  /** Idioma do conteúdo, quando não é o da página (publicações, só em português). */
  lang?: string;
}

export interface ResultadoPesquisa {
  entrada: EntradaPesquisa;
  pontos: number;
  /** Frase da página onde a palavra aparece, quando não está no título nem na descrição. */
  excerto?: string;
}

const PESO = { titulo: 10, palavras: 8, descricao: 4, texto: 1 } as const;
/** O título de uma pergunta ou de uma publicação é uma frase: acertar numa palavra dele diz menos. */
const PESO_TITULO: Partial<Record<TipoResultado, number>> = { pergunta: 5, publicacao: 8 };
/** Quanto conta aparecer também nos outros campos, além do melhor. */
const REFORCO = 0.25;
/** Abaixo desta fracção dos pontos do melhor resultado, não se mostra. */
const CORTE = 0.15;
const ORDEM_TIPO: readonly TipoResultado[] = ["pagina", "exercicio", "seccao", "pergunta", "publicacao", "clinica"];
const TAMANHO_EXCERTO = 130;

const LIGACAO = new Set(
  (
    "a o e as os um uma uns umas de da do das dos em no na nos nas ao aos por para com sem que se ou " +
    "the of and to in on for is an at or with"
  ).split(" "),
);

/**
 * Minúsculas e sem acentos, **com o mesmo comprimento** do texto de entrada
 * (em NFC): a posição de uma letra no resultado é a posição dela no original,
 * que é o que permite realçar a palavra encontrada no texto com acentos.
 */
export function normalizar(texto: string): string {
  let out = "";
  for (let i = 0; i < texto.length; i++) {
    const base = texto[i].normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
    out += base.length === 1 ? base : (base[0] ?? " ");
  }
  return out;
}

const palavrasDe = (normalizado: string) => normalizado.split(/[^a-z0-9]+/).filter(Boolean);

/** As palavras que contam numa consulta (sem as de ligação, a não ser que só haja essas). */
export function termosDaConsulta(consulta: string): string[] {
  const todas = palavrasDe(normalizar(consulta.normalize("NFC")));
  const uteis = todas.filter((p) => !LIGACAO.has(p));
  return [...new Set(uteis.length ? uteis : todas)];
}

/** A palavra e as formas sem plural ("doacoes" -> "doacao", "oculos" -> "oculo"). */
function variantes(termo: string): string[] {
  const v = [termo];
  if (termo.length > 4) {
    if (termo.endsWith("oes") || termo.endsWith("aes")) v.push(`${termo.slice(0, -3)}ao`);
    if (termo.endsWith("ais")) v.push(`${termo.slice(0, -3)}al`);
    if (termo.endsWith("es")) v.push(termo.slice(0, -2));
    if (termo.endsWith("s")) v.push(termo.slice(0, -1));
  }
  return v;
}

/** `true` se as duas palavras diferem numa só letra (trocada, a mais ou a menos). */
function quaseIgual(a: string, b: string): boolean {
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  if (i === a.length && i === b.length) return true;
  const resto = (x: string, y: string) => x === y;
  return (
    resto(a.slice(i + 1), b.slice(i + 1)) || // letra trocada
    resto(a.slice(i + 1), b.slice(i)) || // letra a mais em `a`
    resto(a.slice(i), b.slice(i + 1)) // letra a menos em `a`
  );
}

/** Quanto vale um termo num conjunto de palavras: 2 igual, 1 início, 0,5 meio, 0 nada. */
const EXACTA = 2;

function forca(formas: readonly string[], palavras: ReadonlySet<string>): number {
  let melhor = 0;
  for (const forma of formas) {
    if (palavras.has(forma)) return EXACTA;
    for (const p of palavras) {
      if (p.startsWith(forma)) melhor = Math.max(melhor, 1);
      else if (forma.length >= 4 && p.includes(forma)) melhor = Math.max(melhor, 0.5);
    }
  }
  return melhor;
}

function forcaAproximada(termo: string, palavras: ReadonlySet<string>): number {
  if (termo.length < 5) return 0;
  for (const p of palavras) if (quaseIgual(termo, p)) return 0.4;
  return 0;
}

interface EntradaPreparada {
  entrada: EntradaPesquisa;
  titulo: string;
  palavrasTitulo: Set<string>;
  palavrasChave: Set<string>;
  palavrasDescricao: Set<string>;
  textos: { original: string; normalizado: string; palavras: Set<string> }[];
}

export type IndicePesquisa = readonly EntradaPreparada[];

/** Normaliza o índice uma vez; procurar a cada tecla fica barato. */
export function prepararIndice(entradas: readonly EntradaPesquisa[]): IndicePesquisa {
  const conjunto = (s: string | undefined) => new Set(palavrasDe(normalizar((s ?? "").normalize("NFC"))));
  return entradas.map((entrada) => ({
    entrada,
    titulo: normalizar(entrada.titulo.normalize("NFC")),
    palavrasTitulo: conjunto(entrada.titulo),
    palavrasChave: conjunto(entrada.palavras),
    palavrasDescricao: conjunto(entrada.descricao),
    textos: (entrada.textos ?? []).map((t) => {
      const original = t.normalize("NFC");
      const normalizado = normalizar(original);
      return { original, normalizado, palavras: new Set(palavrasDe(normalizado)) };
    }),
  }));
}

/** Corta a frase à volta da palavra encontrada, sem partir palavras a meio. */
function excertoDe(original: string, normalizado: string, formas: readonly string[]): string {
  if (original.length <= TAMANHO_EXCERTO) return original;
  const pos = Math.max(0, ...formas.map((f) => normalizado.search(new RegExp(`(^|[^a-z0-9])${f}`))));
  let inicio = Math.max(0, pos - Math.floor(TAMANHO_EXCERTO / 3));
  if (inicio > 0) {
    const espaco = original.indexOf(" ", inicio);
    inicio = espaco === -1 || espaco > pos ? inicio : espaco + 1;
  }
  let fim = Math.min(original.length, inicio + TAMANHO_EXCERTO);
  if (fim < original.length) {
    const espaco = original.lastIndexOf(" ", fim);
    if (espaco > inicio) fim = espaco;
  }
  return `${inicio > 0 ? "… " : ""}${original.slice(inicio, fim)}${fim < original.length ? " …" : ""}`;
}

export function procurar(indice: IndicePesquisa, consulta: string, limite = 20): ResultadoPesquisa[] {
  const termos = termosDaConsulta(consulta);
  if (!termos.length) return [];
  const frase = palavrasDe(normalizar(consulta.normalize("NFC"))).join(" ");

  const resultados: ResultadoPesquisa[] = [];
  for (const item of indice) {
    let pontos = 0;
    let excerto: string | undefined;
    let falhou = false;

    for (const termo of termos) {
      const formas = variantes(termo);
      const noTitulo =
        (PESO_TITULO[item.entrada.tipo] ?? PESO.titulo) *
        (forca(formas, item.palavrasTitulo) || forcaAproximada(termo, item.palavrasTitulo));
      const naDescricao =
        PESO.descricao * (forca(formas, item.palavrasDescricao) || forcaAproximada(termo, item.palavrasDescricao));
      const visivel = Math.max(noTitulo, naDescricao);
      const chave = PESO.palavras * (forca(formas, item.palavrasChave) || forcaAproximada(termo, item.palavrasChave));

      let noTexto = 0;
      let frase_: (typeof item.textos)[number] | undefined;
      // O texto corrido só interessa quando a palavra não está à vista no resultado.
      if (!visivel) {
        for (const t of item.textos) {
          const f = forca(formas, t.palavras);
          if (f > noTexto) {
            noTexto = f;
            frase_ = t;
            if (f >= EXACTA) break;
          }
        }
      }

      const melhor = Math.max(visivel, chave, PESO.texto * noTexto);
      if (!melhor) {
        falhou = true;
        break;
      }
      pontos += melhor + REFORCO * (noTitulo + naDescricao + chave + PESO.texto * noTexto - melhor);
      if (!excerto && frase_) excerto = excertoDe(frase_.original, frase_.normalizado, formas);
    }
    if (falhou) continue;

    if (item.titulo === frase) pontos += 12;
    else if (item.titulo.startsWith(`${frase} `)) pontos += 8;
    else if (termos.length > 1 && item.titulo.includes(frase)) pontos += 4;

    resultados.push({ entrada: item.entrada, pontos, excerto });
  }

  // Quem só roça a consulta (uma palavra perdida no texto) não acompanha um resultado forte.
  const melhor = Math.max(0, ...resultados.map((r) => r.pontos));
  return resultados
    .filter((r) => r.pontos >= melhor * CORTE)
    .sort(
      (a, b) =>
        b.pontos - a.pontos ||
        ORDEM_TIPO.indexOf(a.entrada.tipo) - ORDEM_TIPO.indexOf(b.entrada.tipo) ||
        a.entrada.titulo.localeCompare(b.entrada.titulo),
    )
    .slice(0, limite);
}

/**
 * Parte um texto em pedaços, marcando os que começam por uma palavra da
 * consulta -- para a mostrar a negrito no resultado.
 */
export function realcar(texto: string, consulta: string): { texto: string; forte: boolean }[] {
  const original = texto.normalize("NFC");
  const formas = termosDaConsulta(consulta).flatMap(variantes).sort((a, b) => b.length - a.length);
  if (!formas.length) return [{ texto: original, forte: false }];

  const normalizado = normalizar(original);
  const pedacos: { texto: string; forte: boolean }[] = [];
  const palavra = /[a-z0-9]+/g;
  let ultimo = 0;
  for (let m = palavra.exec(normalizado); m; m = palavra.exec(normalizado)) {
    const forma = formas.find((f) => m![0].startsWith(f));
    if (!forma) continue;
    if (m.index > ultimo) pedacos.push({ texto: original.slice(ultimo, m.index), forte: false });
    pedacos.push({ texto: original.slice(m.index, m.index + forma.length), forte: true });
    ultimo = m.index + forma.length;
  }
  if (ultimo < original.length) pedacos.push({ texto: original.slice(ultimo), forte: false });
  return pedacos;
}
