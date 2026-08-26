import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DashboardAlertsCarousel, type DashboardAlertItem } from "./dashboard-alerts-carousel";

describe("DashboardAlertsCarousel", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const mockItemCritical: DashboardAlertItem = {
    id: "cash-gap",
    priority: 1,
    content: <div data-testid="alert-critical">Alerta Crítico de Saldo</div>,
  };

  const mockItemDeficit: DashboardAlertItem = {
    id: "pace-deficit",
    priority: 2,
    content: <div data-testid="alert-deficit">Projeção de Déficit</div>,
  };

  const mockItemSurplus: DashboardAlertItem = {
    id: "surplus-aporte",
    priority: 4,
    content: <div data-testid="alert-surplus">Capacidade de Aporte</div>,
  };

  it("não renderiza nada quando a lista de itens estiver vazia ou nula", () => {
    const { container } = render(<DashboardAlertsCarousel items={[]} />);
    expect(container.firstChild).toBeNull();

    const { container: containerNull } = render(
      <DashboardAlertsCarousel items={[null, undefined, false]} />,
    );
    expect(containerNull.firstChild).toBeNull();
  });

  it("renderiza diretamente em tela sem controles de carrossel quando houver apenas 1 alerta ativo", () => {
    render(<DashboardAlertsCarousel items={[mockItemCritical, null]} />);

    expect(screen.getByTestId("alert-critical")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Próximo alerta/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Alerta anterior/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/\d+ de \d+/)).not.toBeInTheDocument();
  });

  it("ordena por prioridade estrita (prioridade 1 aparece primeiro) e exibe controles quando houver múltiplos alertas", () => {
    // Passando o item de menor prioridade primeiro para testar a ordenação
    render(
      <DashboardAlertsCarousel
        items={[mockItemSurplus, mockItemCritical, mockItemDeficit]}
      />,
    );

    // O primeiro exibido deve ser o mockItemCritical (prioridade 1 com aria-hidden="false")
    expect(screen.getByTestId("alert-critical").closest("[aria-hidden]")).toHaveAttribute("aria-hidden", "false");
    expect(screen.getByTestId("alert-surplus").closest("[aria-hidden]")).toHaveAttribute("aria-hidden", "true");

    expect(screen.getByText("1 de 3")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Próximo alerta/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Alerta anterior/i })).toBeInTheDocument();
  });

  it("permite navegação manual pelos botões próximo e anterior", () => {
    render(
      <DashboardAlertsCarousel
        items={[mockItemCritical, mockItemDeficit]}
      />,
    );

    expect(screen.getByTestId("alert-critical")).toBeInTheDocument();

    // Clica no botão de próximo alerta
    const nextBtn = screen.getByRole("button", { name: /Próximo alerta/i });
    fireEvent.click(nextBtn);

    expect(screen.getByTestId("alert-deficit")).toBeInTheDocument();
    expect(screen.getByText("2 de 2")).toBeInTheDocument();

    // Clica no botão de alerta anterior
    const prevBtn = screen.getByRole("button", { name: /Alerta anterior/i });
    fireEvent.click(prevBtn);

    expect(screen.getByTestId("alert-critical")).toBeInTheDocument();
    expect(screen.getByText("1 de 2")).toBeInTheDocument();
  });

  it("permite navegação direta clicando nos dots de paginação", () => {
    render(
      <DashboardAlertsCarousel
        items={[mockItemCritical, mockItemDeficit, mockItemSurplus]}
      />,
    );

    const dot3 = screen.getByRole("button", { name: "Ir para alerta 3" });
    fireEvent.click(dot3);

    expect(screen.getByTestId("alert-surplus")).toBeInTheDocument();
    expect(screen.getByText("3 de 3")).toBeInTheDocument();
  });

  it("rotaciona automaticamente após o intervalo configurado", () => {
    render(
      <DashboardAlertsCarousel
        items={[mockItemCritical, mockItemDeficit]}
        autoplayIntervalMs={5000}
      />,
    );

    expect(screen.getByTestId("alert-critical")).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(5000);
    });

    expect(screen.getByTestId("alert-deficit")).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(5000);
    });

    expect(screen.getByTestId("alert-critical")).toBeInTheDocument();
  });

  it("pausa a rotação automática quando o cursor entra no carrossel (hover)", () => {
    render(
      <DashboardAlertsCarousel
        items={[mockItemCritical, mockItemDeficit]}
        autoplayIntervalMs={5000}
      />,
    );

    const carousel = screen.getByRole("region", { name: /Alertas e avisos contextuais/i });

    // Simula hover
    fireEvent.mouseEnter(carousel);

    act(() => {
      vi.advanceTimersByTime(10000);
    });

    // Permanece no primeiro alerta pois está pausado
    expect(screen.getByTestId("alert-critical")).toBeInTheDocument();

    // Simula saída do mouse
    fireEvent.mouseLeave(carousel);

    act(() => {
      vi.advanceTimersByTime(5000);
    });

    expect(screen.getByTestId("alert-deficit")).toBeInTheDocument();
  });

  it("suporta gestos de swipe no touch", () => {
    render(
      <DashboardAlertsCarousel
        items={[mockItemCritical, mockItemDeficit]}
      />,
    );

    const carousel = screen.getByRole("region", { name: /Alertas e avisos contextuais/i });

    // Swipe para a esquerda (próximo slide)
    fireEvent.touchStart(carousel, { touches: [{ clientX: 200 }] });
    fireEvent.touchEnd(carousel, { changedTouches: [{ clientX: 100 }] });

    expect(screen.getByTestId("alert-deficit")).toBeInTheDocument();

    // Swipe para a direita (slide anterior)
    fireEvent.touchStart(carousel, { touches: [{ clientX: 100 }] });
    fireEvent.touchEnd(carousel, { changedTouches: [{ clientX: 200 }] });

    expect(screen.getByTestId("alert-critical")).toBeInTheDocument();
  });
});
