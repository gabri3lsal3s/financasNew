import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { KpiCard } from "./kpi-card";

const waitFrames = (ms: number) => act(() => new Promise((resolve) => setTimeout(resolve, ms)));

describe("KpiCard (F12 — valores monetários via NumberTicker)", () => {
  it("cents renderiza o valor formatado com o tom forçado (negativo forte)", () => {
    const { container } = render(<KpiCard label="Saldo aberto" cents={-2500} tone="negative" />);
    expect(screen.getByText("Saldo aberto")).toBeInTheDocument();
    const value = container.querySelector("p.text-negative-strong");
    expect(value).not.toBeNull();
    // Sinal “−” prefixado (convenção MoneyText) + valor absoluto formatado.
    expect(value?.textContent).toBe(`−R$${"\u00A0"}25,00`);
    expect(value?.querySelector(".num")).not.toBeNull();
  });

  it("cents com tom positivo usa a cor forte (padrão de escaneamento)", () => {
    render(<KpiCard label="Receitas" cents={1500} tone="positive" />);
    const value = screen.getByText("R$ 15,00");
    expect(value).toHaveClass("num");
    expect(value.closest("p")).toHaveClass("text-positive-strong");
  });

  it("cents anima via NumberTicker até o valor final (F8)", async () => {
    render(<KpiCard label="Despesas" cents={500} tone="negative" />);
    await waitFrames(400); // janela de animação (300ms) termina no valor exato
    expect(screen.getByText("R$ 5,00")).toBeInTheDocument();
  });

  it("value (string) segue como fallback para valores não monetários", () => {
    render(<KpiCard label="Ativos" value="3" />);
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("onClick torna o card clicável e acessível (clique e teclado — F16 deep-link)", () => {
    const onClick = vi.fn();
    const { container } = render(<KpiCard label="Investimentos" value="R$ 0,00" onClick={onClick} />);
    const card = container.querySelector("[role=button]");
    expect(card).not.toBeNull();
    expect(card).toHaveAttribute("tabindex", "0");
    fireEvent.click(card as Element);
    expect(onClick).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(card as Element, { key: "Enter" });
    expect(onClick).toHaveBeenCalledTimes(2);
    fireEvent.keyDown(card as Element, { key: " " });
    expect(onClick).toHaveBeenCalledTimes(3);
  });

  it("sem onClick o card permanece informativo (sem role button)", () => {
    const { container } = render(<KpiCard label="Receitas" cents={100} />);
    expect(container.querySelector("[role=button]")).toBeNull();
  });
});
