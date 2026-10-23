import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { BatchInvoicePaymentDialog } from "./batch-invoice-payment-dialog";
import type { CompetenceSummary } from "@/domain/cards";
import type { CreditCard } from "@/types";

const batchMutateAsync = vi.fn();

vi.mock("@/state", () => ({
  useBatchCreateCardPayments: () => ({
    mutateAsync: batchMutateAsync,
    isPending: false,
  }),
}));

const mockCard: CreditCard = {
  id: "card-rico",
  name: "Rico",
  user_id: "u1",
  brand: "visa",
  closing_day: 1,
  due_day: 10,
  credit_limit: 5000,
  color: "#ff6600",
  is_active: true,
};

const mockUnpaidSummaries: CompetenceSummary[] = [
  {
    month: "2026-03",
    previstoBrutoCents: 225585,
    previstoPonderadoCents: 225585,
    previstoCents: 225585,
    pagoCents: 0,
    estornoCents: 0,
    creditoAnteriorCents: 0,
    creditoRestanteCents: 0,
    saldoBrutoCents: 225585,
    saldoPonderadoCents: 225585,
    saldoCents: 225585,
  },
  {
    month: "2026-04",
    previstoBrutoCents: 358655,
    previstoPonderadoCents: 358655,
    previstoCents: 358655,
    pagoCents: 0,
    estornoCents: 0,
    creditoAnteriorCents: 0,
    creditoRestanteCents: 0,
    saldoBrutoCents: 358655,
    saldoPonderadoCents: 358655,
    saldoCents: 358655,
  },
];

describe("BatchInvoicePaymentDialog", () => {
  it("renderiza lista de faturas anteriores com todas selecionadas por padrão e valor total correto", () => {
    render(
      <BatchInvoicePaymentDialog
        open={true}
        onOpenChange={vi.fn()}
        card={mockCard}
        unpaidSummaries={mockUnpaidSummaries}
      />,
    );

    expect(screen.getByText("Quitar Faturas Anteriores — Rico")).toBeInTheDocument();
    expect(screen.getByText("Fatura 03/2026")).toBeInTheDocument();
    expect(screen.getByText("Fatura 04/2026")).toBeInTheDocument();
    expect(screen.getByText("2 de 2 selecionada(s)")).toBeInTheDocument();

    const submitBtn = screen.getByRole("button", { name: /quitar 2 fatura\(s\)/i });
    expect(submitBtn).toBeEnabled();
  });

  it("permite desmarcar e marcar faturas recalculando a contagem e submeter a quitação", async () => {
    batchMutateAsync.mockResolvedValueOnce(["p1", "p2"]);
    const onOpenChange = vi.fn();
    const user = userEvent.setup();

    render(
      <BatchInvoicePaymentDialog
        open={true}
        onOpenChange={onOpenChange}
        card={mockCard}
        unpaidSummaries={mockUnpaidSummaries}
      />,
    );

    const submitBtn = screen.getByRole("button", { name: /quitar 2 fatura\(s\)/i });
    await user.click(submitBtn);

    expect(batchMutateAsync).toHaveBeenCalledTimes(1);
    const payload = batchMutateAsync.mock.calls[0]![0];
    expect(payload).toHaveLength(2);
    expect(payload[0]).toMatchObject({
      cardId: "card-rico",
      competenceMonth: "2026-03",
      amount: 2255.85,
    });
    expect(payload[1]).toMatchObject({
      cardId: "card-rico",
      competenceMonth: "2026-04",
      amount: 3586.55,
    });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
