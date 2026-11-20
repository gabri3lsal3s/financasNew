import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { TargetDistributionRow } from "./target-distribution-row";

describe("TargetDistributionRow", () => {
  it("chama onOpenDetail ao clicar na área do item do setor/classe", async () => {
    const user = userEvent.setup();
    const onOpenDetail = vi.fn();
    const onSelectToggle = vi.fn();

    render(
      <TargetDistributionRow
        name="Imobiliário / Papel e CRI"
        target={8}
        currentPct={18.2}
        membersCount={2}
        isSelected={false}
        stepperAriaLabel="Meta do setor em %"
        detailAriaLabel="Ver detalhes de Imobiliário / Papel e CRI"
        onSelectToggle={onSelectToggle}
        onFocusSelect={vi.fn()}
        onTargetChange={vi.fn()}
        onOpenDetail={onOpenDetail}
      />,
    );

    // Clica no nome do setor
    await user.click(screen.getByText("Imobiliário / Papel e CRI"));

    expect(onOpenDetail).toHaveBeenCalledTimes(1);
    expect(onSelectToggle).toHaveBeenCalledTimes(1);
  });
});