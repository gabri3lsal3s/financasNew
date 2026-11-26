import { calculateFiiExposure, calculateFixedIncomeExposure, calculateInternationalExposure, calculateStocksExposure } from "@/domain/portfolio/class-breakdown";
import type { PortfolioAsset } from "@/types";
import type { TearSheetModel } from "./tear-sheet-types";

export interface TearSheetPageNumbers {
  custody: number;
  donut?: number;
  xray1?: number;
  xray2?: number;
  performance?: number;
  methodology: number;
}

export interface TearSheetPaginationInfo {
  totalPages: number;
  pageNumbers: TearSheetPageNumbers;
  hasDonutPage: boolean;
  activeXrays: {
    hasStocks: boolean;
    hasFiis: boolean;
    hasRF: boolean;
    hasIntl: boolean;
    activeXrayCount: number;
  };
  hasPerformancePage: boolean;
}

export function computeTearSheetPagination(
  model: TearSheetModel,
  assetsMetadata: readonly PortfolioAsset[],
): TearSheetPaginationInfo {
  const hasStocks = calculateStocksExposure(model.breakdownRows).totalAssetsCount > 0;
  const hasFiis = calculateFiiExposure(model.breakdownRows).totalAssetsCount > 0;
  const hasRF = calculateFixedIncomeExposure(model.breakdownRows, assetsMetadata).totalAssetsCount > 0;
  const hasIntl = calculateInternationalExposure(model.breakdownRows).totalAssetsCount > 0;

  const activeXrayCount = (hasStocks ? 1 : 0) + (hasFiis ? 1 : 0) + (hasRF ? 1 : 0) + (hasIntl ? 1 : 0);

  const hasDonutPage =
    (model.donutData.classSegments.length >= 2 || model.donutData.sectorSegments.length >= 2) &&
    model.donutData.classSegments.length > 0;

  const hasPerformancePage = model.performanceSeries.length >= 2;

  let currentPg = 1; // Page 1: Overview
  currentPg += 1;
  const custody = currentPg; // Page 2: Custody

  let donut: number | undefined;
  if (hasDonutPage) {
    currentPg += 1;
    donut = currentPg;
  }

  let xray1: number | undefined;
  let xray2: number | undefined;
  if (activeXrayCount > 0) {
    currentPg += 1;
    xray1 = currentPg;
    if (activeXrayCount >= 3) {
      currentPg += 1;
      xray2 = currentPg;
    }
  }

  let performance: number | undefined;
  if (hasPerformancePage) {
    currentPg += 1;
    performance = currentPg;
  }

  currentPg += 1;
  const methodology = currentPg;
  const totalPages = methodology;

  return {
    totalPages,
    pageNumbers: {
      custody,
      donut,
      xray1,
      xray2,
      performance,
      methodology,
    },
    hasDonutPage,
    activeXrays: {
      hasStocks,
      hasFiis,
      hasRF,
      hasIntl,
      activeXrayCount,
    },
    hasPerformancePage,
  };
}
