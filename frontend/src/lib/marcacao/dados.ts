/**
 * Os dados de contacto do pedido de consulta, validados antes de avançar. A
 * API volta a validar (Pydantic): isto serve para dizer o problema no campo
 * certo, antes de a pessoa chegar ao fim.
 */
export interface DadosContacto {
  nome: string;
  email: string;
  telefone: string;
  motivo: string;
}

export type CampoContacto = keyof DadosContacto;
export type ErroContacto = "nomeCurto" | "emailInvalido" | "telefoneInvalido" | "motivoLongo";
export type ErrosContacto = Partial<Record<CampoContacto, ErroContacto>>;

export const MAX_NOME = 100;
export const MAX_MOTIVO = 500;

/** Ordem dos campos no ecrã: o foco vai para o primeiro com erro. */
export const ORDEM_CAMPOS: readonly CampoContacto[] = ["nome", "email", "telefone", "motivo"];

export function validarContacto(d: DadosContacto): ErrosContacto {
  const erros: ErrosContacto = {};
  const nome = d.nome.trim();
  if (nome.length < 2 || nome.length > MAX_NOME) erros.nome = "nomeCurto";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email.trim()) || d.email.trim().length > 255) erros.email = "emailInvalido";
  // Aceita espaços, "+", parênteses e hífenes; conta só os algarismos
  // (9 em Angola, até 15 com o indicativo internacional).
  const algarismos = d.telefone.replace(/\D/g, "").length;
  if (!/^[\d\s+()-]+$/.test(d.telefone.trim()) || algarismos < 9 || algarismos > 15) erros.telefone = "telefoneInvalido";
  if (d.motivo.trim().length > MAX_MOTIVO) erros.motivo = "motivoLongo";
  return erros;
}
