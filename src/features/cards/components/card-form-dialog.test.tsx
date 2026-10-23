import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CardFormDialog } from "./card-form-dialog";
import type { CreditCard } from "@/types";

const createCardMock = vi.fn();
const updateCardMock = vi.fn();
const deleteCardMock = vi.fn();
const updateCustomSettingsMock = vi.fn();

const mockPreferences = {
  data: {
    user_id: "u1",
    theme: "system" as const,
    reminders_enabled: false,
    reminder_days_before_debt: 3,
    reminder_days_before_bill: 3,
    report_weights_enabled: true,
    max_sector_acoes: null,
    max_sector_fiis: null,
    custom_settings: {
      primaryCardId: "card-1",
      cardOrder: ["card-1", "card-2"],
    },
  },
  isLoading: false,
};

vi.mock("@/state", () => ({
  useCreateCard: () => ({ mutateAsync: createCardMock, isPending: false }),
  useUpdateCard: () => ({ mutateAsync: updateCardMock, isPending: false }),
  useDeleteCard: () => ({ mutateAsync: deleteCardMock, isPending: false }),
  useUserPreferences: () => mockPreferences,
  useUpdateCustomSettings: () => ({ mutateAsync: updateCustomSettingsMock, isPending: false }),
}));

const existingCard: CreditCard = {
  id: "card-1",
  user_id: "u1",
  name: "Nubank",
  brand: "Mastercard",
  credit_limit: 5000,
  closing_day: 10,
  due_day: 15,
  color: "#820AD9",
  is_active: true,
};

const secondaryCard: CreditCard = {
  id: "card-2",
  user_id: "u1",
  name: "Itaú",
  brand: "Visa",
  credit_limit: 8000,
  closing_day: 5,
  due_day: 12,
  color: "#003399",
  is_active: true,
};

describe("CardFormDialog — Cartão Principal e Ordenação", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renderiza o checkbox de cartão principal marcado para o cartão principal atual", () => {
    render(
      <CardFormDialog
        card={existingCard}
        open={true}
        onOpenChange={vi.fn()}
      />,
    );

    const checkbox = screen.getByRole("checkbox", { name: /definir como cartão principal/i });
    expect(checkbox).toBeChecked();
    expect(screen.getByText("Principal")).toBeInTheDocument();
  });

  it("renderiza o checkbox desmarcado para um cartão secundário e atualiza para principal ao salvar", async () => {
    const user = userEvent.setup();
    updateCardMock.mockResolvedValueOnce(undefined);
    updateCustomSettingsMock.mockResolvedValueOnce(undefined);
    const onOpenChange = vi.fn();

    render(
      <CardFormDialog
        card={secondaryCard}
        open={true}
        onOpenChange={onOpenChange}
      />,
    );

    const checkbox = screen.getByRole("checkbox", { name: /definir como cartão principal/i });
    expect(checkbox).not.toBeChecked();

    await user.click(checkbox);
    expect(checkbox).toBeChecked();

    const saveButton = screen.getByRole("button", { name: /salvar alterações/i });
    await user.click(saveButton);

    expect(updateCardMock).toHaveBeenCalled();
    expect(updateCustomSettingsMock).toHaveBeenCalledWith({
      primaryCardId: "card-2",
      cardOrder: ["card-2", "card-1"],
    });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("ao criar um novo cartão marcado como principal, define primaryCardId e coloca no topo de cardOrder", async () => {
    const user = userEvent.setup();
    createCardMock.mockResolvedValueOnce({ id: "card-new" });
    updateCustomSettingsMock.mockResolvedValueOnce(undefined);
    const onOpenChange = vi.fn();

    render(
      <CardFormDialog
        card={null}
        open={true}
        onOpenChange={onOpenChange}
      />,
    );

    const nameInput = screen.getByRole("textbox", { name: /nome/i });
    await user.type(nameInput, "XP Visa Infinite");

    const checkbox = screen.getByRole("checkbox", { name: /definir como cartão principal/i });
    await user.click(checkbox);
    expect(checkbox).toBeChecked();

    const createButton = screen.getByRole("button", { name: /criar cartão/i });
    await user.click(createButton);

    expect(createCardMock).toHaveBeenCalled();
    expect(updateCustomSettingsMock).toHaveBeenCalledWith({
      primaryCardId: "card-new",
      cardOrder: ["card-new", "card-1", "card-2"],
    });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
