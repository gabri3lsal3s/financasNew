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

  it("aplica tipografia adaptativa em valores de 7+ e 8+ dígitos sem reticências", () => {
    // 7 dígitos (>= R$ 100.000,00 -> 10.000.000 centavos)
    const { container: container7 } = render(<KpiCard label="Receitas" cents={15000000} />);
    const p7 = container7.querySelector("p");
    expect(p7?.className).toContain("text-base sm:text-lg lg:text-xl");
    expect(p7?.className).not.toContain("truncate");

    // 8 dígitos (>= R$ 1.000.000,00 -> 100.000.000 centavos)
    const { container: container8 } = render(<KpiCard label="Patrimônio" cents={250000000} />);
    const p8 = container8.querySelector("p");
    expect(p8?.className).toContain("text-sm sm:text-base lg:text-lg");
    expect(p8?.className).not.toContain("truncate");
  });

  it("renderiza o micro-gráfico sparkline normalmente mesmo quando a série for zerada (F8)", () => {
    const { container } = render(
      <KpiCard label="Investimentos" cents={0} tone="portfolio" spark={[0, 0, 0, 0]} />,
    );
    const line = container.querySelector("path.stroke-portfolio") ?? container.querySelector("polyline.stroke-portfolio");
    expect(line).not.toBeNull();
    expect(line?.getAttribute("class")).toContain("stroke-portfolio");
  });
});
