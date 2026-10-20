import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useAppUpdate } from "./use-app-update";
import * as updateCheckerService from "@/services/native/update-checker";

vi.mock("@/services/native/update-checker", () => ({
  checkAppUpdate: vi.fn(),
  triggerAppUpdate: vi.fn(),
}));

describe("useAppUpdate hook", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("inicializa com estado idle", () => {
    const { result } = renderHook(() => useAppUpdate({ autoCheck: false }));
    expect(result.current.status).toBe("idle");
    expect(result.current.isChecking).toBe(false);
    expect(result.current.hasUpdate).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("atualiza para available quando checkAppUpdate encontra versão superior", async () => {
    vi.mocked(updateCheckerService.checkAppUpdate).mockResolvedValue({
      hasUpdate: true,
      isMandatory: false,
      currentVersion: "1.0.0",
      currentVersionCode: 1,
      latestVersion: "1.1.0",
      latestVersionCode: 2,
      manifest: {
        version: "1.1.0",
        versionCode: 2,
        releaseDate: "2026-10-20T16:00:00Z",
        apkUrl: "/releases/axis-pro.apk",
        changelog: ["Novidades"],
      },
    });

    const { result } = renderHook(() => useAppUpdate({ autoCheck: false }));

    await act(async () => {
      await result.current.checkForUpdates();
    });

    expect(result.current.status).toBe("available");
    expect(result.current.hasUpdate).toBe(true);
    expect(result.current.updateInfo?.latestVersion).toBe("1.1.0");
  });

  it("atualiza para up-to-date quando não há versão nova", async () => {
    vi.mocked(updateCheckerService.checkAppUpdate).mockResolvedValue({
      hasUpdate: false,
      isMandatory: false,
      currentVersion: "1.0.0",
      currentVersionCode: 1,
    });

    const { result } = renderHook(() => useAppUpdate({ autoCheck: false }));

    await act(async () => {
      await result.current.checkForUpdates();
    });

    expect(result.current.status).toBe("up-to-date");
    expect(result.current.hasUpdate).toBe(false);
  });

  it("dispara triggerAppUpdate ao invocar installUpdate", async () => {
    const manifest = {
      version: "1.1.0",
      versionCode: 2,
      releaseDate: "2026-10-20T16:00:00Z",
      apkUrl: "/releases/axis-pro.apk",
      changelog: [],
    };

    vi.mocked(updateCheckerService.checkAppUpdate).mockResolvedValue({
      hasUpdate: true,
      isMandatory: false,
      currentVersion: "1.0.0",
      currentVersionCode: 1,
      manifest,
    });

    const { result } = renderHook(() => useAppUpdate({ autoCheck: false }));

    await act(async () => {
      await result.current.checkForUpdates();
    });

    await act(async () => {
      await result.current.installUpdate();
    });

    expect(updateCheckerService.triggerAppUpdate).toHaveBeenCalledWith(manifest);
    expect(result.current.status).toBe("ready");
  });
});
