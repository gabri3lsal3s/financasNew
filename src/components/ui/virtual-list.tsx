import { useState } from "react";
import type { CSSProperties, ReactNode, UIEvent } from "react";
import { computeVirtualWindow } from "@/domain/virtualization";
import { cn } from "@/lib/utils";

export interface VirtualListProps<T> {
  rows: T[];
  /** Chave estável de cada linha. */
  rowKey: (row: T, index: number) => string;
  /** Altura fixa de cada linha (px). */
  itemHeight: number;
  /** Renderizador da linha (recebe row + index). */
  renderRow: (row: T, index: number) => ReactNode;
  /** Linhas extras acima/abaixo do visível. */
  overscan?: number;
  /** Acima deste total renderiza tudo direto (sem janela) — default 60. */
  plainThreshold?: number;
  /** Altura máxima do contêiner com scroll. */
  maxHeight?: number | string;
  /**
   * Altura visível inicial/fallback (px) — usada antes do primeiro scroll
   * (jsdom/SSR não medem layout). O scroll real atualiza a medição.
   */
  fallbackViewportHeight?: number;
  /**
   * Use `key` (ex.: key={month}) para remontar a lista ao trocar os dados —
   * zera a rolagem sem efeitos (as regras React Compiler do lint bloqueiam
   * setState em effect/render).
   */
  className?: string;
  "aria-label"?: string;
}

/**
 * Lista virtualizada (F5.5) — renderiza apenas a janela visível + overscan
 * com espaçadores. Regras:
 * - Lista pequena (<= plainThreshold): renderiza tudo num contêiner simples
 *   — comportamento idêntico ao mapa cru (sem custo de janela);
 * - A medição da altura vem do evento de scroll (sem acesso a ref durante
 *   o render — compatível com as regras React Compiler do lint);
 * - Linhas com altura FIXA (`itemHeight`) — listas virtuais exigem uniformidade;
 * - Acessível: os itens continuam no DOM (sem display:none), preservando
 *   navegação por teclado e leitores de tela.
 */
export function VirtualList<T>({
  rows,
  rowKey,
  itemHeight,
  renderRow,
  overscan,
  plainThreshold = 60,
  maxHeight = 480,
  fallbackViewportHeight = 320,
  className,
  ...rest
}: VirtualListProps<T>) {
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(fallbackViewportHeight);

  const plain = rows.length <= plainThreshold;

  const handleScroll = (event: UIEvent<HTMLDivElement>) => {
    setScrollTop(event.currentTarget.scrollTop);
    const measured = event.currentTarget.clientHeight;
    if (measured > 0 && measured !== viewportHeight) {
      setViewportHeight(measured);
    }
  };

  if (plain) {
    return (
      <div className={cn("flex flex-col", className)} aria-label={rest["aria-label"]}>
        {rows.map((row, index) => (
          <div key={rowKey(row, index)}>{renderRow(row, index)}</div>
        ))}
      </div>
    );
  }

  const window = computeVirtualWindow({
    total: rows.length,
    scrollTop,
    viewportHeight,
    itemHeight,
    overscan,
  });

  const visibleRows = rows.slice(window.start, window.end);
  const innerStyle: CSSProperties = {
    height: window.totalHeight,
    position: "relative",
  };
  const blockStyle: CSSProperties = {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    transform: `translateY(${window.offsetY}px)`,
  };

  return (
    <div
      role="list"
      aria-label={rest["aria-label"]}
      onScroll={handleScroll}
      className={cn("overflow-y-auto", className)}
      style={{ maxHeight }}
    >
      <div style={innerStyle}>
        <div style={blockStyle}>
          {visibleRows.map((row, index) => (
            <div key={rowKey(row, window.start + index)} style={{ height: itemHeight }}>
              {renderRow(row, window.start + index)}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
