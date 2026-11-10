import { afterEach, describe, expect, it, vi } from "vitest";
import {
  comprasConfiguradas,
  comprasPelaLoja,
  esperarPelaApi,
  foiCancelada,
  produtoDiamantes,
  produtoMoedas,
} from "./comprasLoja";

type JanelaComCapacitor = { Capacitor?: unknown };

afterEach(() => {
  delete (window as unknown as JanelaComCapacitor).Capacitor;
  vi.unstubAllEnvs();
});

describe("comprasLoja", () => {
  it("ids dos produtos iguais aos da API (compra_loja_service.py)", () => {
    expect(produtoDiamantes("grande")).toBe("jpa_diamantes_grande");
    expect(produtoMoedas("bau")).toBe("jpa_moedas_bau");
  });

  it("no browser nunca usa a loja", () => {
    expect(comprasPelaLoja()).toBe(false);
    expect(comprasConfiguradas()).toBe(false);
  });

  it("na app usa a loja, mas só está configurada com a chave da plataforma", () => {
    (window as unknown as JanelaComCapacitor).Capacitor = {
      isNativePlatform: () => true,
      getPlatform: () => "android",
    };
    vi.stubEnv("VITE_REVENUECAT_CHAVE_ANDROID", "");
    expect(comprasPelaLoja()).toBe(true);
    expect(comprasConfiguradas()).toBe(false);
    vi.stubEnv("VITE_REVENUECAT_CHAVE_ANDROID", "goog_teste");
    expect(comprasConfiguradas()).toBe(true);
  });

  it("reconhece a desistência na folha de pagamento", () => {
    expect(foiCancelada({ userCancelled: true })).toBe(true);
    expect(foiCancelada({ code: "1" })).toBe(true);
    expect(foiCancelada(new Error("rede"))).toBe(false);
    expect(foiCancelada(null)).toBe(false);
  });
});

describe("esperarPelaApi", () => {
  it("devolve o valor quando a API já mostra a compra", async () => {
    const ler = vi
      .fn()
      .mockResolvedValueOnce({ estado: "trial_terminado" })
      .mockRejectedValueOnce(new Error("rede"))
      .mockResolvedValueOnce({ estado: "premium" });
    const valor = await esperarPelaApi(ler, (a: { estado: string }) => a.estado === "premium", { intervaloMs: 0 });
    expect(valor).toEqual({ estado: "premium" });
    expect(ler).toHaveBeenCalledTimes(3);
  });

  it("devolve null quando o tempo acaba -- nunca finge que correu bem", async () => {
    const ler = vi.fn().mockResolvedValue({ estado: "trial_terminado" });
    const valor = await esperarPelaApi(ler, (a: { estado: string }) => a.estado === "premium", { tentativas: 3, intervaloMs: 0 });
    expect(valor).toBeNull();
    expect(ler).toHaveBeenCalledTimes(3);
  });
});
