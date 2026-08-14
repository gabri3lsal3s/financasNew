import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Checkbox } from "./checkbox";

describe("Checkbox", () => {
  it("renderiza com label e estado inicial", () => {
    render(<Checkbox checked={false} onCheckedChange={vi.fn()} label="Fixar lançamento" />);
    expect(screen.getByRole("checkbox")).not.toBeChecked();
    expect(screen.getByText("Fixar lançamento")).toBeInTheDocument();
  });

  it("notifica o toggle ao clicar", async () => {
    const user = userEvent.setup();
    const onCheckedChange = vi.fn();
    render(<Checkbox checked={false} onCheckedChange={onCheckedChange} />);

    await user.click(screen.getByRole("checkbox"));
    expect(onCheckedChange).toHaveBeenCalledWith(true);
  });

  it("reflete o estado controlado marcado", () => {
    render(<Checkbox checked onCheckedChange={vi.fn()} />);
    expect(screen.getByRole("checkbox")).toBeChecked();
  });
});
