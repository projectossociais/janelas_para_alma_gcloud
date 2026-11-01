import { afterEach, describe, expect, it } from "vitest";
import { estaNaAppNativa, plataformaDaApp } from "./appNativa";

type JanelaComCapacitor = { Capacitor?: unknown };

afterEach(() => {
  delete (window as unknown as JanelaComCapacitor).Capacitor;
});

describe("estaNaAppNativa", () => {
  it("é falso num browser normal", () => {
    expect(estaNaAppNativa()).toBe(false);
    expect(plataformaDaApp()).toBe("web");
  });

  it("é verdadeiro dentro da app Android", () => {
    (window as unknown as JanelaComCapacitor).Capacitor = {
      isNativePlatform: () => true,
      getPlatform: () => "android",
    };
    expect(estaNaAppNativa()).toBe(true);
    expect(plataformaDaApp()).toBe("android");
  });

  it("é falso quando o Capacitor diz que é web", () => {
    (window as unknown as JanelaComCapacitor).Capacitor = {
      isNativePlatform: () => false,
      getPlatform: () => "web",
    };
    expect(estaNaAppNativa()).toBe(false);
    expect(plataformaDaApp()).toBe("web");
  });
});
