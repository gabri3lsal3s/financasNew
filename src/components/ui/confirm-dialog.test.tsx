import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ConfirmDialog } from "./confirm-dialog";
import * as sensoryService from "@/services/sensory";

describe("ConfirmDialog", () => {
  it("dispara triggerSensory(success) exatamente uma vez ao confirmar no modo default", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    const onOpenChange = vi.fn();
    const sensorySpy = vi.spyOn(sensoryService, "triggerSensory");

    render(
      <ConfirmDialog
        open={true}
        onOpenChange={onOpenChange}
        title="Confirmar Ação"
        description="Você tem certeza?"
        onConfirm={onConfirm}
      />,
    );

    const confirmButton = screen.getByRole("button", { name: "Confirmar" });
    await user.click(confirmButton);

    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(sensorySpy).toHaveBeenCalledTimes(1);
    expect(sensorySpy).toHaveBeenCalledWith("success");

    sensorySpy.mockRestore();
  });

  it("dispara triggerSensory(destructive) exatamente uma vez ao confirmar no modo destructive", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    const onOpenChange = vi.fn();
    const sensorySpy = vi.spyOn(sensoryService, "triggerSensory");

    render(
      <ConfirmDialog
        open={true}
        onOpenChange={onOpenChange}
        variant="destructive"
        title="Excluir Registro"
        description="Esta ação não pode ser desfeita."
        confirmLabel="Excluir Definitivamente"
        onConfirm={onConfirm}
      />,
    );

    const confirmButton = screen.getByRole("button", { name: "Excluir Definitivamente" });
    await user.click(confirmButton);

    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(sensorySpy).toHaveBeenCalledTimes(1);
    expect(sensorySpy).toHaveBeenCalledWith("destructive");

    sensorySpy.mockRestore();
  });

  it("chama onOpenChange(false) ao clicar em cancelar sem disparar sensory", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    const onOpenChange = vi.fn();

    render(
      <ConfirmDialog
        open={true}
        onOpenChange={onOpenChange}
        title="Confirmar Ação"
        onConfirm={onConfirm}
      />,
    );

    const cancelButton = screen.getByRole("button", { name: "Cancelar" });
    await user.click(cancelButton);

    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(onConfirm).not.toHaveBeenCalled();
  });
});
