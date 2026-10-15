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
    const content = screen.getByText("Conteúdo do Popover").parentElement;
    expect(content).toBeInTheDocument();
    expect(content?.className).toContain("z-dropdown");
  });

  it("aplica z-floating-tools quando elevated=true", async () => {
    const user = userEvent.setup();
    render(
      <Popover>
        <PopoverTrigger asChild>
          <button type="button">Abrir Popover Elevado</button>
        </PopoverTrigger>
        <PopoverContent elevated>
          <div>Conteúdo Elevado</div>
        </PopoverContent>
      </Popover>,
    );

    await user.click(screen.getByRole("button", { name: "Abrir Popover Elevado" }));
    const content = screen.getByText("Conteúdo Elevado").parentElement;
    expect(content?.className).toContain("z-floating-tools");
  });
});

