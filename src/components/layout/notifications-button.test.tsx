import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { describe, expect, it, vi } from "vitest";
import { NotificationsButton } from "./notifications-button";

const mockUseReminders = vi.fn();

vi.mock("@/state", () => ({
  useReminders: () => mockUseReminders(),
  useSetReminderState: () => ({ mutate: vi.fn(), isPending: false }),
  useMarkAllRemindersAsRead: () => ({ mutate: vi.fn(), isPending: false }),
}));

describe("NotificationsButton", () => {
  it("renderiza o sininho com badge de contagem quando há pendências", () => {
    mockUseReminders.mockReturnValue({
      items: [],
      totalCount: 3,
      overdueCount: 1,
      dueTodayCount: 0,
      isLoading: false,
    });

    render(
      <MemoryRouter>
        <NotificationsButton />
      </MemoryRouter>,
    );

    expect(screen.getByRole("button", { name: "Notificações: 3 pendências" })).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("renderiza sem badge quando não há itens", () => {
    mockUseReminders.mockReturnValue({
      items: [],
      totalCount: 0,
      overdueCount: 0,
      dueTodayCount: 0,
      isLoading: false,
    });

    render(
      <MemoryRouter>
        <NotificationsButton />
      </MemoryRouter>,
    );

    expect(screen.getByRole("button", { name: "Notificações" })).toBeInTheDocument();
    expect(screen.queryByText("0")).not.toBeInTheDocument();
  });

  it("abre o popover ao clicar no sininho", async () => {
    const user = userEvent.setup();
    mockUseReminders.mockReturnValue({
      items: [],
      totalCount: 0,
      overdueCount: 0,
      dueTodayCount: 0,
      isLoading: false,
    });

    render(
      <MemoryRouter>
        <NotificationsButton />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole("button", { name: "Notificações" }));
    expect(screen.getByText("Lembretes & Avisos")).toBeInTheDocument();
  });
});
