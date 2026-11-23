import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PositionToolbar } from "./position-toolbar";

describe("PositionToolbar", () => {
  const defaultProps = {
    search: "",
    onSearchChange: vi.fn(),
    groupBy: "class" as const,
    onGroupByChange: vi.fn(),
    availableClasses: ["Ações", "FIIs", "Internacional", "Renda Fixa"] as const,
    selectedClass: null,
    onSelectClass: vi.fn(),
    closedCount: 2,
    hideClosed: true,
    onToggleHideClosed: vi.fn(),
    filteredCount: 10,
    totalCount: 12,
    hasFiltersActive: false,
  };

  it("renderiza o campo de busca e os alternadores de agrupamento", async () => {
    const user = userEvent.setup();
    const onGroupByChange = vi.fn();
    render(<PositionToolbar {...defaultProps} onGroupByChange={onGroupByChange} />);

    expect(screen.getByPlaceholderText(/Buscar por ticker ou classe/i)).toBeInTheDocument();
    const sectorBtn = screen.getByRole("button", { name: /Por Setor/i });
    await user.click(sectorBtn);
    expect(onGroupByChange).toHaveBeenCalledWith("sector");
  });

  it("renderiza o seletor móvel e os botões de desktop para classes", () => {
    render(<PositionToolbar {...defaultProps} />);

    // Select acessível para mobile
    expect(screen.getByLabelText(/Filtrar por classe de ativo/i)).toBeInTheDocument();

    // Botões de desktop
    expect(screen.getByRole("button", { name: "Todas" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ações" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "FIIs" })).toBeInTheDocument();
  });

  it("permite alternar a visualização de posições encerradas", async () => {
    const user = userEvent.setup();
    const onToggleHideClosed = vi.fn();
    render(<PositionToolbar {...defaultProps} onToggleHideClosed={onToggleHideClosed} />);

    const closedBtn = screen.getByRole("button", { name: /Ver encerradas/i });
    await user.click(closedBtn);
    expect(onToggleHideClosed).toHaveBeenCalledTimes(1);
  });

  it("renderiza o seletor de setores de forma confortável quando groupBy é sector", () => {
    render(
      <PositionToolbar
        {...defaultProps}
        groupBy="sector"
        availableSectors={["Tecnologia & Software", "Petróleo"]}
        selectedSector={null}
      />,
    );

    // No modo Por Setor, o seletor limpo de setores é exibido sem poluir em múltiplas linhas
    expect(screen.getByLabelText(/Filtrar por setor/i)).toBeInTheDocument();
  });
});
