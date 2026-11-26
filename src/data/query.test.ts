import { describe, expect, it, vi } from "vitest";
import { readAllPages } from "./query";

const rows = Array.from({ length: 1201 }, (_, index) => ({ id: String(index).padStart(5, "0"), cents: index }));

describe("readAllPages", () => {
  it("preserva todos os registros e centavos acima do teto de 1.000", async () => {
    const fetchPage = vi.fn(async (afterId: string | null, size: number) => ({
      data: rows.filter((row) => afterId === null || row.id > afterId).slice(0, size), error: null,
    }));
    const result = await readAllPages(fetchPage);
    expect(result).toEqual(rows);
    expect(result.reduce((sum, row) => sum + row.cents, 0)).toBe(720600);
    expect(fetchPage).toHaveBeenCalledTimes(3);
  });

  it("uma exclusão em página anterior não omite registros posteriores", async () => {
    let source = [...rows];
    const result = await readAllPages(async (afterId, size) => {
      if (afterId) source = source.filter((row) => row.id !== "00000");
      return { data: source.filter((row) => afterId === null || row.id > afterId).slice(0, size), error: null };
    });
    expect(result.map((row) => row.id)).toEqual(rows.map((row) => row.id));
  });

  it("cancela entre páginas sem publicar um histórico parcial", async () => {
    const controller = new AbortController();
    const fetchPage = vi.fn(async () => {
      controller.abort();
      return { data: rows.slice(0, 500), error: null };
    });
    await expect(readAllPages(fetchPage, controller.signal)).rejects.toMatchObject({ name: "AbortError" });
    expect(fetchPage).toHaveBeenCalledTimes(1);
  });

  it("propaga a falha de uma página posterior", async () => {
    const error = {
      name: "PostgrestError",
      code: "XX000",
      message: "Falha de consulta",
      details: "",
      hint: "",
      toJSON: () => ({
        name: "PostgrestError",
        code: "XX000",
        message: "Falha de consulta",
        details: "",
        hint: "",
      }),
    };
    await expect(readAllPages(async (afterId) => afterId
      ? { data: null, error }
      : { data: rows.slice(0, 500), error: null },
    )).rejects.toThrow();
  });
});
