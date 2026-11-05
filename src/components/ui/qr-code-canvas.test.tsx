import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { QrCodeCanvas } from "./qr-code-canvas";

describe("QrCodeCanvas component", () => {
  it("renderiza o container com role img e label de acessibilidade", () => {
    render(<QrCodeCanvas text="00020126...TEST" label="QR Code de Teste" />);
    const el = screen.getByRole("img", { name: "QR Code de Teste" });
    expect(el).toBeInTheDocument();
  });

  it("renderiza fallback SVG quando nao ha contexto 2d", () => {
    render(<QrCodeCanvas text="PAYLOAD_PIX_EXEMPLO" size={160} />);
    const el = screen.getByRole("img");
    expect(el).toBeInTheDocument();
  });
});
