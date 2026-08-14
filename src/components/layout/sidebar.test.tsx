import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { axe } from "vitest-axe";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Sidebar } from "./sidebar";

function renderSidebar(isCollapsed = false, onToggle = () => {}) {
  return render(
    <MemoryRouter initialEntries={["/"]}>
      <Sidebar isCollapsed={isCollapsed} onToggle={onToggle} />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  window.localStorage.clear();
});

describe("Sidebar colapsável (F7.2)", () => {
  it("renderiza expandida com logo e labels visíveis", () => {
    renderSidebar();
    expect(screen.getByText("Guia Financeiro")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Transações" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Recolher menu lateral" })).toBeInTheDocument();
  });

  it("modo compacto esconde labels e expõe os nomes via aria-label", () => {
    renderSidebar(true);
    expect(screen.queryByText("Guia Financeiro")).not.toBeInTheDocument();
    // Link ainda nomeado para leitores de tela e tooltips (title).
    expect(screen.getByRole("link", { name: "Transações" })).toHaveAttribute(
      "title",
      "Transações",
    );
    expect(screen.getByRole("button", { name: "Expandir menu lateral" })).toBeInTheDocument();
  });

  it("toggle dispara o callback do dono do estado (PageShell)", async () => {
    const user = userEvent.setup();
    const onToggle = vi.fn();
    renderSidebar(false, onToggle);

    await user.click(screen.getByRole("button", { name: "Recolher menu lateral" }));
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it("sem violações de acessibilidade (axe) nos dois modos", async () => {
    const { container } = renderSidebar(false);
    expect(await axe(container)).toHaveNoViolations();
  });
});
