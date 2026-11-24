import { beforeEach, describe, expect, it } from "vitest";
import type { StatementLayoutBlueprint } from "@/domain/reconciliation/blueprints";
import {
  MAX_STORED_BLUEPRINTS,
  STATEMENT_BLUEPRINT_STORE_KEY,
  clearAllStatementBlueprints,
  listStoredStatementBlueprints,
  recordBlueprintFailure,
  recordBlueprintSuccess,
  saveStatementBlueprint,
} from "./statement-blueprint-store";

function makeBlueprint(
  idx: number,
  overrides?: Partial<StatementLayoutBlueprint>,
): StatementLayoutBlueprint {
  return {
    version: 1,
    fingerprint: `pdf:banco_${idx}:abcd${String(idx).padStart(4, "0")}`,
    issuerKey: `banco_${idx}`,
    issuerName: `Banco ${idx}`,
    fileKind: "pdf_text",
    origin: "ai_learned",
    pdfRules: {
      startMarkers: ["movimento exclusivo cartao"],
      pauseMarkers: ["resumo programa fidelidade"],
      boletoMarkers: [],
      totalLabels: ["valor fatura"],
      ignoredTotalLabels: [],
      columnMode: "single",
      strictStartZone: true,
      requireExplicitDatePerLine: true,
    },
    polarity: "positive_purchase",
    dateFormatHint: "dd/mm",
    currencyStrategy: "brl_rightmost",
    stats: {
      uses: 1,
      exactChecksumHits: 1,
      consecutiveFailures: 0,
      updatedAt: new Date(Date.UTC(2026, 10, 1, 0, idx)).toISOString(),
    },
    ...overrides,
  };
}

describe("statement-blueprint-store — Persistência Zod, LRU 50 e Self-Healing", () => {
  beforeEach(() => {
    clearAllStatementBlueprints();
  });

  it("salva, valida via Zod e descarta silenciosamente entradas corrompidas no localStorage", () => {
    const valid = makeBlueprint(1);
    expect(saveStatementBlueprint(valid)).toBe(true);

    // Injeta registro corrompido diretamente no localStorage ao lado do válido
    const raw = JSON.parse(
      window.localStorage.getItem(STATEMENT_BLUEPRINT_STORE_KEY) ?? "[]",
    ) as unknown[];
    raw.push({ fingerprint: "broken", version: 999, invalid: true });
    window.localStorage.setItem(STATEMENT_BLUEPRINT_STORE_KEY, JSON.stringify(raw));

    const loaded = listStoredStatementBlueprints();
    expect(loaded).toHaveLength(1);
    expect(loaded[0]?.fingerprint).toBe(valid.fingerprint);
  });

  it("aplica limite estrito LRU de 50 entradas descartando as mais antigas", () => {
    for (let i = 1; i <= MAX_STORED_BLUEPRINTS + 5; i++) {
      saveStatementBlueprint(makeBlueprint(i));
    }

    const stored = listStoredStatementBlueprints();
    expect(stored).toHaveLength(MAX_STORED_BLUEPRINTS);
  });

  it("executa self-healing removendo blueprint após 2 falhas consecutivas e reseta contador em sucesso", () => {
    const bp = makeBlueprint(42);
    saveStatementBlueprint(bp);

    // 1ª falha: mantém salvo com consecutiveFailures = 1
    const firstFail = recordBlueprintFailure(bp.fingerprint);
    expect(firstFail).toEqual({ invalidated: false, consecutiveFailures: 1 });
    expect(listStoredStatementBlueprints()).toHaveLength(1);

    // Sucesso intermediário reseta consecutiveFailures para 0
    recordBlueprintSuccess(bp.fingerprint, true);
    expect(listStoredStatementBlueprints()[0]?.stats.consecutiveFailures).toBe(0);

    // Duas falhas consecutivas removem automaticamente o blueprint (self-healing)
    expect(recordBlueprintFailure(bp.fingerprint).invalidated).toBe(false);
    const secondFail = recordBlueprintFailure(bp.fingerprint);
    expect(secondFail).toEqual({ invalidated: true, consecutiveFailures: 2 });
    expect(listStoredStatementBlueprints()).toHaveLength(0);
  });

  it("impede que ai_learned sobrescreva um blueprint user_learned", () => {
    const userBp = makeBlueprint(7, { origin: "user_learned" });
    saveStatementBlueprint(userBp);

    const aiOverride = makeBlueprint(7, { origin: "ai_learned" });
    expect(saveStatementBlueprint(aiOverride)).toBe(false);
    expect(listStoredStatementBlueprints()[0]?.origin).toBe("user_learned");
  });
});
