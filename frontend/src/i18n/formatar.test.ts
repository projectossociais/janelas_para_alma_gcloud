import i18n from "./index";
import { formatarData, formatarDataHora, formatarDiaCivil } from "./formatar";

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

describe("formatarDiaCivil", () => {
  // Caso real (2026-10-09): "2026-10-08" lido por `new Date()` é meia-noite UTC;
  // num aparelho a oeste de UTC (ex.: Brasil), mostrava "07/10/2026".
  it("mostra o dia escrito, mesmo num fuso a oeste de UTC", () => {
    const tzAntes = process.env.TZ;
    process.env.TZ = "America/Sao_Paulo";
    try {
      expect(formatarData("2026-10-08")).toBe("07/10/2026"); // o defeito, com a função antiga
      expect(formatarDiaCivil("2026-10-08")).toBe("08/10/2026");
    } finally {
      process.env.TZ = tzAntes;
    }
  });

  it("um valor que não é um dia fica como está", () => {
    expect(formatarDiaCivil("brevemente")).toBe("brevemente");
  });
});
