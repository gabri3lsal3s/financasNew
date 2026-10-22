import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { QuickAporteCard } from "./quick-aporte-card";

const navigateMock = vi.fn();
const triggerSensoryMock = vi.fn();

vi.mock("react-router", () => ({
  useNavigate: () => navigateMock,
}));

vi.mock("@/services/sensory", () => ({
  triggerSensory: (arg: unknown) => triggerSensoryMock(arg),
}));

describe("QuickAporteCard — Atalho de Aporte Rápido na Home (Fase 5 — Tarefa 5.4)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renderiza cabeçalho, total de aportes realizados e formulário de novo aporte", () => {
    render(
      <QuickAporteCard
        currentMonthAporteCents={250000}
        suggestedAporteCents={100000}
      />,
    );

    expect(screen.getByText("Investimentos do mês")).toBeInTheDocument();
    expect(screen.getByText("Aportes realizados no período")).toBeInTheDocument();
    expect(screen.getByText(/2\.500,00/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ver carteira completa" })).toBeInTheDocument();
    expect(screen.getByLabelText("Valor do aporte planejado")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Calcular Rebalanceamento/i })).toBeInTheDocument();
  });

  it("navega para /investments ao clicar em Ver carteira", () => {
    render(<QuickAporteCard currentMonthAporteCents={0} />);

    const button = screen.getByRole("button", { name: "Ver carteira completa" });
    fireEvent.click(button);

    expect(navigateMock).toHaveBeenCalledWith("/investments");
  });

  it("chama onViewPortfolio customizado quando fornecido", () => {
    const onViewPortfolio = vi.fn();
    render(<QuickAporteCard onViewPortfolio={onViewPortfolio} />);

    const button = screen.getByRole("button", { name: "Ver carteira completa" });
    fireEvent.click(button);

    expect(onViewPortfolio).toHaveBeenCalledTimes(1);
    expect(navigateMock).not.toHaveBeenCalled();
  });

  it("preenche o campo com o valor sugerido ao clicar no chip de sugestão", () => {
    render(
      <QuickAporteCard
        currentMonthAporteCents={0}
        suggestedAporteCents={150000}
      />,
    );

    const chip = screen.getByRole("button", {
      name: /Preencher com sugestão de aporte/i,
    });
    expect(chip).toBeInTheDocument();
    expect(screen.getByText(/1\.500,00/)).toBeInTheDocument();

    fireEvent.click(chip);

    const input = screen.getByLabelText("Valor do aporte planejado") as HTMLInputElement;
    expect(input.value).toMatch(/1[.,]500,00/);
    expect(triggerSensoryMock).toHaveBeenCalledWith("action");
  });

  it("navega para /investments?tab=aporte&valor=... ao submeter formulário com valor > 0", async () => {
    const user = userEvent.setup();
    render(<QuickAporteCard />);

    const input = screen.getByLabelText("Valor do aporte planejado");
    // Digita 50000 (R$ 500,00)
    await user.click(input);
    await user.type(input, "50000");

    const submitButton = screen.getByRole("button", { name: /Calcular Rebalanceamento/i });
    await user.click(submitButton);

    expect(navigateMock).toHaveBeenCalledWith("/investments?tab=aporte&valor=50000");
    expect(triggerSensoryMock).toHaveBeenCalledWith("action");
  });

  it("chama onSimulate customizado com valor em centavos se fornecido", async () => {
    const onSimulate = vi.fn();
    const user = userEvent.setup();
    render(<QuickAporteCard onSimulate={onSimulate} />);

    const input = screen.getByLabelText("Valor do aporte planejado");
    await user.click(input);
    await user.type(input, "30000");

    const submitButton = screen.getByRole("button", { name: /Calcular Rebalanceamento/i });
    await user.click(submitButton);

    expect(onSimulate).toHaveBeenCalledWith(30000);
    expect(navigateMock).not.toHaveBeenCalled();
    expect(triggerSensoryMock).toHaveBeenCalledWith("action");
  });

  it("navega para /investments?tab=aporte sem parâmetro de valor se o valor for zerado", async () => {
    const user = userEvent.setup();
    render(<QuickAporteCard />);

    const submitButton = screen.getByRole("button", { name: /Calcular Rebalanceamento/i });
    await user.click(submitButton);

    expect(navigateMock).toHaveBeenCalledWith("/investments?tab=aporte");
    expect(triggerSensoryMock).toHaveBeenCalledWith("action");
  });
});
