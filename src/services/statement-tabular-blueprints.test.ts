import { beforeEach, describe, expect, it } from "vitest";
import { StatementLayoutBlueprintSchema } from "@/domain/reconciliation";
import {
  isLocalTabularBlueprintId,
  loadLocalTabularBlueprints,
  recordLocalTabularBlueprintOutcome,
  saveLocalTabularBlueprint,
} from "./statement-tabular-blueprints";

function makeSampleTabularBlueprint(
  fingerprint: string,
  fileKind: "csv" | "xlsx" | "pdf_text" = "xlsx",
) {
  return StatementLayoutBlueprintSchema.parse({
    version: 1,
    fingerprint,
    issuerKey: "banco-exemplo",
    issuerName: "Banco Exemplo",
    fileKind,
    origin: "builtin",
    tabularRules: {
      headerSignature: "data|descricao|valor",
      sheetName: "Fatura",
      columnMapping: {
        dateColIndex: 0,
        descriptionColIndex: 1,
        amountColIndex: 2,
        hasHeader: true,
        startRowIndex: 1,
        headerRowIndex: 0,
      },
    },
    stats: {
      uses: 1,
      exactChecksumHits: 1,
      consecutiveFailures: 0,
      updatedAt: "2026-11-25T12:00:00.000Z",
    },
  });
}

describe("statement-tabular-blueprints", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("identifica IDs de blueprints tabulares locais pelo prefixo", () => {
    expect(isLocalTabularBlueprintId("local-tab:abc")).toBe(true);
    expect(isLocalTabularBlueprintId("cloud:abc")).toBe(false);
    expect(isLocalTabularBlueprintId(null)).toBe(false);
  });

  it("salva, carrega e ignora blueprints que não sejam csv/xlsx", () => {
    const pdfBp = makeSampleTabularBlueprint("fp-pdf", "pdf_text");
    expect(saveLocalTabularBlueprint(pdfBp, "user-1")).toBeNull();

    const xlsxBp = makeSampleTabularBlueprint("fp-xlsx-1", "xlsx");
    const saved = saveLocalTabularBlueprint(xlsxBp, "user-1");
    expect(saved).not.toBeNull();
    expect(saved?.cloudId).toBe("local-tab:fp-xlsx-1");
    expect(saved?.origin).toBe("user_verified");

    const loaded = loadLocalTabularBlueprints("user-1");
    expect(loaded).toHaveLength(1);
    expect(loaded[0]?.fingerprint).toBe("fp-xlsx-1");
    expect(loadLocalTabularBlueprints("user-2")).toHaveLength(0);
  });

  it("registra acertos e suspende blueprint após 2 falhas consecutivas", () => {
    const saved = saveLocalTabularBlueprint(
      makeSampleTabularBlueprint("fp-xlsx-2", "xlsx"),
      "user-1",
    );
    expect(saved?.cloudId).toBe("local-tab:fp-xlsx-2");

    recordLocalTabularBlueprintOutcome("local-tab:fp-xlsx-2", false, "user-1");
    let loaded = loadLocalTabularBlueprints("user-1");
    expect(loaded[0]?.cloudStatus).toBe("active");
    expect(loaded[0]?.stats.consecutiveFailures).toBe(1);

    recordLocalTabularBlueprintOutcome("local-tab:fp-xlsx-2", false, "user-1");
    loaded = loadLocalTabularBlueprints("user-1");
    expect(loaded[0]?.cloudStatus).toBe("suspended");
    expect(loaded[0]?.stats.consecutiveFailures).toBe(2);

    recordLocalTabularBlueprintOutcome("local-tab:fp-xlsx-2", true, "user-1");
    loaded = loadLocalTabularBlueprints("user-1");
    expect(loaded[0]?.cloudStatus).toBe("active");
    expect(loaded[0]?.stats.consecutiveFailures).toBe(0);
  });
});
