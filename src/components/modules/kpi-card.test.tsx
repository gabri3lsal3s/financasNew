import { act, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { KpiCard } from "./kpi-card";

const waitFrames = (ms: number) => act(() => new Promise((resolve) => setTimeout(resolve, ms)));

describe("KpiCard (F12 — valores monetários via MoneyText)", () => {
  it("cents renderiza MoneyText com o tom forçado (negativo forte)", () => {
    render(<KpiCard label="Saldo aberto" cents={-2500} tone="negative" />);
    expect(screen.getByText("Saldo aberto")).toBeInTheDocument();
    const value = screen.getByText("−R$ 25,00");
    expect(value).toHaveClass("num", "text-negative-strong");
  });

  it("cents com tom positivo usa a cor forte (padrão de escaneamento)", () => {
    render(<KpiCard label="Receitas" cents={1500} tone="positive" />);
    expect(screen.getByText("R$ 15,00")).toHaveClass("text-positive-strong");
  });

  it("valueCents mantém o NumberTicker animado (F8) até o valor final", async () => {
    render(<KpiCard label="Despesas" value="R$ 0,00" valueCents={500} tone="negative" />);
    await waitFrames(400); // animação de 300ms termina no valor exato
    expect(screen.getByText("R$ 5,00")).toBeInTheDocument();
  });

  it("value (string) segue como fallback para valores não monetários", () => {
    render(<KpiCard label="Ativos" value="3" />);
    expect(screen.getByText("3")).toBeInTheDocument();
  });
});
