/**
 * Calendário de Mercado B3 e Regras de Fechamento de Competência.
 *
 * Funções puras sem dependência de banco de dados ou rede.
 * Utiliza o calendário oficial ANBIMA/B3 de `business-days.ts`.
 */

import { isBusinessDay } from "./business-days";

/**
 * Retorna o último dia útil de um mês e ano específicos no formato ISO YYYY-MM-DD.
 *
 * @param year Ano com 4 dígitos (ex: 2026)
 * @param month Mês de 1 a 12
 */
export function getLastBusinessDayOfMonth(year: number, month: number): string {
  if (month < 1 || month > 12) {
    throw new Error(`Mês inválido: ${month}. Deve estar entre 1 e 12.`);
  }

  // Último dia do mês (dia 0 do mês seguinte em UTC)
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const m = String(month).padStart(2, "0");

  for (let day = daysInMonth; day >= 1; day--) {
    const d = String(day).padStart(2, "0");
    const isoDate = `${year}-${m}-${d}`;
    if (isBusinessDay(isoDate)) {
      return isoDate;
    }
  }

  // Fallback seguro caso nenhum dia seja considerado útil (impossível em meses normais)
  return `${year}-${m}-${String(daysInMonth).padStart(2, "0")}`;
}

/**
 * Verifica se o mercado de negociação da B3 para a competência informada já se encerrou.
 *
 * Critério Canônico: O mercado é considerado fechado após as 19h00 BRT (UTC-3 / 22h00 UTC)
 * do último dia útil do mês.
 *
 * @param year Ano com 4 dígitos (ex: 2026)
 * @param month Mês de 1 a 12
 * @param currentDateTime Data/hora de referência (default: now)
 */
export function isMarketClosedForMonth(
  year: number,
  month: number,
  currentDateTime: Date = new Date(),
): boolean {
  const lastBizDay = getLastBusinessDayOfMonth(year, month);
  const parts = lastBizDay.split("-").map(Number);
  const y = parts[0] ?? year;
  const m = parts[1] ?? month;
  const d = parts[2] ?? 28;

  // 19:00 BRT (UTC-3) equivale exatamente a 22:00:00 UTC
  const marketCloseUtc = new Date(Date.UTC(y, m - 1, d, 22, 0, 0, 0));

  return currentDateTime.getTime() >= marketCloseUtc.getTime();
}
