import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { QrCodeCanvas } from "./qr-code-canvas";

describe("QrCodeCanvas component", () => {
  it("renderiza SVG vetorial nítido com role img e label de acessibilidade", () => {
    const { container } = render(<QrCodeCanvas text="00020126...TEST" label="QR Code de Teste" />);
    const el = screen.getByRole("img", { name: "QR Code de Teste" });
    expect(el).toBeInTheDocument();

    const svg = container.querySelector("svg");
    expect(svg).not.toBeNull();
    expect(svg?.getAttribute("viewBox")).toMatch(/^0 0 \d+ \d+$/);
    expect(container.querySelector("path")?.getAttribute("d")).toBeTruthy();
  });

  it("aplica zona de silêncio padrão ISO de 4 módulos ao redor da matriz", () => {
    const { container } = render(<QrCodeCanvas text="PAYLOAD_PIX_EXEMPLO" size={160} />);
    const svg = container.querySelector("svg");
    const viewBox = svg?.getAttribute("viewBox") ?? "";
    const total = Number(viewBox.split(" ")[2]);
    // Matriz QR versão >= 1 tem >= 21 módulos + 8 módulos (4 de cada lado) >= 29
    expect(total).toBeGreaterThanOrEqual(29);
  });

  it("retorna null quando texto for vazio", () => {
    const { container } = render(<QrCodeCanvas text="   " />);
    expect(container.firstChild).toBeNull();
  });
});
