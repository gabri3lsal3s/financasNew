import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { FinancialPeriodToolbar } from "./financial-period-toolbar";

let mockIsBusinessModeEnabled = false;
let mockViewScope = "all";
const mockSetViewScope = vi.fn();

vi.mock("@/hooks/use-safe-business-scope", () => ({
  useSafeViewScope: () => ({
    viewScope: mockViewScope,
    effectiveViewScope: mockViewScope,
    setViewScope: mockSetViewScope,
    isBusinessModeEnabled: mockIsBusinessModeEnabled,
  }),
}));

describe("FinancialPeriodToolbar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsBusinessModeEnabled = false;
    mockViewScope = "all";
  });

  it("renderiza apenas o seletor de periodicidade quando Modo Negócio estiver desligado", () => {
    render(
      <FinancialPeriodToolbar
        mode="month"
        setMode={vi.fn()}
        month="2026-08"
        setMonth={vi.fn()}
        year={2026}
        setYear={vi.fn()}
        customStart=""
        setCustomStart={vi.fn()}
        customEnd=""
        setCustomEnd={vi.fn()}
      />,
    );

    expect(screen.getByRole("group", { name: /Periodicidade do relatório/i })).toBeInTheDocument();
    expect(
      screen.queryByRole("group", { name: /Esfera contábil do relatório/i }),
    ).not.toBeInTheDocument();
  });

  it("renderiza o seletor de esfera (Consolidado, Pessoal, Negócio) quando Modo Negócio estiver ativo", async () => {
    mockIsBusinessModeEnabled = true;
    const user = userEvent.setup();

    render(
      <FinancialPeriodToolbar
        mode="month"
        setMode={vi.fn()}
        month="2026-08"
        setMonth={vi.fn()}
        year={2026}
        setYear={vi.fn()}
        customStart=""
        setCustomStart={vi.fn()}
        customEnd=""
        setCustomEnd={vi.fn()}
      />,
    );

    const sphereGroup = screen.getByRole("group", {
      name: /Esfera contábil do relatório/i,
    });
    expect(sphereGroup).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Consolidado" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Pessoal" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Negócio" })).toBeInTheDocument();

    const businessBtn = screen.getByRole("button", { name: "Negócio" });
    await user.click(businessBtn);

    expect(mockSetViewScope).toHaveBeenCalledWith("business");
  });
});
