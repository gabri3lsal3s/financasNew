/**
 * Calcula o atraso de bloqueio temporário (em segundos) contra ataques de força bruta
 * baseado no número de falhas consecutivas de autenticação na sessão ativa.
 *
 * - Menos de 3 falhas consecutivas: sem atraso (0s)
 * - 3 a 4 falhas consecutivas: atraso temporário de 15 segundos
 * - 5 ou mais falhas consecutivas: atraso temporário de 60 segundos
 */
export function calculateLoginBackoff(consecutiveFailures: number): number {
  if (consecutiveFailures >= 5) {
    return 60;
  }
  if (consecutiveFailures >= 3) {
    return 15;
  }
  return 0;
}
