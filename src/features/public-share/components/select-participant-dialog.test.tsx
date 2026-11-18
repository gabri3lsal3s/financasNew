import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SelectParticipantDialog } from "./select-participant-dialog";
import type { SplitParticipantItem } from "@/types";

describe("SelectParticipantDialog", () => {
  const mockParticipants: SplitParticipantItem[] = [
    { id: "p-1", name: "Lucas", share_cents: 4500, is_host: false, is_settled: false },
    { id: "p-2", name: "Mariana", share_cents: 4500, is_host: false, is_settled: false },
  ];

  it("renderiza lista de participantes com acentuação pt-BR e permite selecionar e confirmar", () => {
    const onConfirm = vi.fn();
    render(
      <SelectParticipantDialog
        open={true}
        onOpenChange={vi.fn()}
        participants={mockParticipants}
        onConfirm={onConfirm}
      />,
    );

    expect(screen.getByText(/Quem é você no racha\?/i)).toBeInTheDocument();
    expect(screen.getByText(/anfitrião/i)).toBeInTheDocument();
    expect(screen.getByText("Lucas")).toBeInTheDocument();
    expect(screen.getByText("Mariana")).toBeInTheDocument();

    const marianaBtn = screen.getByRole("button", { name: /mariana/i });
    fireEvent.click(marianaBtn);

    const confirmBtn = screen.getByRole("button", { name: /confirmar e salvar/i });
    fireEvent.click(confirmBtn);

    expect(onConfirm).toHaveBeenCalledWith(mockParticipants[1]);
  });

  it("sincroniza seleção padrão quando participantes carregam assincronamente após o mount", () => {
    const onConfirm = vi.fn();
    const { rerender } = render(
      <SelectParticipantDialog
        open={true}
        onOpenChange={vi.fn()}
        participants={[]}
        onConfirm={onConfirm}
      />,
    );

    const confirmBtn = screen.getByRole("button", { name: /confirmar e salvar/i });
    expect(confirmBtn).toBeDisabled();

    rerender(
      <SelectParticipantDialog
        open={true}
        onOpenChange={vi.fn()}
        participants={mockParticipants}
        onConfirm={onConfirm}
      />,
    );

    expect(confirmBtn).toBeEnabled();
    fireEvent.click(confirmBtn);
    expect(onConfirm).toHaveBeenCalledWith(mockParticipants[0]);
  });
});
