import { describe, expect, it } from "vitest";
import { nomeDaSessao } from "./rotulos";
import ptAO from "@/i18n/locales/pt-AO.json";

const V = ptAO.Visao;

describe("nomeDaSessao", () => {
  it("as sessões dos exercícios sem óculos levam o nome actual", () => {
    expect(nomeDaSessao({ exercicio_id: "figure8", sinais: { ao_longe: true } })).toBe(V.acuidadeTitulo);
    expect(nomeDaSessao({ exercicio_id: "cerebro", sinais: { modo: "fio_missangas" } })).toBe(V.contrasteTitulo);
    expect(nomeDaSessao({ exercicio_id: "estereopsia", sinais: { modo: "agulha" } })).toBe(V.estereoTitulo);
    expect(nomeDaSessao({ exercicio_id: "flexibilidade-acomodativa", sinais: { modo: "tapa_olho_horas" } })).toBe(V.pertoLongeTitulo);
    expect(nomeDaSessao({ exercicio_id: "convergence", sinais: { modo: "fusao_livre", pontes: {} } })).toBe(V.convergenciaTitulo);
  });

  it("as sessões antigas com o mesmo id levam o nome do teste que as gravou", () => {
    expect(nomeDaSessao({ exercicio_id: "figure8", sinais: { aglomeracao: true } })).toBe(V.nomeAntigoAcuidadePerto);
    expect(nomeDaSessao({ exercicio_id: "cerebro", sinais: null })).toBe(V.nomeAntigoContraste);
    expect(nomeDaSessao({ exercicio_id: "relax", sinais: {} })).toBe(V.nomeAntigoAstigmatismo);
    expect(nomeDaSessao({ exercicio_id: "estereopsia", sinais: { oculos_verificados: true } })).toBe(V.estereoOculosTitulo);
    expect(nomeDaSessao({ exercicio_id: "sacadas-convergencia", sinais: {} })).toBe(V.nomeAntigoContrasteBlocos);
    expect(nomeDaSessao({ exercicio_id: "flexibilidade-acomodativa", sinais: {} })).toBe(V.nomeAntigoPertoLonge);
    expect(nomeDaSessao({ exercicio_id: "convergence", sinais: { pontes: {} } })).toBe(V.pontesTitulo);
  });
});
