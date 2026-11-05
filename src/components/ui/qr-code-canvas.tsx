import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { drawQrCodeToCanvas, renderQrCodeSvg } from "@/domain/pix";

export interface QrCodeCanvasProps {
  /** Texto a ser codificado no QR Code (ex.: Pix Copia e Cola, URL) */
  text: string;
  /** Tamanho visual do conteiner em pixels (largura e altura). Padrao: 180 */
  size?: number;
  /** Margem de respiro em modulos do QR code. Padrao: 2 */
  margin?: number;
  /** Escala interna de renderizacao do canvas para nitidez em telas de alta densidade. Padrao: 4 */
  scale?: number;
  /** Cor dos modulos escuros. Padrao: #000000 */
  darkColor?: string;
  /** Cor de fundo. Padrao: #ffffff */
  lightColor?: string;
  /** Classes CSS adicionais */
  className?: string;
  /** Texto de acessibilidade aria-label */
  label?: string;
}

export function QrCodeCanvas({
  text,
  size = 180,
  margin = 2,
  scale = 4,
  darkColor = "#000000",
  lightColor = "#ffffff",
  className,
  label = "Codigo QR Pix para pagamento",
}: QrCodeCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!text || !canvas) return;
    try {
      drawQrCodeToCanvas(canvas, text, {
        scale,
        margin,
        darkColor,
        lightColor,
      });
    } catch {
      // Ignora erro em ambientes sem suporte nativo a contexto 2D (ex: jsdom)
    }
  }, [text, scale, margin, darkColor, lightColor]);

  const svgFallback = renderQrCodeSvg(text, {
    border: margin,
    blackColor: darkColor,
    whiteColor: lightColor,
  });

  return (
    <div
      role="img"
      aria-label={label}
      className={cn(
        "inline-flex items-center justify-center rounded-xl bg-white p-2 shadow-xs border border-border/60 overflow-hidden",
        className,
      )}
      style={{ width: size, height: size }}
    >
      <canvas
        ref={canvasRef}
        className="size-full object-contain"
        width={size}
        height={size}
        aria-hidden="true"
      >
        <span dangerouslySetInnerHTML={{ __html: svgFallback }} />
      </canvas>
    </div>
  );
}
