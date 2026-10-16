import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import * as appIconModule from "@/services/native/app-icon";
import { useDynamicAppIcon } from "./use-dynamic-app-icon";

describe("useDynamicAppIcon Hook", () => {
  it("chama setNativeAppIcon com true quando isPro for true", () => {
    const spy = vi.spyOn(appIconModule, "setNativeAppIcon").mockResolvedValue(true);
    renderHook(() => useDynamicAppIcon(true));
    expect(spy).toHaveBeenCalledWith(true);
  });

  it("chama setNativeAppIcon com false quando isPro for false", () => {
    const spy = vi.spyOn(appIconModule, "setNativeAppIcon").mockResolvedValue(true);
    renderHook(() => useDynamicAppIcon(false));
    expect(spy).toHaveBeenCalledWith(false);
  });

  it("reage dinamicamente quando o status de isPro é alterado", () => {
    const spy = vi.spyOn(appIconModule, "setNativeAppIcon").mockResolvedValue(true);
    const { rerender } = renderHook(({ pro }) => useDynamicAppIcon(pro), {
      initialProps: { pro: false },
    });

    expect(spy).toHaveBeenCalledWith(false);

    rerender({ pro: true });
    expect(spy).toHaveBeenCalledWith(true);
  });
});
