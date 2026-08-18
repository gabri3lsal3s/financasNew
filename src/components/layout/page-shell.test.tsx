import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PageShell } from "./page-shell";

const STORAGE_KEY = "financas_sidebar_collapsed";

vi.mock("@/app/theme-provider", () => ({
  useTheme: () => ({ theme: "light", preference: "light", setPreference: vi.fn() }),
}));

vi.mock("@/features/transactions", () => ({
  LaunchWizard: ({ open }: { open?: boolean }) => (open ? <div data-testid="launch-wizard-overlay" /> : null),
}));

vi.mock("@/state", () => ({
  useGlobalSearchEntries: () => ({
    entries: [],
    isLoading: false,
    isError: false,
    error: null,
  }),
  useReminders: () => ({
    totalCount: 0,
    urgentCount: 0,
    items: [],
    isLoading: false,
    error: null,
  }),
  useSetReminderState: () => ({ mutate: vi.fn(), isPending: false }),
  useMarkAllRemindersAsRead: () => ({ mutate: vi.fn(), isPending: false }),
}));

function renderShell() {
  return render(
    <MemoryRouter initialEntries={["/"]}>
      <Routes>
        <Route element={<PageShell />}>
          <Route path="/" element={<div data-testid="page-content">Conteúdo</div>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

/** O wrapper de conteúdo é o pai do <header> sticky (div com a margem da sidebar). */
function contentWrapper() {
  const header = screen.getByRole("banner");
  return header.parentElement as HTMLElement;
}

beforeEach(() => {
  window.localStorage.clear();
});

describe("PageShell (F7.2/F7.3)", () => {
  it("monta header, sidebar, conteúdo e bottom nav", () => {
    renderShell();
    expect(screen.getByRole("banner")).toBeInTheDocument();
    expect(screen.getByRole("complementary")).toBeInTheDocument(); // <aside> sidebar
    expect(screen.getByTestId("page-content")).toBeInTheDocument();
    // Sidebar (desktop) + BottomNav (mobile) compartilham o mesmo label acessível.
    expect(screen.getAllByRole("navigation", { name: "Navegação principal" })).toHaveLength(2);
  });

  it("margem inicial acompanha a sidebar expandida (lg:pl-64)", () => {
    renderShell();
    expect(contentWrapper().className).toContain("lg:pl-64");
  });

  it("recolher a sidebar ajusta a margem do conteúdo em tempo real (lg:pl-20) e persiste", async () => {
    const user = userEvent.setup();
    renderShell();

    await user.click(screen.getByRole("button", { name: "Recolher menu lateral" }));

    expect(contentWrapper().className).toContain("lg:pl-20");
    expect(contentWrapper().className).not.toContain("lg:pl-64");
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe("1");
  });

  it("expandir novamente restaura a margem (lg:pl-64)", async () => {
    const user = userEvent.setup();
    renderShell();

    await user.click(screen.getByRole("button", { name: "Recolher menu lateral" }));
    await user.click(screen.getByRole("button", { name: "Expandir menu lateral" }));

    expect(contentWrapper().className).toContain("lg:pl-64");
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe("0");
  });

  it("renderiza o LaunchWizard overlay quando ?novo=transacao está presente", () => {
    render(
      <MemoryRouter initialEntries={["/?novo=transacao"]}>
        <Routes>
          <Route element={<PageShell />}>
            <Route path="/" element={<div data-testid="page-content">Conteúdo</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByTestId("launch-wizard-overlay")).toBeInTheDocument();
    expect(screen.getByTestId("page-content")).toBeInTheDocument();
  });
});
