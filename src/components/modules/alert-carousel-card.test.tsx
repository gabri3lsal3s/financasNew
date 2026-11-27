import { fireEvent, render, screen } from "@testing-library/react";
import { AlertTriangle } from "lucide-react";
import { describe, expect, it, vi } from "vitest";
import { MoneyText } from "@/components/ui/money-text";
import { AlertCarouselCard } from "./alert-carousel-card";

describe("AlertCarouselCard", () => {
  it("renderiza título sem truncate cego e posiciona utilitários na coluna dedicada", () => {
    render(
      <AlertCarouselCard
        id="portfolio.drift"
        tone="warning"
        icon={<AlertTriangle className="size-4.5" />}
        title="Concentração em Baixa Convicção na Carteira"
        description={
          <>
            Sobra estimada de <MoneyText cents={150_000} /> pronta para alocação.
          </>
        }
        descriptionText="Sobra estimada de R$ 1.500,00 pronta para alocação."
        badge={{ label: "Atenção", variant: "warning" }}
        primaryAction={{ label: "Simular Aporte", onClick: vi.fn() }}
        dismissPolicy={{
          allowedPresets: ["7d", "1m", "6m"],
          onSelectPreset: vi.fn(),
        }}
      />,
    );

    const heading = screen.getByRole("heading", {
      name: "Concentração em Baixa Convicção na Carteira",
    });
    expect(heading.className).toContain("line-clamp-2");
    expect(heading.className).toContain("break-words");
    expect(heading.className).not.toContain("truncate");

    expect(screen.getByRole("button", { name: /Dispensar/i }).closest(".col-start-3")).not.toBeNull();
    expect(screen.getByText(/R\$\s*1\.500,00/)).toBeInTheDocument();
  });

  it("omite botão de dispensa quando allowedPresets for vazio (P0 obrigatório)", () => {
    render(
      <AlertCarouselCard
        id="billing.past_due"
        tone="critical"
        icon={<AlertTriangle className="size-4.5" />}
        title="Assinatura em atraso"
        description="Regularize sua cobrança."
        primaryAction={{ label: "Regularizar", onClick: vi.fn() }}
        dismissPolicy={{
          allowedPresets: [],
          onSelectPreset: vi.fn(),
        }}
      />,
    );

    expect(screen.queryByRole("button", { name: /Dispensar/i })).not.toBeInTheDocument();
  });

  it("dispensa com presets 7d / 1m / 6m quando permitidos pela política", () => {
    const onSelectPreset = vi.fn();
    render(
      <AlertCarouselCard
        id="portfolio.risk.single_asset.PETR4"
        tone="critical"
        icon={<AlertTriangle className="size-4.5" />}
        title="Alta concentração em PETR4"
        description="Acima do limite prudencial."
        dismissPolicy={{
          allowedPresets: ["7d", "1m", "6m"],
          onSelectPreset,
          nowMs: new Date(2026, 10, 27, 10, 0).getTime(),
        }}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Dispensar/i }));
    const btn6m = screen.getByRole("button", { name: /6 meses/i });
    fireEvent.click(btn6m);

    expect(onSelectPreset).toHaveBeenCalledWith("6m");
  });

  it("abre CalculationMemoryModal com priority=p0 (acessível no mobile) e pausa autoplay via CarouselPauseContext", async () => {
    const { MemoryRouter } = await import("react-router");
    const { CarouselPauseProvider } = await import("./carousel-pause-context");
    const { useCarouselPauseContext } = await import("./carousel-pause-context-def");
    const { buildGoalProgressBreakdown } = await import(
      "@/domain/calculation-memory/builders/overview-carousel-breakdown"
    );

    function PauseObserver() {
      const { isPaused } = useCarouselPauseContext();
      return <span data-testid="pause-state">{isPaused ? "paused" : "running"}</span>;
    }

    const breakdown = buildGoalProgressBreakdown({
      shareId: "g1",
      goalTitle: "Reserva",
      asOf: "2026-11-27",
      deadline: "2026-12-31",
      targetCents: 100_000,
      currentCents: 60_000,
      source: "Conta",
      remainingCents: 40_000,
      remainingDays: 34,
      requiredDailyCents: 1_176,
      stage: "regular",
    });

    render(
      <MemoryRouter>
        <CarouselPauseProvider>
          <PauseObserver />
          <AlertCarouselCard
            id="overview.cash_gap"
            tone="critical"
            icon={<AlertTriangle className="size-4.5" />}
            title="Furo de Caixa Previsto"
            description="Sobra negativa prevista."
            calculationBreakdown={breakdown}
          />
        </CarouselPauseProvider>
      </MemoryRouter>,
    );

    expect(screen.getByTestId("pause-state")).toHaveTextContent("running");

    const triggerBtn = screen.getByRole("button", {
      name: /Memória de cálculo: Furo de Caixa Previsto/i,
    });
    expect(triggerBtn.className).not.toContain("hidden");

    fireEvent.click(triggerBtn);
    expect(screen.getByTestId("pause-state")).toHaveTextContent("paused");
  });

  it("renderiza ação secundária e primária em grid-cols-2 no mobile (<400px) com aria-label", () => {
    const onPrimary = vi.fn();
    const onSecondary = vi.fn();
    const { container } = render(
      <AlertCarouselCard
        id="bridge.combined_contribution"
        tone="portfolio"
        icon={<AlertTriangle className="size-4.5" />}
        title="Aporte combinado disponível"
        description="Sobra + caixa em corretora."
        primaryAction={{ label: "Simular", onClick: onPrimary, ariaLabel: "Simular aporte combinado" }}
        secondaryAction={{ label: "Detalhes", onClick: onSecondary, ariaLabel: "Ver detalhes do aporte" }}
      />,
    );

    expect(container.querySelector(".grid-cols-2")).not.toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Simular aporte combinado" }));
    fireEvent.click(screen.getByRole("button", { name: "Ver detalhes do aporte" }));
    expect(onPrimary).toHaveBeenCalledTimes(1);
    expect(onSecondary).toHaveBeenCalledTimes(1);
  });

  it("centraliza verticalmente no mobile quando !hasActions e ancora CTA na base quando hasActions", () => {
    const { container: noActionsContainer } = render(
      <AlertCarouselCard
        id="advisor.celebration"
        tone="positive"
        icon={<AlertTriangle className="size-4.5" />}
        title="Economia real no mês"
        description="Descrição completa sem truncamento para equilibrar altura."
      />,
    );
    const noActionsCard = noActionsContainer.querySelector('[data-card-id="advisor.celebration"]');
    expect(noActionsCard?.className).toContain("content-center");
    expect(noActionsCard?.className).not.toContain("grid-rows-[auto_1fr_auto]");

    const { container: withActionsContainer } = render(
      <AlertCarouselCard
        id="advisor.budget"
        tone="warning"
        icon={<AlertTriangle className="size-4.5" />}
        title="Orçamento próximo do limite"
        description="Você atingiu 85% da meta."
        primaryAction={{ label: "Revisar", onClick: vi.fn() }}
      />,
    );
    const withActionsCard = withActionsContainer.querySelector('[data-card-id="advisor.budget"]');
    expect(withActionsCard?.className).toContain("content-start");
    expect(withActionsCard?.className).toContain("grid-rows-[auto_1fr_auto]");
  });

  it("renderiza essentialAction junto com dismissPolicy e suporta customActions", () => {
    const onEssential = vi.fn();
    const onDismiss = vi.fn();
    render(
      <AlertCarouselCard
        id="advisor.savings.netflix"
        tone="warning"
        icon={<AlertTriangle className="size-4.5" />}
        title="Assinatura recorrente"
        description="Netflix mensal."
        essentialAction={{ label: "Manter como essencial", onClick: onEssential }}
        customActions={<button type="button">Ação customizada</button>}
        dismissPolicy={{
          allowedPresets: ["7d", "1m"],
          onSelectPreset: onDismiss,
          label: "Dispensar sugestão",
        }}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Manter como essencial" }));
    expect(onEssential).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "Ação customizada" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Dispensar sugestão" })).toBeInTheDocument();
  });
});
