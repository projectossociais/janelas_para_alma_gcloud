import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { FICHEIROS_FACE_MESH, VERSAO_FACE_MESH, localizarFicheiroFaceMesh } from "./ficheirosFaceMesh";

const PASTA = resolve(process.cwd(), "node_modules/@mediapipe/face_mesh");
/** Não são pedidos em tempo de execução: o código entra no pacote; o resto é documentação/tipos. */
const NAO_PEDIDOS = new Set(["face_mesh.js", "index.d.ts", "package.json", "README.md"]);

describe("ficheiros do FaceMesh servidos pelo próprio site", () => {
  it("todos os ficheiros do pacote que o MediaPipe pode pedir estão mapeados (nenhum vai à CDN)", () => {
    const pedidos = readdirSync(PASTA).filter((f) => !NAO_PEDIDOS.has(f));
    for (const f of pedidos) {
      expect(FICHEIROS_FACE_MESH[f], f).toBeTruthy();
      expect(localizarFicheiroFaceMesh(f)).not.toContain("cdn.jsdelivr.net");
    }
  });

  it("a versão do mapa é a instalada (uma actualização do pacote obriga a rever o mapa)", () => {
    const pacote = JSON.parse(readFileSync(resolve(PASTA, "package.json"), "utf-8")) as { version: string };
    expect(pacote.version).toBe(VERSAO_FACE_MESH);
  });

  it("um ficheiro desconhecido continua a funcionar pela CDN", () => {
    expect(localizarFicheiroFaceMesh("outro.bin")).toBe(
      `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh@${VERSAO_FACE_MESH}/outro.bin`,
    );
  });
});
