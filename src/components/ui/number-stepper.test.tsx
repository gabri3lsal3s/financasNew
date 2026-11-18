import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useState } from "react";
import { NumberStepper } from "./number-stepper";
import * as sensoryModule from "@/services/sensory";

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

function ControlledReadonly({ initial = 3, min = 1, max = 12 }: { initial?: number; min?: number; max?: number }) {
  const [value, setValue] = useState(initial);
  return (
    <NumberStepper
      value={value}
      onValueChange={setValue}
      min={min}
      max={max}
      decreaseLabel="Diminuir parcelas"
      increaseLabel="Aumentar parcelas"
      format={(v) => `${v}x`}
    />
  );
}

function ControlledEditable({ initial = 5 }: { initial?: number }) {
  const [value, setValue] = useState(initial);
  return (
    <NumberStepper
      editable
      value={value}
      onValueChange={setValue}
      min={1}
      max={31}
      ariaLabel="Dia de vencimento"
    />
  );
}

describe("NumberStepper (unificado + sem .num para Modo Privacidade)", () => {
  it("incrementa/decrementa no modo somente-leitura com size-10 e sem classe .num", async () => {
    const user = userEvent.setup();
    render(<ControlledReadonly />);

    const display = screen.getByText("3x");
    expect(display).toHaveClass("font-mono", "tabular-nums", "h-10");
    expect(display).not.toHaveClass("num");

    const minusBtn = screen.getByRole("button", { name: "Diminuir parcelas" });
    const plusBtn = screen.getByRole("button", { name: "Aumentar parcelas" });
    expect(minusBtn).toHaveClass("size-10");
    expect(plusBtn).toHaveClass("size-10");

    await user.click(plusBtn);
    expect(screen.getByText("4x")).toBeInTheDocument();

    await user.click(minusBtn);
    expect(screen.getByText("3x")).toBeInTheDocument();
  });

  it("suporta modo editable sem classe .num e com tipografia anti-zoom iOS", async () => {
    render(<ControlledEditable initial={10} />);

    const input = screen.getByRole("textbox", { name: "Dia de vencimento" });
    expect(input).toHaveClass("h-10", "font-mono", "tabular-nums", "text-base", "sm:text-sm");
    expect(input).not.toHaveClass("num");

    fireEvent.change(input, { target: { value: "15" } });
    expect(input).toHaveValue("15");
  });

  it("em long-press passa { skipSound: true } com throttle >= 120ms", async () => {
    vi.useFakeTimers();
    const sensorySpy = vi.spyOn(sensoryModule, "triggerSensory");
    render(<ControlledReadonly initial={1} min={1} max={20} />);

    const plus = screen.getByRole("button", { name: "Aumentar parcelas" });
    fireEvent.pointerDown(plus, { pointerId: 1, pointerType: "touch", button: 0 });

    // t=400ms: primeiro tick -> dispara com { skipSound: true }
    await act(async () => {
      vi.advanceTimersByTime(400);
    });
    expect(screen.getByText("2x")).toBeInTheDocument();
    expect(sensorySpy).toHaveBeenCalledTimes(1);
    expect(sensorySpy).toHaveBeenLastCalledWith("selection", { skipSound: true });

    // t=500ms (+100ms < 120ms): valor avança, mas sensory respeita throttle
    await act(async () => {
      vi.advanceTimersByTime(100);
    });
    expect(screen.getByText("3x")).toBeInTheDocument();
    expect(sensorySpy).toHaveBeenCalledTimes(1);

    // t=600ms (+200ms >= 120ms): sensory dispara novamente sem som
    await act(async () => {
      vi.advanceTimersByTime(100);
    });
    expect(screen.getByText("4x")).toBeInTheDocument();
    expect(sensorySpy).toHaveBeenCalledTimes(2);
    expect(sensorySpy).toHaveBeenLastCalledWith("selection", { skipSound: true });

    fireEvent.pointerUp(plus, { pointerId: 1, pointerType: "touch" });
  });
});
