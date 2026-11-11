import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PinSetupDialog } from "./pin-setup-dialog";
import * as nativeModule from "@/services/native";

describe("PinSetupDialog", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it("não renderiza quando open=false", () => {
    render(<PinSetupDialog open={false} onOpenChange={vi.fn()} />);
    expect(screen.queryByText(/Definir PIN de Acesso/i)).not.toBeInTheDocument();
  });

  it("renderiza o formulário com campos de PIN e confirmação quando open=true", () => {
    render(<PinSetupDialog open={true} onOpenChange={vi.fn()} />);
    expect(screen.getByText(/Definir PIN de Acesso/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/PIN de Acesso \(4 a 6 dígitos\)/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Confirme o PIN/i)).toBeInTheDocument();
  });

  it("exibe erro se a confirmação do PIN não conferir", async () => {
    const user = userEvent.setup();
    render(<PinSetupDialog open={true} onOpenChange={vi.fn()} />);

    const pinInput = screen.getByLabelText(/PIN de Acesso \(4 a 6 dígitos\)/i);
    const confirmInput = screen.getByLabelText(/Confirme o PIN/i);
    const submitBtn = screen.getByRole("button", { name: /Salvar PIN/i });

    await user.type(pinInput, "1234");
    await user.type(confirmInput, "9999");
    await user.click(submitBtn);

    expect(screen.getByText(/A confirmação do PIN não confere./i)).toBeInTheDocument();
  });

  it("salva o PIN e chama onSuccess ao preencher campos válidos", async () => {
    const user = userEvent.setup();
    const onSuccess = vi.fn();
    const onOpenChange = vi.fn();
    const setPinSpy = vi.spyOn(nativeModule, "setPinLock").mockResolvedValue();

    render(
      <PinSetupDialog
        open={true}
        onOpenChange={onOpenChange}
        onSuccess={onSuccess}
        userId="user-test"
      />,
    );

    const pinInput = screen.getByLabelText(/PIN de Acesso \(4 a 6 dígitos\)/i);
    const confirmInput = screen.getByLabelText(/Confirme o PIN/i);
    const submitBtn = screen.getByRole("button", { name: /Salvar PIN/i });

    await user.type(pinInput, "5678");
    await user.type(confirmInput, "5678");
    await user.click(submitBtn);

    expect(setPinSpy).toHaveBeenCalledWith("5678", "user-test");
    expect(onSuccess).toHaveBeenCalled();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("permite remover o PIN existente quando hasExistingPin=true", async () => {
    const user = userEvent.setup();
    const onSuccess = vi.fn();
    const onOpenChange = vi.fn();
    const removePinSpy = vi.spyOn(nativeModule, "removePinLock");

    render(
      <PinSetupDialog
        open={true}
        onOpenChange={onOpenChange}
        hasExistingPin={true}
        onSuccess={onSuccess}
        userId="user-test"
      />,
    );

    const removeBtn = screen.getByRole("button", { name: /Remover PIN/i });
    await user.click(removeBtn);

    expect(removePinSpy).toHaveBeenCalledWith("user-test");
    expect(onSuccess).toHaveBeenCalled();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
