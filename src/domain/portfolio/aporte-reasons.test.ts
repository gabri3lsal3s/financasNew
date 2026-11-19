import { describe, expect, it } from "vitest";
import {
  calculateAssetReviewStatus,
  deriveAporteSuggestionReason,
} from "./aporte-reasons";

describe("deriveAporteSuggestionReason", () => {
  it("detecta conflito crítico de qualidade vs alocação para ativo com nota baixa em grupo com poucas opções", () => {
    const reason = deriveAporteSuggestionReason({
      ticker: "BBDC4",
      rawScore: 3,
      assetClass: "Ações",
      sector: "Financeiro",
      sectorDeficitRel: 0.25,
      classDeficitRel: 0.15,
      groupEligibleCount: 1,
    });

    expect(reason.hasQualityConflict).toBe(true);
    expect(reason.label).toBe("Puxado por Setor");
    expect(reason.qualityConflictDetail).toContain("Nota de convicção baixa (3/10)");
  });

  it("não gera alerta de conflito para ativo com nota boa em grupo de 1 ativo", () => {
    const reason = deriveAporteSuggestionReason({
      ticker: "ITUB4",
      rawScore: 9,
      assetClass: "Ações",
      sector: "Financeiro",
      sectorDeficitRel: 0.25,
      classDeficitRel: 0.15,
      groupEligibleCount: 1,
    });

    expect(reason.hasQualityConflict).toBe(false);
    expect(reason.kind).toBe("asset_conviction");
    expect(reason.label).toBe("Destaque por Nota");
  });

  it("classifica como Destaque por Nota quando o ativo possui nota >= 7 e lidera o grupo", () => {
    const reason = deriveAporteSuggestionReason({
      ticker: "WEGE3",
      rawScore: 10,
      assetClass: "Ações",
      sector: "Bens Industriais",
      weightInSector: 0.6,
      maxScoreInGroup: 10,
      groupEligibleCount: 3,
    });

    expect(reason.hasQualityConflict).toBe(false);
    expect(reason.kind).toBe("asset_conviction");
    expect(reason.label).toBe("Destaque por Nota");
  });

  it("classifica como Defasagem de Setor quando o setor apresenta déficit relevante", () => {
    const reason = deriveAporteSuggestionReason({
      ticker: "HGLG11",
      rawScore: 6,
      assetClass: "FIIs",
      sector: "Logística",
      sectorDeficitRel: 0.35,
      classDeficitRel: 0.1,
      groupEligibleCount: 3,
    });

    expect(reason.hasQualityConflict).toBe(false);
    expect(reason.kind).toBe("sector_deficit");
    expect(reason.label).toBe("Defasagem de Setor");
  });

  it("classifica como Defasagem de Classe quando não há déficit setorial destacado", () => {
    const reason = deriveAporteSuggestionReason({
      ticker: "B5P211",
      rawScore: null,
      assetClass: "Renda Fixa",
      classDeficitRel: 0.2,
      groupEligibleCount: 2,
    });

    expect(reason.hasQualityConflict).toBe(false);
    expect(reason.kind).toBe("class_deficit");
    expect(reason.label).toBe("Defasagem de Classe");
  });
});

describe("calculateAssetReviewStatus", () => {
  const refDate = new Date("2026-11-19T12:00:00Z");

  it("trata ativo nunca avaliado formalmente como vencido com status never_reviewed", () => {
    const status = calculateAssetReviewStatus({
      lastReviewedAt: null,
      reviewFrequencyMonths: 6,
      referenceDate: refDate,
    });

    expect(status.status).toBe("never_reviewed");
    expect(status.isOverdue).toBe(true);
    expect(status.badgeVariant).toBe("warning");
    expect(status.statusLabel).toBe("Nunca avaliado formalmente");
  });

  it("identifica revisão vencida quando ultrapassa a periodicidade", () => {
    // Revisado há 8 meses, periodicidade 6 meses
    const reviewedAt = new Date("2026-03-01T12:00:00Z").toISOString();
    const status = calculateAssetReviewStatus({
      lastReviewedAt: reviewedAt,
      reviewFrequencyMonths: 6,
      referenceDate: refDate,
    });

    expect(status.status).toBe("overdue");
    expect(status.isOverdue).toBe(true);
    expect(status.badgeVariant).toBe("critical");
    expect(status.statusLabel).toContain("Revisão vencida há");
  });

  it("identifica revisão próxima ao vencimento (janela <= 30 dias)", () => {
    // Vence em 10 dias
    const reviewedAt = new Date("2026-05-29T12:00:00Z").toISOString();
    const status = calculateAssetReviewStatus({
      lastReviewedAt: reviewedAt,
      reviewFrequencyMonths: 6,
      referenceDate: refDate,
    });

    expect(status.status).toBe("upcoming");
    expect(status.isUpcoming).toBe(true);
    expect(status.badgeVariant).toBe("warning");
    expect(status.statusLabel).toContain("Vence em");
  });

  it("identifica tese em dia quando revisada recentemente", () => {
    // Revisada há 1 mês, periodicidade 6 meses
    const reviewedAt = new Date("2026-10-19T12:00:00Z").toISOString();
    const status = calculateAssetReviewStatus({
      lastReviewedAt: reviewedAt,
      reviewFrequencyMonths: 6,
      referenceDate: refDate,
    });

    expect(status.status).toBe("ok");
    expect(status.isOverdue).toBe(false);
    expect(status.badgeVariant).toBe("positive");
    expect(status.statusLabel).toBe("Em dia");
  });
});
