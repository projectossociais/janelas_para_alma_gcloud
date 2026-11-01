/**
 * O site corre dentro da app nativa (Google Play / App Store)?
 *
 * A app é o próprio site publicado, aberto pelo Capacitor (ver
 * capacitor.config.ts e docs/APP_LOJAS.md). O Capacitor injecta
 * `window.Capacitor` na página; num browser normal não existe. Lê-se o global
 * em vez de importar `@capacitor/core`, para o bundle do site não crescer.
 */
interface CapacitorGlobal {
  isNativePlatform?: () => boolean;
  getPlatform?: () => string;
}

function capacitor(): CapacitorGlobal | undefined {
  if (typeof window === "undefined") return undefined;
  return (window as unknown as { Capacitor?: CapacitorGlobal }).Capacitor;
}

export function estaNaAppNativa(): boolean {
  return capacitor()?.isNativePlatform?.() === true;
}

/** "android", "ios" ou "web". */
export function plataformaDaApp(): string {
  return estaNaAppNativa() ? capacitor()?.getPlatform?.() ?? "web" : "web";
}
