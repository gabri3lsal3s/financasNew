import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";

describe("Popover component", () => {
  it("renderiza o trigger e abre o conteúdo ao clicar", async () => {
    const user = userEvent.setup();
    render(
      <Popover>
        <PopoverTrigger asChild>
          <button type="button">Abrir Popover</button>
        </PopoverTrigger>
        <PopoverContent>
          <div>Conteúdo do Popover</div>
        </PopoverContent>
      </Popover>,
    );

    expect(screen.getByRole("button", { name: "Abrir Popover" })).toBeInTheDocument();
    expect(screen.queryByText("Conteúdo do Popover")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Abrir Popover" }));
    expect(screen.getByText("Conteúdo do Popover")).toBeInTheDocument();
  });
});
