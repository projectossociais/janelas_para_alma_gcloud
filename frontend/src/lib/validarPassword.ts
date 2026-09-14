/**
 * Regra de força de password (AUTH-01) — espelha
 * `api/app/schemas/auth.py::validar_password_forte`, a única fonte de
 * verdade real. Isto aqui é só para dar feedback imediato no formulário,
 * antes de ir à API; quem decide de facto se a password é aceite é sempre
 * o servidor (nunca confiar só nesta cópia). Usado em `Auth.tsx` (registo),
 * `Configuracoes.tsx` (mudar password) e `AtualizarPassword.tsx`
 * (recuperação) — três formulários, uma regra só.
 */

export const PASSWORD_MIN_LEN = 8;

/** `null` quando a password é aceitável; caso contrário, a mensagem a
 *  mostrar ao utilizador. */
export function erroDePasswordFraca(password: string): string | null {
  if (password.length < PASSWORD_MIN_LEN) {
    return `A palavra-passe deve ter pelo menos ${PASSWORD_MIN_LEN} caracteres.`;
  }
  if (!/[A-Za-z]/.test(password)) {
    return "A palavra-passe precisa de pelo menos uma letra.";
  }
  if (!/\d/.test(password)) {
    return "A palavra-passe precisa de pelo menos um número.";
  }
  return null;
}
