import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { PrivacyToggle } from "./privacy-toggle";
import { setPrivacyMasked } from "@/hooks/use-privacy-mask";

beforeEach(() => {
  setPrivacyMasked(false);
});

afterEach(() => {
  setPrivacyMasked(false);
});

describe("PrivacyToggle (F8 — Decisão 5)", () => {
  it("alterna a máscara pelo clique e reflete no aria-pressed", async () => {
    const user = userEvent.setup();
    render(<PrivacyToggle />);

    const button = screen.getByRole("button", { name: "Ocultar valores (P)" });
    expect(button).toHaveAttribute("aria-pressed", "false");

    await user.click(button);
    expect(screen.getByRole("button", { name: "Mostrar valores (P)" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("o atalho de teclado P alterna a máscara (fora de campos de texto)", async () => {
    const user = userEvent.setup();
    render(<PrivacyToggle />);

    await user.keyboard("p");
    expect(screen.getByRole("button", { name: "Mostrar valores (P)" })).toBeInTheDocument();

    await user.keyboard("p");
    expect(screen.getByRole("button", { name: "Ocultar valores (P)" })).toBeInTheDocument();
  });
});
