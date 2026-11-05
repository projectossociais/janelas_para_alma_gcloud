import i18n from "./index";
import { formatarData, formatarDataHora, formatarDiaCurto } from "./formatar";

const DATA = "2026-09-23T14:05:00";

describe("formatarData / formatarDataHora", () => {
  afterEach(() => void i18n.changeLanguage("pt-AO"));

  it("em português mantém exactamente o formato pt-PT de sempre", () => {
    void i18n.changeLanguage("pt-AO");
    expect(formatarData(DATA)).toBe(new Date(DATA).toLocaleDateString("pt-PT"));
    expect(formatarDataHora(DATA)).toBe(new Date(DATA).toLocaleString("pt-PT"));
  });

  it("em inglês usa o formato americano por extenso", () => {
    void i18n.changeLanguage("en-US");
    expect(formatarData(DATA)).toBe("September 23, 2026");
    expect(formatarDataHora(DATA)).toMatch(/^September 23, 2026(,| at) 2:05\s?PM$/);
  });
});

describe("datas sem hora (AAAA-MM-DD)", () => {
  // `new Date("2026-09-12")` é meia-noite UTC: em fusos a oeste de UTC
  // (Américas) isso ainda é dia 11. Uma data de calendário (data de um
  // evento, de uma medição) tem de mostrar sempre o mesmo dia, em qualquer fuso.
  const tzOriginal = process.env.TZ;
  beforeEach(() => {
    process.env.TZ = "America/Phoenix";
  });
  afterEach(() => {
    process.env.TZ = tzOriginal;
    void i18n.changeLanguage("pt-AO");
  });

  it("mostra o próprio dia em português, mesmo num fuso a oeste de UTC", () => {
    void i18n.changeLanguage("pt-AO");
    expect(formatarData("2026-09-12")).toBe("12/09/2026");
    expect(formatarDiaCurto("2026-09-12")).toBe("12/09");
  });

  it("mostra o próprio dia em inglês, mesmo num fuso a oeste de UTC", () => {
    void i18n.changeLanguage("en-US");
    expect(formatarData("2026-09-12")).toBe("September 12, 2026");
    expect(formatarDiaCurto("2026-09-12")).toBe("Sep 12");
  });

  it("não mexe em datas com hora (continuam a ser um instante)", () => {
    void i18n.changeLanguage("pt-AO");
    const instante = "2026-09-12T00:30:00Z";
    expect(formatarData(instante)).toBe(new Date(instante).toLocaleDateString("pt-PT"));
  });
});
