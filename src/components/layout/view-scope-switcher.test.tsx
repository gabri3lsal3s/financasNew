import { MemoryRouter } from "react-router";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ViewScopeSwitcher } from "./view-scope-switcher";

const setViewScopeMock = vi.fn();
let mockEnabled = true;
let mockScope: "all" | "personal" | "business" = "all";

vi.mock("@/state", () => ({
  useViewScope: () => ({
    viewScope: mockScope,
    effectiveViewScope: mockEnabled ? mockScope : "all",
    setViewScope: setViewScopeMock,
    isBusinessModeEnabled: mockEnabled,
  }),
}));

describe("ViewScopeSwitcher", () => {
  it("não renderiza nada quando businessModeEnabled = false (isolamento PF)", () => {
    mockEnabled = false;
    const { container } = render(
      <MemoryRouter initialEntries={["/transacoes"]}>
        <ViewScopeSwitcher />
      </MemoryRouter>,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("não renderiza em rotas sem escopo (/investments)", () => {
    mockEnabled = true;
    const { container } = render(
      <MemoryRouter initialEntries={["/investments"]}>
        <ViewScopeSwitcher />
      </MemoryRouter>,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("renderiza os 3 botões e chama setViewScope ao clicar", async () => {
    mockEnabled = true;
    mockScope = "all";
    setViewScopeMock.mockClear();
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={["/transacoes"]}>
        <ViewScopeSwitcher />
      </MemoryRouter>,
    );

    const businessBtn = screen.getByRole("radio", { name: "Negócio" });
    await user.click(businessBtn);
    expect(setViewScopeMock).toHaveBeenCalledWith("business");
  });
});
