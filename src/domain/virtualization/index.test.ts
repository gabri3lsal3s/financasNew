import { describe, expect, it } from "vitest";
import { computeVirtualWindow, isEmptyWindow } from "./index";

const base = { total: 100, scrollTop: 0, viewportHeight: 400, itemHeight: 40 };

describe("computeVirtualWindow — janela de renderização (F5.5)", () => {
  it("no topo renderiza do início com overscan", () => {
    const window = computeVirtualWindow({ ...base, overscan: 2 });
    // visíveis: 0..10 + 2 de overscan inferior
    expect(window.start).toBe(0);
    expect(window.end).toBe(12);
    expect(window.offsetY).toBe(0);
    expect(window.totalHeight).toBe(4000);
  });

  it("rolagem intermediária desloca o bloco e mantém overscan", () => {
    const window = computeVirtualWindow({ ...base, scrollTop: 400, overscan: 2 });
    expect(window.start).toBe(8);
    expect(window.end).toBe(22);
    expect(window.offsetY).toBe(320);
  });

  it("fim da lista não ultrapassa o total", () => {
    const window = computeVirtualWindow({ ...base, scrollTop: 4000, overscan: 2 });
    expect(window.start).toBe(98);
    expect(window.end).toBe(100);
  });

  it("overscan padrão de 4 linhas", () => {
    const window = computeVirtualWindow(base);
    expect(window.end - window.start).toBe(14); // 10 visíveis + 4 overscan
  });

  it("lista vazia ou dimensões inválidas → janela nula", () => {
    expect(isEmptyWindow({ ...base, total: 0 })).toBe(true);
    expect(isEmptyWindow({ ...base, viewportHeight: 0 })).toBe(true);
    expect(isEmptyWindow({ ...base, itemHeight: 0 })).toBe(true);
    const empty = computeVirtualWindow({ ...base, total: 0 });
    expect(empty).toEqual({ start: 0, end: 0, totalHeight: 0, offsetY: 0 });
  });
});
