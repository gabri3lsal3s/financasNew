import { useCallback, useMemo } from "react";
import { addDaysISO, todayISO } from "@/domain/debts";
import {
  buildReportPeriodLabel,
  validateCustomPeriod,
  type ReportPeriodMode,
} from "@/domain/reports";
import { currentMonth, currentYear, monthRange, yearRange } from "@/lib/date";

export interface UseReportPeriodFilterParams {
  mode: ReportPeriodMode;
  month: string;
  year: number;
  debouncedCustomStart: string;
  debouncedCustomEnd: string;
  customStart?: string;
  customEnd?: string;
}

/**
 * Deriva janela temporal, validade de período customizado e rótulo legível pt-BR.
 */
export function useReportPeriodFilter({
  mode,
  month,
  year,
  debouncedCustomStart,
  debouncedCustomEnd,
  customStart = "",
  customEnd = "",
}: UseReportPeriodFilterParams) {
  const isYear = mode === "year";
  const isCustom = mode === "custom";

  const range = useMemo(() => {
    if (mode === "month") return monthRange(month);
    if (mode === "year") return yearRange(year);
    return {
      start: debouncedCustomStart,
      end: debouncedCustomEnd ? addDaysISO(debouncedCustomEnd, 1) : "",
    };
  }, [mode, month, year, debouncedCustomStart, debouncedCustomEnd]);

  const customValid =
    mode !== "custom" ||
    (debouncedCustomStart !== "" &&
      debouncedCustomEnd !== "" &&
      validateCustomPeriod(debouncedCustomStart, debouncedCustomEnd).ok);

  const periodLabel = useMemo(
    () => buildReportPeriodLabel({ mode, month, year, customStart, customEnd }),
    [mode, month, year, customStart, customEnd],
  );

  const isDateInPeriod = useCallback(
    (dateStr: string) => {
      if (mode === "month") return dateStr.startsWith(month);
      if (mode === "year") return dateStr.startsWith(String(year));
      if (mode === "custom" && customValid && debouncedCustomStart && debouncedCustomEnd) {
        return dateStr >= debouncedCustomStart && dateStr <= debouncedCustomEnd;
      }
      return true;
    },
    [mode, month, year, customValid, debouncedCustomStart, debouncedCustomEnd],
  );

  const isCurrentPeriod = useMemo(() => {
    if (mode === "month") return month === currentMonth();
    if (mode === "year") return year === currentYear();
    if (mode === "custom") return Boolean(debouncedCustomEnd && debouncedCustomEnd >= todayISO());
    return true;
  }, [mode, month, year, debouncedCustomEnd]);

  const selectedYearNum = useMemo(() => {
    if (mode === "year") return year;
    if (mode === "month") return parseInt(month.slice(0, 4), 10) || currentYear();
    if (debouncedCustomStart) return parseInt(debouncedCustomStart.slice(0, 4), 10) || currentYear();
    return currentYear();
  }, [mode, year, month, debouncedCustomStart]);

  return {
    range,
    customValid,
    isYear,
    isCustom,
    isCurrentPeriod,
    selectedYearNum,
    periodLabel,
    isDateInPeriod,
  };
}
