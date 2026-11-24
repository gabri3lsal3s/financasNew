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

    // O primeiro exibido deve ter o contador "1 de 3"
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

    expect(screen.getByText("1 de 2")).toBeInTheDocument();

    // Clica no botão de próximo alerta
    const nextBtn = screen.getByRole("button", { name: /Próximo alerta/i });
    fireEvent.click(nextBtn);

    expect(screen.getByText("2 de 2")).toBeInTheDocument();

    // Clica no botão de alerta anterior
    const prevBtn = screen.getByRole("button", { name: /Alerta anterior/i });
    fireEvent.click(prevBtn);

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

    expect(screen.getByText("3 de 3")).toBeInTheDocument();
  });

  it("rotaciona automaticamente após o intervalo configurado", () => {
    render(
      <DashboardAlertsCarousel
        items={[mockItemCritical, mockItemDeficit]}
        autoplayIntervalMs={5000}
      />,
    );

    expect(screen.getByText("1 de 2")).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(5000);
    });

    expect(screen.getByText("2 de 2")).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(5000);
    });

    expect(screen.getByText("1 de 2")).toBeInTheDocument();
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
    expect(screen.getByText("1 de 2")).toBeInTheDocument();

    // Simula saída do mouse
    fireEvent.mouseLeave(carousel);

    act(() => {
      vi.advanceTimersByTime(5000);
    });

    expect(screen.getByText("2 de 2")).toBeInTheDocument();
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

    expect(screen.getByText("2 de 2")).toBeInTheDocument();

    // Swipe para a direita (slide anterior)
    fireEvent.touchStart(carousel, { touches: [{ clientX: 100 }] });
    fireEvent.touchEnd(carousel, { changedTouches: [{ clientX: 200 }] });

    expect(screen.getByText("1 de 2")).toBeInTheDocument();
  });

  it("realiza o snap instantâneo de loop infinito ao atingir o final da trilha", () => {
    const { container } = render(
      <DashboardAlertsCarousel
        items={[mockItemCritical, mockItemDeficit]}
      />,
    );

    const nextBtn = screen.getByRole("button", { name: /Próximo alerta/i });
    // Slide 1 (mockItemCritical) -> Slide 2 (mockItemDeficit)
    fireEvent.click(nextBtn);
    expect(screen.getByText("2 de 2")).toBeInTheDocument();

    // Slide 2 -> Clone do Slide 1 (mockItemCritical)
    fireEvent.click(nextBtn);
    expect(screen.getByText("1 de 2")).toBeInTheDocument();

    // Dispara transitionEnd no track
    const track = container.querySelector(".will-change-transform");
    if (track) {
      fireEvent.transitionEnd(track);
    }

    expect(screen.getByText("1 de 2")).toBeInTheDocument();
  });

  it("limita os slides exibidos ao teto definido por maxItems preservando a prioridade", () => {
    const sixItems: DashboardAlertItem[] = [
      { id: "p6", priority: 6, content: <div>Slide 6</div> },
      { id: "p1", priority: 1, content: <div>Slide 1</div> },
      { id: "p4", priority: 4, content: <div>Slide 4</div> },
      { id: "p2", priority: 2, content: <div>Slide 2</div> },
      { id: "p5", priority: 5, content: <div>Slide 5</div> },
      { id: "p3", priority: 3, content: <div>Slide 3</div> },
    ];

    render(<DashboardAlertsCarousel items={sixItems} maxItems={5} />);

    expect(screen.getByText("1 de 5")).toBeInTheDocument();
    expect(screen.getAllByText("Slide 1").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Slide 5").length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText("Slide 6")).not.toBeInTheDocument();
  });

  it("aplica inert nos slides inativos e clones para eliminar elementos fantasmas no DOM", () => {
    const { container } = render(
      <DashboardAlertsCarousel
        items={[mockItemCritical, mockItemDeficit]}
      />,
    );

    const slideContainers = container.querySelectorAll(".will-change-transform > div");
    expect(slideContainers.length).toBe(4); // [lastClone, item0, item1, firstClone]

    // Slide 1 (índice físico 1 = item0 ativo): NÃO deve ter inert
    expect(slideContainers[1]).not.toHaveAttribute("inert");
    expect(slideContainers[1]).toHaveAttribute("aria-hidden", "false");

    // Clones e slides inativos (índice 0, 2 e 3): DEVEM ter inert e aria-hidden="true"
    expect(slideContainers[0]).toHaveAttribute("inert");
    expect(slideContainers[0]).toHaveAttribute("aria-hidden", "true");
    expect(slideContainers[2]).toHaveAttribute("inert");
    expect(slideContainers[2]).toHaveAttribute("aria-hidden", "true");
    expect(slideContainers[3]).toHaveAttribute("inert");
    expect(slideContainers[3]).toHaveAttribute("aria-hidden", "true");
  });

  it("reinicia para o slide 1 quando itens são alterados ou dispensados", () => {
    const { rerender } = render(
      <DashboardAlertsCarousel
        items={[mockItemCritical, mockItemDeficit]}
      />,
    );

    // Navega para o slide 2
    const nextBtn = screen.getByRole("button", { name: /Próximo alerta/i });
    fireEvent.click(nextBtn);
    expect(screen.getByText("2 de 2")).toBeInTheDocument();

    // Simula dispensa do mockItemCritical substituído por mockItemSurplus (total permanece 2)
    rerender(
      <DashboardAlertsCarousel
        items={[mockItemDeficit, mockItemSurplus]}
      />,
    );

    // Ao mudar os itens (itemsKey), deve reiniciar para o slide 1 sem travar em índice obsoleto
    expect(screen.getByText("1 de 2")).toBeInTheDocument();
  });
});
