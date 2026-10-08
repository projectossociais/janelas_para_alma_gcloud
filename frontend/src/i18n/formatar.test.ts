import i18n from "./index";
import { formatarData, formatarDataHora } from "./formatar";

const DATA = "2026-09-23T14:05:00";

describe("formatarData / formatarDataHora", () => {
  afterEach(() => void i18n.changeLanguage("pt-AO"));

  it("em português mantém exactamente o formato pt-PT de sempre", () => {
    void i18n.changeLanguage("pt-AO");
    expect(formatarData(DATA)).toBe(new Date(DATA).toLocaleDateString("pt-PT"));
    const d = new Date(DATA);
    const dois = (n: number) => String(n).padStart(2, "0");
    // Dia, mês, ano, hora e minutos; nunca os segundos.
    expect(formatarDataHora(DATA)).toBe(
      `${dois(d.getDate())}/${dois(d.getMonth() + 1)}/${d.getFullYear()}, ${dois(d.getHours())}:${dois(d.getMinutes())}`,
    );
  });

  it("em inglês usa o formato americano por extenso", () => {
    void i18n.changeLanguage("en-US");
    expect(formatarData(DATA)).toBe("September 23, 2026");
    expect(formatarDataHora(DATA)).toMatch(/^September 23, 2026(,| at) 2:05\s?PM$/);
  });
});
