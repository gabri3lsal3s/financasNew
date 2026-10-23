export interface ChartPoint {
  x: number;
  y: number;
}

/**
 * Calcula o comando SVG path usando interpolação Spline Cúbica Monótona (Fritsch-Carlson).
 * Garante que a curva seja estritamente monótona entre pontos adjacentes, eliminando
 * completamente o overshoot (efeito Runge) que faz o traço mergulhar abaixo do baseline zero.
 */
export function toMonotoneCubicPath(points: readonly ChartPoint[], clampBaselineY?: number): string {
  const n = points.length;
  if (n === 0) return "";
  if (n === 1) return `M ${points[0]!.x.toFixed(1)} ${points[0]!.y.toFixed(1)}`;
  if (n === 2) {
    return `M ${points[0]!.x.toFixed(1)} ${points[0]!.y.toFixed(1)} L ${points[1]!.x.toFixed(1)} ${points[1]!.y.toFixed(1)}`;
  }

  // 1. Calcula os deltas das secantes: Δk = (y_{k+1} - y_k) / (x_{k+1} - x_k)
  const deltas: number[] = [];
  const dxs: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    const dx = points[i + 1]!.x - points[i]!.x;
    const dy = points[i + 1]!.y - points[i]!.y;
    dxs.push(dx);
    deltas.push(dx !== 0 ? dy / dx : 0);
  }

  // 2. Inicializa as tangentes m_k
  const m: number[] = new Array(n).fill(0);
  m[0] = deltas[0]!;
  for (let i = 1; i < n - 1; i++) {
    if (deltas[i - 1]! * deltas[i]! <= 0) {
      m[i] = 0;
    } else {
      m[i] = (deltas[i - 1]! + deltas[i]!) / 2;
    }
  }
  m[n - 1] = deltas[n - 2]!;

  // 3. Aplica restrições de Fritsch-Carlson para garantir monotonicidade estrita
  for (let i = 0; i < n - 1; i++) {
    const delta = deltas[i]!;
    if (delta === 0) {
      m[i] = 0;
      m[i + 1] = 0;
    } else {
      const alpha = m[i]! / delta;
      const beta = m[i + 1]! / delta;
      if (alpha < 0) m[i] = 0;
      if (beta < 0) m[i + 1] = 0;
      const hyp = alpha * alpha + beta * beta;
      if (hyp > 9) {
        const tau = 3 / Math.sqrt(hyp);
        m[i] = tau * alpha * delta;
        m[i + 1] = tau * beta * delta;
      }
    }
  }

  // 4. Converte tangentes Hermite para pontos de controle Bézier cúbicos
  let path = `M ${points[0]!.x.toFixed(1)} ${points[0]!.y.toFixed(1)}`;
  for (let i = 0; i < n - 1; i++) {
    const p1 = points[i]!;
    const p2 = points[i + 1]!;
    const dx = dxs[i]!;
    const thirdDx = dx / 3;

    const cp1x = p1.x + thirdDx;
    let cp1y = p1.y + m[i]! * thirdDx;
    const cp2x = p2.x - thirdDx;
    let cp2y = p2.y - m[i + 1]! * thirdDx;

    if (clampBaselineY !== undefined) {
      cp1y = Math.min(cp1y, clampBaselineY);
      cp2y = Math.min(cp2y, clampBaselineY);
    }

    path += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
  }

  return path;
}

/** Converte a série em área fechada ancorada na linha base. */
export function toAreaPath(points: readonly ChartPoint[], linePath: string, baselineY: number): string {
  if (points.length < 2 || !linePath) return "";
  const first = points[0]!;
  const last = points[points.length - 1]!;
  return `${linePath} L ${last.x.toFixed(1)} ${baselineY.toFixed(1)} L ${first.x.toFixed(1)} ${baselineY.toFixed(1)} Z`;
}
