import { describe, it, expect, vi, beforeEach } from "vitest";
import { resetAppState } from "./auth-cleanup";
import { QueryClient } from "@tanstack/react-query";
import { setPrivacyMasked, getPrivacyMasked } from "@/hooks/use-privacy-mask";
import { updateVisualCustomization, getVisualCustomization } from "@/hooks/use-visual-customization";
import { setDensity, getDensity } from "@/hooks/use-density";
import { getActiveUserId, setActiveUserId, setUserStorageItem } from "@/services/user-storage";

describe("auth-cleanup", () => {
  beforeEach(() => {
    window.localStorage.clear();
    setActiveUserId("user-before");
    setPrivacyMasked(false);
  });

  it("reseta cache do queryClient, stores em memória e atributos do DOM", () => {
    const queryClient = new QueryClient();
    const cancelSpy = vi.spyOn(queryClient, "cancelQueries");
    const clearSpy = vi.spyOn(queryClient, "clear");

    // Modifica estados de UI
    setPrivacyMasked(true);
    expect(document.documentElement.dataset.privacy).toBe("masked");
    expect(getPrivacyMasked()).toBe(true);

    updateVisualCustomization({ accent: "rose", surfaceStyle: "flat", motionLevel: "reduced" });
    expect(document.documentElement.getAttribute("data-accent")).toBe("rose");
    expect(document.documentElement.getAttribute("data-surface-style")).toBe("flat");
    expect(document.documentElement.getAttribute("data-motion")).toBe("reduced");

    setDensity("compact");
    expect(getDensity()).toBe("compact");

    // Executa reset completo (ex: logout com nextUserId = null)
    resetAppState(queryClient, null);

    // 1. TanStack Query cancelado e limpo
    expect(cancelSpy).toHaveBeenCalled();
    expect(clearSpy).toHaveBeenCalled();

    // 2. Active User resetado
    expect(getActiveUserId()).toBeNull();

    // 3. Privacy Mask resetado
    expect(getPrivacyMasked()).toBe(false);
    expect(document.documentElement.dataset.privacy).toBeUndefined();

    // 4. Visual Customization resetado para padrões
    const visual = getVisualCustomization();
    expect(visual.accent).toBe("teal");
    expect(visual.surfaceStyle).toBe("glass");
    expect(visual.motionLevel).toBe("fluid");
    expect(document.documentElement.getAttribute("data-accent")).toBeNull();
    expect(document.documentElement.getAttribute("data-surface-style")).toBeNull();
    expect(document.documentElement.getAttribute("data-motion")).toBeNull();

    // 5. Density resetada
    expect(getDensity()).toBe("comfortable");
  });

  it("ao transicionar para novo usuário, carrega configurações isoladas do novo usuário", () => {
    // Configura usuário A
    setActiveUserId("user-a");
    setUserStorageItem("density", "compact", "user-a");
    setUserStorageItem("accent_theme", "gold", "user-a");

    // Configura usuário B
    setUserStorageItem("density", "comfortable", "user-b");
    setUserStorageItem("accent_theme", "violet", "user-b");

    // Estado ativo inicial: Usuário A
    setDensity("compact", "user-a");
    updateVisualCustomization({ accent: "gold" }, "user-a");
    expect(getDensity()).toBe("compact");
    expect(getVisualCustomization().accent).toBe("gold");

    // Transiciona diretamente para Usuário B
    resetAppState(undefined, "user-b");

    expect(getActiveUserId()).toBe("user-b");
    expect(getDensity()).toBe("comfortable");
    expect(getVisualCustomization().accent).toBe("violet");
    expect(document.documentElement.getAttribute("data-accent")).toBe("violet");
  });
});
