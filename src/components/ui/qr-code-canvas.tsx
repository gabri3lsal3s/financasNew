import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { generateQrCodeMatrix } from "@/domain/pix/qr-code";

export interface QrCodeCanvasProps {
  /** Texto a ser codificado no QR Code (ex.: Pix Copia e Cola, URL) */
  text: string;
  /** Tamanho visual do conteiner em pixels (largura e altura). Padrao: 200 */
  size?: number;
  /** Margem de respiro em modulos do QR code (ISO/IEC 18004 exige >= 4). Padrao: 4 */
  margin?: number;
  /** Escala interna legada (mantida por compatibilidade de API). */
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

/**
 * Renderizador vetorial SVG de QR Code nítido em qualquer densidade de tela (Retina/OLED),
 * com zona de silêncio padrão ISO (4 módulos) para leitura imediata em apps bancários.
 */
export function QrCodeCanvas({
  text,
  size = 200,
  margin = 4,
  darkColor = "#000000",
  lightColor = "#ffffff",
  className,
  label = "Codigo QR Pix para pagamento",
}: QrCodeCanvasProps) {
  const vector = useMemo(() => {
    const trimmed = text.trim();
    if (!trimmed) return null;
    try {
      const matrix = generateQrCodeMatrix(trimmed, { ecc: "M", border: 0 });
      const modules = matrix.length;
      if (modules === 0) return null;
      const safeMargin = Math.max(0, Math.floor(margin));
      const total = modules + safeMargin * 2;
      const segments: string[] = [];
      for (let y = 0; y < modules; y++) {
        const row = matrix[y];
        if (!row) continue;
        for (let x = 0; x < modules; x++) {
          if (row[x]) {
            segments.push(`M${x + safeMargin},${y + safeMargin}h1v1h-1z`);
          }
        }
      }
      return { total, pathData: segments.join("") };
    } catch {
      return null;
    }
  }, [text, margin]);

  if (!vector) {
    return null;
  }

  return (
    <div
      role="img"
      aria-label={label}
      className={cn(
        "inline-flex items-center justify-center rounded-xl bg-white p-2 shadow-xs border border-border/80 overflow-hidden",
        className,
      )}
      style={{ width: size, height: size }}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox={`0 0 ${vector.total} ${vector.total}`}
        shapeRendering="crispEdges"
        className="size-full block"
        aria-hidden="true"
      >
        <rect width={vector.total} height={vector.total} fill={lightColor} />
        <path d={vector.pathData} fill={darkColor} />
      </svg>
    </div>
  );
}
