import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { DonutRing } from "./donut-ring";
import * as sensoryModule from "@/services/sensory";

describe("DonutRing", () => {
  const sampleSlices = [
    { id: "moradia", label: "Moradia", value: 6000 },
    { id: "mercado", label: "Mercado", value: 4000 },
  ];

  it("renderiza SVG com aria-label e conteúdo central", () => {
    render(
      <DonutRing
        slices={sampleSlices}
        ariaLabel="Distribuição mensal"
        centerContent={<span>Total</span>}
      />,
    );

    expect(screen.getByRole("img", { name: "Distribuição mensal" })).toBeInTheDocument();
    expect(screen.getByText("Total")).toBeInTheDocument();
  });

  it("dispara onSliceSelect e triggerSensory ao clicar em uma fatia interativa", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    const sensorySpy = vi.spyOn(sensoryModule, "triggerSensory");
    sensorySpy.mockClear();

    render(
      <DonutRing
        slices={sampleSlices}
        activeId={null}
        onSliceSelect={onSelect}
      />,
    );

    const moradiaSlice = screen.getByRole("button", { name: "Moradia: 60.0%" });
    await user.click(moradiaSlice);

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect.mock.calls[0]?.[0]?.id).toBe("moradia");
    expect(sensorySpy).toHaveBeenCalledWith("selection");
  });

  it("desmarca a fatia quando activeId já corresponde à fatia clicada", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();

    render(
      <DonutRing
        slices={sampleSlices}
        activeId="moradia"
        onSliceSelect={onSelect}
      />,
    );

    const moradiaSlice = screen.getByRole("button", { name: "Moradia: 60.0%" });
    expect(moradiaSlice).toHaveAttribute("aria-pressed", "true");
    await user.click(moradiaSlice);
    expect(onSelect).toHaveBeenCalledWith(null);
  });
});
