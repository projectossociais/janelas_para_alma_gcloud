import { describe, expect, it } from "vitest";
import { cn as cnGenerico } from "@/lib/utils";
import { cn } from "./cn";

describe("cn do sistema de design", () => {
  it("reproduz o problema: o cn genérico apaga o tamanho quando há uma cor a seguir", () => {
    expect(cnGenerico("text-corpo", "text-tinta")).toBe("text-tinta");
  });

  it("mantém tamanho e cor, que são grupos diferentes", () => {
    expect(cn("text-corpo", "text-tinta")).toBe("text-corpo text-tinta");
  });

  it("resolve conflitos dentro do mesmo grupo (o último ganha)", () => {
    expect(cn("text-corpo", "text-titulo-p")).toBe("text-titulo-p");
    expect(cn("text-tinta", "text-accao")).toBe("text-accao");
    expect(cn("rounded-controlo", "rounded-pilula")).toBe("rounded-pilula");
    expect(cn("shadow-nivel-1", "shadow-nivel-2")).toBe("shadow-nivel-2");
    expect(cn("min-h-alvo-app", "min-h-alvo-crianca")).toBe("min-h-alvo-crianca");
  });
});
