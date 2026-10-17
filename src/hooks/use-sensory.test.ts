import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useSensory } from "./use-sensory";
import * as sensoryModule from "@/services/sensory";

describe("useSensory (Fase 6 — Microinterações Sensoriais)", () => {
  it("fornece todos os métodos despachantes semânticos", () => {
    const { result } = renderHook(() => useSensory());

    expect(typeof result.current.trigger).toBe("function");
    expect(typeof result.current.selection).toBe("function");
    expect(typeof result.current.action).toBe("function");
    expect(typeof result.current.toggle).toBe("function");
    expect(typeof result.current.success).toBe("function");
    expect(typeof result.current.warning).toBe("function");
    expect(typeof result.current.destructive).toBe("function");
    expect(typeof result.current.error).toBe("function");
  });

  it("preserva estabilidade referencial entre renders sucessivos", () => {
    const { result, rerender } = renderHook(() => useSensory());
    const firstInstance = result.current;

    rerender();
    expect(result.current).toBe(firstInstance);
  });

  it("despacha as intenções semânticas correspondentes para triggerSensory", () => {
    const spy = vi.spyOn(sensoryModule, "triggerSensory").mockImplementation(() => {});

    const { result } = renderHook(() => useSensory());

    result.current.selection();
    expect(spy).toHaveBeenCalledWith("selection", undefined);

    result.current.action({ skipSound: true });
    expect(spy).toHaveBeenCalledWith("action", { skipSound: true });

    result.current.toggle();
    expect(spy).toHaveBeenCalledWith("toggle", undefined);

    result.current.success();
    expect(spy).toHaveBeenCalledWith("success", undefined);

    result.current.warning();
    expect(spy).toHaveBeenCalledWith("warning", undefined);

    result.current.destructive();
    expect(spy).toHaveBeenCalledWith("destructive", undefined);

    result.current.error();
    expect(spy).toHaveBeenCalledWith("error", undefined);

    result.current.trigger("selection", { skipHaptic: true });
    expect(spy).toHaveBeenCalledWith("selection", { skipHaptic: true });

    spy.mockRestore();
  });
});
