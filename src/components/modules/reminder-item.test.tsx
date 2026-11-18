import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReminderItem as ReminderItemData } from "@/domain/reminders";
import { ReminderItem } from "./reminder-item";

const billItem: ReminderItemData = {
  key: "bill:c1:2026-08",
  kind: "bill",
  title: "Fatura Nubank",
  subtitle: "Fechamento dia 25",
  dueDate: "2026-08-10",
  amountCents: 245000,
  status: "overdue",
};

describe("ReminderItem", () => {
  it("renderiza título, data formatada em pt-BR, valor e badges", () => {
    render(<ReminderItem item={billItem} />);

    expect(screen.getByText("Fatura Nubank")).toBeInTheDocument();
    expect(screen.getByText("10/08/2026")).toBeInTheDocument();
    expect(screen.getByText("R$ 2.450,00")).toBeInTheDocument();
    expect(screen.getByText("Vencido")).toBeInTheDocument();
  });

  it("aciona onOpen ao clicar no conteúdo sem acionar quando clica nos botões de ação", async () => {
    const user = userEvent.setup();
    const onOpen = vi.fn();
    const onSettle = vi.fn();
    const onSnooze = vi.fn();
    const onMarkRead = vi.fn();

    render(
      <ReminderItem
        item={billItem}
        onOpen={onOpen}
        onSettle={onSettle}
        onSnooze={onSnooze}
        onMarkRead={onMarkRead}
      />,
    );

    await user.click(screen.getByText("Fatura Nubank"));
    expect(onOpen).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole("button", { name: /Pagar fatura Fatura Nubank/i }));
    expect(onSettle).toHaveBeenCalledWith(billItem);
    expect(onOpen).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole("button", { name: /Adiar lembrete Fatura Nubank/i }));
    expect(onSnooze).toHaveBeenCalledWith("bill:c1:2026-08");

    await user.click(screen.getByRole("button", { name: /Marcar como lido Fatura Nubank/i }));
    expect(onMarkRead).toHaveBeenCalledWith("bill:c1:2026-08");
  });

  it("exibe ação Reabrir quando stateKind for read", async () => {
    const user = userEvent.setup();
    const onRestore = vi.fn();

    render(<ReminderItem item={billItem} stateKind="read" onRestore={onRestore} />);

    expect(screen.getByText("Lido")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Reabrir lembrete Fatura Nubank/i }));
    expect(onRestore).toHaveBeenCalledWith("bill:c1:2026-08");
  });
});
