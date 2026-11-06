import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { FamilySettlementDialog } from "./family-settlement-dialog";
import type { FamilyConsolidationResult } from "@/types";

const mockMutateAsync = vi.fn();
let mockIsPending = false;

vi.mock("@/state", () => ({
  useRecordFamilySettlement: () => ({
    mutateAsync: mockMutateAsync,
    isPending: mockIsPending,
  }),
}));

const mockConsolidation: FamilyConsolidationResult = {
  family: {
    id: "fam-1",
    name: "Família Santos",
    owner_id: "user-1",
    monthly_budget_cents: 500000,
    split_rule: "equal",
  },
  month: "2026-11",
  monthly_ceiling_cents: 500000,
  total_spent_cents: 400000,
  total_income_cents: 800000,
  remaining_cents: 100000,
  spent_percentage: 80,
  members: [
    {
      user_id: "user-1",
      role: "owner",
      display_name: "Gabriel",
      spent_cents: 300000,
      percentage_of_total: 75,
      pix_key: "gabriel@email.com",
      pix_key_type: "email",
      split_ratio: null,
    },
    {
      user_id: "user-2",
      role: "member",
      display_name: "Mariana",
      spent_cents: 100000,
      percentage_of_total: 25,
      pix_key: "11999999999",
      pix_key_type: "phone",
      split_ratio: null,
    },
  ],
  expenses: [
    {
      id: "exp-1",
      description: "Supermercado Grande",
      date: "2026-11-02",
      amount_cents: 300000,
      category_id: "cat-1",
      category_name: "Supermercado",
      category_icon: "shopping-cart",
      category_color: "#10b981",
      user_id: "user-1",
      payer_name: "Gabriel",
      is_own: true,
      created_at: "2026-11-02T10:00:00Z",
    },
    {
      id: "exp-2",
      description: "Farmácia",
      date: "2026-11-03",
      amount_cents: 100000,
      category_id: "cat-2",
      category_name: "Saúde",
      category_icon: "pill",
      category_color: "#ef4444",
      user_id: "user-2",
      payer_name: "Mariana",
      is_own: false,
      created_at: "2026-11-03T10:00:00Z",
    },
  ],
  is_settled: false,
  settlement: null,
  has_post_settlement_expenses: false,
};

describe("FamilySettlementDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsPending = false;
  });

  it("renderiza a proposta de acerto calculada e permite registrar", async () => {
    const handleOpenChange = vi.fn();
    mockMutateAsync.mockResolvedValueOnce("settle-id");

    render(
      <FamilySettlementDialog
        open={true}
        onOpenChange={handleOpenChange}
        consolidation={mockConsolidation}
        currentUserId="user-1"
      />,
    );

    expect(screen.getByRole("heading", { name: "Acerto de Contas Familiar" })).toBeInTheDocument();
    expect(screen.getByText("Proposta de Compensação")).toBeInTheDocument();
    expect(screen.getByText("Mariana")).toBeInTheDocument();
    expect(screen.getByText("deve transferir para")).toBeInTheDocument();
    expect(screen.getByText("Gabriel")).toBeInTheDocument();

    // Mariana deve pagar R$ 1.000,00 para Gabriel (total 4000, metade 2000, ela pagou 1000)
    expect(screen.getByText("Valor a compensar")).toBeInTheDocument();
    expect(screen.getByText("Chave Pix de Gabriel")).toBeInTheDocument();

    const registerBtn = screen.getByRole("button", { name: "Registrar Acerto Realizado" });
    fireEvent.click(registerBtn);

    expect(mockMutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        month: "2026-11",
        payerId: "user-2",
        receiverId: "user-1",
        amount: 1000,
        familyId: "fam-1",
      }),
    );
  });

  it("permite copiar a chave Pix com navigator.clipboard", async () => {
    const user = userEvent.setup();
    const writeTextSpy = vi
      .spyOn(navigator.clipboard, "writeText")
      .mockResolvedValue(undefined);

    render(
      <FamilySettlementDialog
        open={true}
        onOpenChange={vi.fn()}
        consolidation={mockConsolidation}
        currentUserId="user-2"
      />,
    );

    const copyBtn = screen.getByRole("button", { name: "Copiar" });
    await user.click(copyBtn);

    expect(writeTextSpy).toHaveBeenCalledWith("gabriel@email.com");
  });
});
