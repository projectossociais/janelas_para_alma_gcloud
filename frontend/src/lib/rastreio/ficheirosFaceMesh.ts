import binarypb from "@mediapipe/face_mesh/face_mesh.binarypb?url";
import dadosEmpacotados from "@mediapipe/face_mesh/face_mesh_solution_packed_assets.data?url";
import carregadorDados from "@mediapipe/face_mesh/face_mesh_solution_packed_assets_loader.js?url";
import simdDados from "@mediapipe/face_mesh/face_mesh_solution_simd_wasm_bin.data?url";
import simdJs from "@mediapipe/face_mesh/face_mesh_solution_simd_wasm_bin.js?url";
import simdWasm from "@mediapipe/face_mesh/face_mesh_solution_simd_wasm_bin.wasm?url";
import wasmJs from "@mediapipe/face_mesh/face_mesh_solution_wasm_bin.js?url";
import wasm from "@mediapipe/face_mesh/face_mesh_solution_wasm_bin.wasm?url";

/**
 * Ficheiros do modelo do FaceMesh servidos pelo próprio site, em vez da CDN
 * (jsDelivr): a CDN pode ser lenta ou estar bloqueada em Angola, e o rastreio não
 * deve depender de um terceiro para funcionar. O Vite publica-os com o nome a
 * mudar a cada versão, por isso ficam em cache permanente no telemóvel.
 *
 * `face_mesh.js` (o código) entra no pacote normalmente; o resto é pedido pelo
 * MediaPipe em tempo de execução, pelo nome, através de `locateFile`.
 */
export const VERSAO_FACE_MESH = "0.4.1633559619";
const CDN = `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh@${VERSAO_FACE_MESH}`;

export const FICHEIROS_FACE_MESH: Readonly<Record<string, string>> = {
  "face_mesh.binarypb": binarypb,
  "face_mesh_solution_packed_assets.data": dadosEmpacotados,
  "face_mesh_solution_packed_assets_loader.js": carregadorDados,
  "face_mesh_solution_simd_wasm_bin.data": simdDados,
  "face_mesh_solution_simd_wasm_bin.js": simdJs,
  "face_mesh_solution_simd_wasm_bin.wasm": simdWasm,
  "face_mesh_solution_wasm_bin.js": wasmJs,
  "face_mesh_solution_wasm_bin.wasm": wasm,
};

/** Para `locateFile`: o ficheiro local; se algum faltar no mapa, a CDN (como até aqui). */
export const localizarFicheiroFaceMesh = (nome: string) => FICHEIROS_FACE_MESH[nome] ?? `${CDN}/${nome}`;
