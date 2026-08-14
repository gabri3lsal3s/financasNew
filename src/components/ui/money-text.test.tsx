import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MoneyText } from "./money-text";

describe("MoneyText (F12 — hierarquia tipográfica de valores)", () => {
  it("formata centavos em BRL com a classe .num (mono + tabular)", () => {
    const { container } = render(<MoneyText cents={150000} />);
    const el = container.firstChild as HTMLElement;
    expect(el).toHaveClass("num");
    expect(el.textContent).toBe("R$\u00a01.500,00");
  });

  it("aplica as variantes de escala (hero/value/caption)", () => {
    const { container, rerender } = render(<MoneyText cents={100} variant="hero" />);
    let el = container.firstChild as HTMLElement;
    expect(el).toHaveClass("text-lg", "font-semibold", "lg:text-2xl");

    rerender(<MoneyText cents={100} variant="value" />);
    el = container.firstChild as HTMLElement;
    expect(el).toHaveClass("text-sm", "font-semibold");

    rerender(<MoneyText cents={100} variant="caption" />);
    el = container.firstChild as HTMLElement;
    expect(el).toHaveClass("text-xs", "font-medium");
  });

  it("tone auto deriva do sinal (positivo → positive, negativo → negative, zero → default)", () => {
    const { container, rerender } = render(<MoneyText cents={2500} />);
    let el = container.firstChild as HTMLElement;
    expect(el).toHaveClass("text-positive-strong");

    rerender(<MoneyText cents={-2500} />);
    el = container.firstChild as HTMLElement;
    expect(el).toHaveClass("text-negative-strong");

    rerender(<MoneyText cents={0} />);
    el = container.firstChild as HTMLElement;
    expect(el).toHaveClass("text-foreground");
  });

  it("tone forçado vence o sinal (despesa sempre negative)", () => {
    const { container } = render(<MoneyText cents={500} tone="negative" />);
    expect(container.firstChild).toHaveClass("text-negative-strong");
  });

  it("sign explicit marca + e −; auto só o negativo; none nunca", () => {
    const { container, rerender } = render(<MoneyText cents={1200} sign="explicit" />);
    expect(container.firstChild?.textContent).toBe("+R$\u00a012,00");

    rerender(<MoneyText cents={-1200} sign="explicit" />);
    expect(container.firstChild?.textContent).toBe("−R$\u00a012,00");

    rerender(<MoneyText cents={-1200} sign="auto" />);
    expect(container.firstChild?.textContent).toBe("−R$\u00a012,00");

    rerender(<MoneyText cents={1200} sign="auto" />);
    expect(container.firstChild?.textContent).toBe("R$\u00a012,00");

    rerender(<MoneyText cents={-1200} sign="none" />);
    expect(container.firstChild?.textContent).toBe("R$\u00a012,00");
  });

  it("zero nunca recebe sinal, mesmo com sign explicit", () => {
    const { container } = render(<MoneyText cents={0} sign="explicit" />);
    expect(container.firstChild?.textContent).toBe("R$\u00a00,00");
  });

  it("propaga aria-hidden e className do chamador (privacidade/máscara)", () => {
    const { container } = render(<MoneyText cents={100} aria-hidden="true" className="shrink-0" />);
    const el = container.firstChild as HTMLElement;
    expect(el).toHaveAttribute("aria-hidden", "true");
    expect(el).toHaveClass("shrink-0");
  });
});
