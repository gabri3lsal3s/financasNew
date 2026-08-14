import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { Accordion } from "./accordion";

const items = [
  { value: "a", title: "Como funciona?", content: <p>Explicação A</p> },
  { value: "b", title: "Quanto custa?", content: <p>Explicação B</p> },
];

describe("Accordion", () => {
  it("expande e mostra o conteúdo ao clicar", async () => {
    const user = userEvent.setup();
    render(<Accordion items={items} />);

    expect(screen.queryByText("Explicação A")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Como funciona?" }));
    expect(screen.getByText("Explicação A")).toBeInTheDocument();
  });

  it("permite múltiplos itens abertos no tipo multiple", async () => {
    const user = userEvent.setup();
    render(<Accordion items={items} type="multiple" />);

    await user.click(screen.getByRole("button", { name: "Como funciona?" }));
    await user.click(screen.getByRole("button", { name: "Quanto custa?" }));
    expect(screen.getByText("Explicação A")).toBeInTheDocument();
    expect(screen.getByText("Explicação B")).toBeInTheDocument();
  });
});
