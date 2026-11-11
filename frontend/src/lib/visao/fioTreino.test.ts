import { describe, expect, it } from "vitest";
import {
  ESPERA_MS,
  FOLGA_CM,
  avancarFio,
  iniciarFioTreino,
  posicaoNoTreino,
  resumirFioTreino,
  retomarFio,
  tocarFio,
  type EstadoFioTreino,
} from "./fioTreino";

const INICIO = 12;
/** Avança o relógio e aplica o que acontece sozinho. */
const passar = (e: EstadoFioTreino, agora: number) => avancarFio(e, agora, INICIO);

describe("Vaivém da Missanga (treino do Fio)", () => {
  it("parte parada do topo, e só começa a descer depois da espera", () => {
    const e = iniciarFioTreino(INICIO, 0);
    expect(posicaoNoTreino(e, 500, INICIO)).toBe(12);
    expect(passar(e, 500).estado.fase).toBe("espera");
    const a = passar(e, ESPERA_MS).estado;
    expect(a.fase).toBe("aproximar");
    // 1,5 cm por segundo.
    expect(posicaoNoTreino(a, ESPERA_MS + 2000, INICIO)).toBe(9);
  });

  it("um vaivém: dobra, volta a ser uma, afasta-se mais um pouco e volta a descer daí", () => {
    let e = passar(iniciarFioTreino(INICIO, 0), ESPERA_MS).estado;
    let t = ESPERA_MS + 4000; // 12 -> 6 cm
    const rot = tocarFio(e, t, INICIO);
    expect(rot.evento).toBe("rotura");
    expect(rot.estado).toMatchObject({ fase: "afastar", rotura: 6 });
    e = rot.estado;

    t += 2000; // 6 -> 9 cm
    const rec = tocarFio(e, t, INICIO);
    expect(rec.evento).toBe("recuperacao");
    expect(rec.estado.reps).toEqual([{ rotura: 6, recuperacao: 9 }]);
    expect(rec.estado).toMatchObject({ fase: "folga", alvo: 9 + FOLGA_CM });
    e = rec.estado;

    // A folga não aceita toques, e ao chegar ao alvo a missanga volta a descer daí.
    expect(tocarFio(e, t + 100, INICIO).estado).toBe(e);
    t += 2000;
    e = passar(e, t).estado;
    expect(e).toMatchObject({ fase: "aproximar", desde: 11 });
    expect(e.reps).toHaveLength(1);
  });

  it("um segundo toque logo a seguir a 'ficou a dobrar' é o mesmo toque, não a recuperação", () => {
    const e = tocarFio(passar(iniciarFioTreino(INICIO, 0), ESPERA_MS).estado, ESPERA_MS + 2000, INICIO).estado;
    expect(tocarFio(e, ESPERA_MS + 2200, INICIO).estado).toBe(e);
  });

  it("chegar ao nariz sem dobrar conta como repetição a 0 cm e recomeça do topo", () => {
    const e = passar(iniciarFioTreino(INICIO, 0), ESPERA_MS).estado;
    const r = passar(e, ESPERA_MS + 60_000);
    expect(r.evento).toBe("nariz");
    expect(r.estado).toMatchObject({ fase: "espera", desde: INICIO });
    expect(r.estado.reps).toEqual([{ rotura: 0, recuperacao: 0 }]);
  });

  it("voltar ao topo sem a missanga voltar a ser uma fica registado, sem recuperação", () => {
    let e = passar(iniciarFioTreino(INICIO, 0), ESPERA_MS).estado;
    e = tocarFio(e, ESPERA_MS + 2000, INICIO).estado; // dobra aos 9 cm
    const r = passar(e, ESPERA_MS + 60_000);
    expect(r.evento).toBe("semRecuperar");
    expect(r.estado.reps).toEqual([{ rotura: 9, recuperacao: null }]);
    expect(r.estado.fase).toBe("espera");
  });

  it("depois de uma pausa, a missanga retoma de onde ficou, sem salto", () => {
    const e = passar(iniciarFioTreino(INICIO, 0), ESPERA_MS).estado;
    const onde = posicaoNoTreino(e, ESPERA_MS + 2000, INICIO); // 9 cm
    const r = retomarFio(e, onde, 500_000);
    expect(posicaoNoTreino(r, 500_000, INICIO)).toBe(9);
    expect(posicaoNoTreino(r, 501_000, INICIO)).toBe(7.5);
  });

  it("o resumo dá a mediana, a melhor vez e as vezes que chegou ao nariz", () => {
    expect(resumirFioTreino([])).toEqual({ repeticoes: 0, medianaCm: null, melhorCm: null, narizes: 0, semRecuperar: 0 });
    expect(
      resumirFioTreino([
        { rotura: 8, recuperacao: 10 },
        { rotura: 6, recuperacao: null },
        { rotura: 0, recuperacao: 0 },
        { rotura: 7, recuperacao: 9 },
      ]),
    ).toEqual({ repeticoes: 4, medianaCm: 6.5, melhorCm: 0, narizes: 1, semRecuperar: 1 });
  });
});
