import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ConvertRecurrenceDialog } from "./convert-recurrence-dialog";
import type { RecurrenceOccurrence } from "@/domain/insights/recurrences";

const createRecurrenceMock = vi.fn().mockResolvedValue("rec-123");
const setFeedbackMock = vi.fn().mockResolvedValue(undefined);

vi.mock("@/state", () => ({
  useUserSubscription: () => ({
    canWrite: true,
    isReadOnly: false,
    tier: "pro_annual",
  }),
  useCategories: () => ({
    data: [
      { id: "cat-stream", name: "Streaming e Assinaturas", icon: "video", type: "expense" },
      { id: "cat-moradia", name: "Moradia", icon: "home", type: "expense" },
    ],
    isLoading: false,
    error: null,
  }),
  useCreditCards: () => ({
    data: [{ id: "card-nubank", name: "Nubank Black", limit: 10000 }],
    isLoading: false,
    error: null,
  }),
  useCreateRecurrence: () => ({
    mutateAsync: createRecurrenceMock,
    isPending: false,
  }),
  useSetFeedback: () => ({
    mutateAsync: setFeedbackMock,
    isPending: false,
  }),
}));

const mockOccurrence: RecurrenceOccurrence = {
  key: "sub:netflix",
  name: "Netflix",
  level: "subscription",
  segment: "streaming",
  months: ["2026-06", "2026-07", "2026-08"],
  averageCents: 3990,
  confidence: 0.98,
  categoryId: "cat-stream",
  typicalDayOfMonth: 10,
  nextDueDate: "2026-09-10",
  expenses: [
    {
      id: "exp-1",
      description: "Netflix",
      month: "2026-08",
      date: "2026-08-10",
      valueCents: 3990,
      categoryId: "cat-stream",
      paymentMethod: "credit_card",
      cardId: "card-nubank",
    },
  ],
};

describe("ConvertRecurrenceDialog", () => {
  it("renderiza campos pré-preenchidos a partir da ocorrência", () => {
    render(
      <ConvertRecurrenceDialog
        occurrence={mockOccurrence}
        open={true}
        onOpenChange={vi.fn()}
      />,
    );

    expect(screen.getByText("Fixar como Recorrência Formal")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Netflix")).toBeInTheDocument();
    expect(screen.getByDisplayValue("R$ 39,90")).toBeInTheDocument();
    expect(screen.getByText("Streaming e Assinaturas")).toBeInTheDocument();
    expect(screen.getByText("Mensal")).toBeInTheDocument();
    expect(screen.getAllByText("Cartão de crédito").length).toBeGreaterThanOrEqual(1);
  });

  it("exibe mensagem de erro se a descrição for apagada e tentar submeter", async () => {
    const user = userEvent.setup();

    render(
      <ConvertRecurrenceDialog
        occurrence={mockOccurrence}
        open={true}
        onOpenChange={vi.fn()}
      />,
    );

    const descInput = screen.getByLabelText("Descrição do agendamento");
    await user.clear(descInput);

    const submitBtn = screen.getByRole("button", { name: "Fixar Recorrência" });
    await user.click(submitBtn);

    expect(screen.getByText("Informe a descrição da recorrência.")).toBeInTheDocument();
    expect(createRecurrenceMock).not.toHaveBeenCalled();
  });

  it("submete payload ao RPC e grava feedback como confirm ao converter com sucesso", async () => {
    const user = userEvent.setup();
    const handleOpenChange = vi.fn();
    const handleSuccess = vi.fn();

    createRecurrenceMock.mockClear();
    setFeedbackMock.mockClear();

    render(
      <ConvertRecurrenceDialog
        occurrence={mockOccurrence}
        open={true}
        onOpenChange={handleOpenChange}
        onSuccess={handleSuccess}
      />,
    );

    const submitBtn = screen.getByRole("button", { name: "Fixar Recorrência" });
    await user.click(submitBtn);

    expect(createRecurrenceMock).toHaveBeenCalledTimes(1);
    expect(createRecurrenceMock).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "expense",
        frequency: "monthly",
        value: 39.9,
        categoryId: "cat-stream",
        startDate: "2026-09-10",
        occurrencesTotal: 12,
        paymentMethod: "credit_card",
        cardId: "card-nubank",
        description: "Netflix",
      }),
    );

    expect(setFeedbackMock).toHaveBeenCalledTimes(1);
    expect(setFeedbackMock).toHaveBeenCalledWith({
      occurrenceKey: "sub:netflix",
      decision: "confirm",
    });

    expect(handleSuccess).toHaveBeenCalledWith("sub:netflix");
    expect(handleOpenChange).toHaveBeenCalledWith(false);
  });
});
