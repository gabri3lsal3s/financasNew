import { fireEvent, render, screen } from "@testing-library/react";
import { AlertTriangle } from "lucide-react";
import { describe, expect, it, vi } from "vitest";
import { MoneyText } from "@/components/ui/money-text";
import { AlertCarouselCard } from "./alert-carousel-card";

describe("AlertCarouselCard", () => {
  it("renderiza título sem truncate cego e aplica pr-9 sm:pr-0 quando dispensável", () => {
    const { container } = render(
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

    expect(container.querySelector(".pr-9")).not.toBeNull();
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
});
