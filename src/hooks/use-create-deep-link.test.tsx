import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useCreateDeepLink } from "./use-create-deep-link";

const setSearchParamsMock = vi.fn();
let params = new URLSearchParams();

vi.mock("react-router", () => ({
  useSearchParams: () => [params, setSearchParamsMock],
}));

beforeEach(() => {
  params = new URLSearchParams();
  setSearchParamsMock.mockReset();
});

describe("useCreateDeepLink (F12 — FAB contextual)", () => {
  it("fecha por padrão sem o parâmetro na URL", () => {
    const { result } = renderHook(() => useCreateDeepLink("cartao"));
    expect(result.current.open).toBe(false);
    expect(result.current.fromUrl).toBe(false);
  });

  it("abre quando o parâmetro ?novo=<key> está presente (estado derivado da URL)", () => {
    params.set("novo", "cartao");
    const { result } = renderHook(() => useCreateDeepLink("cartao"));
    expect(result.current.open).toBe(true);
    expect(result.current.fromUrl).toBe(true);
  });

  it("ignora parâmetro com chave diferente (ex.: ?novo=divida em outra página)", () => {
    params.set("novo", "divida");
    const { result } = renderHook(() => useCreateDeepLink("cartao"));
    expect(result.current.open).toBe(false);
  });

  it("abre e fecha pelo estado local (botão da página) sem tocar na URL", () => {
    const { result } = renderHook(() => useCreateDeepLink("cartao"));

    act(() => result.current.setOpen(true));
    expect(result.current.open).toBe(true);

    act(() => result.current.setOpen(false));
    expect(result.current.open).toBe(false);
    expect(setSearchParamsMock).not.toHaveBeenCalled();
  });

  it("fechar um diálogo aberto por deep-link limpa o parâmetro (replace)", () => {
    params.set("novo", "cartao");
    const { result } = renderHook(() => useCreateDeepLink("cartao"));
    expect(result.current.open).toBe(true);

    act(() => result.current.setOpen(false));
    expect(setSearchParamsMock).toHaveBeenCalledTimes(1);
    const updater = setSearchParamsMock.mock.calls[0]?.[0];
    const next = typeof updater === "function" ? updater(new URLSearchParams("novo=cartao")) : undefined;
    expect(next?.get("novo")).toBeNull();
  });
});
