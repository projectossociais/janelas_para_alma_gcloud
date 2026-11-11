import i18n from "./index";
import {
  chaveDiaEmLuanda,
  formatarData,
  formatarDataHora,
  formatarDiaConsulta,
  formatarDiaCurto,
  formatarHoraConsulta,
  formatarHorarioConsulta,
} from "./formatar";

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

describe("formatarHorarioConsulta", () => {
  // As clínicas definem o horário em hora de Luanda; um browser noutro fuso
  // mostrava as consultas da Optioptika a horas fora do expediente.
  const tzOriginal = process.env.TZ;
  const OITO_DE_LUANDA = "2026-11-09T07:00:00Z"; // segunda-feira, 08:00 em Luanda
  const DEZASSEIS_E_TRINTA = "2026-11-09T15:30:00Z"; // 16:30 em Luanda
  beforeEach(() => {
    process.env.TZ = "America/Sao_Paulo";
  });
  afterEach(() => {
    process.env.TZ = tzOriginal;
    void i18n.changeLanguage("pt-AO");
  });

  it("mostra a hora de Luanda em 24h, em português, num browser noutro fuso", () => {
    void i18n.changeLanguage("pt-AO");
    expect(formatarHorarioConsulta(OITO_DE_LUANDA)).toMatch(/^segunda-feira, 09\/11\/2026,? (às )?08:00$/);
    expect(formatarHorarioConsulta(DEZASSEIS_E_TRINTA)).toMatch(/16:30$/);
  });

  it("em inglês também usa 24h e a hora de Luanda, nunca AM/PM", () => {
    void i18n.changeLanguage("en-US");
    const texto = formatarHorarioConsulta(DEZASSEIS_E_TRINTA);
    expect(texto).toMatch(/^Monday, November 9, 2026(,| at) 16:30$/);
    expect(texto).not.toMatch(/AM|PM/);
  });
});

describe("dia e hora de uma consulta, separados", () => {
  const tzOriginal = process.env.TZ;
  // 23:30 UTC de domingo já é segunda 00:30 em Luanda.
  const MEIA_NOITE_E_MEIA = "2027-01-03T23:30:00Z";
  beforeEach(() => {
    process.env.TZ = "America/Phoenix";
  });
  afterEach(() => {
    process.env.TZ = tzOriginal;
    void i18n.changeLanguage("pt-AO");
  });

  it("agrupa pelo dia de Luanda, não pelo do computador", () => {
    expect(chaveDiaEmLuanda(MEIA_NOITE_E_MEIA)).toBe("2027-01-04");
  });

  it("em português", () => {
    void i18n.changeLanguage("pt-AO");
    expect(formatarDiaConsulta(MEIA_NOITE_E_MEIA)).toBe("segunda-feira, 04/01/2027");
    expect(formatarHoraConsulta(MEIA_NOITE_E_MEIA)).toBe("00:30");
  });

  it("em inglês, também em 24h", () => {
    void i18n.changeLanguage("en-US");
    expect(formatarDiaConsulta(MEIA_NOITE_E_MEIA)).toBe("Monday, January 4, 2027");
    expect(formatarHoraConsulta(MEIA_NOITE_E_MEIA)).toBe("00:30");
  });
});
