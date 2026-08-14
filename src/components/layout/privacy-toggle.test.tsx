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

  it("aplica a máscara GLOBAL no <html> (data-privacy=masked) — não só nos KPIs", async () => {
    const user = userEvent.setup();
    render(<PrivacyToggle />);

    expect(document.documentElement.dataset.privacy).toBe("");

    await user.click(screen.getByRole("button", { name: "Ocultar valores (P)" }));
    expect(document.documentElement.dataset.privacy).toBe("masked");

    await user.click(screen.getByRole("button", { name: "Mostrar valores (P)" }));
    expect(document.documentElement.dataset.privacy).toBe("");
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
