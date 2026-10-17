import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Command, type CommandGroup } from "./command";

describe("Primitivo Command — Busca Global e Safe Area", () => {
  const groups: CommandGroup[] = [
    {
      label: "Ações",
      items: [
        {
          value: "nova-despesa",
          label: "Nova Despesa",
          onSelect: vi.fn(),
        },
        {
          value: "nova-receita",
          label: "Nova Receita",
          onSelect: vi.fn(),
        },
      ],
    },
  ];

  it("renderiza o diálogo fechado quando open=false", () => {
    render(<Command open={false} onOpenChange={vi.fn()} groups={groups} />);
    expect(screen.queryByPlaceholderText("Buscar…")).not.toBeInTheDocument();
  });

  it("renderiza o diálogo aberto com as classes canônicas de Safe Area e posicionamento responsivo", () => {
    render(<Command open={true} onOpenChange={vi.fn()} groups={groups} />);

    const input = screen.getByPlaceholderText("Buscar…");
    expect(input).toBeInTheDocument();

    const dialogContent = input.closest("[role='dialog']");
    expect(dialogContent).toBeInTheDocument();

    // Blindagem de Safe Area superior no mobile e centralização a 15% no desktop (sm)
    expect(dialogContent?.className).toContain(
      "top-[max(1rem,calc(max(env(safe-area-inset-top,0px),var(--safe-area-top,0px))+0.75rem))]",
    );
    expect(dialogContent?.className).toContain("sm:top-[15%]");
    expect(dialogContent?.className).toContain(
      "max-h-[calc(85dvh-max(env(safe-area-inset-top,0px),var(--safe-area-top,0px)))]",
    );
    expect(dialogContent?.className).toContain("sm:max-h-[85dvh]");
  });

  it("dispara onSelect ao selecionar um item", async () => {
    const user = userEvent.setup();
    const onSelectMock = vi.fn();

    const testGroups: CommandGroup[] = [
      {
        label: "Opções",
        items: [
          {
            value: "acao-1",
            label: "Executar Ação",
            onSelect: onSelectMock,
          },
        ],
      },
    ];

    render(<Command open={true} onOpenChange={vi.fn()} groups={testGroups} />);

    const item = screen.getByText("Executar Ação");
    await user.click(item);

    expect(onSelectMock).toHaveBeenCalledTimes(1);
  });
});
