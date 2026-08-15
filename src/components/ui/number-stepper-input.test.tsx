import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "vitest-axe";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useState } from "react";
import { NumberStepperInput } from "./number-stepper-input";

afterEach(() => {
  vi.useRealTimers();
});

type StepperOverrides = Omit<Partial<Parameters<typeof NumberStepperInput>[0]>, "value" | "onValueChange"> & {
  initial?: number;
};

function ControlledStepper({
  initial = 10,
  onValueChange: spy,
  ...overrides
}: StepperOverrides & { onValueChange?: (value: string) => void } = {}) {
  const [value, setValue] = useState(String(initial));
  return (
    <NumberStepperInput
      value={value}
      onValueChange={(next) => {
        setValue(next);
        spy?.(next);
      }}
      ariaLabel="quantidade"
      {...overrides}
    />
  );
}

function renderStepper(overrides: StepperOverrides = {}) {
  const onValueChange = vi.fn();
  const utils = render(<ControlledStepper initial={10} onValueChange={onValueChange} {...overrides} />);
  return { onValueChange, ...utils };
}

describe("NumberStepperInput (F25/pós-F13)", () => {
  it("incrementa ao clicar em + e decrementa ao clicar em -", async () => {
    const user = userEvent.setup();
    const { onValueChange } = renderStepper();

    await user.click(screen.getByRole("button", { name: "Aumentar quantidade" }));
    expect(onValueChange).toHaveBeenCalledWith("11");

    // Valor controlado agora é 11 → diminuir volta para 10.
    await user.click(screen.getByRole("button", { name: "Diminuir quantidade" }));
    expect(onValueChange).toHaveBeenCalledWith("10");
  });

  it("respeita min e max (botões desabilitados nos limites)", () => {
    const first = renderStepper({ initial: 0, min: 0, max: 10 });
    expect(screen.getByRole("button", { name: "Diminuir quantidade" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Aumentar quantidade" })).toBeEnabled();
    first.unmount();

    renderStepper({ initial: 10, min: 0, max: 10 });
    expect(screen.getByRole("button", { name: "Aumentar quantidade" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Diminuir quantidade" })).toBeEnabled();
  });

  it("usa o step configurado (ex.: 0.5)", async () => {
    const user = userEvent.setup();
    const { onValueChange } = renderStepper({ initial: 5, step: 0.5 });

    await user.click(screen.getByRole("button", { name: "Aumentar quantidade" }));
    expect(onValueChange).toHaveBeenCalledWith("5.5");
  });

  it("digitação manual continua livre (decimal)", () => {
    const { onValueChange } = renderStepper();

    const input = screen.getByRole("spinbutton", { name: "quantidade" });
    fireEvent.change(input, { target: { value: "42" } });
    expect(onValueChange).toHaveBeenLastCalledWith("42");
  });

  it("repete continuamente ao segurar o botão (long-press)", async () => {
    vi.useFakeTimers();
    const { onValueChange } = renderStepper();

    const plus = screen.getByRole("button", { name: "Aumentar quantidade" });
    // Segura o botão: pointerdown + tempo sem soltar → repetição contínua.
    fireEvent.pointerDown(plus, { pointerId: 1, pointerType: "mouse", button: 0 });
    await act(async () => {
      vi.advanceTimersByTime(400); // primeira repetição (delay)
    });
    expect(onValueChange).toHaveBeenLastCalledWith("11");

    await act(async () => {
      vi.advanceTimersByTime(100); // segunda repetição
    });
    expect(onValueChange).toHaveBeenLastCalledWith("12");

    await act(async () => {
      vi.advanceTimersByTime(100); // terceira repetição
    });
    expect(onValueChange).toHaveBeenLastCalledWith("13");

    // Solta: a repetição para.
    fireEvent.pointerUp(plus, { pointerId: 1, pointerType: "mouse" });
    const callsAtRelease = onValueChange.mock.calls.length;
    await act(async () => {
      vi.advanceTimersByTime(300);
    });
    expect(onValueChange.mock.calls.length).toBe(callsAtRelease);
  });

  it("não incrementa duas vezes quando o long-press já repetiu (anti-double-fire)", async () => {
    vi.useFakeTimers();
    const { onValueChange } = renderStepper();

    const plus = screen.getByRole("button", { name: "Aumentar quantidade" });
    fireEvent.pointerDown(plus, { pointerId: 1, pointerType: "mouse", button: 0 });
    await act(async () => {
      vi.advanceTimersByTime(400); // primeira repetição
    });
    fireEvent.pointerUp(plus, { pointerId: 1, pointerType: "mouse" });
    fireEvent.click(plus); // o click após o long-press NÃO incrementa de novo

    expect(onValueChange.mock.calls.filter((call) => call[0] === "11").length).toBe(1);
  });

  it("sem violações de acessibilidade (axe)", async () => {
    const { container } = renderStepper();
    expect(await axe(container)).toHaveNoViolations();
  });
});
