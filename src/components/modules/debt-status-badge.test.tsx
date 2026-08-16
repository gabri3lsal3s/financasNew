import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DebtStatusBadge } from "./debt-status-badge";
import { InvoiceStatusBadge } from "./invoice-status-badge";

describe("DebtStatusBadge", () => {
  it("exibe o rótulo correto por status", () => {
    render(<DebtStatusBadge status="overdue" />);
    expect(screen.getByText("Vencida")).toBeInTheDocument();
    render(<DebtStatusBadge status="due_soon" />);
    expect(screen.getByText("Vence em breve")).toBeInTheDocument();
    render(<DebtStatusBadge status="paid" />);
    expect(screen.getByText("Quitada")).toBeInTheDocument();
  });
});

describe("InvoiceStatusBadge", () => {
  it("exibe o rótulo correto por status", () => {
    render(<InvoiceStatusBadge status="overdue" />);
    expect(screen.getByText("Vencida")).toBeInTheDocument();
    render(<InvoiceStatusBadge status="near_due" />);
    expect(screen.getByText("Vence em breve")).toBeInTheDocument();
  });
});

