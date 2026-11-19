import { describe, expect, it } from "vitest";
import { calculateModuleScores, runForensicAudit } from "./audit-runner";
import type { InvariantResult } from "../types";

describe("Laboratório Forense — Orquestrador Isomórfico & Invariantes (Fases 1, 2 e 3)", () => {
  it("executa a auditoria sintética de todas as 8 personas em menos de 100ms", async () => {
    const start = performance.now();
    const report = await runForensicAudit({ environment: "synthetic" });
    const elapsed = performance.now() - start;

    expect(report.auditId).toMatch(/^AUDIT-/);
    expect(report.environment).toBe("synthetic");
    expect(report.overallScore).toBe(100);
    expect(report.totalAssertions).toBe(23);
    expect(report.totalPassed).toBe(23);
    expect(report.totalFailed).toBe(0);
    expect(report.personas).toHaveLength(8);
    expect(elapsed).toBeLessThan(100);

    // Todos os 10 módulos devem ter score 100%
    for (const score of Object.values(report.moduleScores)) {
      expect(score.score).toBe(100);
      expect(score.failed).toBe(0);
    }
  });

  it("permite filtrar auditoria por personas específicas", async () => {
    const report = await runForensicAudit({
      personaIds: ["persona-investor-6445", "persona-trips-split"],
    });

    expect(report.personas).toHaveLength(2);
    expect(report.personas[0]?.personaId).toBe("persona-investor-6445");
    expect(report.personas[1]?.personaId).toBe("persona-trips-split");
  });

  it("permite filtrar auditoria por módulo de negócio específico", async () => {
    const report = await runForensicAudit({
      moduleFilter: ["cards", "loans"],
    });

    const nonTargetResults = report.personas
      .flatMap((p) => p.results)
      .filter((r) => r.module !== "cards" && r.module !== "loans");

    expect(nonTargetResults).toHaveLength(0);
  });

  it("calcula corretamente os scores dos módulos de negócio", () => {
    const mockResults: InvariantResult[] = [
      {
        id: "INV-01",
        name: "Teste Aprovado 1",
        module: "portfolio",
        status: "passed",
        severity: "critical",
        expected: 100,
        found: 100,
        divergence: 0,
        message: "OK",
        origin: "test",
        timestamp: new Date().toISOString(),
      },
      {
        id: "INV-02",
        name: "Teste Aprovado 2",
        module: "portfolio",
        status: "passed",
        severity: "critical",
        expected: 200,
        found: 200,
        divergence: 0,
        message: "OK",
        origin: "test",
        timestamp: new Date().toISOString(),
      },
      {
        id: "INV-03",
        name: "Teste Falho 1",
        module: "cards",
        status: "failed",
        severity: "critical",
        expected: 50,
        found: 49,
        divergence: 1,
        message: "Falha de centavo",
        origin: "test",
        timestamp: new Date().toISOString(),
      },
    ];

    const scores = calculateModuleScores(mockResults);

    expect(scores.portfolio.score).toBe(100);
    expect(scores.portfolio.passed).toBe(2);
    expect(scores.portfolio.failed).toBe(0);
    expect(scores.portfolio.total).toBe(2);

    expect(scores.cards.score).toBe(0);
    expect(scores.cards.passed).toBe(0);
    expect(scores.cards.failed).toBe(1);
    expect(scores.cards.total).toBe(1);

    expect(scores.insights.score).toBe(100);
    expect(scores.insights.total).toBe(0);
  });
});
