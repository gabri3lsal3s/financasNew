import { Haptics, ImpactStyle, NotificationType } from "@capacitor/haptics";
import { isNativePlatform } from "./platform";

export type NativeHapticPattern =
  | "light"
  | "medium"
  | "success"
  | "warning"
  | "destructive"
  | "error";

/**
 * Dispara resposta háptica nativa refinada via @capacitor/haptics.
 * Em Web/PWA, retorna false para acionar o fallback gracioso de navigator.vibrate.
 */
export async function triggerNativeHaptic(
  pattern: NativeHapticPattern = "light",
): Promise<boolean> {
  if (!isNativePlatform()) return false;

  try {
    switch (pattern) {
      case "light":
        await Haptics.impact({ style: ImpactStyle.Light });
        return true;
      case "medium":
        await Haptics.impact({ style: ImpactStyle.Medium });
        return true;
      case "success":
        await Haptics.notification({ type: NotificationType.Success });
        return true;
      case "warning":
        await Haptics.notification({ type: NotificationType.Warning });
        return true;
      case "destructive":
      case "error":
        await Haptics.notification({ type: NotificationType.Error });
        return true;
      default:
        await Haptics.impact({ style: ImpactStyle.Light });
        return true;
    }
  } catch {
    return false;
  }
}
