import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { StatementBlockClipperStep } from "./statement-block-clipper-step";

const SAMPLE_LINES = [
  "Banco Horizonte S.A.",
  "01/11/2026 Limite pre aprovado 15.000,00",
  "Movimento Exclusivo Cartao Titular",
  "10/11/2026 Padaria Estrela 120,50",
  "11/11/2026 Subtotal bloco intruso 500,00",
  "12/11/2026 Mercado Central 200,00",
  "Resumo Programa Fidelidade",
  "30/11/2026 Pontos a expirar 250,00",
];

describe("StatementBlockClipperStep — Camada 5: Assistente Guiado Sem Tokens (Fase 4)", () => {
  it("marca Início e Fim em 2 cliques, permite exclusão pontual recalculando o total ao vivo e alterna Candidatas/Todas", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();

    const { container } = render(
      <StatementBlockClipperStep
        rawLines={SAMPLE_LINES}
        cardId="card-1"
        competenceMonth="2026-11"
        officialTotalCents={32050}
        onConfirmSelection={onConfirm}
        onBack={vi.fn()}
      />,
    );

    // Conformidade AGENTS.md: zero modais aninhados, zero autoFocus, zero checkbox nativo
    expect(container.querySelectorAll('[role="dialog"]')).toHaveLength(0);
    expect(container.querySelectorAll("[autofocus]")).toHaveLength(0);
    expect(container.querySelectorAll('input[type="checkbox"]')).toHaveLength(0);

    // Por padrão exibe apenas candidatas (5 linhas com Data+Valor); cabeçalho não aparece ainda
    expect(screen.queryByText("Movimento Exclusivo Cartao Titular")).not.toBeInTheDocument();

    // Toggle para Todas as linhas revela cabeçalhos estruturais
    await user.click(screen.getByRole("button", { name: /Todas \(8\)/i }));
    expect(screen.getByText("Movimento Exclusivo Cartao Titular")).toBeInTheDocument();

    // Volta para Candidatas
    await user.click(screen.getByRole("button", { name: /Candidatas \(5\)/i }));

    // Clique 1: marca Início em Padaria Estrela (R$ 120,50)
    await user.click(screen.getByText(/Padaria Estrela/i));
    expect(screen.getByText("Início")).toBeInTheDocument();

    // Clique 2: marca Fim em Mercado Central (R$ 200,00) -> inclui intrusa R$ 500,00 (total = R$ 820,50)
    await user.click(screen.getByText(/Mercado Central/i));
    expect(screen.getByText("Fim")).toBeInTheDocument();
    expect(screen.getByText("3 selecionados")).toBeInTheDocument();
    expect(screen.getByText(/820,50/)).toBeInTheDocument();
    expect(screen.getByText(/Diferença:/i)).toBeInTheDocument();

    // Exclusão pontual da linha intrusa ("Subtotal bloco intruso 500,00") via Checkbox Radix DRY
    const intrusiveCheckbox = screen.getByRole("checkbox", {
      name: /Subtotal bloco intruso/i,
    });
    await user.click(intrusiveCheckbox);

    // Total ao vivo recalcula para R$ 320,50 e confere exatamente com Fatura Oficial (R$ 320,50)
    expect(screen.getByText("2 selecionados")).toBeInTheDocument();
    expect(screen.getByText("Soma conferida")).toBeInTheDocument();

    // Confirma o recorte manual
    await user.click(screen.getByRole("button", { name: /Usar 2 lançamentos/i }));

    expect(onConfirm).toHaveBeenCalledTimes(1);
    const payload = onConfirm.mock.calls[0]?.[0];
    expect(payload.startIndex).toBe(3);
    expect(payload.endIndex).toBe(5);
    expect(payload.excludedLineIndices).toEqual([4]);
    expect(payload.transactions).toHaveLength(2);
    expect(payload.transactions.map((t: { cleanDescription: string }) => t.cleanDescription)).toEqual([
      "Padaria Estrela",
      "Mercado Central",
    ]);
  });
});
