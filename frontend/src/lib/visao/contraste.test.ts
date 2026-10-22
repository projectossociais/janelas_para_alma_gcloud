import { linearParaSrgb, srgbParaLinear } from "./contraste";

describe("contraste", () => {
  it("sRGB <-> linear são inversas", () => {
    for (const x of [0, 0.01, 0.2, 0.5, 0.9, 1]) expect(linearParaSrgb(srgbParaLinear(x))).toBeCloseTo(x, 9);
  });

  it("50% de luminância não é sRGB 50%: a curva não é linear", () => {
    expect(Math.round(linearParaSrgb(0.5) * 255)).toBe(188);
  });
});
