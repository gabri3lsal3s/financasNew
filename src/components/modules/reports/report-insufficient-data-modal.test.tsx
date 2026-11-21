import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { describe, expect, it, vi } from "vitest";
import { ReportInsufficientDataModal } from "./report-insufficient-data-modal";

describe("ReportInsufficientDataModal", () => {
  it("renderiza o modal com o título, subtítulo contextual e motivos de bloqueio", () => {
    render(
      <MemoryRouter>
        <ReportInsufficientDataModal
          open={true}
          onOpenChange={vi.fn()}
          reportTitle="Fatura de Cartão"
          periodLabel="Agosto de 2026"
          blockingReasons={[
            {
              code: "NO_CREDIT_CARD",
              title: "Nenhum cartão de crédito cadastrado",
              description: "Cadastre um cartão de crédito para acompanhar faturas.",
              ctaLabel: "Cadastrar cartão",
              ctaRoute: "/cartoes",
            },
          ]}
        />
      </MemoryRouter>,
    );

    expect(
      screen.getByText("Dados insuficientes para gerar este relatório"),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Para gerar o Fatura de Cartão \(Agosto de 2026\)/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Nenhum cartão de crédito cadastrado"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Cadastre um cartão de crédito para acompanhar faturas."),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Cadastrar cartão/i }),
    ).toBeInTheDocument();
  });

  it("aciona onAction e fecha o modal ao clicar no botão CTA", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    const onAction = vi.fn();

    render(
      <MemoryRouter>
        <ReportInsufficientDataModal
          open={true}
          onOpenChange={onOpenChange}
          reportTitle="DRE Pessoal"
          blockingReasons={[
            {
              code: "NO_FINANCIAL_ENTRIES",
              title: "Nenhum lançamento no período",
              description: "Registre ao menos uma receita ou despesa.",
              ctaLabel: "Registrar lançamentos",
              ctaRoute: "/transacoes",
            },
          ]}
          onAction={onAction}
        />
      </MemoryRouter>,
    );

    const ctaBtn = screen.getByRole("button", { name: /Registrar lançamentos/i });
    await user.click(ctaBtn);

    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(onAction).toHaveBeenCalledWith("/transacoes");
  });
});
