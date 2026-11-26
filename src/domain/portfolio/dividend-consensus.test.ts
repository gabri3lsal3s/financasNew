import { describe, expect, it } from "vitest";
import {
  evaluateConsensusVariants,
  isIndependentEvidenceEligible,
  isVariantCompatibleWithAnchor,
  pontuar,
} from "./dividend-consensus";

describe("dividend-consensus (S5 — Consenso Progressivo & LGPD)", () => {
  it("exige evidência independente: 5 aceites = 0, origem circular = 0, mensal/N:1 = 0", () => {
    for (let i = 0; i < 5; i += 1) {
      expect(isIndependentEvidenceEligible({ kind: "accept" })).toBe(false);
    }
    expect(isIndependentEvidenceEligible({ kind: "auto" })).toBe(false);
    expect(isIndependentEvidenceEligible({ kind: "batch_no_edit" })).toBe(false);
    expect(isIndependentEvidenceEligible({ kind: "replay" })).toBe(false);
    expect(isIndependentEvidenceEligible({ kind: "undo_no_prior_vote" })).toBe(false);
    expect(isIndependentEvidenceEligible({ kind: "backup" })).toBe(false);

    // Origem circular / derivado do motor vale 0
    expect(
      isIndependentEvidenceEligible({
        kind: "dedup",
        entryOrigin: "engine",
        sourceEventId: "ev-1",
        hasServerPrecedence: true,
      }),
    ).toBe(false);

    // Mensal e N:1 valem 0
    expect(
      isIndependentEvidenceEligible({
        kind: "dedup",
        entryOrigin: "manual",
        sourceEventId: null,
        hasServerPrecedence: true,
        isMonthly: true,
      }),
    ).toBe(false);
    expect(
      isIndependentEvidenceEligible({
        kind: "dedup",
        entryOrigin: "manual",
        sourceEventId: null,
        hasServerPrecedence: true,
        isNTo1: true,
      }),
    ).toBe(false);

    // Dedup 1:1 independente e edição com termos confirmados são elegíveis
    expect(
      isIndependentEvidenceEligible({
        kind: "dedup",
        entryOrigin: "manual",
        sourceEventId: null,
        hasServerPrecedence: true,
      }),
    ).toBe(true);
    expect(
      isIndependentEvidenceEligible({
        kind: "edited",
        hasConfirmedTerms: true,
        isAnchored: true,
      }),
    ).toBe(true);
  });

  it("pontua em décimos: mesma pessoa repetida = 1, 2x0.8 ancorado = 16, 3x0.8 não ancorado = 24, retração substitui positivo", () => {
    const repeatedSameUser = pontuar(
      [
        { votante: "u1", sinal: "dedup" },
        { votante: "u1", sinal: "dedup" },
        { votante: "u1", sinal: "edited" },
      ],
      true,
    );
    expect(repeatedSameUser).toEqual({ decimos: 8, positivosDistintos: 1, elegivel: false });

    const anchoredTwoEdits = pontuar(
      [
        { votante: "u1", sinal: "edited" },
        { votante: "u2", sinal: "edited" },
      ],
      true,
    );
    expect(anchoredTwoEdits).toEqual({ decimos: 16, positivosDistintos: 2, elegivel: true });

    const unanchoredTwoEdits = pontuar(
      [
        { votante: "u1", sinal: "edited" },
        { votante: "u2", sinal: "edited" },
      ],
      false,
    );
    expect(unanchoredTwoEdits.elegivel).toBe(false);

    const unanchoredThreeEdits = pontuar(
      [
        { votante: "u1", sinal: "edited" },
        { votante: "u2", sinal: "edited" },
        { votante: "u3", sinal: "edited" },
      ],
      false,
    );
    expect(unanchoredThreeEdits).toEqual({ decimos: 24, positivosDistintos: 3, elegivel: true });

    // Estorno de uma das duas edições ancoradas: 8 - 15 = -7, 1 positivo -> perde quórum (sem acumular débito em retry)
    const retracted = pontuar(
      [
        { votante: "u1", sinal: "edited" },
        { votante: "u2", sinal: "edited" },
        { votante: "u2", sinal: "reverted" },
        { votante: "u2", sinal: "reverted" },
      ],
      true,
    );
    expect(retracted).toEqual({ decimos: -7, positivosDistintos: 1, elegivel: false });
  });

  it("respeita limites COM ±1 pregão e taxa ±1% contra âncora fixa", () => {
    const anchor = { ticker: "PETR4", currency: "BRL" as const, comDate: "2026-10-15", grossRate: 1.0 };
    expect(
      isVariantCompatibleWithAnchor(anchor, {
        ticker: "PETR4",
        currency: "BRL",
        comDate: "2026-10-16",
        grossRate: 1.009,
      }),
    ).toBe(true);
    // 2 pregões de diferença -> fora do limite
    expect(
      isVariantCompatibleWithAnchor(anchor, {
        ticker: "PETR4",
        currency: "BRL",
        comDate: "2026-10-19",
        grossRate: 1.0,
      }),
    ).toBe(false);
    // > 1% na taxa -> fora do limite
    expect(
      isVariantCompatibleWithAnchor(anchor, {
        ticker: "PETR4",
        currency: "BRL",
        comDate: "2026-10-15",
        grossRate: 1.02,
      }),
    ).toBe(false);
  });

  it("avalia variantes concorrentes: coleta privada (shadow), promoção, empate e preservação de oficial", () => {
    const twoUsers = [
      { votante: "u1", sinal: "dedup" as const },
      { votante: "u2", sinal: "edited" as const },
    ];

    expect(evaluateConsensusVariants([{ variantKey: "v1", sinais: twoUsers }], true, false)).toEqual({
      action: "shadow_quorum",
      winnerVariantKey: "v1",
      scoreDecimos: 18,
      positivesCount: 2,
    });

    expect(evaluateConsensusVariants([{ variantKey: "v1", sinais: twoUsers }], true, true)).toEqual({
      action: "promote",
      winnerVariantKey: "v1",
      scoreDecimos: 18,
      positivesCount: 2,
    });

    // Duas variantes atingem quórum -> suspende promoção
    expect(
      evaluateConsensusVariants(
        [
          { variantKey: "v1", sinais: twoUsers },
          {
            variantKey: "v2",
            sinais: [
              { votante: "u3", sinal: "dedup" },
              { votante: "u4", sinal: "dedup" },
            ],
          },
        ],
        true,
        true,
      ).action,
    ).toBe("suspend_tie");

    // Oficial nunca é rebaixado por consenso
    expect(
      evaluateConsensusVariants([{ variantKey: "v1", sinais: twoUsers }], true, true, "official").action,
    ).toBe("keep");

    // Perda de quórum (após expurgo LGPD, por exemplo) rebaixa community_verified
    expect(
      evaluateConsensusVariants(
        [{ variantKey: "v1", sinais: [{ votante: "u1", sinal: "dedup" }] }],
        true,
        true,
        "community_verified",
      ).action,
    ).toBe("demote");
  });
});
