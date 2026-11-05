import { describe, expect, it } from "vitest";
import {
  generateQrCodeMatrix,
  renderQrCodeSvg,
  drawQrCodeToCanvas,
} from "./qr-code";

describe("qr-code domain motor", () => {
  it("gera matriz vazia para texto vazio ou espacos", () => {
    expect(generateQrCodeMatrix("")).toEqual([]);
    expect(generateQrCodeMatrix("   ")).toEqual([]);
  });

  it("gera matriz valida para texto alfanumerico", () => {
    const matrix = generateQrCodeMatrix("HELLO WORLD", { ecc: "M" });
    expect(matrix.length).toBeGreaterThan(15);
    expect(matrix[0]?.length).toBe(matrix.length);
  });

  it("gera matriz valida para payload Pix BR Code real", () => {
    const pixPayload =
      "00020126580014BR.GOV.BCB.PIX0114+5511999999999520400005303986540510.505802BR5910FULANO SIL6009SAO PAULO62170513RACHAA1B2C3D46304ABCD";
    const matrix = generateQrCodeMatrix(pixPayload, { ecc: "M" });
    expect(matrix.length).toBeGreaterThanOrEqual(30);
    expect(matrix[0]?.length).toBe(matrix.length);
  });

  it("gera SVG valido para renderizacao vetorial", () => {
    const svg = renderQrCodeSvg("TEST_PIX", { ecc: "L" });
    expect(svg).toContain("<svg");
    expect(svg).toContain("</svg>");
    expect(renderQrCodeSvg("")).toBe("");
  });

  it("permite desenhar no canvas simulado sem excecoes", () => {
    const mockCtx = {
      fillStyle: "",
      fillRect: () => {},
    };
    const mockCanvas = {
      getContext: () => mockCtx,
      width: 0,
      height: 0,
    } as unknown as HTMLCanvasElement;

    expect(() => {
      drawQrCodeToCanvas(mockCanvas, "PIX_PAYLOAD_TEST", { scale: 5, margin: 4 });
    }).not.toThrow();

    expect(mockCanvas.width).toBeGreaterThan(0);
    expect(mockCanvas.height).toBe(mockCanvas.width);
  });
});
