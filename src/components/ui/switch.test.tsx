import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Switch } from "./switch";
import * as sensoryModule from "@/services/sensory";

describe("Switch UI Primitive", () => {
  it("renderiza corretamente com role switch e reflete o estado checked", () => {
    const { rerender } = render(
      <Switch checked={false} onCheckedChange={vi.fn()} label="Notificações" description="Ativar alertas" />,
    );

    const switchBtn = screen.getByRole("switch", { name: "Notificações" });
    expect(switchBtn).toBeInTheDocument();
    expect(switchBtn).toHaveAttribute("aria-checked", "false");
    expect(screen.getByText("Notificações")).toBeInTheDocument();
    expect(screen.getByText("Ativar alertas")).toBeInTheDocument();

    rerender(<Switch checked={true} onCheckedChange={vi.fn()} label="Notificações" />);
    expect(switchBtn).toHaveAttribute("aria-checked", "true");
  });

  it("dispara callback onCheckedChange e sensory trigger ao ser clicado", async () => {
    const sensorySpy = vi.spyOn(sensoryModule, "triggerSensory");
    const onCheckedChange = vi.fn();
    const user = userEvent.setup();

    render(<Switch checked={false} onCheckedChange={onCheckedChange} label="Modo Escuro" />);

    const switchBtn = screen.getByRole("switch", { name: "Modo Escuro" });
    await user.click(switchBtn);

    expect(onCheckedChange).toHaveBeenCalledWith(true);
    expect(sensorySpy).toHaveBeenCalledWith("toggle");
  });

  it("permite alternar clicando no rótulo de texto", async () => {
    const onCheckedChange = vi.fn();
    const user = userEvent.setup();

    render(<Switch checked={true} onCheckedChange={onCheckedChange} label="Despesa Familiar" />);

    const labelText = screen.getByText("Despesa Familiar");
    await user.click(labelText);

    expect(onCheckedChange).toHaveBeenCalledWith(false);
  });

  it("não dispara alteração quando desabilitado", async () => {
    const onCheckedChange = vi.fn();
    const user = userEvent.setup();

    render(<Switch checked={false} onCheckedChange={onCheckedChange} disabled label="Bloqueado" />);

    const switchBtn = screen.getByRole("switch", { name: "Bloqueado" });
    expect(switchBtn).toBeDisabled();

    await user.click(switchBtn);
    expect(onCheckedChange).not.toHaveBeenCalled();
  });
});
