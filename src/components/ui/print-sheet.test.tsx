import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PrintSheet } from "./print-sheet";

describe("PrintSheet (F22 evolução — portal de impressão multi-página)", () => {
  it("porta o documento para o body com a classe print-sheet quando aberto", () => {
    render(
      <PrintSheet open>
        <div data-testid="doc">Documento do fechamento</div>
      </PrintSheet>,
    );

    // O conteúdo vive num portal irmão do app (document.body), não no container.
    const sheet = document.body.querySelector(".print-sheet");
    expect(sheet).not.toBeNull();
    expect(sheet).toContainElement(screen.getByTestId("doc"));
    expect(sheet?.getAttribute("aria-hidden")).toBe("true");
  });

  it("não renderiza nada quando fechado", () => {
    render(
      <PrintSheet open={false}>
        <div>Documento</div>
      </PrintSheet>,
    );
    expect(document.body.querySelector(".print-sheet")).toBeNull();
  });
});
