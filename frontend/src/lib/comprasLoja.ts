import { estaNaAppNativa, plataformaDaApp } from "@/lib/appNativa";

/**
 * Compras dentro da app nativa, pela App Store ou pelo Google Play
 * (2026-10-30). As lojas não aceitam vender o Premium nem diamantes/moedas
 * por transferência + comprovativo dentro de uma app; na app, essas páginas
 * compram por aqui.
 *
 * O SDK do RevenueCat (`@revenuecat/purchases-capacitor`) fala com a loja e
 * confirma o recibo; o RevenueCat avisa a nossa API pelo webhook
 * (`api/app/routers/webhooks.py`), que é quem dá o Premium ou o saldo. **Este
 * módulo nunca credita nada**: depois de comprar, espera que a API o mostre
 * (`esperarPelaApi`). O SDK só se carrega dentro da app (import dinâmico).
 *
 * Os ids dos produtos têm de ser iguais nas consolas das lojas e em
 * `compra_loja_service.py`; os preços vivem só nas consolas.
 */

export const PRODUTO_PREMIUM_MENSAL = "jpa_premium_mensal";
export const produtoDiamantes = (pacoteId: string) => `jpa_diamantes_${pacoteId}`;
export const produtoMoedas = (pacoteId: string) => `jpa_moedas_${pacoteId}`;

/** Dentro da app, as compras são sempre pela loja -- nunca por transferência. */
export function comprasPelaLoja(): boolean {
  return estaNaAppNativa();
}

function chaveDaPlataforma(): string | undefined {
  const plataforma = plataformaDaApp();
  if (plataforma === "ios") return import.meta.env.VITE_REVENUECAT_CHAVE_IOS as string | undefined;
  if (plataforma === "android") return import.meta.env.VITE_REVENUECAT_CHAVE_ANDROID as string | undefined;
  return undefined;
}

/** A chave pública do RevenueCat para esta plataforma está configurada. */
export function comprasConfiguradas(): boolean {
  return comprasPelaLoja() && !!chaveDaPlataforma();
}

let configuradoPara: string | null = null;

async function sdk(utilizadorId: string) {
  const apiKey = chaveDaPlataforma();
  if (!apiKey) throw new Error("compras na loja sem chave configurada");
  const { Purchases } = await import("@revenuecat/purchases-capacitor");
  // `app_user_id` = id da conta: é por ele que o webhook sabe a quem dar a compra.
  if (configuradoPara === null) {
    await Purchases.configure({ apiKey, appUserID: utilizadorId });
  } else if (configuradoPara !== utilizadorId) {
    await Purchases.logIn({ appUserID: utilizadorId });
  }
  configuradoPara = utilizadorId;
  return Purchases;
}

async function produtoDaLoja(utilizadorId: string, produtoId: string, subscricao: boolean) {
  const Purchases = await sdk(utilizadorId);
  const { PRODUCT_CATEGORY } = await import("@revenuecat/purchases-capacitor");
  const { products } = await Purchases.getProducts({
    productIdentifiers: [produtoId],
    type: subscricao ? PRODUCT_CATEGORY.SUBSCRIPTION : PRODUCT_CATEGORY.NON_SUBSCRIPTION,
  });
  // No Google Play, uma subscrição vem como "subscricao:plano_base".
  const produto = products.find((p) => p.identifier === produtoId || p.identifier.startsWith(`${produtoId}:`));
  return { Purchases, produto };
}

/** Preço como a loja o mostra (moeda e formato do país da conta da loja). */
export async function precoNaLoja(utilizadorId: string, produtoId: string, subscricao = false): Promise<string | null> {
  const { produto } = await produtoDaLoja(utilizadorId, produtoId, subscricao);
  return produto?.priceString ?? null;
}

export type ResultadoCompra = "comprado" | "cancelado";

/** Abre a folha de pagamento da loja. "cancelado" se a pessoa desistiu;
 *  qualquer outra falha levanta o erro. */
export async function comprarNaLoja(
  utilizadorId: string,
  produtoId: string,
  subscricao = false
): Promise<ResultadoCompra> {
  const { Purchases, produto } = await produtoDaLoja(utilizadorId, produtoId, subscricao);
  if (!produto) throw new Error(`a loja devolveu sem o produto ${produtoId}`);
  try {
    await Purchases.purchaseStoreProduct({ product: produto });
    return "comprado";
  } catch (err) {
    if (foiCancelada(err)) return "cancelado";
    throw err;
  }
}

/** "Restaurar compras" -- exigido pela App Store para subscrições. */
export async function restaurarCompras(utilizadorId: string): Promise<void> {
  const Purchases = await sdk(utilizadorId);
  await Purchases.restorePurchases();
}

/** Duck-typing: o erro do SDK traz `userCancelled` (ou o código 1). */
export function foiCancelada(err: unknown): boolean {
  const e = err as { userCancelled?: unknown; code?: unknown } | null;
  return e?.userCancelled === true || e?.code === "1" || e?.code === 1;
}

/**
 * Lê a API até `pronto` dizer que a compra já lá está (o webhook pode
 * demorar uns segundos). `null` se o tempo acabar -- quem chama nunca mostra
 * sucesso nesse caso.
 */
export async function esperarPelaApi<T>(
  ler: () => Promise<T>,
  pronto: (valor: T) => boolean,
  { tentativas = 15, intervaloMs = 2000 }: { tentativas?: number; intervaloMs?: number } = {}
): Promise<T | null> {
  for (let i = 0; i < tentativas; i++) {
    try {
      const valor = await ler();
      if (pronto(valor)) return valor;
    } catch {
      // Uma leitura falhada não pára a espera.
    }
    if (i < tentativas - 1) await new Promise((r) => setTimeout(r, intervaloMs));
  }
  return null;
}
