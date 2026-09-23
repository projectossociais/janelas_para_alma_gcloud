import i18n from "./index";
import { formatarData, formatarDataHora } from "./formatar";

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
