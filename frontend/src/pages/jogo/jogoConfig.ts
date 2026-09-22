import type { RespostaOpcaoJogo } from "@/lib/apiClient";

export const TOTAL_PATAMARES = 15;
export const OPCOES: RespostaOpcaoJogo[] = ["A", "B", "C", "D"];

interface Patamar {
  numero: number;
  valorKz: number;
}

export const PATAMARES: Patamar[] = [
  { numero: 1, valorKz: 500 },
  { numero: 2, valorKz: 1_000 },
  { numero: 3, valorKz: 2_000 },
  { numero: 4, valorKz: 3_500 },
  { numero: 5, valorKz: 5_000 },
  { numero: 6, valorKz: 7_500 },
  { numero: 7, valorKz: 12_500 },
  { numero: 8, valorKz: 20_000 },
  { numero: 9, valorKz: 35_000 },
  { numero: 10, valorKz: 50_000 },
  { numero: 11, valorKz: 100_000 },
  { numero: 12, valorKz: 175_000 },
  { numero: 13, valorKz: 300_000 },
  { numero: 14, valorKz: 500_000 },
  { numero: 15, valorKz: 1_000_000 },
];

// `toLocaleString("pt-PT")` não agrupa consistentemente valores abaixo de
// 10.000 (dá "1000" mas "12 500") -- em vez de depender disso, formatamos
// os milhares à mão com "." (mesma escrita usada em Angola/Portugal).
export const formatarKz = (valor: number) =>
  `Kz ${valor.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".")}`;

export const valorDoPatamar = (numero: number) =>
  PATAMARES.find((p) => p.numero === numero)?.valorKz ?? 0;

const MOEDAS_POR_PATAMAR = 50;

// Espelha exactamente `calcular_recompensa` do backend (ver
// api/app/repositories/perfil_jogador_repository.py) -- só para mostrar o
// prémio de imediato no ecrã final. Quem decide o valor que fica gravado
// na conta é sempre o servidor; isto nunca é enviado, só exibido.
export const calcularRecompensaCliente = (patamarAlcancado: number): { moedas: number; diamantes: number } => {
  const moedas = patamarAlcancado * MOEDAS_POR_PATAMAR;
  const diamantes = patamarAlcancado >= 15 ? 5 : patamarAlcancado >= 10 ? 2 : patamarAlcancado >= 5 ? 1 : 0;
  return { moedas, diamantes };
};
