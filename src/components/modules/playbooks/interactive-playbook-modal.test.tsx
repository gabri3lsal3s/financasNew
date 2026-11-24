import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { InteractivePlaybookModal } from "./interactive-playbook-modal";

vi.mock("@/state", () => ({
  useUpdateCustomSettings: () => ({
    mutate: vi.fn(),
    isPending: false,
  }),
}));

vi.mock("@/hooks/use-visual-customization", () => ({
  useVisualCustomization: () => ({
    showEducationalPlaybooks: true,
    dismissedPlaybookKeys: [],
    dismissPlaybook: vi.fn(),
    setShowEducationalPlaybooks: vi.fn(),
    isPlaybookVisible: vi.fn(() => true),
  }),
}));

vi.mock("@/services/sensory", () => ({
  triggerSensory: vi.fn(),
}));

describe("InteractivePlaybookModal", () => {
  const dummyTabs = [
    {
      value: "tab1",
      label: "Aba 1",
      content: <div>Conteúdo da Aba 1</div>,
    },
    {
      value: "tab2",
      label: "Aba 2",
      content: <div>Conteúdo da Aba 2</div>,
    },
  ];

  it("renderiza título, abas e rodapé normal", () => {
    render(
      <InteractivePlaybookModal
        open={true}
        onOpenChange={vi.fn()}
        moduleKey="transactions"
        title="Guia de Lançamentos"
        description="Aprenda a lançar despesas"
        tabs={dummyTabs}
      />,
    );

    expect(screen.getByText("Guia de Lançamentos")).toBeInTheDocument();
    expect(screen.getByText("Aprenda a lançar despesas")).toBeInTheDocument();
    expect(screen.getByText("Conteúdo da Aba 1")).toBeInTheDocument();
    expect(screen.getByText("Ocultar este guia...")).toBeInTheDocument();
  });

  it("permite alternar para a barra inline de dispensa", () => {
    render(
      <InteractivePlaybookModal
        open={true}
        onOpenChange={vi.fn()}
        moduleKey="transactions"
        title="Guia de Lançamentos"
        description="Aprenda a lançar despesas"
        tabs={dummyTabs}
      />,
    );

    const dismissToggle = screen.getByText("Ocultar este guia...");
    fireEvent.click(dismissToggle);

    expect(screen.getByText("Deseja ocultar:")).toBeInTheDocument();
    expect(screen.getByText("Só o guia de Lançamentos")).toBeInTheDocument();
    expect(screen.getByText("Todos os guias do app")).toBeInTheDocument();
    expect(screen.getByText("Cancelar")).toBeInTheDocument();
  });
});
