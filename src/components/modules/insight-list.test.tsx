import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { InsightList } from "./insight-list";

describe("InsightList", () => {
  it("renderiza lista de itens com badges e valores", () => {
    render(
      <InsightList
        items={[
          {
            key: "sub:netflix",
            title: "Netflix",
            subtitle: "Assinatura · 3 mês(es)",
            confidence: 0.98,
            amountCents: 3990,
            badges: [{ label: "Streaming", tone: "default" }, { label: "Pode cortar", tone: "positive" }],
          },
        ]}
      />,
    );

    expect(screen.getByText("Netflix")).toBeInTheDocument();
    expect(screen.getByText("Assinatura · 3 mês(es)")).toBeInTheDocument();
    expect(screen.getByText("Streaming")).toBeInTheDocument();
    expect(screen.getByText("Pode cortar")).toBeInTheDocument();
    expect(screen.getByText("R$ 39,90")).toBeInTheDocument();
  });

  it("aciona onConfirm e onIgnore ao clicar nos botões da cápsula unificada", () => {
    const handleConfirm = vi.fn();
    const handleIgnore = vi.fn();

    render(
      <InsightList
        items={[
          {
            key: "sub:spotify",
            title: "Spotify",
            amountCents: 2190,
          },
        ]}
        onConfirm={handleConfirm}
        onIgnore={handleIgnore}
      />,
    );

    const actionGroup = screen.getByRole("group", { name: "Ações para Spotify" });
    expect(actionGroup).toBeInTheDocument();

    const confirmBtn = screen.getByRole("button", { name: "Confirmar Spotify" });
    const ignoreBtn = screen.getByRole("button", { name: "Ignorar Spotify" });

    fireEvent.click(confirmBtn);
    expect(handleConfirm).toHaveBeenCalledWith("sub:spotify");

    fireEvent.click(ignoreBtn);
    expect(handleIgnore).toHaveBeenCalledWith("sub:spotify");
  });

  it("exibe cápsula de confirmada e permite desmarcar acionando onRestore", () => {
    const handleRestore = vi.fn();

    render(
      <InsightList
        items={[
          {
            key: "sub:spotify",
            title: "Spotify",
            amountCents: 2190,
          },
        ]}
        feedback={{ "sub:spotify": "confirm" }}
        onRestore={handleRestore}
      />,
    );

    const confirmedBtn = screen.getByRole("button", { name: "Confirmada (Spotify) — clique para desmarcar" });
    expect(confirmedBtn).toBeInTheDocument();

    fireEvent.click(confirmedBtn);
    expect(handleRestore).toHaveBeenCalledWith("sub:spotify");
  });

  it("exibe botão de restaurar para item ignorado e aciona onRestore", () => {
    const handleRestore = vi.fn();

    render(
      <InsightList
        items={[
          {
            key: "sub:ignorado",
            title: "Item Ignorado",
            amountCents: 1000,
          },
        ]}
        feedback={{ "sub:ignorado": "ignore" }}
        onRestore={handleRestore}
      />,
    );

    const restoreBtn = screen.getByRole("button", { name: "Restaurar Item Ignorado" });
    expect(restoreBtn).toBeInTheDocument();

    fireEvent.click(restoreBtn);
    expect(handleRestore).toHaveBeenCalledWith("sub:ignorado");
  });

  it("renderiza empty state quando a lista for vazia", () => {
    render(<InsightList items={[]} emptyLabel="Nenhuma recorrência encontrada." />);
    expect(screen.getByText("Nenhuma recorrência encontrada.")).toBeInTheDocument();
  });
});
