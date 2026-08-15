import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MonthSwiper } from "./month-swiper";

const clock = { now: 0 };

beforeEach(() => {
  clock.now = 0;
  vi.stubGlobal("performance", { now: () => clock.now });
  Object.defineProperty(window, "innerWidth", { value: 390, configurable: true });
});

describe("MonthSwiper (F20 — navegação temporal por gesto)", () => {
  it("swipe para a esquerda avança para o próximo mês", () => {
    const onValueChange = vi.fn();
    const { container } = render(<MonthSwiper value="2026-08" onValueChange={onValueChange} />);
    const zone = container.querySelector("[data-testid=\"month-swiper\"]")!;

    fireEvent.pointerDown(zone, { clientX: 300, clientY: 100, pointerId: 1, pointerType: "touch", isPrimary: true });
    clock.now = 200;
    fireEvent.pointerMove(zone, { clientX: 220, clientY: 105, pointerId: 1, pointerType: "touch", isPrimary: true });
    clock.now = 500;
    fireEvent.pointerUp(zone, { clientX: 220, clientY: 105, pointerId: 1, pointerType: "touch", isPrimary: true });

    expect(onValueChange).toHaveBeenCalledWith("2026-09");
  });

  it("swipe para a direita volta para o mês anterior", () => {
    const onValueChange = vi.fn();
    const { container } = render(<MonthSwiper value="2026-08" onValueChange={onValueChange} />);
    const zone = container.querySelector("[data-testid=\"month-swiper\"]")!;

    fireEvent.pointerDown(zone, { clientX: 100, clientY: 100, pointerId: 1, pointerType: "touch", isPrimary: true });
    clock.now = 200;
    fireEvent.pointerMove(zone, { clientX: 180, clientY: 105, pointerId: 1, pointerType: "touch", isPrimary: true });
    clock.now = 500;
    fireEvent.pointerUp(zone, { clientX: 180, clientY: 105, pointerId: 1, pointerType: "touch", isPrimary: true });

    expect(onValueChange).toHaveBeenCalledWith("2026-07");
  });

  it("borda APP_START_DATE: swipe para voltar em 2026-01 NÃO navega", () => {
    const onValueChange = vi.fn();
    const { container } = render(<MonthSwiper value="2026-01" onValueChange={onValueChange} />);
    const zone = container.querySelector("[data-testid=\"month-swiper\"]")!;

    fireEvent.pointerDown(zone, { clientX: 100, clientY: 100, pointerId: 1, pointerType: "touch", isPrimary: true });
    clock.now = 200;
    fireEvent.pointerMove(zone, { clientX: 180, clientY: 105, pointerId: 1, pointerType: "touch", isPrimary: true });
    clock.now = 500;
    fireEvent.pointerUp(zone, { clientX: 180, clientY: 105, pointerId: 1, pointerType: "touch", isPrimary: true });

    expect(onValueChange).not.toHaveBeenCalled();
  });

  it("botões do MonthPicker continuam funcionando (gesto é adicional — a11y)", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<MonthSwiper value="2026-08" onValueChange={onValueChange} />);

    await user.click(screen.getByRole("button", { name: "Próximo mês" }));
    expect(onValueChange).toHaveBeenCalledWith("2026-09");
  });
});
