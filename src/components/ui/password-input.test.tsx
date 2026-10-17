import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef } from "react";
import { describe, expect, it, vi } from "vitest";
import { PasswordInput } from "./password-input";
import * as sensoryService from "@/services/sensory";

vi.mock("@/services/sensory", () => ({
  triggerSensory: vi.fn(),
}));

describe("PasswordInput Component", () => {
  it("renderiza o input do tipo password por padrão", () => {
    render(<PasswordInput placeholder="Digite sua senha" />);
    const input = screen.getByPlaceholderText("Digite sua senha") as HTMLInputElement;

    expect(input).toBeInTheDocument();
    expect(input.type).toBe("password");
    expect(screen.getByRole("button", { name: "Ver senha" })).toBeInTheDocument();
  });

  it("alterna a visibilidade ao clicar no botão e dispara sensory feedback", async () => {
    const user = userEvent.setup();
    render(<PasswordInput placeholder="Digite sua senha" />);
    const input = screen.getByPlaceholderText("Digite sua senha") as HTMLInputElement;

    const showBtn = screen.getByRole("button", { name: "Ver senha" });
    await user.click(showBtn);

    expect(input.type).toBe("text");
    expect(sensoryService.triggerSensory).toHaveBeenCalledWith("selection");

    const hideBtn = screen.getByRole("button", { name: "Ocultar senha" });
    await user.click(hideBtn);

    expect(input.type).toBe("password");
  });

  it("encaminha a ref corretamente para o input", () => {
    const ref = createRef<HTMLInputElement>();
    render(<PasswordInput ref={ref} />);

    expect(ref.current).toBeInstanceOf(HTMLInputElement);
  });

  it("permite desativar a alternância de visibilidade via allowToggleVisibility={false}", () => {
    render(<PasswordInput allowToggleVisibility={false} placeholder="Senha fixa" />);

    expect(screen.getByPlaceholderText("Senha fixa")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("desabilita o botão quando disabled for true", () => {
    render(<PasswordInput disabled placeholder="Senha desabilitada" />);
    const input = screen.getByPlaceholderText("Senha desabilitada") as HTMLInputElement;
    const button = screen.getByRole("button", { name: "Ver senha" });

    expect(input).toBeDisabled();
    expect(button).toBeDisabled();
  });
});
