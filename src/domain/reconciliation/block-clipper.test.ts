import { describe, expect, it } from "vitest";
import { buildClipperLinePreviews, computeClippedSelection } from "./block-clipper";

describe("block-clipper — Motor Puro de Recorte Início-Fim e Exclusão Pontual (Fase 4)", () => {
  const sampleLines = [
    "Banco Horizonte S.A.",
    "01/11/2026 Limite pre aprovado 15.000,00",
    "Movimento Exclusivo Cartao Titular",
    "10/11/2026 Padaria Estrela 120,50",
    "11/11/2026 Subtotal parcial bloco 500,00",
    "12/11/2026 Mercado Central 200,00",
    "15/11/2026 Estorno Loja X -20,50",
    "Resumo Programa Fidelidade",
    "30/11/2026 Pontos a expirar 250,00",
  ];

  it("identifica linhas candidatas com Data + Valor preservando todas as linhas originais", () => {
    const previews = buildClipperLinePreviews({
      rawLines: sampleLines,
      cardId: "card-1",
      competenceMonth: "2026-11",
    });

    expect(previews).toHaveLength(9);
    const candidates = previews.filter((p) => p.isCandidate);
    expect(candidates.map((c) => c.lineIndex)).toEqual([1, 3, 4, 5, 6, 8]);
  });

  it("calcula intervalo Início-Fim e aplica exclusão pontual recalculando soma líquida em centavos", () => {
    const previews = buildClipperLinePreviews({
      rawLines: sampleLines,
      cardId: "card-1",
      competenceMonth: "2026-11",
    });

    // Seleciona linhas 3..6 sem exclusões: 120,50 + 500,00 + 200,00 - 20,50 = 800,00 (80000 cents)
    const withoutExclusion = computeClippedSelection({
      previews,
      startIndex: 3,
      endIndex: 6,
      excludedLineIndices: new Set(),
      cardId: "card-1",
      competenceMonth: "2026-11",
    });
    expect(withoutExclusion.transactions).toHaveLength(4);
    expect(withoutExclusion.selectedNetCents).toBe(80000);

    // Exclui pontualmente a linha intrusa 4 (500,00): 120,50 + 200,00 - 20,50 = 300,00 (30000 cents)
    const withExclusion = computeClippedSelection({
      previews,
      startIndex: 3,
      endIndex: 6,
      excludedLineIndices: new Set([4]),
      cardId: "card-1",
      competenceMonth: "2026-11",
    });
    expect(withExclusion.transactions).toHaveLength(3);
    expect(withExclusion.selectedNetCents).toBe(30000);
    expect(withExclusion.transactions.map((t) => t.cleanDescription)).toEqual([
      "Padaria Estrela",
      "Mercado Central",
      "Estorno Loja X",
    ]);
  });

  it("normaliza corretamente quando o usuário marca Fim antes de Início", () => {
    const previews = buildClipperLinePreviews({
      rawLines: sampleLines,
      cardId: "card-1",
      competenceMonth: "2026-11",
    });

    const reversed = computeClippedSelection({
      previews,
      startIndex: 5,
      endIndex: 3,
      excludedLineIndices: new Set([4]),
      cardId: "card-1",
      competenceMonth: "2026-11",
    });
    expect(reversed.transactions).toHaveLength(2);
    expect(reversed.selectedNetCents).toBe(32050);
  });
});
